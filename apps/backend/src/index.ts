import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import { env } from "./env";
import { registerAuthRoutes } from "../routes/auth";
import { registerDashboardRoutes } from "../routes/dashboard";
import { registerNfseController } from "./nfse/controllers/nfse.controller";
import { startScheduler } from "./nfse/workers/scheduler";
import { registerGpsRoutes } from "../routes/gps";
import { registerPaymentRoutes } from "../routes/payments";
import { registerWhatsappRoutes } from "../routes/whatsapp";
import { testSupabaseConnection } from "./test-supabase";

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
  await registerGpsRoutes(app);
  await registerPaymentRoutes(app);
  await registerWhatsappRoutes(app);

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
      if (env.NODE_ENV !== 'test') {
        try {
          startScheduler();
          app.log.info('NFSe scheduler started');
        } catch (err) {
          app.log.error(err, 'Failed to start NFSe scheduler');
        }
      }
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar servidor", error);
    process.exit(1);
  });
