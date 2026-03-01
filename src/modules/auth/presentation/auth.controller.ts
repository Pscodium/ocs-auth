import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuthenticatedUserId } from "@/shared/http/auth-context";
import { AppError } from "@/shared/errors";
import { getRedisClient } from "@/shared/cache/redis";
import { env } from "@/config/env";
import { AuthService } from "../application/auth.service";
import { authorizeQuerySchema, loginSchema, logoutSchema, registerSchema, tokenSchema } from "./auth.schemas";

const authService = new AuthService();
const TOKEN_RATE_LIMIT_WINDOW_SECONDS = 60;
const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

function shouldUseSecureCookies() {
  return env.NODE_ENV === "production" || requestBaseUrlIsHttps();
}

function requestBaseUrlIsHttps() {
  return env.BASE_URL.startsWith("https://");
}

function setRefreshTokenCookie(reply: FastifyReply, refreshToken: string, maxAgeSeconds?: number) {
  reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/auth",
    ...(maxAgeSeconds ? { maxAge: maxAgeSeconds } : {})
  });
}

function clearRefreshTokenCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    path: "/auth",
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax"
  });
}

function getTokenRateLimitByGrantType(grantType: "authorization_code" | "refresh_token") {
  if (grantType === "refresh_token") {
    return 8;
  }
  return 24;
}

async function enforceTokenRateLimit(input: {
  ip: string;
  clientId: string;
  grantType: "authorization_code" | "refresh_token";
}) {
  const redis = await getRedisClient();
  const windowBucket = Math.floor(Date.now() / (TOKEN_RATE_LIMIT_WINDOW_SECONDS * 1000));
  const redisKey = `rate_limit:auth:token:${input.grantType}:${input.clientId}:${input.ip}:${windowBucket}`;

  const currentCount = await redis.incr(redisKey);
  if (currentCount === 1) {
    await redis.expire(redisKey, TOKEN_RATE_LIMIT_WINDOW_SECONDS + 1);
  }

  const maxRequests = getTokenRateLimitByGrantType(input.grantType);
  if (currentCount > maxRequests) {
    throw new AppError("Too many token requests", 429, "rate_limit_exceeded");
  }
}

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);
  const user = await authService.register(body.fullName, body.email, body.password);
  reply.code(201).send(user);
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);
  const result = await authService.login(body);
  reply.send({ ...result, state: body.state });
}

export async function authorizeHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = authorizeQuerySchema.parse(request.query);
  const userId = await getAuthenticatedUserId(request);
  const result = await authService.authorize(userId, query);
  reply.send({ ...result, state: query.state });
}

export async function tokenHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = tokenSchema.parse(request.body);
  if (body.grant_type === "refresh_token") {
    const refreshToken = body.refresh_token ?? request.cookies[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken) {
      throw new AppError("Missing refresh token", 400, "invalid_request");
    }

    await enforceTokenRateLimit({
      ip: request.ip,
      clientId: body.client_id,
      grantType: body.grant_type
    });

    const result = await authService.token({
      grant_type: "refresh_token",
      client_id: body.client_id,
      refresh_token: refreshToken
    });

    if (result.refresh_token) {
      setRefreshTokenCookie(reply, result.refresh_token, result.refresh_token_expires_in);
    }
    reply.send(result);
    return;
  }

  await enforceTokenRateLimit({
    ip: request.ip,
    clientId: body.client_id,
    grantType: body.grant_type
  });

  const result = await authService.token(body);
  if ("refresh_token" in result && result.refresh_token) {
    setRefreshTokenCookie(reply, result.refresh_token, result.refresh_token_expires_in);
  }
  reply.send(result);
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = logoutSchema.parse(request.body);
  const refreshToken = body.refresh_token ?? request.cookies[REFRESH_TOKEN_COOKIE_NAME];
  if (refreshToken) {
    await authService.logout({
      refresh_token: refreshToken,
      client_id: body.client_id
    });
  }
  clearRefreshTokenCookie(reply);
  reply.code(204).send();
}
