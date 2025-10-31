/**
 * SicoobAuthService unit tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SicoobAuthService } from '../../src/services/sicoob/auth.service';
import type { SicoobConfig } from '../../src/services/sicoob/types';
import axios from 'axios';

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
  readFileSync: vi.fn().mockReturnValue('-----BEGIN CERT-----'),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('https', () => ({
  Agent: vi.fn().mockImplementation(function MockAgent() {}),
}));

describe('SicoobAuthService', () => {
  let config: SicoobConfig;
  let mockPost: ReturnType<typeof vi.fn>;

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
      retryAttempts: 1,
      retryDelay: 10,
      scopes: ['pix', 'boleto'],
    };

    mockPost = vi.fn();
    (axios as any).create.mockReturnValue({
      post: mockPost,
      get: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('solicita token usando payload form-urlencoded e armazena em cache', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    });

    const authService = new SicoobAuthService(config);
    const token = await authService.getAccessToken();

    expect(token).toBe('token-123');
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [endpoint, body] = mockPost.mock.calls[0];
    expect(endpoint).toBe(config.authUrl);
    expect(typeof body).toBe('string');
    expect(body).toContain('grant_type=client_credentials');
    expect(body).toContain('client_id=client');
    expect(body).toContain('scope=pix+boleto');

    // Segunda chamada deve usar o cache e não chamar o endpoint novamente
    const cachedToken = await authService.getAccessToken();
    expect(cachedToken).toBe('token-123');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('deriva endpoint de validação quando não configurado explicitamente', async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          access_token: 'token-abc',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      })
      .mockResolvedValueOnce({}); // chamada de validação

    const authService = new SicoobAuthService(config);
    await authService.getAccessToken();
    const isValid = await authService.validateToken('token-abc');

    expect(isValid).toBe(true);
    expect(mockPost).toHaveBeenNthCalledWith(2, `${config.authUrl}/validate`, expect.any(String), expect.any(Object));
  });

  it('retorna false quando validação falha', async () => {
    mockPost
      .mockResolvedValueOnce({
        data: {
          access_token: 'token-abc',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      })
      .mockRejectedValueOnce(new Error('invalid token'));

    const authService = new SicoobAuthService(config);
    await authService.getAccessToken();
    const isValid = await authService.validateToken('fake');

    expect(isValid).toBe(false);
  });
});
