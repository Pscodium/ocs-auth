import type { FastifyRequest } from "fastify";
import { AppError } from "@/infra/errors";
import { verifyAccessToken } from "@/infra/jwt";

export function extractBearerToken(request: FastifyRequest): string {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new AppError("Missing access token", 401, "unauthorized");
  }
  return auth.slice("Bearer ".length);
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