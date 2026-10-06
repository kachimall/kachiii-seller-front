import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export const recoveryCodeSchema = z.object({
  recovery_code: z.string().trim().min(1, "Enter one of your recovery codes."),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type RecoveryCodeValues = z.infer<typeof recoveryCodeSchema>;
