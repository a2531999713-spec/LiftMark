import { create } from 'zustand';

import { createAuthService } from '@/services/auth/authService';
import type { AuthUser, CodeLoginInput, LoginInput, RegisterInput, SendCodeInput } from '@/services/auth/authTypes';

type AuthStore = {
  error: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  loginWithCode: (input: CodeLoginInput) => Promise<string | null>;
  loadCurrentUser: () => Promise<void>;
  login: (input: LoginInput) => Promise<string | null>;
  logout: () => Promise<void>;
  register: (input: RegisterInput) => Promise<string | null>;
  sendCode: (input: SendCodeInput) => Promise<string | null>;
  user: AuthUser | null;
};

const authService = createAuthService();

export const useAuthStore = create<AuthStore>((set) => ({
  error: null,
  isLoading: false,
  isLoggedIn: false,
  user: null,

  async loadCurrentUser() {
    set({ error: null, isLoading: true });
    try {
      const session = await authService.getCurrentSession();
      set({
        isLoggedIn: Boolean(session),
        user: session?.user ?? null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '账号状态加载失败。',
        isLoggedIn: false,
        user: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  async login(input) {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.login(input);
      if (!result.ok) {
        set({ error: result.message, isLoggedIn: false, user: null });
        return result.message;
      }

      set({ isLoggedIn: true, user: result.session.user });
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
        set({ error: result.message, isLoggedIn: false, user: null });
        return result.message;
      }

      set({ isLoggedIn: true, user: result.session.user });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  async logout() {
    set({ error: null, isLoading: true });
    try {
      await authService.logout();
      set({ isLoggedIn: false, user: null });
    } finally {
      set({ isLoading: false });
    }
  },

  async register(input) {
    set({ error: null, isLoading: true });
    try {
      const result = await authService.register(input);
      if (!result.ok) {
        set({ error: result.message, isLoggedIn: false, user: null });
        return result.message;
      }

      set({ isLoggedIn: true, user: result.session.user });
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
        return result.message;
      }
      return result.debugCode ? `验证码已发送。开发模式验证码：${result.debugCode}` : null;
    } finally {
      set({ isLoading: false });
    }
  },
}));
