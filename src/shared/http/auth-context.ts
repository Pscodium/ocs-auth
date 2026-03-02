import type { FastifyRequest } from "fastify";
import { AppError } from "@/shared/errors";
import { verifyAccessToken } from "@/shared/security/jwt";

const ACCESS_TOKEN_COOKIE_NAME = "access_token";

export function extractBearerToken(request: FastifyRequest): string {
  const auth = request.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }

  const cookieAccessToken = request.cookies[ACCESS_TOKEN_COOKIE_NAME];
  if (cookieAccessToken) {
    return cookieAccessToken;
  }

  throw new AppError("Missing access token", 401, "unauthorized");
}

export async function getAuthenticatedUserId(request: FastifyRequest): Promise<string> {
  const token = extractBearerToken(request);
  const payload = await verifyAccessToken(token);
  const userId = payload.sub;
  if (!userId) {
    throw new AppError("Invalid access token", 401, "unauthorized");
  }
  return userId;
}