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
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Ambiente da API NFS-e (production | homologation)
  NFSE_ENVIRONMENT: z.enum(['production', 'homologation']).default('production'),
  
  // URLs baseadas no ambiente
  NFSE_BASE_URL: z.string().url().transform((val, ctx) => {
    const env = (ctx as any)._data?.NFSE_ENVIRONMENT || 'production';
    if (env === 'homologation') {
      return 'https://homologacao.adn.nfse.gov.br';
    }
    return val;
  }),
  
  // URLs específicas para diferentes módulos
  NFSE_CONTRIBUINTES_BASE_URL: z.string().url().optional(),
  NFSE_PARAMETROS_BASE_URL: z.string().url().optional(),
  NFSE_DANFSE_BASE_URL: z.string().url().optional(),
  
  NFSE_CERT_PFX_PATH: z.string().optional(),
  NFSE_CERT_PFX_BASE64: z.string().optional(),
  NFSE_CERT_PFX_PASS: z.string().optional(),
  NFSE_CERT_PKCS11_LIBRARY: z.string().optional(),
  NFSE_CERT_PKCS11_SLOT: z.string().optional(),
  NFSE_CERT_PKCS11_PIN: z.string().optional(),
  NFSE_CREDENTIAL_SECRET: z.string().min(16, "NFSE_CREDENTIAL_SECRET must be at least 16 characters"),

  // Configurações Sicoob
  SICOOB_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),
  SICOOB_API_BASE_URL: z.string().url().optional(),
  SICOOB_AUTH_URL: z.string().url().optional(),
  SICOOB_AUTH_VALIDATE_URL: z.string().url().optional(),
  SICOOB_CLIENT_ID: z.string().optional(),
  SICOOB_CLIENT_SECRET: z.string().optional(),
  SICOOB_CERT_PATH: z.string().optional(),
  SICOOB_KEY_PATH: z.string().optional(),
  SICOOB_CA_PATH: z.string().optional(),
  SICOOB_CA_BASE64: z.string().optional(),
  SICOOB_CERT_PFX_BASE64: z.string().optional(),
  SICOOB_CERT_PFX_PASS: z.string().optional(),
  SICOOB_WEBHOOK_SECRET: z.string().optional(),
  SICOOB_JWT_SECRET: z.string().optional(),
  SICOOB_SCOPES: z.string().optional(),
  SICOOB_COOPERATIVA: z.string().optional(),
  SICOOB_CONTA: z.string().optional()
});

export const env = envSchema.parse(process.env);
