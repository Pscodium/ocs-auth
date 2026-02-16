import { AppError } from "@/infra/errors";
import { hashPassword } from "@/infra/crypto";
import { UserRepository } from "./user.repo";
import type { PublicUser } from "./user.types";

type UserRoleWithRole = { role: { name: string } };

export class UserService {
  private readonly users = new UserRepository();

  async registerUser(email: string, password: string): Promise<PublicUser> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new AppError("Email already registered", 409, "email_exists");
    }

    const passwordHash = await hashPassword(password);
    const user = await this.users.createUser(email, passwordHash);
    const role = await this.users.ensureRole("user");
    await this.users.assignRole(user.id, role.id);

    const roles = [role.name];
    return { id: user.id, email: user.email, roles };
  }

  async getUserWithRoles(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "user_not_found");
    }
    const roles = user.roles.map((userRole: UserRoleWithRole) => userRole.role.name);
    return { id: user.id, email: user.email, roles };
  }

  async getUserByEmail(email: string) {
    return this.users.findByEmail(email);
  }
}
