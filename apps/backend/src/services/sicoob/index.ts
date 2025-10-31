/**
 * Sicoob Services Index
 * Central export point for all Sicoob services
 */

import { SicoobAuthService } from './auth.service';
import { SicoobPixService } from './pix.service';
import { SicoobBoletoService } from './boleto.service';
import { SicoobCobrancaService } from './cobranca.service';
import { SicoobWebhookService } from './webhook.service';
import type { SicoobConfig } from './types';

export { SicoobAuthService } from './auth.service';
export { SicoobPixService } from './pix.service';
export { SicoobBoletoService } from './boleto.service';
export { SicoobCobrancaService } from './cobranca.service';
export { SicoobWebhookService } from './webhook.service';
export type { WebhookHandler } from './webhook.service';
export * from './types';

let authService: SicoobAuthService | null = null;
let pixService: SicoobPixService | null = null;
let boletoService: SicoobBoletoService | null = null;
let cobrancaService: SicoobCobrancaService | null = null;
let webhookService: SicoobWebhookService | null = null;

export function initializeSicoobServices(config: SicoobConfig) {
  authService = new SicoobAuthService(config);
  pixService = new SicoobPixService(config, authService);
  boletoService = new SicoobBoletoService(config, authService);
  cobrancaService = new SicoobCobrancaService(pixService, boletoService);

  if (config.webhookSecret) {
    webhookService = new SicoobWebhookService(config.webhookSecret);
    webhookService.setupDefaultHandlers();
  }

  return {
    authService,
    pixService,
    boletoService,
    cobrancaService,
    webhookService,
  };
}

export function getAuthService(): SicoobAuthService {
  if (!authService) {
    throw new Error(
      'Sicoob services not initialized. Call initializeSicoobServices() first.'
    );
  }
  return authService;
}

export function getPixService(): SicoobPixService {
  if (!pixService) {
    throw new Error(
      'Sicoob services not initialized. Call initializeSicoobServices() first.'
    );
  }
  return pixService;
}

export function getBoletoService(): SicoobBoletoService {
  if (!boletoService) {
    throw new Error(
      'Sicoob services not initialized. Call initializeSicoobServices() first.'
    );
  }
  return boletoService;
}

export function getCobrancaService(): SicoobCobrancaService {
  if (!cobrancaService) {
    throw new Error(
      'Sicoob services not initialized. Call initializeSicoobServices() first.'
    );
  }
  return cobrancaService;
}

export function getWebhookService(): SicoobWebhookService {
  if (!webhookService) {
    throw new Error(
      'Sicoob webhook service not initialized. Ensure webhookSecret is configured.'
    );
  }
  return webhookService;
}
