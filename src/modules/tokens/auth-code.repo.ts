import { prisma } from "@/infra/prisma";

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
    return prisma.authorizationCode.create({ data });
  }

  async findValidByHash(codeHash: string) {
    return prisma.authorizationCode.findFirst({
      where: {
        codeHash,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
  }

  async consume(codeId: string) {
    return prisma.authorizationCode.update({
      where: { id: codeId },
      data: { consumedAt: new Date() }
    });
  }
}
