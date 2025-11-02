import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyExpress from "@fastify/express";
import fastifySensible from "@fastify/sensible";
import { env } from "./env";
import { registerAuthRoutes } from "../routes/auth";
import { registerDashboardRoutes } from "../routes/dashboard";
import { registerNfseController } from "./nfse/controllers/nfse.controller";
import { registerNfseRoutes } from "../routes/nfse";
import { startScheduler } from "./nfse/workers/scheduler";
import { startCertificateScheduler } from "./services/certificate/certificate-scheduler";
import { registerGpsRoutes } from "../routes/gps";
import { registerPaymentRoutes } from "../routes/payments";
import { registerWhatsappRoutes } from "../routes/whatsapp";
import { testSupabaseConnection } from "./test-supabase";
import { initializeSicoobServices } from "./services/sicoob";
import { registerSicoobRoutes } from "./routes/sicoob.routes";
import { certisignRoutes } from "./routes/certisign.routes";

function hasSicoobConfiguration(): boolean {
  const hasFileCert = env.SICOOB_CERT_PATH && env.SICOOB_KEY_PATH;
  const hasPfx = env.SICOOB_CERT_PFX_BASE64 && env.SICOOB_CERT_PFX_PASS;
  const baseUrl = env.SICOOB_API_BASE_URL || (env as any).SICOOB_PIX_BASE_URL;

  return Boolean(
    baseUrl &&
      env.SICOOB_AUTH_URL &&
      env.SICOOB_CLIENT_ID &&
      (hasFileCert || hasPfx)
  );
}

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "debug" : "info"
    }
  });

  await app.register(fastifyCors, {
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });
  await app.register(fastifySensible);

  app.get("/health", async () => {
    return { status: "healthy" };
  });

  await registerAuthRoutes(app);
  await registerDashboardRoutes(app);
  await registerNfseController(app);
  await registerNfseRoutes(app);
  await registerGpsRoutes(app);
  await registerPaymentRoutes(app);
  await registerWhatsappRoutes(app);
  await app.register(certisignRoutes);

  if (hasSicoobConfiguration()) {
    await app.register(fastifyExpress);

    // Adicionar parsers Express para corpo e raw body
    const express = (await import('express')).default;
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    initializeSicoobServices({
      environment: env.SICOOB_ENVIRONMENT ?? "sandbox",
      baseUrl: (env.SICOOB_API_BASE_URL || (env as any).SICOOB_PIX_BASE_URL)!,
      authUrl: env.SICOOB_AUTH_URL!,
      authValidateUrl: env.SICOOB_AUTH_VALIDATE_URL,
      clientId: env.SICOOB_CLIENT_ID!,
      clientSecret: env.SICOOB_CLIENT_SECRET || undefined,
      certPath: env.SICOOB_CERT_PATH || undefined,
      keyPath: env.SICOOB_KEY_PATH || undefined,
      caPath: env.SICOOB_CA_PATH || undefined,
      caBase64: env.SICOOB_CA_BASE64 || undefined,
      pfxBase64: env.SICOOB_CERT_PFX_BASE64 || undefined,
      pfxPassphrase: env.SICOOB_CERT_PFX_PASS || undefined,
      webhookSecret: env.SICOOB_WEBHOOK_SECRET || 'dev-webhook-secret',
      cooperativa: env.SICOOB_COOPERATIVA,
      conta: env.SICOOB_CONTA,
      scopes: env.SICOOB_SCOPES
        ? env.SICOOB_SCOPES.split(/[,\s]+/)
            .filter(Boolean)
        : undefined,
    });

    registerSicoobRoutes(
      app as any,
      (env.SICOOB_WEBHOOK_SECRET || 'dev-webhook-secret'),
      "/api/sicoob"
    );

    app.log.info("Integra��o Sicoob inicializada");
  } else {
    app.log.warn(
      "Vari�veis de ambiente Sicoob ausentes. Rotas Sicoob n�o foram registradas."
    );
  }

  return app;
}

buildServer()
  .then(async (app) => {
    app.listen({ port: env.PORT, host: "127.0.0.1" }, (error, address) => {
      if (error) {
        app.log.error(error, "Falha ao iniciar servidor");
        process.exit(1);
      }
      app.log.info(`API GuiasMEI escutando em ${address}`);
      if (env.NODE_ENV !== "test") {
        try {
          startScheduler();
          startCertificateScheduler();
          app.log.info("Schedulers started");
        } catch (err) {
          app.log.error(err, "Failed to start NFSe scheduler");
        }
      }
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar servidor", error);
    process.exit(1);
  });
