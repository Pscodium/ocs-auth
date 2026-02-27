import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@/infra/errors";
import { env } from "@/config/env";
import { SocialAuthService } from "./social-auth.service";

const socialAuthService = new SocialAuthService();

const socialStartQuerySchema = z.object({
  redirect_uri: z.string().url().optional()
});

const REDIRECT_COOKIE_TTL_SECONDS = 600;

function resolveAllowedOrigins(): string[] {
  return env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
}

function validateAndNormalizeRedirectUri(redirectUri: string): string {
  const parsed = new URL(redirectUri);
  const allowedOrigins = resolveAllowedOrigins();

  if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsed.origin)) {
    throw new AppError(`redirect_uri: ${parsed.origin} not allowed`, 400, "invalid_redirect_uri");
  }

  return parsed.toString();
}

function storeRedirectCookie(reply: FastifyReply, cookieName: string, redirectUri?: string) {
  if (!redirectUri) {
    return;
  }

  reply.setCookie(cookieName, validateAndNormalizeRedirectUri(redirectUri), {
    path: "/auth",
    httpOnly: true,
    sameSite: "lax",
    secure: env.BASE_URL.startsWith("https://"),
    maxAge: REDIRECT_COOKIE_TTL_SECONDS
  });
}

function clearRedirectCookie(reply: FastifyReply, cookieName: string) {
  reply.clearCookie(cookieName, { path: "/auth" });
}

function appendAccessTokenToRedirectUri(redirectUri: string, accessToken: string): string {
  const url = new URL(redirectUri);
  const fragmentParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");
  fragmentParams.set("accessToken", accessToken);
  url.hash = fragmentParams.toString();
  return url.toString();
}

function getRedirectUriFromCookie(request: FastifyRequest, cookieName: string): string | undefined {
  const value = request.cookies[cookieName];
  if (!value) {
    return undefined;
  }
  return validateAndNormalizeRedirectUri(value);
}

export async function googleOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = socialStartQuerySchema.parse(request.query);
  storeRedirectCookie(reply, "google-social-redirect-uri", query.redirect_uri);
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.googleOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function githubOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = socialStartQuerySchema.parse(request.query);
  storeRedirectCookie(reply, "github-social-redirect-uri", query.redirect_uri);
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.githubOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function microsoftOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = socialStartQuerySchema.parse(request.query);
  storeRedirectCookie(reply, "microsoft-social-redirect-uri", query.redirect_uri);
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.microsoftOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function googleOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleGoogleCallback(request.server.googleOAuth2, request, reply);
  const redirectUri = getRedirectUriFromCookie(request, "google-social-redirect-uri");
  clearRedirectCookie(reply, "google-social-redirect-uri");
  if (redirectUri) {
    reply.redirect(appendAccessTokenToRedirectUri(redirectUri, result.accessToken));
    return;
  }
  reply.send(result);
}

export async function githubOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleGithubCallback(request.server.githubOAuth2, request, reply);
  const redirectUri = getRedirectUriFromCookie(request, "github-social-redirect-uri");
  clearRedirectCookie(reply, "github-social-redirect-uri");
  if (redirectUri) {
    reply.redirect(appendAccessTokenToRedirectUri(redirectUri, result.accessToken));
    return;
  }
  reply.send(result);
}

export async function microsoftOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleMicrosoftCallback(request.server.microsoftOAuth2, request, reply);
  const redirectUri = getRedirectUriFromCookie(request, "microsoft-social-redirect-uri");
  clearRedirectCookie(reply, "microsoft-social-redirect-uri");
  if (redirectUri) {
    reply.redirect(appendAccessTokenToRedirectUri(redirectUri, result.accessToken));
    return;
  }
  reply.send(result);
}
