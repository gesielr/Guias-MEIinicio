/**
 * Sicoob Webhook Middleware
 * Valida assinatura e timestamp dos webhooks
 */

import { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sicoobLogger } from "../utils/sicoob-logger";

export interface SicoobWebhookRequest extends Request {
  sicoobPayload?: string;
  sicoobSignature?: string;
}

/**
 * Middleware para validar webhooks do Sicoob
 */
export function sicoobWebhookMiddleware(webhookSecret: string) {
  return (
    req: SicoobWebhookRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Obter payload bruto como string
      let payload: string;

      if (typeof req.body === 'string') {
        payload = req.body;
      } else {
        payload = JSON.stringify(req.body);
      }

      // Obter assinatura do header
      const signature = req.headers['x-sicoob-signature'] as string;
      const timestamp = req.headers['x-sicoob-timestamp'] as string;

      if (!signature) {
        sicoobLogger.warn('Webhook recebido sem assinatura');
        res.status(401).json({ error: 'Assinatura não fornecida' });
        return;
      }

      if (!timestamp) {
        sicoobLogger.warn('Webhook recebido sem timestamp');
        res.status(401).json({ error: 'Timestamp não fornecido' });
        return;
      }

      // Validar timestamp (tolerância de 5 minutos)
      const eventTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const timeDiffSeconds = Math.abs(currentTime - eventTime) / 1000;
      const toleranceSeconds = 300; // 5 minutos

      if (timeDiffSeconds > toleranceSeconds) {
        sicoobLogger.warn('Webhook com timestamp fora da tolerância', {
          timeDiff: timeDiffSeconds,
          tolerance: toleranceSeconds,
        });
        res.status(401).json({ error: 'Timestamp fora da tolerância' });
        return;
      }

      // Validar assinatura HMAC
      const expectedSignature = createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      let isValid = false;
      try {
        isValid = timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      } catch (error) {
        isValid = false;
      }

      if (!isValid) {
        sicoobLogger.warn('Webhook com assinatura inválida');
        res.status(401).json({ error: 'Assinatura inválida' });
        return;
      }

      // Armazenar no request para uso posterior
      req.sicoobPayload = payload;
      req.sicoobSignature = signature;

      sicoobLogger.debug('Webhook validado com sucesso');
      next();
    } catch (error) {
      sicoobLogger.error('Erro ao validar webhook', error as Error);
      res.status(500).json({ error: 'Erro ao validar webhook' });
    }
  };
}

/**
 * Middleware para parsear JSON do webhook
 */
export function sicoobWebhookBodyParser() {
  return bodyParser.json({
    verify: (req: SicoobWebhookRequest, res: Response, buf: Buffer) => {
      req.rawBody = buf.toString('utf8');
    },
  });
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}
