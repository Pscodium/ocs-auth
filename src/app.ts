import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "@/config/env";
import { ZodError } from "zod";
import { AppError } from "@/infra/errors";
import { getJwks } from "@/infra/jwt";
import { getLogger } from "@/infra/logger";
import { setRedisLogger } from "@/infra/redis";
import { authRoutes } from "@/modules/auth/auth.routes";

export async function buildApp() {
  const app = Fastify({ logger: true });
  const logger = getLogger(app.log);
  setRedisLogger(logger);

  const corsOrigins = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];

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

  await app.register(rateLimit, { global: false });

  app.get("/.well-known/jwks.json", async (_request, reply) => {
    const jwks = await getJwks();
    reply.send(jwks);
  });

  app.register(authRoutes, { prefix: "/auth" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
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

  return app;
}
