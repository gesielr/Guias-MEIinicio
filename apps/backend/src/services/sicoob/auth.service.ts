/**
 * Sicoob Authentication Service
 * OAuth 2.0 Client Credentials + mTLS with automatic token renewal
 */

import * as https from 'https';
import * as http from 'http';
import axios, { AxiosInstance } from 'axios';
import {
  TokenResponse,
  CertificateConfig,
  SicoobAuthError,
  SicoobCertificateError,
  SicoobConfig,
} from './types';
import { TokenCache } from '../../utils/sicoob-cache';
import { sicoobLogger } from '../../utils/sicoob-logger';
import { buildCertificateConfig } from './certificate.util';

export class SicoobAuthService {
  private readonly axiosInstance: AxiosInstance;
  private readonly tokenCache: TokenCache;
  private readonly config: SicoobConfig;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(config: SicoobConfig) {
    this.config = config;
    this.tokenCache = new TokenCache();
    this.maxRetries = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1_000;

    this.axiosInstance = this.setupHttpClient();
    sicoobLogger.info('SicoobAuthService inicializado', {
      environment: config.environment,
      baseUrl: config.baseUrl,
    });
  }

  private setupHttpClient(): AxiosInstance {
    const certificates = this.loadCertificates();
    const httpsAgent = this.setupMTLS(certificates);

    return axios.create({
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent,
      timeout: this.config.timeout || 10_000,
    });
  }

  private loadCertificates(): CertificateConfig {
    sicoobLogger.debug('Carregando certificados mTLS', {
      certPath: this.config.certPath,
      keyPath: this.config.keyPath,
      caPath: this.config.caPath,
      pfx: Boolean(this.config.pfxBase64),
    });

    return buildCertificateConfig(this.config);
  }

  private setupMTLS(certificates: CertificateConfig): https.Agent {
    try {
      const agentOptions: https.AgentOptions = {
        cert: certificates.cert,
        key: certificates.key,
        ca: certificates.ca ? [certificates.ca] : undefined,
        rejectUnauthorized: this.config.environment === 'production',
      };

      sicoobLogger.info('Agente HTTPS mTLS configurado', {
        rejectUnauthorized: agentOptions.rejectUnauthorized,
      });

      return new https.Agent(agentOptions);
    } catch (error) {
      sicoobLogger.error('Erro ao configurar mTLS', error as Error, certificates);
      throw new SicoobCertificateError(
        `Falha ao configurar mTLS: ${(error as Error).message}`
      );
    }
  }

  /**
   * Obter token de acesso com retry automático
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache.hasValidToken()) {
      if (!this.tokenCache.shouldRefreshToken()) {
        const cached = this.tokenCache.getToken();
        if (cached) {
          sicoobLogger.debug('Token válido em cache');
          return cached;
        }
      } else {
        sicoobLogger.debug('Token será renovado antecipadamente');
      }
    }

    return this.requestToken();
  }

  private async requestToken(attempt: number = 1): Promise<string> {
    try {
      sicoobLogger.debug(`Requisitando token (tentativa ${attempt})`);

      const tokenEndpoint = this.getTokenEndpoint();
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.config.clientId);
      if (this.config.clientSecret) {
        params.append('client_secret', this.config.clientSecret);
      }

      const scopes =
        this.config.scopes && this.config.scopes.length
          ? this.config.scopes
          : ['pix', 'boleto', 'cobranca'];
      params.append('scope', scopes.join(' '));

      const response = await this.axiosInstance.post<TokenResponse>(
        tokenEndpoint,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in } = response.data;
      this.tokenCache.setToken(access_token, expires_in);

      sicoobLogger.info('Token obtido com sucesso', {
        expiresIn: expires_in,
        attemptUsed: attempt,
      });

      return access_token;
    } catch (error) {
      sicoobLogger.warn(
        `Erro ao requisitar token (tentativa ${attempt}/${this.maxRetries})`,
        error as Error
      );

      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        sicoobLogger.debug('Aguardando para nova tentativa', { delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.requestToken(attempt + 1);
      }

      throw new SicoobAuthError(
        `Falha ao obter token após ${this.maxRetries} tentativas`,
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Renovar token manualmente
   */
  async refreshToken(): Promise<string> {
    sicoobLogger.info('Renovando token manualmente');
    this.tokenCache.clearToken();
    return this.requestToken();
  }

  /**
   * Validar se um token é válido
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const validationUrl = this.getTokenValidationEndpoint();

      if (!validationUrl) {
        sicoobLogger.warn('Endpoint de validação de token não configurado');
        return true;
      }

      const params = new URLSearchParams();
      params.append('token', token);
      params.append('client_id', this.config.clientId);
      if (this.config.clientSecret) {
        params.append('client_secret', this.config.clientSecret);
      }

      await this.axiosInstance.post(validationUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      sicoobLogger.debug('Token validado com sucesso');
      return true;
    } catch (error) {
      sicoobLogger.warn('Token inválido ou expirado', error as Error);
      return false;
    }
  }

  /**
   * Obter informações do cliente autenticado
   */
  async getClientInfo(): Promise<Record<string, any>> {
    try {
      const token = await this.getAccessToken();
      const clientInfoUrl = new URL(
        '/client/info',
        this.getAuthBaseUrl()
      ).toString();

      const response = await this.axiosInstance.get(clientInfoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      sicoobLogger.debug('Informações do cliente obtidas');
      return response.data;
    } catch (error) {
      sicoobLogger.error(
        'Erro ao obter informações do cliente',
        error as Error
      );
      throw new SicoobAuthError(
        `Falha ao obter informações do cliente: ${(error as Error).message}`
      );
    }
  }

  /**
   * Limpar cache de token
   */
  clearCache(): void {
    this.tokenCache.clearToken();
    sicoobLogger.info('Cache de token limpo');
  }

  private getTokenEndpoint(): string {
    return this.config.authUrl;
  }

  private getAuthBaseUrl(): string {
    try {
      const url = new URL(this.config.authUrl);
      if (url.pathname.endsWith('/token')) {
        url.pathname = url.pathname.slice(
          0,
          url.pathname.length - '/token'.length
        );
      }
      if (!url.pathname.endsWith('/')) {
        url.pathname += '/';
      }
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch (error) {
      sicoobLogger.warn('Não foi possível derivar auth base URL', {
        authUrl: this.config.authUrl,
      });
      return this.config.authUrl;
    }
  }

  private getTokenValidationEndpoint(): string | null {
    if (this.config.authValidateUrl) {
      return this.config.authValidateUrl;
    }

    try {
      const url = new URL(this.config.authUrl);
      if (url.pathname.endsWith('/token')) {
        url.pathname = url.pathname.replace(/\/token$/, '/token/validate');
        return url.toString();
      }
    } catch (error) {
      sicoobLogger.warn('Não foi possível derivar endpoint de validação', {
        authUrl: this.config.authUrl,
      });
    }

    return null;
  }
}
