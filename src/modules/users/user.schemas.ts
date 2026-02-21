import { z } from "zod";
import { isValidCpf, isValidCnpj } from "@/infra/document-validators";

const docTypeSchema = z.enum(["CPF", "CNPJ"]);

export const updateMeSchema = z.object({
  fullName: z.string().min(3).optional(),
  email: z.string().email().optional(),
  docType: docTypeSchema.optional(),
  document: z.string().min(1).transform((value) => value.replace(/\D/g, "")).optional()
}).superRefine((input, ctx) => {
  const { docType, document } = input;
  const hasDocType = docType !== undefined;
  const hasDocument = document !== undefined;

  if (hasDocType !== hasDocument) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message: "docType and document must be provided together"
    });
    return;
  }

  if (!hasDocType || !hasDocument || !docType || !document) {
    return;
  }

  const expectedLength = docType === "CPF" ? 11 : 14;
  if (document.length !== expectedLength) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message: `Document must have ${expectedLength} digits for ${docType}`
    });
    return;
  }

  if (docType === "CPF" && !isValidCpf(document)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message: "Invalid CPF"
    });
  }

  if (docType === "CNPJ" && !isValidCnpj(document)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message: "Invalid CNPJ"
    });
  }
});
