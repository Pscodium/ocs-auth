import { z } from "zod";

export const registerSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43),
  code_challenge_method: z.literal("S256"),
  state: z.string().optional()
});

export const authorizeQuerySchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43),
  code_challenge_method: z.literal("S256"),
  state: z.string().optional()
});

export const tokenSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(32),
    redirect_uri: z.string().url(),
    client_id: z.string().min(1),
    code_verifier: z.string().min(43)
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(32),
    client_id: z.string().min(1)
  })
]);

export const logoutSchema = z.object({
  refresh_token: z.string().min(32),
  client_id: z.string().min(1)
});
