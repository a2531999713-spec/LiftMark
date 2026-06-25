import { create } from 'zustand';

import { deriveAuthMode, type AuthMode, type MembershipTier } from '@/domain/auth';
import { createAuthService } from '@/services/auth/authService';
import type {
  AuthSession,
  AuthStatus,
  AuthUser,
  CodeLoginInput,
  LoginInput,
  RegisterInput,
  SendCodeResult,
  SendCodeInput,
} from '@/services/auth/authTypes';
import { getMembership, type Membership } from '@/services/membershipService';

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

  if (session.isOffline) {
    return {
      authStatus: 'offline_authenticated' as const,
      authMode: 'logged_in_free' as const,
      isLoggedIn: true,
      membership: null,
      membershipTier: 'free' as const,
      user: session.user,
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
    user: session.user,
  };
}

export const useAuthStore = create<AuthStore>((set) => ({
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
      set(await resolveSessionState(session));
    } catch (error) {
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
        authStatus: state.authStatus === 'offline_authenticated'
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

      set({
        ...(await resolveSessionState(result.session)),
        hasSeenSyncPrompt: false,
      });
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

      set({
        ...(await resolveSessionState(result.session)),
        hasSeenSyncPrompt: false,
      });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  async logout() {
    set({ error: null, isLoading: true });
    try {
      await authService.logout();
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

      set({
        ...(await resolveSessionState(result.session)),
        hasSeenSyncPrompt: false,
      });
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
        message: result.debugCode ? `验证码已发送。开发模式验证码：${result.debugCode}` : result.message,
      };
    } finally {
      set({ isLoading: false });
    }
  },
}));
