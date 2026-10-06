import { api } from "@/lib/api/client";
import type { LoginResult, TokenResult, TwoFactorSetup, TwoFactorStatus, User } from "@/types/api";

export const DEVICE_NAME = "kachi-seller-centre";

export function login(email: string, password: string) {
  return api<LoginResult>("/auth/login", {
    method: "POST",
    body: { email, password, device_name: DEVICE_NAME },
    skipAuthHandling: true,
  });
}

export function twoFactorChallenge(challengeToken: string, answer: { code: string } | { recovery_code: string }) {
  return api<TokenResult>("/auth/two-factor/challenge", {
    method: "POST",
    body: { challenge_token: challengeToken, ...answer },
    skipAuthHandling: true,
  });
}

/** The signed-in account with its `vendor`, which the login and 2FA answers leave out. */
export const me = (token?: string) => api<User>("/auth/me", { token, skipAuthHandling: Boolean(token) });
export const refresh = () => api<{ token: string; expires_at: string }>("/auth/refresh", { method: "POST" });
export const logout = (token?: string) =>
  api<null>("/auth/logout", { method: "POST", skipAuthHandling: true, token });

export const twoFactorStatus = () => api<TwoFactorStatus>("/auth/two-factor");
export const startTwoFactor = () => api<TwoFactorSetup>("/auth/two-factor", { method: "POST" });
export const confirmTwoFactor = (code: string) =>
  api<{ recovery_codes: string[] }>("/auth/two-factor/confirm", { method: "POST", body: { code } });
export const newRecoveryCodes = (code: string) =>
  api<{ recovery_codes: string[] }>("/auth/two-factor/recovery-codes", { method: "POST", body: { code } });
export const disableTwoFactor = (code: string) => api<null>("/auth/two-factor", { method: "DELETE", query: { code } });

/** Changes the password; the API signs out every other device. */
export const changePassword = (body: { current_password: string; password: string; password_confirmation: string }) =>
  api<null>("/auth/password", { method: "PUT", body });
