/**
 * Sicoob PIX Service
 * Gerenciamento de cobranças PIX (imediata e com vencimento)
 */

import axios, { AxiosInstance } from 'axios';
import {
  CobrancaPixImediata,
  CobrancaPixVencimento,
  CobrancaResponse,
  ListaCobrancas,
  FiltrosCobranca,
  QRCodeResponse,
  SicoobConfig,
  SicoobValidationError,
  SicoobNotFoundError,
  SicoobServerError,
} from './types';
import { SicoobAuthService } from './auth.service';
import { sicoobLogger } from '../../utils/sicoob-logger';
import * as https from 'https';
import * as http from 'http';
import { buildCertificateConfig } from './certificate.util';

export class SicoobPixService {
  private axiosInstance: AxiosInstance;
  private authService: SicoobAuthService;
  private config: SicoobConfig;

  constructor(config: SicoobConfig, authService: SicoobAuthService) {
    this.config = config;
    this.authService = authService;
    this.axiosInstance = this.setupHttpClient();
    sicoobLogger.info('SicoobPixService inicializado');
  }

  private setupHttpClient(): AxiosInstance {
    const httpsAgent = this.setupMTLS();

    return axios.create({
      baseURL: `${this.config.baseUrl}/pix`,
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: httpsAgent,
      timeout: this.config.timeout || 30000,
    });
  }

  private setupMTLS(): https.Agent {
    try {
      const certificates = buildCertificateConfig(this.config);

      return new https.Agent({
        cert: certificates.cert,
        key: certificates.key,
        ca: certificates.ca ? [certificates.ca] : undefined,
        rejectUnauthorized: this.config.environment === 'production',
      });
    } catch (error) {
      sicoobLogger.error('Erro ao configurar mTLS para PIX', error as Error);
      throw error;
    }
  }

  /**
   * Criar cobrança PIX imediata
   */
  async criarCobrancaImediata(
    dados: CobrancaPixImediata
  ): Promise<CobrancaResponse> {
    try {
      this.validarDadosCobranca(dados);
      sicoobLogger.debug('Criando cobrança PIX imediata', { valor: dados.valor });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.post<CobrancaResponse>(
        '/cobranca-imediata',
        dados,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      sicoobLogger.info('Cobrança PIX imediata criada', {
        txid: response.data.txid,
        valor: response.data.valor,
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'Erro ao criar cobrança PIX imediata');
      throw error;
    }
  }

  /**
   * Criar cobrança PIX com vencimento
   */
  async criarCobrancaComVencimento(
    dados: CobrancaPixVencimento
  ): Promise<CobrancaResponse> {
    try {
      this.validarDadosCobranca(dados);
      sicoobLogger.debug('Criando cobrança PIX com vencimento', {
        valor: dados.valor,
        dataVencimento: dados.data_vencimento,
      });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.post<CobrancaResponse>(
        '/cobranca-vencimento',
        dados,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      sicoobLogger.info('Cobrança PIX com vencimento criada', {
        txid: response.data.txid,
        valor: response.data.valor,
        dataVencimento: response.data.data_vencimento,
      });

      return response.data;
    } catch (error) {
      this.handleError(
        error,
        'Erro ao criar cobrança PIX com vencimento'
      );
      throw error;
    }
  }

  /**
   * Consultar cobrança PIX por TXID
   */
  async consultarCobranca(txid: string): Promise<CobrancaResponse> {
    try {
      if (!txid || txid.trim() === '') {
        throw new SicoobValidationError('TXID é obrigatório');
      }

      sicoobLogger.debug('Consultando cobrança PIX', { txid });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.get<CobrancaResponse>(
        `/cobranca/${txid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.debug('Cobrança consultada com sucesso', {
        txid,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SicoobNotFoundError(`Cobrança não encontrada: ${txid}`);
      }
      this.handleError(error, 'Erro ao consultar cobrança');
      throw error;
    }
  }

  /**
   * Listar cobranças PIX com filtros
   */
  async listarCobrancas(filtros?: FiltrosCobranca): Promise<ListaCobrancas> {
    try {
      sicoobLogger.debug('Listando cobranças PIX', filtros);

      const token = await this.authService.getAccessToken();
      const params = new URLSearchParams();

      if (filtros?.status) params.append('status', filtros.status);
      if (filtros?.data_inicio)
        params.append('data_inicio', filtros.data_inicio);
      if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
      if (filtros?.pagina) params.append('pagina', filtros.pagina.toString());
      if (filtros?.limite) params.append('limite', filtros.limite.toString());

      const response = await this.axiosInstance.get<ListaCobrancas>(
        '/cobrancas',
        {
          params: Object.fromEntries(params),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.debug('Cobranças listadas', {
        total: response.data.paginacao.total_itens,
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'Erro ao listar cobranças');
      throw error;
    }
  }

  /**
   * Cancelar ou devolver cobrança PIX
   */
  async cancelarCobranca(txid: string): Promise<void> {
    try {
      if (!txid || txid.trim() === '') {
        throw new SicoobValidationError('TXID é obrigatório');
      }

      sicoobLogger.debug('Cancelando cobrança PIX', { txid });

      const token = await this.authService.getAccessToken();
      await this.axiosInstance.delete(
        `/cobranca/${txid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.info('Cobrança cancelada com sucesso', { txid });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SicoobNotFoundError(`Cobrança não encontrada: ${txid}`);
      }
      this.handleError(error, 'Erro ao cancelar cobrança');
      throw error;
    }
  }

  /**
   * Consultar QR Code de cobrança
   */
  async consultarQRCode(txid: string): Promise<QRCodeResponse> {
    try {
      if (!txid || txid.trim() === '') {
        throw new SicoobValidationError('TXID é obrigatório');
      }

      sicoobLogger.debug('Consultando QR Code', { txid });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.get<QRCodeResponse>(
        `/qrcode/${txid}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.debug('QR Code obtido com sucesso', { txid });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SicoobNotFoundError(
          `QR Code não encontrado para TXID: ${txid}`
        );
      }
      this.handleError(error, 'Erro ao consultar QR Code');
      throw error;
    }
  }

  /**
   * Validar dados de cobrança
   */
  private validarDadosCobranca(dados: any): void {
    if (!dados.chave_pix || dados.chave_pix.trim() === '') {
      throw new SicoobValidationError('Chave PIX é obrigatória');
    }

    if (!dados.valor || dados.valor <= 0) {
      throw new SicoobValidationError('Valor deve ser maior que 0');
    }

    if ('data_vencimento' in dados && dados.data_vencimento) {
      const dataVencimento = new Date(dados.data_vencimento);
      if (isNaN(dataVencimento.getTime())) {
        throw new SicoobValidationError('Data de vencimento inválida');
      }
    }
  }

  /**
   * Tratar erros da API
   */
  private handleError(error: any, defaultMessage: string): void {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data;

      if (status === 400) {
        sicoobLogger.warn(defaultMessage, {
          error: data,
          status,
        });
        throw new SicoobValidationError(defaultMessage, data);
      }

      if (status === 429) {
        sicoobLogger.warn('Rate limit atingido', {
          retryAfter: error.response?.headers['retry-after'],
        });
      }

      if (status && status >= 500) {
        sicoobLogger.error(defaultMessage, error, {
          status,
          data,
        });
        throw new SicoobServerError(defaultMessage, status, data);
      }
    }

    sicoobLogger.error(defaultMessage, error as Error);
  }
}
