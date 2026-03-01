import * as argon2Module from "argon2";
import { createHash, randomBytes } from "node:crypto";

const argon2 = (argon2Module as unknown as { default?: typeof argon2Module }).default ?? argon2Module;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function generateRandomToken(byteLength = 64): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function computePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
