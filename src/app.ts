import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "@/config/env";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors";
import { getJwks } from "@/shared/security/jwt";
import { getLogger } from "@/shared/observability/logger";
import { setRedisLogger } from "@/shared/cache/redis";
import { socialOAuthPlugin } from "@/modules/auth/presentation/social-oauth.plugin";
import { authRoutes } from "@/modules/auth/presentation/auth.routes";
import { userRoutes } from "@/modules/users/presentation/user.routes";

function getCorsOrigins(): string[] {
  return env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
}

async function registerSecurityPlugins(app: FastifyInstance) {
  const corsOrigins = getCorsOrigins();

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
    credentials: true
  });

  await app.register(cookie);

  await app.register(rateLimit, { global: false });
}

function registerJwksRoute(app: FastifyInstance) {
  app.get("/.well-known/jwks.json", async (_request, reply) => {
    const jwks = await getJwks();
    reply.send(jwks);
  });
}

async function registerModules(app: FastifyInstance) {
  await app.register(socialOAuthPlugin);

  app.register(authRoutes, { prefix: "/auth" });
  app.register(userRoutes, { prefix: "/users" });
}

function registerErrorHandler(app: FastifyInstance) {
  const logger = getLogger(app.log);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      logger.info({
        method: request.method,
        url: request.url,
        issues: error.issues
      }, "Request schema validation failed");
      reply.code(400).send({ error: "invalid_request", message: "Invalid request" });
      return;
    }
    if (error instanceof Error) {
      logger.error({ err: error }, error.message);
    } else {
      logger.error({ err: error }, "Unhandled error");
    }
    reply.code(500).send({ error: "server_error", message: "Internal server error" });
  });
}

export async function buildApp() {
  const app = Fastify({ logger: true });
  setRedisLogger(getLogger(app.log));

  await registerSecurityPlugins(app);
  registerJwksRoute(app);
  await registerModules(app);
  registerErrorHandler(app);

  return app;
}
