import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FRONTEND_URL: z.string().url().optional(),
  WHATSAPP_NUMBER: z.string().min(8),
  WHATSAPP_WELCOME_TEMPLATE: z
    .string()
    .default("Olá! Sou a IA do GuiasMEI. Estou aqui para te ajudar com suas guias e notas fiscais."),
  STRIPE_PRICE_ID: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
  ,
  NFSE_ENV: z.enum(["pr", "prod"]).default("pr"),
  NFSE_BASE_URL: z.string().url(),
  NFSE_CERT_PFX_PATH: z.string().optional(),
  NFSE_CERT_PFX_BASE64: z.string().optional(),
  NFSE_CERT_PFX_PASS: z.string().optional(),
  NFSE_CERT_PKCS11_LIBRARY: z.string().optional(),
  NFSE_CERT_PKCS11_SLOT: z.string().optional(),
  NFSE_CERT_PKCS11_PIN: z.string().optional(),
  NFSE_CREDENTIAL_SECRET: z.string().min(16, "NFSE_CREDENTIAL_SECRET must be at least 16 characters")
});

export const env = envSchema.parse(process.env);
