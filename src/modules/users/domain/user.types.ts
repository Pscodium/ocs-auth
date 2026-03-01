export type PublicUser = {
  id: string;
  fullName: string | null;
  docType: "CPF" | "CNPJ" | null;
  document: string | null;
  email: string;
  plan: "free_plan" | "premium_plan" | "ultimate_plan";
  roles: string[];
};
