import type { FastifyInstance } from "fastify";
import { getMeHandler, updateMeHandler } from "./user.controller";

export async function userRoutes(app: FastifyInstance) {
  app.get("/me", getMeHandler);
  app.patch("/me", updateMeHandler);
}
