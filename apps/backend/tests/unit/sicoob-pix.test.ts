/**
 * SicoobPixService unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { SicoobPixService } from '../../src/services/sicoob/pix.service';
import {
  SicoobConfig,
  SicoobValidationError,
  SicoobNotFoundError,
} from '../../src/services/sicoob/types';

vi.mock('axios', () => {
  const create = vi.fn();
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

describe('SicoobPixService', () => {
  let config: SicoobConfig;
  let mockPost: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;
  const mockAuthService = {
    getAccessToken: vi.fn<[], Promise<string>>(),
  };

  beforeEach(() => {
    config = {
      environment: 'sandbox',
      baseUrl: 'https://api.sicoob.test',
      authUrl: 'https://auth.sicoob.test/token',
      clientId: 'client',
      clientSecret: 'secret',
      certPath: './certificates/cert.pem',
      keyPath: './certificates/key.pem',
      timeout: 5_000,
    };

    mockPost = vi.fn();
    mockGet = vi.fn();
    (axios as any).create.mockReturnValue({
      post: mockPost,
      get: mockGet,
      delete: vi.fn(),
    });
    mockAuthService.getAccessToken.mockResolvedValue('access-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('cria cobrança PIX imediata com token de acesso', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        txid: 'TX123',
        valor: 100,
        status: 'VIGENTE',
      },
    });

    const service = new SicoobPixService(config, mockAuthService as any);
    const payload = {
      chave_pix: '12345678900',
      valor: 100,
      solicitacao_pagador: 'Teste',
    };
    const result = await service.criarCobrancaImediata(payload as any);

    expect(result.txid).toBe('TX123');
    expect(mockAuthService.getAccessToken).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith(
      '/cobranca-imediata',
      payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
  });

  it('valida dados obrigatórios antes de criar cobrança', async () => {
    const service = new SicoobPixService(config, mockAuthService as any);

    await expect(
      service.criarCobrancaImediata({
        chave_pix: '',
        valor: 10,
      } as any)
    ).rejects.toThrow(SicoobValidationError);
  });

  it('lista cobranças aplicando filtros de query', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        cobrancas: [],
        paginacao: {
          pagina_atual: 1,
          total_paginas: 1,
          total_itens: 0,
        },
      },
    });

    const service = new SicoobPixService(config, mockAuthService as any);
    const filtros = {
      pagina: 2,
      limite: 50,
      status: 'VIGENTE' as const,
    };

    await service.listarCobrancas(filtros);

    expect(mockGet).toHaveBeenCalledWith(
      '/cobrancas',
      expect.objectContaining({
        params: expect.objectContaining({
          pagina: '2',
          limite: '50',
          status: 'VIGENTE',
        }),
      })
    );
  });

  it('lança SicoobNotFoundError ao cancelar cobrança inexistente', async () => {
    const error = {
      isAxiosError: true,
      response: { status: 404 },
    };
    (axios as any).create.mockReturnValueOnce({
      post: mockPost,
      get: mockGet,
      delete: vi.fn().mockRejectedValue(error),
    });

    const service = new SicoobPixService(config, mockAuthService as any);

    await expect(service.cancelarCobranca('inexistente')).rejects.toThrow(
      SicoobNotFoundError
    );
  });

  it('consulta QR Code com token válido', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        txid: 'TX777',
        qr_code: '0002...',
      },
    });

    const service = new SicoobPixService(config, mockAuthService as any);
    await service.consultarQRCode('TX777');

    expect(mockGet).toHaveBeenCalledWith(
      '/qrcode/TX777',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
  });
});
