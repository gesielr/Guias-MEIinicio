/**
 * SicoobBoletoService unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { SicoobBoletoService } from '../../src/services/sicoob/boleto.service';
import {
  DadosBoleto,
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

describe('SicoobBoletoService', () => {
  let config: SicoobConfig;
  const mockAuthService = {
    getAccessToken: vi.fn<[], Promise<string>>(),
  };
  let mockPost: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;

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
    mockDelete = vi.fn();

    (axios as any).create.mockReturnValue({
      post: mockPost,
      get: mockGet,
      delete: mockDelete,
    });

    mockAuthService.getAccessToken.mockResolvedValue('access-token');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const boletoBase: DadosBoleto = {
    beneficiario: {
      nome: 'Empresa',
      cpf_cnpj: '12345678901234',
    },
    pagador: {
      nome: 'Cliente',
      cpf_cnpj: '98765432100123',
    },
    valor: 150,
    data_vencimento: '2099-12-31',
    descricao: 'Serviço',
  };

  it('gera boleto chamando API com token Bearer', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        nosso_numero: '123',
        valor: 150,
        status: 'ATIVO',
      },
    });

    const service = new SicoobBoletoService(config, mockAuthService as any);
    const result = await service.gerarBoleto(boletoBase);

    expect(result.status).toBe('ATIVO');
    expect(mockAuthService.getAccessToken).toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledWith(
      '/gerar',
      boletoBase,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
  });

  it('valida campos obrigatórios antes de gerar boleto', async () => {
    const service = new SicoobBoletoService(config, mockAuthService as any);
    await expect(
      service.gerarBoleto({
        ...boletoBase,
        beneficiario: { nome: '', cpf_cnpj: '' },
      })
    ).rejects.toThrow(SicoobValidationError);
  });

  it('consulta boleto específico', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        nosso_numero: '321',
        status: 'ATIVO',
      },
    });

    const service = new SicoobBoletoService(config, mockAuthService as any);
    await service.consultarBoleto('321');

    expect(mockGet).toHaveBeenCalledWith(
      '/consultar/321',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      })
    );
  });

  it('lista boletos aplicando filtros', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        boletos: [],
        paginacao: { total_itens: 0 },
      },
    });

    const service = new SicoobBoletoService(config, mockAuthService as any);
    await service.listarBoletos({ pagina: 3, limite: 25 });

    expect(mockGet).toHaveBeenCalledWith(
      '/listar',
      expect.objectContaining({
        params: expect.objectContaining({
          pagina: '3',
          limite: '25',
        }),
      })
    );
  });

  it('cancela boleto inexistente lançando SicoobNotFoundError', async () => {
    const error = {
      isAxiosError: true,
      response: { status: 404 },
    };
    mockDelete.mockRejectedValueOnce(error);

    const service = new SicoobBoletoService(config, mockAuthService as any);

    await expect(service.cancelarBoleto('999')).rejects.toThrow(
      SicoobNotFoundError
    );
  });

  it('baixa PDF com responseType arraybuffer', async () => {
    const pdfBuffer = Buffer.from('pdf');
    mockGet.mockResolvedValueOnce({ data: pdfBuffer });

    const service = new SicoobBoletoService(config, mockAuthService as any);
    const result = await service.baixarPDF('123');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockGet).toHaveBeenCalledWith(
      '/pdf/123',
      expect.objectContaining({
        responseType: 'arraybuffer',
      })
    );
  });
});
