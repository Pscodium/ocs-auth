import type { SocialProvider } from "@prisma/client";

export type SocialProviderName = SocialProvider;

export type SocialProfile = {
  provider: SocialProviderName;
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type SocialAuthResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};
