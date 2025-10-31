/**
 * Sicoob Boleto Service
 * Gerenciamento de boletos bancários
 */

import axios, { AxiosInstance } from 'axios';
import {
  DadosBoleto,
  BoletoResponse,
  ListaBoletos,
  FiltrosBoleto,
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

export class SicoobBoletoService {
  private axiosInstance: AxiosInstance;
  private authService: SicoobAuthService;
  private config: SicoobConfig;

  constructor(config: SicoobConfig, authService: SicoobAuthService) {
    this.config = config;
    this.authService = authService;
    this.axiosInstance = this.setupHttpClient();
    sicoobLogger.info('SicoobBoletoService inicializado');
  }

  private setupHttpClient(): AxiosInstance {
    const httpsAgent = this.setupMTLS();

    return axios.create({
      baseURL: `${this.config.baseUrl}/boleto`,
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
      sicoobLogger.error('Erro ao configurar mTLS para Boleto', error as Error);
      throw error;
    }
  }

  /**
   * Gerar boleto bancário
   */
  async gerarBoleto(dados: DadosBoleto): Promise<BoletoResponse> {
    try {
      this.validarDadosBoleto(dados);
      sicoobLogger.debug('Gerando boleto', {
        valor: dados.valor,
        dataVencimento: dados.data_vencimento,
      });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.post<BoletoResponse>(
        '/gerar',
        dados,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      sicoobLogger.info('Boleto gerado com sucesso', {
        nossoNumero: response.data.nosso_numero,
        valor: response.data.valor,
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'Erro ao gerar boleto');
      throw error;
    }
  }

  /**
   * Consultar boleto por nosso número
   */
  async consultarBoleto(nossoNumero: string): Promise<BoletoResponse> {
    try {
      if (!nossoNumero || nossoNumero.trim() === '') {
        throw new SicoobValidationError('Nosso número é obrigatório');
      }

      sicoobLogger.debug('Consultando boleto', { nossoNumero });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.get<BoletoResponse>(
        `/consultar/${nossoNumero}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.debug('Boleto consultado com sucesso', {
        nossoNumero,
        status: response.data.status,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SicoobNotFoundError(`Boleto não encontrado: ${nossoNumero}`);
      }
      this.handleError(error, 'Erro ao consultar boleto');
      throw error;
    }
  }

  /**
   * Cancelar boleto
   */
  async cancelarBoleto(nossoNumero: string): Promise<void> {
    try {
      if (!nossoNumero || nossoNumero.trim() === '') {
        throw new SicoobValidationError('Nosso número é obrigatório');
      }

      sicoobLogger.debug('Cancelando boleto', { nossoNumero });

      const token = await this.authService.getAccessToken();
      await this.axiosInstance.delete(
        `/cancelar/${nossoNumero}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.info('Boleto cancelado com sucesso', { nossoNumero });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SicoobNotFoundError(`Boleto não encontrado: ${nossoNumero}`);
      }
      this.handleError(error, 'Erro ao cancelar boleto');
      throw error;
    }
  }

  /**
   * Listar boletos com filtros
   */
  async listarBoletos(filtros?: FiltrosBoleto): Promise<ListaBoletos> {
    try {
      sicoobLogger.debug('Listando boletos', filtros);

      const token = await this.authService.getAccessToken();
      const params = new URLSearchParams();

      if (filtros?.status) params.append('status', filtros.status);
      if (filtros?.data_inicio)
        params.append('data_inicio', filtros.data_inicio);
      if (filtros?.data_fim) params.append('data_fim', filtros.data_fim);
      if (filtros?.pagina) params.append('pagina', filtros.pagina.toString());
      if (filtros?.limite) params.append('limite', filtros.limite.toString());

      const response = await this.axiosInstance.get<ListaBoletos>(
        '/listar',
        {
          params: Object.fromEntries(params),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      sicoobLogger.debug('Boletos listados', {
        total: response.data.paginacao.total_itens,
      });

      return response.data;
    } catch (error) {
      this.handleError(error, 'Erro ao listar boletos');
      throw error;
    }
  }

  /**
   * Baixar PDF do boleto
   */
  async baixarPDF(nossoNumero: string): Promise<Buffer> {
    try {
      if (!nossoNumero || nossoNumero.trim() === '') {
        throw new SicoobValidationError('Nosso número é obrigatório');
      }

      sicoobLogger.debug('Baixando PDF do boleto', { nossoNumero });

      const token = await this.authService.getAccessToken();
      const response = await this.axiosInstance.get(
        `/pdf/${nossoNumero}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
        }
      );

      sicoobLogger.info('PDF do boleto baixado com sucesso', { nossoNumero });

      return Buffer.from(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new SicoobNotFoundError(`Boleto não encontrado: ${nossoNumero}`);
      }
      this.handleError(error, 'Erro ao baixar PDF do boleto');
      throw error;
    }
  }

  /**
   * Validar dados do boleto
   */
  private validarDadosBoleto(dados: DadosBoleto): void {
    if (!dados.beneficiario || !dados.beneficiario.nome) {
      throw new SicoobValidationError('Beneficiário e nome são obrigatórios');
    }

    if (!dados.beneficiario.cpf_cnpj) {
      throw new SicoobValidationError(
        'CPF/CNPJ do beneficiário é obrigatório'
      );
    }

    if (!dados.pagador || !dados.pagador.nome) {
      throw new SicoobValidationError('Pagador e nome são obrigatórios');
    }

    if (!dados.pagador.cpf_cnpj) {
      throw new SicoobValidationError('CPF/CNPJ do pagador é obrigatório');
    }

    if (!dados.valor || dados.valor <= 0) {
      throw new SicoobValidationError('Valor deve ser maior que 0');
    }

    if (!dados.data_vencimento) {
      throw new SicoobValidationError('Data de vencimento é obrigatória');
    }

    const dataVencimento = new Date(dados.data_vencimento);
    if (isNaN(dataVencimento.getTime())) {
      throw new SicoobValidationError('Data de vencimento inválida');
    }

    if (dataVencimento < new Date()) {
      throw new SicoobValidationError(
        'Data de vencimento não pode ser no passado'
      );
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
