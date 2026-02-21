import { prisma } from "@/infra/prisma";
import type { DocumentType } from "@prisma/client";

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } }
    });
  }

  async findByDocument(document: string) {
    return prisma.user.findUnique({
      where: { document },
      include: { roles: { include: { role: true } } }
    });
  }

  async findById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } }
    });
  }

  async createUser(fullName: string, email: string, passwordHash: string) {
    return prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        roles: {
          create: []
        }
      },
      include: { roles: { include: { role: true } } }
    });
  }

  async updateUserById(
    userId: string,
    data: Partial<{
      fullName: string;
      docType: DocumentType;
      document: string;
      email: string;
    }>
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
      include: { roles: { include: { role: true } } }
    });
  }

  async ensureRole(name: string) {
    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      return existing;
    }
    return prisma.role.create({ data: { name } });
  }

  async assignRole(userId: string, roleId: string) {
    return prisma.userRole.create({
      data: { userId, roleId }
    });
  }
}
