/**
 * Sicoob Routes
 * Express router para endpoints Sicoob
 */

import { Router, Request, Response, NextFunction } from 'express';
import { SicoobController } from '../controllers/sicoob.controller';
import { sicoobWebhookMiddleware, sicoobWebhookBodyParser } from '../middleware/sicoob-webhook.middleware';
import { sicoobLogger } from '../utils/sicoob-logger';
import { createSicoobJwtMiddleware } from '../middleware/sicoob-auth.middleware';
import { createSicoobRateLimitMiddleware } from '../middleware/sicoob-rate-limit.middleware';
import {
  validateBody,
  validateParams,
  validateQuery,
  criarPixImediataSchema,
  criarPixComVencimentoSchema,
  listarPixQuerySchema,
  criarBoletoSchema,
  listarBoletosQuerySchema,
  cobrancaGenericaSchema,
  txidParamSchema,
  nossoNumeroParamSchema,
  cobrancaIdParamSchema,
} from './sicoob.validators';

export function createSicoobRoutes(webhookSecret: string): Router {
  const router = Router();
  const authenticate = createSicoobJwtMiddleware();
  const rateLimiter = createSicoobRateLimitMiddleware({
    windowMs: 60_000,
    max: 60,
  });
  const webhookRateLimiter = createSicoobRateLimitMiddleware({
    windowMs: 60_000,
    max: 120,
    keyGenerator: (req) => req.ip ?? 'unknown',
  });

  // Middleware de logging
  router.use((req: Request, res: Response, next: NextFunction) => {
    sicoobLogger.debug(`${req.method} ${req.path}`);
    next();
  });

  // ============================================================
  // HEALTH CHECK
  // ============================================================
  router.get('/health', SicoobController.healthCheck);

  // ============================================================
  // PIX ENDPOINTS
  // ============================================================

  // POST /api/sicoob/pix/cobranca-imediata
  router.post(
    '/pix/cobranca-imediata',
    rateLimiter,
    authenticate,
    validateBody(criarPixImediataSchema),
    SicoobController.criarCobrancaPixImediata
  );

  // POST /api/sicoob/pix/cobranca-vencimento
  router.post(
    '/pix/cobranca-vencimento',
    rateLimiter,
    authenticate,
    validateBody(criarPixComVencimentoSchema),
    SicoobController.criarCobrancaPixVencimento
  );

  // GET /api/sicoob/pix/cobranca/:txid
  router.get(
    '/pix/cobranca/:txid',
    rateLimiter,
    authenticate,
    validateParams(txidParamSchema),
    SicoobController.consultarCobrancaPix
  );

  // GET /api/sicoob/pix/cobracas
  router.get(
    '/pix/cobracas',
    rateLimiter,
    authenticate,
    validateQuery(listarPixQuerySchema),
    SicoobController.listarCobrancasPix
  );

  // DELETE /api/sicoob/pix/cobranca/:txid
  router.delete(
    '/pix/cobranca/:txid',
    rateLimiter,
    authenticate,
    validateParams(txidParamSchema),
    SicoobController.cancelarCobrancaPix
  );

  // GET /api/sicoob/pix/qrcode/:txid
  router.get(
    '/pix/qrcode/:txid',
    rateLimiter,
    authenticate,
    validateParams(txidParamSchema),
    SicoobController.consultarQRCode
  );

  // ============================================================
  // BOLETO ENDPOINTS
  // ============================================================

  // POST /api/sicoob/boleto
  router.post(
    '/boleto',
    rateLimiter,
    authenticate,
    validateBody(criarBoletoSchema),
    SicoobController.gerarBoleto
  );

  // GET /api/sicoob/boleto/:nossoNumero
  router.get(
    '/boleto/:nossoNumero',
    rateLimiter,
    authenticate,
    validateParams(nossoNumeroParamSchema),
    SicoobController.consultarBoleto
  );

  // GET /api/sicoob/boletos
  router.get(
    '/boletos',
    rateLimiter,
    authenticate,
    validateQuery(listarBoletosQuerySchema),
    SicoobController.listarBoletos
  );

  // DELETE /api/sicoob/boleto/:nossoNumero
  router.delete(
    '/boleto/:nossoNumero',
    rateLimiter,
    authenticate,
    validateParams(nossoNumeroParamSchema),
    SicoobController.cancelarBoleto
  );

  // GET /api/sicoob/boleto/:nossoNumero/pdf
  router.get(
    '/boleto/:nossoNumero/pdf',
    rateLimiter,
    authenticate,
    validateParams(nossoNumeroParamSchema),
    SicoobController.baixarPDFBoleto
  );

  // ============================================================
  // COBRANCA ENDPOINTS
  // ============================================================

  // POST /api/sicoob/cobranca
  router.post(
    '/cobranca',
    rateLimiter,
    authenticate,
    validateBody(cobrancaGenericaSchema),
    SicoobController.criarCobranca
  );

  // GET /api/sicoob/cobranca/:id
  router.get(
    '/cobranca/:id',
    rateLimiter,
    authenticate,
    validateParams(cobrancaIdParamSchema),
    SicoobController.consultarCobranca
  );

  // PUT /api/sicoob/cobranca/:id
  router.put(
    '/cobranca/:id',
    rateLimiter,
    authenticate,
    validateParams(cobrancaIdParamSchema),
    validateBody(cobrancaGenericaSchema.partial()),
    SicoobController.atualizarCobranca
  );

  // DELETE /api/sicoob/cobranca/:id
  router.delete(
    '/cobranca/:id',
    rateLimiter,
    authenticate,
    validateParams(cobrancaIdParamSchema),
    SicoobController.cancelarCobranca
  );

  // GET /api/sicoob/cobrancas
  router.get(
    '/cobrancas',
    rateLimiter,
    authenticate,
    SicoobController.listarCobrancas
  );

  // ============================================================
  // WEBHOOK ENDPOINT
  // ============================================================

  // POST /api/sicoob/webhook
  router.post(
    '/webhook',
    webhookRateLimiter,
    sicoobWebhookBodyParser(),
    sicoobWebhookMiddleware(webhookSecret),
    SicoobController.receberWebhook
  );

  return router;
}

/**
 * Função helper para registrar rotas no app principal
 */
export function registerSicoobRoutes(
  app: any,
  webhookSecret: string,
  basePath: string = '/api/sicoob'
): void {
  const router = createSicoobRoutes(webhookSecret);
  app.use(basePath, router);
  sicoobLogger.info('Rotas Sicoob registradas', { basePath });
}
