import { create } from 'zustand';

import { deriveAuthMode, type AuthMode, type MembershipTier } from '@/domain/auth';
import { getAccountProfileCache, updateAccountProfileCacheDisplayName } from '@/services/avatar';
import { createAuthService } from '@/services/auth/authService';
import type {
  AuthSession,
  AuthStatus,
  AuthUser,
  CodeLoginInput,
  LoginInput,
  RegisterInput,
  SendCodeInput,
  SendCodeResult,
} from '@/services/auth/authTypes';
import { readStoredSession, saveStoredSession } from '@/services/auth/tokenStorage';
import { getMembership, type Membership } from '@/services/membershipService';
import { repairLocalDataOwnership } from '@/services/ownershipRepairService';
import { sync } from '@/sync/syncOrchestrator';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';

type AuthStore = {
  authMode: AuthMode;
  authStatus: AuthStatus;
  error: string | null;
  hasSeenSyncPrompt: boolean;
  isLoading: boolean;
  isLoggedIn: boolean;
  loadMembership: () => Promise<void>;
  loginWithCode: (input: CodeLoginInput) => Promise<string | null>;
  loadCurrentUser: () => Promise<void>;
  login: (input: LoginInput) => Promise<string | null>;
  logout: () => Promise<void>;
  markSyncPromptSeen: () => void;
  membership: Membership | null;
  membershipTier: MembershipTier;
  register: (input: RegisterInput) => Promise<string | null>;
  sendCode: (input: SendCodeInput) => Promise<SendCodeResult>;
  updateLocalUser: (patch: Partial<AuthUser>) => Promise<void>;
  user: AuthUser | null;
};

const authService = createAuthService();

function getMembershipTier(membership: Membership | null): MembershipTier {
  if (!membership) return 'free';
  if (membership.isLifetime || membership.type === 'lifetime') return 'lifetime';
  if (membership.type === 'pro') return 'pro';
  return 'free';
}

async function loadMembershipSafely() {
  try {
    return await getMembership();
  } catch {
    return null;
  }
}

async function resolveSessionState(session: AuthSession | null) {
  if (!session) {
    return {
      authStatus: 'unauthenticated' as const,
      authMode: 'guest_preview' as const,
      isLoggedIn: false,
      membership: null,
      membershipTier: 'free' as const,
      user: null,
    };
  }

  // server 数据优先：登录/refresh 后 /auth/me 返回的 nickname/avatar 必须覆盖本地旧缓存，
  // 防止 188 登录后仍显示 176 的缓存昵称。缓存仅在 server 未返回 displayName 时作 fallback。
  const cachedProfile = await getAccountProfileCache(session.user.id).catch(() => null);
  const cachedDisplayName = cachedProfile?.displayName?.trim();
  const serverDisplayName = session.user.displayName?.trim();
  const fallbackDisplayName = !serverDisplayName && cachedDisplayName ? cachedDisplayName : null;
  const resolvedSession = fallbackDisplayName
    ? {
        ...session,
        user: {
          ...session.user,
          displayName: fallbackDisplayName,
        },
      }
    : session;
  // server 优先时若与缓存不一致，刷新缓存
  if (serverDisplayName && serverDisplayName !== cachedDisplayName) {
    await updateAccountProfileCacheDisplayName(session.user.id, serverDisplayName).catch(() => undefined);
  }
  if (resolvedSession !== session) {
    await saveStoredSession(resolvedSession).catch(() => undefined);
  }

  if (session.isOffline) {
    return {
      authStatus: 'offline_authenticated' as const,
      authMode: 'logged_in_free' as const,
      isLoggedIn: true,
      membership: null,
      membershipTier: 'free' as const,
      user: resolvedSession.user,
    };
  }

  const membership = await loadMembershipSafely();
  const membershipTier = getMembershipTier(membership);
  return {
    authStatus: 'authenticated' as const,
    authMode: deriveAuthMode(true, membershipTier),
    isLoggedIn: true,
    membership,
    membershipTier,
    user: resolvedSession.user,
  };
}

function switchRuntimeAccountScope(userId?: string | null) {
  useSelectedGroupStore.getState().switchAccountScope(userId);
}

function recoverCurrentAccountData() {
  // 登录后只修复身份表归属 + 增量同步，不再无条件 fullPull。
  // fullPull 会重置游标全量拉取，在本地库不可信时可能放大污染，留给用户在同步页主动触发。
  repairLocalDataOwnership()
    .then(() => sync())
    .catch((error) => {
      console.warn('[auth] account data recovery failed', error instanceof Error ? error.message : error);
    });
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'checking',
  authMode: 'guest_preview',
  error: null,
  hasSeenSyncPrompt: false,
  isLoading: false,
  isLoggedIn: false,
  membership: null,
  membershipTier: 'free',
  user: null,

  async loadCurrentUser() {
    set({ error: null, isLoading: true });
    try {
      const session = await authService.getCurrentSession();
      const nextState = await resolveSessionState(session);
      switchRuntimeAccountScope(nextState.user?.id ?? null);
      set(nextState);
      // 登录态恢复后异步修复本地数据归属（不阻塞 UI）
      if (nextState.user?.id) {
        recoverCurrentAccountData();
      }
    } catch (error) {
      switchRuntimeAccountScope(null);
      set({
        authStatus: 'unauthenticated',
        authMode: 'guest_preview',
        error: error instanceof Error ? error.message : '账号状态加载失败。',
        isLoggedIn: false,
        membership: null,
        membershipTier: 'free',
        user: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  async loadMembership() {
    set({ error: null, isLoading: true });
    try {
      const membership = await loadMembershipSafely();
      const membershipTier = getMembershipTier(membership);
      set((state) => ({
        authMode: deriveAuthMode(state.isLoggedIn, membershipTier),
        authStatus:
          state.authStatus === 'offline_authenticated'
            ? 'offline_authenticated'
            : state.isLoggedIn
              ? 'authenticated'
              : 'unauthenticated',
        membership,
        membershipTier,
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  async login(input) {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.login(input);
      if (!result.ok) {
        switchRuntimeAccountScope(null);
        set({
          authStatus: 'unauthenticated',
          authMode: 'guest_preview',
          error: result.message,
          isLoggedIn: false,
          membership: null,
          membershipTier: 'free',
          user: null,
        });
        return result.message;
      }

      const nextState = await resolveSessionState(result.session);
      switchRuntimeAccountScope(nextState.user?.id ?? null);
      set({
        ...nextState,
        hasSeenSyncPrompt: false,
      });
      recoverCurrentAccountData();
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  async loginWithCode(input) {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.loginWithCode(input);
      if (!result.ok) {
        switchRuntimeAccountScope(null);
        set({
          authStatus: 'unauthenticated',
          authMode: 'guest_preview',
          error: result.message,
          isLoggedIn: false,
          membership: null,
          membershipTier: 'free',
          user: null,
        });
        return result.message;
      }

      const nextState = await resolveSessionState(result.session);
      switchRuntimeAccountScope(nextState.user?.id ?? null);
      set({
        ...nextState,
        hasSeenSyncPrompt: false,
      });
      recoverCurrentAccountData();
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  async logout() {
    set({ error: null, isLoading: true });
    try {
      await authService.logout();
      switchRuntimeAccountScope(null);
      set({
        authMode: 'guest_preview',
        authStatus: 'unauthenticated',
        isLoggedIn: false,
        membership: null,
        membershipTier: 'free',
        user: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  markSyncPromptSeen() {
    set({ hasSeenSyncPrompt: true });
  },

  async register(input) {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.register(input);
      if (!result.ok) {
        switchRuntimeAccountScope(null);
        set({
          authStatus: 'unauthenticated',
          authMode: 'guest_preview',
          error: result.message,
          isLoggedIn: false,
          membership: null,
          membershipTier: 'free',
          user: null,
        });
        return result.message;
      }

      const nextState = await resolveSessionState(result.session);
      switchRuntimeAccountScope(nextState.user?.id ?? null);
      set({
        ...nextState,
        hasSeenSyncPrompt: false,
      });
      recoverCurrentAccountData();
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  async sendCode(input) {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.sendCode(input);
      if (!result.ok) {
        set({ error: result.message });
        return result;
      }
      return {
        ok: true,
        message: result.message ?? '验证码已发送，请查看短信。',
      };
    } finally {
      set({ isLoading: false });
    }
  },

  async updateLocalUser(patch) {
    const currentUser = get().user;
    if (!currentUser) {
      return;
    }

    const nextUser = { ...currentUser, ...patch };
    const session = await readStoredSession();
    if (session) {
      await saveStoredSession({
        ...session,
        user: {
          ...session.user,
          ...patch,
        },
      });
    }
    set({ user: nextUser });
  },
}));
