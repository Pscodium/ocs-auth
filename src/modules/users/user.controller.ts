import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@/infra/errors";
import { verifyAccessToken } from "@/infra/jwt";
import { UserService } from "./user.service";
import { updateMeSchema } from "./user.schemas";

const userService = new UserService();

function getBearerToken(request: FastifyRequest): string {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new AppError("Missing access token", 401, "unauthorized");
  }
  return auth.slice("Bearer ".length);
}

function getUserIdFromRequest(request: FastifyRequest): Promise<string> {
  const token = getBearerToken(request);
  return verifyAccessToken(token).then((payload) => {
    const userId = payload.sub;
    if (!userId) {
      throw new AppError("Invalid access token", 401, "unauthorized");
    }
    return userId;
  });
}

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = await getUserIdFromRequest(request);
  const user = await userService.getUserWithRoles(userId);
  reply.send(user);
}

export async function updateMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = await getUserIdFromRequest(request);

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
