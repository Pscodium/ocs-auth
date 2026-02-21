import { AppError } from "@/infra/errors";
import { hashPassword } from "@/infra/crypto";
import { UserRepository } from "./user.repo";
import type { PublicUser } from "./user.types";
import type { DocumentType, UserPlan } from "@prisma/client";

type UserRoleWithRole = { role: { name: string } };

export class UserService {
  private readonly users = new UserRepository();

  private toPublicUser(user: {
    id: string;
    fullName: string | null;
    docType: DocumentType | null;
    document: string | null;
    email: string;
    plan: UserPlan;
    roles: UserRoleWithRole[];
  }): PublicUser {
    const roles = user.roles.map((userRole: UserRoleWithRole) => userRole.role.name);
    return { id: user.id, fullName: user.fullName, docType: user.docType, document: user.document, email: user.email, plan: user.plan, roles };
  }

  async registerUser(fullName: string, email: string, password: string): Promise<PublicUser> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new AppError("Email already registered", 409, "email_exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await this.users.createUser(fullName, email, passwordHash);
    const role = await this.users.ensureRole("user");
    await this.users.assignRole(user.id, role.id);
    const updatedUser = await this.users.findById(user.id);
    if (!updatedUser) {
      throw new AppError("User not found", 404, "user_not_found");
    }
    return this.toPublicUser(updatedUser);
  }

  async getUserWithRoles(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "user_not_found");
    }
    return this.toPublicUser(user);
  }

  async updateUser(
    userId: string,
    input: Partial<{
      fullName: string;
      docType: DocumentType;
      document: string;
      email: string;
    }>
  ): Promise<PublicUser> {
    const currentUser = await this.users.findById(userId);
    if (!currentUser) {
      throw new AppError("User not found", 404, "user_not_found");
    }

    if (input.email) {
      const existingEmail = await this.users.findByEmail(input.email);
      if (existingEmail && existingEmail.id !== userId) {
        throw new AppError("Email already registered", 409, "email_exists");
      }
    }

    if (input.document) {
      const existingDocument = await this.users.findByDocument(input.document);
      if (existingDocument && existingDocument.id !== userId) {
        throw new AppError("Document already registered", 409, "document_exists");
      }
    }

    const user = await this.users.updateUserById(userId, input);
    return this.toPublicUser(user);
  }

  async getUserByEmail(email: string) {
    return this.users.findByEmail(email);
  }
}
