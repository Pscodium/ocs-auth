import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "@/shared/errors";
import { env } from "@/config/env";
import { SocialAuthService } from "../application/social-auth.service";

const socialAuthService = new SocialAuthService();
const ACCESS_TOKEN_COOKIE_NAME = "access_token";

const socialStartQuerySchema = z.object({
  redirect_uri: z.string().url().optional(),
  client_id: z.string().min(1).optional(),
  state: z.string().optional(),
  code_challenge: z.string().min(43).optional(),
  code_challenge_method: z.literal("S256").optional()
}).superRefine((value, ctx) => {
  if (!value.redirect_uri) {
    return;
  }

  if (!value.client_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["client_id"],
      message: "client_id is required when redirect_uri is provided"
    });
  }

  if (!value.code_challenge) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["code_challenge"],
      message: "code_challenge is required when redirect_uri is provided"
    });
  }
});

const socialRedirectContextCookieSchema = z.object({
  redirectUri: z.string().url(),
  clientId: z.string().min(1),
  state: z.string().optional(),
  codeChallenge: z.string().min(43),
  codeChallengeMethod: z.literal("S256")
});

type SocialRedirectContext = z.infer<typeof socialRedirectContextCookieSchema>;

const REDIRECT_COOKIE_TTL_SECONDS = 600;

function shouldUseSecureCookies() {
  return env.NODE_ENV === "production" || env.BASE_URL.startsWith("https://");
}

function getCookieDomain() {
  const domain = env.COOKIE_DOMAIN?.trim();
  return domain && domain.length > 0 ? domain : undefined;
}

function getCookieSameSite() {
  return env.COOKIE_SAME_SITE;
}

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

function storeRedirectCookie(reply: FastifyReply, cookieName: string, context?: SocialRedirectContext) {
  if (!context) {
    return;
  }

  const normalizedContext: SocialRedirectContext = {
    ...context,
    redirectUri: validateAndNormalizeRedirectUri(context.redirectUri)
  };

  const domain = getCookieDomain();
  reply.setCookie(cookieName, JSON.stringify(normalizedContext), {
    path: "/auth",
    httpOnly: true,
    sameSite: getCookieSameSite(),
    secure: shouldUseSecureCookies(),
    ...(domain ? { domain } : {}),
    maxAge: REDIRECT_COOKIE_TTL_SECONDS
  });
}

function clearRedirectCookie(reply: FastifyReply, cookieName: string) {
  const domain = getCookieDomain();
  reply.clearCookie(cookieName, {
    path: "/auth",
    httpOnly: true,
    sameSite: getCookieSameSite(),
    secure: shouldUseSecureCookies(),
    ...(domain ? { domain } : {})
  });
}

function setAccessTokenCookie(reply: FastifyReply, accessToken: string) {
  const domain = getCookieDomain();
  reply.setCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
    path: "/",
    httpOnly: true,
    sameSite: getCookieSameSite(),
    secure: shouldUseSecureCookies(),
    ...(domain ? { domain } : {})
  });
}

function appendAuthCodeToRedirectUri(redirectUri: string, code: string, state?: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}

function getRedirectContextFromCookie(request: FastifyRequest, cookieName: string): SocialRedirectContext | undefined {
  const raw = request.cookies[cookieName];
  if (!raw) {
    return undefined;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return undefined;
  }

  const parsed = socialRedirectContextCookieSchema.safeParse(decoded);
  if (!parsed.success) {
    return undefined;
  }

  return {
    ...parsed.data,
    redirectUri: validateAndNormalizeRedirectUri(parsed.data.redirectUri)
  };
}
export async function googleOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = socialStartQuerySchema.parse(request.query);
  const redirectContext = query.redirect_uri
    ? {
        redirectUri: query.redirect_uri,
        clientId: query.client_id!,
        state: query.state,
        codeChallenge: query.code_challenge!,
        codeChallengeMethod: query.code_challenge_method ?? "S256"
      }
    : undefined;
  if (redirectContext) {
    await socialAuthService.assertClientRedirect(redirectContext.clientId, redirectContext.redirectUri);
  }
  storeRedirectCookie(reply, "google-social-redirect-uri", redirectContext);
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.googleOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function githubOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = socialStartQuerySchema.parse(request.query);
  const redirectContext = query.redirect_uri
    ? {
        redirectUri: query.redirect_uri,
        clientId: query.client_id!,
        state: query.state,
        codeChallenge: query.code_challenge!,
        codeChallengeMethod: query.code_challenge_method ?? "S256"
      }
    : undefined;
  if (redirectContext) {
    await socialAuthService.assertClientRedirect(redirectContext.clientId, redirectContext.redirectUri);
  }
  storeRedirectCookie(reply, "github-social-redirect-uri", redirectContext);
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.githubOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function microsoftOAuthStartHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = socialStartQuerySchema.parse(request.query);
  const redirectContext = query.redirect_uri
    ? {
        redirectUri: query.redirect_uri,
        clientId: query.client_id!,
        codeChallenge: query.code_challenge!,
        codeChallengeMethod: query.code_challenge_method ?? "S256"
      }
    : undefined;
  if (redirectContext) {
    await socialAuthService.assertClientRedirect(redirectContext.clientId, redirectContext.redirectUri);
  }
  storeRedirectCookie(reply, "microsoft-social-redirect-uri", redirectContext);
  const authorizationUri = await socialAuthService.generateAuthorizationUri(request.server.microsoftOAuth2, request, reply);
  reply.redirect(authorizationUri);
}

export async function googleOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleGoogleCallback(request.server.googleOAuth2, request, reply);
  const redirectContext = getRedirectContextFromCookie(request, "google-social-redirect-uri");
  clearRedirectCookie(reply, "google-social-redirect-uri");
  if (redirectContext) {
    const authorizationCode = await socialAuthService.issueAuthorizationCodeForUser({
      userId: result.user.id,
      clientId: redirectContext.clientId,
      redirectUri: redirectContext.redirectUri,
      codeChallenge: redirectContext.codeChallenge,
      codeChallengeMethod: redirectContext.codeChallengeMethod
    });
    reply.redirect(appendAuthCodeToRedirectUri(redirectContext.redirectUri, authorizationCode.code, redirectContext.state));
    return;
  }
  setAccessTokenCookie(reply, result.accessToken);
  reply.send(result);
}

export async function githubOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleGithubCallback(request.server.githubOAuth2, request, reply);
  const redirectContext = getRedirectContextFromCookie(request, "github-social-redirect-uri");
  clearRedirectCookie(reply, "github-social-redirect-uri");
  if (redirectContext) {
    const authorizationCode = await socialAuthService.issueAuthorizationCodeForUser({
      userId: result.user.id,
      clientId: redirectContext.clientId,
      redirectUri: redirectContext.redirectUri,
      codeChallenge: redirectContext.codeChallenge,
      codeChallengeMethod: redirectContext.codeChallengeMethod
    });
    reply.redirect(appendAuthCodeToRedirectUri(redirectContext.redirectUri, authorizationCode.code, redirectContext.state));
    return;
  }
  setAccessTokenCookie(reply, result.accessToken);
  reply.send(result);
}

export async function microsoftOAuthCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await socialAuthService.handleMicrosoftCallback(request.server.microsoftOAuth2, request, reply);
  const redirectContext = getRedirectContextFromCookie(request, "microsoft-social-redirect-uri");
  clearRedirectCookie(reply, "microsoft-social-redirect-uri");
  if (redirectContext) {
    const authorizationCode = await socialAuthService.issueAuthorizationCodeForUser({
      userId: result.user.id,
      clientId: redirectContext.clientId,
      redirectUri: redirectContext.redirectUri,
      codeChallenge: redirectContext.codeChallenge,
      codeChallengeMethod: redirectContext.codeChallengeMethod
    });
    reply.redirect(appendAuthCodeToRedirectUri(redirectContext.redirectUri, authorizationCode.code, redirectContext.state));
    return;
  }
  setAccessTokenCookie(reply, result.accessToken);
  reply.send(result);
}
