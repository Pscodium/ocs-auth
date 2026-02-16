import { buildApp } from "@/app";
import { env } from "@/config/env";
import { getLogger } from "@/infra/logger";

async function start() {
  const app = await buildApp();
  const logger = getLogger(app.log);
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    logger.info({ port: env.PORT }, "server listening");
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}

start();
