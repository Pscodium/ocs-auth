import { env } from "@/config/env";
import { getRedisClient } from "@/infra/redis";

export class AuthorizationCodeRepository {
  async createAuthCode(data: {
    codeHash: string;
    userId: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    expiresAt: Date;
  }) {
    const redis = await getRedisClient();
    const ttlSeconds = Math.max(
      1,
      Math.ceil((data.expiresAt.getTime() - Date.now()) / 1000)
    );
    const payload = {
      userId: data.userId,
      clientId: data.clientId,
      redirectUri: data.redirectUri,
      codeChallenge: data.codeChallenge,
      codeChallengeMethod: data.codeChallengeMethod,
      expiresAt: data.expiresAt.toISOString()
    };

    await redis.set(this.getKey(data.codeHash), JSON.stringify(payload), {
      EX: Math.min(ttlSeconds, env.AUTH_CODE_EXPIRES_IN)
    });
  }

  async findValidByHash(codeHash: string) {
    const redis = await getRedisClient();
    const raw = await redis.get(this.getKey(codeHash));
    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw) as {
      userId: string;
      clientId: string;
      redirectUri: string;
      codeChallenge: string;
      codeChallengeMethod: "S256";
      expiresAt: string;
    };

    if (new Date(data.expiresAt).getTime() <= Date.now()) {
      await redis.del(this.getKey(codeHash));
      return null;
    }

    return {
      codeHash,
      ...data,
      expiresAt: new Date(data.expiresAt)
    };
  }

  async consume(codeHash: string) {
    const redis = await getRedisClient();
    await redis.del(this.getKey(codeHash));
  }

  private getKey(codeHash: string) {
    return `auth_code:${codeHash}`;
  }
}
