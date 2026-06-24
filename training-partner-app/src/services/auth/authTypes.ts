export type AuthUser = {
  id: string;
  liftmarkId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  role?: 'user' | 'admin';
  status?: 'normal' | 'disabled';
};

export type AuthSession = {
  accessToken: string;
  isOffline?: boolean;
  refreshToken: string;
  user: AuthUser;
};

export type LoginInput = {
  identifier: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  displayName: string;
};

export type SendCodeInput = {
  phone: string;
  purpose: 'login' | 'register' | 'reset_password';
};

export type CodeLoginInput = {
  code: string;
  phone: string;
};

export type AuthServiceResult =
  | { ok: true; session: AuthSession }
  | { ok: false; message: string };

export interface AuthService {
  getCurrentSession(): Promise<AuthSession | null>;
  loginWithCode(input: CodeLoginInput): Promise<AuthServiceResult>;
  login(input: LoginInput): Promise<AuthServiceResult>;
  logout(): Promise<void>;
  refreshToken(refreshToken?: string): Promise<AuthServiceResult>;
  register(input: RegisterInput): Promise<AuthServiceResult>;
  sendCode(input: SendCodeInput): Promise<{ debugCode?: string; ok: true } | { ok: false; message: string }>;
}
