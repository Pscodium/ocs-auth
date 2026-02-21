export type PublicUser = {
  id: string;
  fullName: string | null;
  docType: "CPF" | "CNPJ" | null;
  document: string | null;
  email: string;
  roles: string[];
};
