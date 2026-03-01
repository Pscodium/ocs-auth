import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuthenticatedUserId } from "@/infra/http/auth-context";
import { AuthService } from "./auth.service";
import { authorizeQuerySchema, loginSchema, logoutSchema, registerSchema, tokenSchema } from "./auth.schemas";

const authService = new AuthService();

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);
  const user = await authService.register(body.fullName, body.email, body.password);
  reply.code(201).send(user);
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);
  const result = await authService.login(body);
  reply.send({ ...result, state: body.state });
}

export async function authorizeHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = authorizeQuerySchema.parse(request.query);
  const userId = await getAuthenticatedUserId(request);
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
