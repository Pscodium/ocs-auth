import { Prisma } from "@prisma/client";
import { prisma } from "@/infra/prisma";
import { AppError } from "@/infra/errors";
import { computePkceChallenge, generateRandomToken, hashToken, verifyPassword } from "@/infra/crypto";
import { signAccessToken } from "@/infra/jwt";
import { AuthorizationCodeRepository } from "@/modules/tokens/auth-code.repo";
import { RefreshTokenRepository } from "@/modules/tokens/refresh-token.repo";
import { UserService } from "@/modules/users/user.service";
import { env } from "@/config/env";

export class AuthService {
  private readonly users = new UserService();
  private readonly authCodes = new AuthorizationCodeRepository();
  private readonly refreshTokens = new RefreshTokenRepository();

  async register(email: string, password: string) {
    return this.users.registerUser(email, password);
  }

  private async getClientConfig(clientId: string) {
    const client = await prisma.oAuthClient.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new AppError("Unknown client", 400, "invalid_client");
    }
    return {
      client,
      accessTokenExpiresIn: client.accessTokenExpiresIn,
      refreshTokenExpiresIn: client.refreshTokenExpiresIn
    };
  }

  async login(input: {
    email: string;
    password: string;
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: "S256";
  }) {
    await this.assertClientRedirect(input.client_id, input.redirect_uri);
    const user = await this.users.getUserByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid credentials", 401, "invalid_credentials");
    }
    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      throw new AppError("Invalid credentials", 401, "invalid_credentials");
    }

    const code = generateRandomToken(48);
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + env.AUTH_CODE_EXPIRES_IN * 1000);

    await this.authCodes.createAuthCode({
      codeHash,
      userId: user.id,
      clientId: input.client_id,
      redirectUri: input.redirect_uri,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method,
      expiresAt
    });

    return {
      code,
      expires_in: env.AUTH_CODE_EXPIRES_IN,
      redirect_uri: input.redirect_uri
    };
  }

  async authorize(userId: string, input: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: "S256";
  }) {
    await this.assertClientRedirect(input.client_id, input.redirect_uri);

    const code = generateRandomToken(48);
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + env.AUTH_CODE_EXPIRES_IN * 1000);

    await this.authCodes.createAuthCode({
      codeHash,
      userId,
      clientId: input.client_id,
      redirectUri: input.redirect_uri,
      codeChallenge: input.code_challenge,
      codeChallengeMethod: input.code_challenge_method,
      expiresAt
    });

    return {
      code,
      expires_in: env.AUTH_CODE_EXPIRES_IN,
      redirect_uri: input.redirect_uri
    };
  }

  async token(input:
    | {
        grant_type: "authorization_code";
        code: string;
        redirect_uri: string;
        client_id: string;
        code_verifier: string;
      }
    | {
        grant_type: "refresh_token";
        refresh_token: string;
        client_id: string;
      }) {
    if (input.grant_type === "authorization_code") {
      return this.exchangeCode(input);
    }
    return this.rotateRefreshToken(input);
  }

  async logout(input: { refresh_token: string; client_id: string }) {
    const tokenHash = hashToken(input.refresh_token);
    const token = await this.refreshTokens.findValidByHash(tokenHash);
    if (!token) {
      return;
    }
    if (token.clientId !== input.client_id) {
      throw new AppError("Invalid refresh token", 401, "invalid_refresh_token");
    }
    await this.refreshTokens.revokeToken(token.id);
  }

  private async exchangeCode(input: {
    grant_type: "authorization_code";
    code: string;
    redirect_uri: string;
    client_id: string;
    code_verifier: string;
  }) {
    const codeHash = hashToken(input.code);
    const authCode = await this.authCodes.findValidByHash(codeHash);
    if (!authCode) {
      throw new AppError("Invalid authorization code", 400, "invalid_grant");
    }
    if (authCode.clientId !== input.client_id || authCode.redirectUri !== input.redirect_uri) {
      throw new AppError("Invalid authorization code", 400, "invalid_grant");
    }

    const computedChallenge = computePkceChallenge(input.code_verifier);
    if (authCode.codeChallengeMethod !== "S256" || computedChallenge !== authCode.codeChallenge) {
      throw new AppError("PKCE validation failed", 400, "invalid_grant");
    }

    await this.authCodes.consume(authCode.id);

    const { accessTokenExpiresIn, refreshTokenExpiresIn } = await this.getClientConfig(input.client_id);

    const user = await this.users.getUserWithRoles(authCode.userId);
    const accessToken = await signAccessToken({
      sub: user.id,
      roles: user.roles,
      clientId: input.client_id
    });

    const refreshTokenValue = generateRandomToken(64);
    const refreshTokenHash = hashToken(refreshTokenValue);
    const expiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);

    await this.refreshTokens.createRefreshToken({
      tokenHash: refreshTokenHash,
      userId: user.id,
      clientId: input.client_id,
      expiresAt
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenExpiresIn,
      refresh_token: refreshTokenValue
    };
  }

  private async rotateRefreshToken(input: { grant_type: "refresh_token"; refresh_token: string; client_id: string }) {
    const tokenHash = hashToken(input.refresh_token);
    const token = await this.refreshTokens.findValidByHash(tokenHash);
    if (!token) {
      throw new AppError("Invalid refresh token", 401, "invalid_grant");
    }
    if (token.clientId !== input.client_id) {
      throw new AppError("Invalid refresh token", 401, "invalid_grant");
    }

    const { accessTokenExpiresIn, refreshTokenExpiresIn } = await this.getClientConfig(input.client_id);

    const user = await this.users.getUserWithRoles(token.userId);
    const accessToken = await signAccessToken({
      sub: user.id,
      roles: user.roles,
      clientId: input.client_id
    });

    const newRefreshTokenValue = generateRandomToken(64);
    const newRefreshTokenHash = hashToken(newRefreshTokenValue);
    const expiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { revokedAt: new Date() }
      });
      await tx.refreshToken.create({
        data: {
          tokenHash: newRefreshTokenHash,
          userId: token.userId,
          clientId: token.clientId,
          expiresAt
        }
      });
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenExpiresIn,
      refresh_token: newRefreshTokenValue
    };
  }

  private async assertClientRedirect(clientId: string, redirectUri: string) {
    const { client } = await this.getClientConfig(clientId);
    if (!client.redirectUris.includes(redirectUri)) {
      throw new AppError("Invalid redirect uri", 400, "invalid_redirect_uri");
    }
  }
}
