import type { FastifyInstance } from "fastify";
import { authorizeHandler, loginHandler, logoutHandler, registerHandler, tokenHandler } from "./auth.controller";
import {
  githubOAuthCallbackHandler,
  githubOAuthStartHandler,
  googleOAuthCallbackHandler,
  googleOAuthStartHandler,
  microsoftOAuthCallbackHandler,
  microsoftOAuthStartHandler
} from "./social-auth.controller";

export async function authRoutes(app: FastifyInstance) {
  app.get("/google", googleOAuthStartHandler);
  app.get("/google/callback", googleOAuthCallbackHandler);
  app.get("/github", githubOAuthStartHandler);
  app.get("/github/callback", githubOAuthCallbackHandler);
  app.get("/microsoft", microsoftOAuthStartHandler);
  app.get("/microsoft/callback", microsoftOAuthCallbackHandler);

  app.post("/register", registerHandler);
  app.post("/login", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, loginHandler);
  app.get("/authorize", authorizeHandler);
  app.post("/token", tokenHandler);
  app.post("/logout", logoutHandler);
}
