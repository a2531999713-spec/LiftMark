export interface VerifiedPhoneRegistrationInput {
  phone: string;
  code: string;
  password?: string;
  campaignCode?: string;
  nickname?: string;
  registrationSource?: string;
}

export async function registerVerifiedPhone<TUser, TSession>(input: VerifiedPhoneRegistrationInput, dependencies: {
  verifyCode(input: { phone: string; purpose: 'register'; code: string }): Promise<unknown>;
  createUser(input: VerifiedPhoneRegistrationInput): Promise<TUser>;
  createSession(user: TUser): Promise<TSession>;
}): Promise<TSession> {
  await dependencies.verifyCode({ phone: input.phone, purpose: 'register', code: input.code });
  const user = await dependencies.createUser(input);
  return dependencies.createSession(user);
}
