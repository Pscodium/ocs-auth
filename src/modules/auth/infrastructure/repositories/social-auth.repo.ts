import { prisma } from "@/shared/persistence/prisma";
import type { SocialProvider } from "@prisma/client";

export class SocialAuthRepository {
  async findByProviderAccount(provider: SocialProvider, providerId: string) {
    return prisma.socialAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId
        }
      }
    });
  }

  async createSocialAccount(input: {
    userId: string;
    provider: SocialProvider;
    providerId: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  }) {
    return prisma.socialAccount.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        providerId: input.providerId,
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl
      }
    });
  }
}
