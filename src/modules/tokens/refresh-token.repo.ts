import { prisma } from "@/infra/prisma";

export class RefreshTokenRepository {
  async createRefreshToken(data: {
    tokenHash: string;
    userId: string;
    clientId: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({ data });
  }

  async findValidByHash(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
  }

  async revokeToken(tokenId: string, replacedByTokenId?: string) {
    const data = replacedByTokenId
      ? { revokedAt: new Date(), replacedByTokenId }
      : { revokedAt: new Date() };
    return prisma.refreshToken.update({
      where: { id: tokenId },
      data
    });
  }
}
