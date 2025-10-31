/**
 * Integration-like tests for Sicoob service bootstrap
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import {
  initializeSicoobServices,
  getAuthService,
  getPixService,
  getBoletoService,
  getCobrancaService,
  getWebhookService,
} from '../../src/services/sicoob';
import type { SicoobConfig } from '../../src/services/sicoob/types';

vi.mock('axios', () => {
  const create = vi.fn().mockReturnValue({
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  });
  const isAxiosError = (error: any) => Boolean(error?.isAxiosError);
  return {
    default: { create, isAxiosError },
    create,
    isAxiosError,
  };
});

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('-----CERT-----'),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('https', () => ({
  Agent: vi.fn().mockImplementation(function MockAgent() {}),
}));

describe('initializeSicoobServices', () => {
  let config: SicoobConfig;

  beforeEach(() => {
    config = {
      environment: 'sandbox',
      baseUrl: 'https://api.sicoob.test',
      authUrl: 'https://auth.sicoob.test/token',
      clientId: 'client',
      clientSecret: 'secret',
      certPath: './certificates/cert.pem',
      keyPath: './certificates/key.pem',
      webhookSecret: 'whsec',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retorna instâncias únicas compartilhadas entre helpers', () => {
    const { authService, pixService, boletoService, cobrancaService } =
      initializeSicoobServices(config);

    expect(authService).toBe(getAuthService());
    expect(pixService).toBe(getPixService());
    expect(boletoService).toBe(getBoletoService());
    expect(cobrancaService.getPixService()).toBe(pixService);
    expect(cobrancaService.getBoletoService()).toBe(boletoService);
  });

  it('inicializa serviço de webhook quando webhookSecret informado', () => {
    initializeSicoobServices(config);
    const webhookService = getWebhookService();

    expect(webhookService).toBeDefined();
    expect(typeof webhookService.processWebhook).toBe('function');
  });

  it('permite reinicialização com nova configuração', () => {
    initializeSicoobServices(config);
    const firstPix = getPixService();

    const newConfig = { ...config, timeout: 10_000 };
    const secondInit = initializeSicoobServices(newConfig);

    expect(secondInit.pixService).not.toBe(firstPix);
    expect(getPixService()).toBe(secondInit.pixService);
  });
});
