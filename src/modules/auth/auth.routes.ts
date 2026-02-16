import type { FastifyInstance } from "fastify";
import { authorizeHandler, loginHandler, logoutHandler, registerHandler, tokenHandler } from "./auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", registerHandler);
  app.post("/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, loginHandler);
  app.get("/authorize", authorizeHandler);
  app.post("/token", tokenHandler);
  app.post("/logout", logoutHandler);
}
