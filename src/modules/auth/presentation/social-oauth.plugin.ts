import type { FastifyInstance } from "fastify";
import oauthPlugin from "@fastify/oauth2";
import fp from "fastify-plugin";
import { env } from "@/config/env";

function buildCallbackUrl(pathname: string) {
  return `${env.BASE_URL.replace(/\/$/, "")}${pathname}`;
}

async function socialOAuthPluginImpl(app: FastifyInstance) {
  await app.register(oauthPlugin, {
    name: "googleOAuth2",
    scope: ["openid", "email", "profile"],
    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID,
        secret: env.GOOGLE_CLIENT_SECRET
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION
    },
    callbackUri: buildCallbackUrl("/auth/google/callback"),
    pkce: "S256",
    verifierCookieName: "google-oauth2-code-verifier",
    redirectStateCookieName: "google-oauth2-state"
  });

  await app.register(oauthPlugin, {
    name: "githubOAuth2",
    scope: ["read:user", "user:email"],
    credentials: {
      client: {
        id: env.GITHUB_CLIENT_ID,
        secret: env.GITHUB_CLIENT_SECRET
      },
      auth: oauthPlugin.GITHUB_CONFIGURATION
    },
    callbackUri: buildCallbackUrl("/auth/github/callback"),
    pkce: "S256",
    verifierCookieName: "github-oauth2-code-verifier",
    redirectStateCookieName: "github-oauth2-state"
  });

  await app.register(oauthPlugin, {
    name: "microsoftOAuth2",
    scope: ["openid", "profile", "email", "User.Read"],
    credentials: {
      client: {
        id: env.MICROSOFT_CLIENT_ID,
        secret: env.MICROSOFT_CLIENT_SECRET
      },
      auth: oauthPlugin.MICROSOFT_CONFIGURATION
    },
    callbackUri: buildCallbackUrl("/auth/microsoft/callback"),
    pkce: "S256",
    verifierCookieName: "microsoft-oauth2-code-verifier",
    redirectStateCookieName: "microsoft-oauth2-state"
  });
}

export const socialOAuthPlugin = fp(socialOAuthPluginImpl, {
  name: "social-oauth-plugin"
});
