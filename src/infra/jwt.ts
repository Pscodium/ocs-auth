import { SignJWT, calculateJwkThumbprint, exportJWK, importPKCS8, importSPKI, jwtVerify, type JWTPayload, type KeyLike } from "jose";
import { env } from "@/config/env";

const privateKeyPromise = importPKCS8(env.JWT_PRIVATE_KEY, "RS256");
const publicKeyPromise = importSPKI(env.JWT_PUBLIC_KEY, "RS256");

let jwksCache: { keys: Array<Record<string, unknown>> } | null = null;
let kidCache: string | null = null;

async function getKid(): Promise<string> {
  if (kidCache) {
    return kidCache;
  }
  const publicKey = await publicKeyPromise;
  const jwk = await exportJWK(publicKey);
  kidCache = await calculateJwkThumbprint(jwk);
  return kidCache;
}

export async function signAccessToken(payload: { sub: string; roles: string[]; clientId: string }): Promise<string> {
  const privateKey = await privateKeyPromise;
  const kid = await getKid();
  return new SignJWT({ roles: payload.roles, client_id: payload.clientId })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(env.ISSUER_URL)
    .setAudience(env.AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(privateKey as KeyLike);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const publicKey = await publicKeyPromise;
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: env.ISSUER_URL,
    audience: env.AUDIENCE
  });
  return payload;
}

export async function getJwks(): Promise<{ keys: Array<Record<string, unknown>> }> {
  if (jwksCache) {
    return jwksCache;
  }
  const publicKey = await publicKeyPromise;
  const jwk = await exportJWK(publicKey);
  const kid = await getKid();
  jwksCache = {
    keys: [
      {
        ...jwk,
        use: "sig",
        alg: "RS256",
        kid
      }
    ]
  };
  return jwksCache;
}
