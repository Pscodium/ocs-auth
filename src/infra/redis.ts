import { createClient, type RedisClientType } from "redis";
import { env } from "@/config/env";
import type { AppLogger } from "@/infra/logger";

let client: RedisClientType | null = null;
let redisLogger: AppLogger | null = null;

export function setRedisLogger(logger: AppLogger) {
  redisLogger = logger;
}

export async function getRedisClient() {
  if (client) {
    return client;
  }

  client = createClient({ url: env.REDIS_URL });
  client.on("ready", () => {
    logInfo("Redis ready");
  });
  client.on("error", (error) => {
    logError("Redis client error", error);
  });

  await client.connect();
  return client;
}

function logInfo(message: string) {
  if (redisLogger) {
    redisLogger.info({}, message);
  } else {
    console.log(message);
  }
}

function logError(message: string, error: unknown) {
  if (redisLogger) {
    redisLogger.error({ err: error }, message);
  } else {
    console.error(message, error);
  }
}
