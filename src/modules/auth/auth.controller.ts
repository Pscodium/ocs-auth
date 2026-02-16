import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@/infra/errors";
import { verifyAccessToken } from "@/infra/jwt";
import { AuthService } from "./auth.service";
import { authorizeQuerySchema, loginSchema, logoutSchema, registerSchema, tokenSchema } from "./auth.schemas";

const authService = new AuthService();

function getBearerToken(request: FastifyRequest): string {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new AppError("Missing access token", 401, "unauthorized");
  }
  return auth.slice("Bearer ".length);
}

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);
  const user = await authService.register(body.email, body.password);
  reply.code(201).send(user);
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);
  const result = await authService.login(body);
  reply.send({ ...result, state: body.state });
}

export async function authorizeHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = authorizeQuerySchema.parse(request.query);
  const token = getBearerToken(request);
  const payload = await verifyAccessToken(token);
  const userId = payload.sub;
  if (!userId) {
    throw new AppError("Invalid access token", 401, "unauthorized");
  }
  const result = await authService.authorize(userId, query);
  reply.send({ ...result, state: query.state });
}

export async function tokenHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = tokenSchema.parse(request.body);
  const result = await authService.token(body);
  reply.send(result);
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = logoutSchema.parse(request.body);
  await authService.logout(body);
  reply.code(204).send();
}
