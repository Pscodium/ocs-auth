import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@/infra/errors";
import { getAuthenticatedUserId } from "@/infra/http/auth-context";
import { UserService } from "./user.service";
import { updateMeSchema } from "./user.schemas";

const userService = new UserService();

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = await getAuthenticatedUserId(request);
  const user = await userService.getUserWithRoles(userId);
  reply.send(user);
}

export async function updateMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = await getAuthenticatedUserId(request);

  const body = updateMeSchema.parse(request.body);
  const updateData = {
    ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.docType !== undefined ? { docType: body.docType } : {}),
    ...(body.document !== undefined ? { document: body.document } : {})
  };

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No fields to update", 400, "invalid_request");
  }

  const user = await userService.updateUser(userId, updateData);
  reply.send(user);
}
