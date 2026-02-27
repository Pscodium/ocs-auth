import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@/infra/errors";
import { env } from "@/config/env";
import { signAccessToken } from "@/infra/jwt";
import type { SocialProvider } from "@prisma/client";
import { UserService } from "@/modules/users/user.service";
import { SocialAuthRepository } from "./social-auth.repo";
import type { SocialAuthResult, SocialProfile } from "./social.types";

const GITHUB_API_VERSION = "2022-11-28";

type OAuth2NamespaceLike = {
  generateAuthorizationUri: (request: FastifyRequest, reply: FastifyReply) => Promise<string>;
  getAccessTokenFromAuthorizationCodeFlow: (request: FastifyRequest, reply: FastifyReply) => Promise<{
    token: {
      access_token: string;
    };
  }>;
};

export class SocialAuthService {
  private readonly users = new UserService();
  private readonly socialAuth = new SocialAuthRepository();

  async generateAuthorizationUri(namespace: OAuth2NamespaceLike, request: FastifyRequest, reply: FastifyReply) {
    const authorizationUri = await namespace.generateAuthorizationUri(request, reply);
    return authorizationUri;
  }

  async handleGoogleCallback(namespace: OAuth2NamespaceLike, request: FastifyRequest, reply: FastifyReply): Promise<SocialAuthResult> {
    const { token } = await namespace.getAccessTokenFromAuthorizationCodeFlow(request, reply);
    const profile = await this.fetchGoogleProfile(token.access_token);
    return this.authenticateOrProvisionUser(profile);
  }

  async handleGithubCallback(namespace: OAuth2NamespaceLike, request: FastifyRequest, reply: FastifyReply): Promise<SocialAuthResult> {
    const { token } = await namespace.getAccessTokenFromAuthorizationCodeFlow(request, reply);
    const profile = await this.fetchGithubProfile(token.access_token);
    return this.authenticateOrProvisionUser(profile);
  }

  async handleMicrosoftCallback(namespace: OAuth2NamespaceLike, request: FastifyRequest, reply: FastifyReply): Promise<SocialAuthResult> {
    const { token } = await namespace.getAccessTokenFromAuthorizationCodeFlow(request, reply);
    const profile = await this.fetchMicrosoftProfile(token.access_token);
    return this.authenticateOrProvisionUser(profile);
  }

  private async authenticateOrProvisionUser(profile: SocialProfile): Promise<SocialAuthResult> {
    const existingSocialAccount = await this.socialAuth.findByProviderAccount(profile.provider, profile.providerId);
    if (existingSocialAccount) {
      return this.issueJwtForUser(existingSocialAccount.userId);
    }

    const existingUser = await this.users.getUserByEmail(profile.email);
    if (existingUser) {
      await this.socialAuth.createSocialAccount({
        userId: existingUser.id,
        provider: profile.provider,
        providerId: profile.providerId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl
      });
      return this.issueJwtForUser(existingUser.id);
    }

    const createdUser = await this.users.registerSocialUser(profile.name, profile.email);
    await this.socialAuth.createSocialAccount({
      userId: createdUser.id,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl
    });

    return this.issueJwtForUser(createdUser.id);
  }

  private async issueJwtForUser(userId: string): Promise<SocialAuthResult> {
    const user = await this.users.getUserWithRoles(userId);
    const accessToken = await signAccessToken({
      sub: user.id,
      roles: user.roles,
      plan: user.plan,
      clientId: "social_oauth",
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.fullName
      }
    };
  }

  private async fetchGoogleProfile(accessToken: string): Promise<SocialProfile> {
    const data = await this.fetchJson<{
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    }>("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!data.id || !data.email) {
      throw new AppError("Google profile is missing required fields", 400, "social_profile_invalid");
    }

    return {
      provider: "google",
      providerId: data.id,
      email: data.email.toLowerCase(),
      name: data.name ?? null,
      avatarUrl: data.picture ?? null
    };
  }

  private async fetchGithubProfile(accessToken: string): Promise<SocialProfile> {
    const user = await this.fetchJson<{
      id?: number;
      email?: string | null;
      name?: string | null;
      login?: string;
      avatar_url?: string | null;
    }>("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ocs-auth-service",
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

    const githubEmail = user.email ?? await this.fetchGithubPrimaryEmail(accessToken);
    if (!user.id || !githubEmail) {
      throw new AppError("GitHub profile is missing required fields", 400, "social_profile_invalid");
    }

    return {
      provider: "github",
      providerId: String(user.id),
      email: githubEmail.toLowerCase(),
      name: user.name ?? user.login ?? null,
      avatarUrl: user.avatar_url ?? null
    };
  }

  private async fetchGithubPrimaryEmail(accessToken: string): Promise<string | null> {
    const emails = await this.fetchJson<Array<{
      email?: string;
      primary?: boolean;
      verified?: boolean;
    }>>("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ocs-auth-service",
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      }
    });

    const primaryVerified = emails.find((item) => item.primary && item.verified && item.email);
    if (primaryVerified?.email) {
      return primaryVerified.email;
    }

    const firstVerified = emails.find((item) => item.verified && item.email);
    return firstVerified?.email ?? null;
  }

  private async fetchMicrosoftProfile(accessToken: string): Promise<SocialProfile> {
    const data = await this.fetchJson<{
      id?: string;
      displayName?: string;
      mail?: string | null;
      userPrincipalName?: string | null;
    }>("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const email = data.mail ?? data.userPrincipalName;
    if (!data.id || !email) {
      throw new AppError("Microsoft profile is missing required fields", 400, "social_profile_invalid");
    }

    return {
      provider: "microsoft",
      providerId: data.id,
      email: email.toLowerCase(),
      name: data.displayName ?? null,
      avatarUrl: null
    };
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new AppError("Failed to fetch social profile", 502, "social_provider_error");
    }
    return response.json() as Promise<T>;
  }
}
