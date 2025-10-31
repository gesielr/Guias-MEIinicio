/**
 * Sicoob Cobrança Service
 * Centraliza operações de cobranças PIX e Boleto reutilizando os serviços específicos.
 */

import {
  CobrancaData,
  PixModalidade,
  SicoobValidationError,
} from './types';
import { SicoobPixService } from './pix.service';
import { SicoobBoletoService } from './boleto.service';
import { sicoobLogger } from '../../utils/sicoob-logger';

export class SicoobCobrancaService {
  private readonly pixService: SicoobPixService;
  private readonly boletoService: SicoobBoletoService;

  constructor(pixService: SicoobPixService, boletoService: SicoobBoletoService) {
    this.pixService = pixService;
    this.boletoService = boletoService;
    sicoobLogger.info('SicoobCobrancaService inicializado');
  }

  /**
   * Criar cobrança genérica (delegando para PIX ou Boleto).
   */
  async criarCobranca(dados: CobrancaData): Promise<any> {
    try {
      this.validarDadosCobranca(dados);

      sicoobLogger.debug('Criando cobrança', { tipo: dados.tipo });

      if (dados.tipo === 'PIX') {
        return this.criarCobrancaPix(dados);
      }

      return this.criarCobrancaBoleto(dados);
    } catch (error) {
      sicoobLogger.error('Erro ao criar cobrança', error as Error, {
        tipo: dados.tipo,
      });
      throw error;
    }
  }

  /**
   * Consultar cobrança por identificador.
   */
  async consultarCobranca(id: string, tipo: 'PIX' | 'BOLETO'): Promise<any> {
    try {
      sicoobLogger.debug('Consultando cobrança', { id, tipo });

      if (tipo === 'PIX') {
        return this.pixService.consultarCobranca(id);
      }

      if (tipo === 'BOLETO') {
        return this.boletoService.consultarBoleto(id);
      }

      throw new SicoobValidationError(`Tipo de cobrança inválido: ${tipo}`);
    } catch (error) {
      sicoobLogger.error('Erro ao consultar cobrança', error as Error, {
        id,
        tipo,
      });
      throw error;
    }
  }

  /**
   * Cancelar cobrança.
   */
  async cancelarCobranca(id: string, tipo: 'PIX' | 'BOLETO'): Promise<void> {
    try {
      sicoobLogger.debug('Cancelando cobrança', { id, tipo });

      if (tipo === 'PIX') {
        await this.pixService.cancelarCobranca(id);
        return;
      }

      if (tipo === 'BOLETO') {
        await this.boletoService.cancelarBoleto(id);
        return;
      }

      throw new SicoobValidationError(`Tipo de cobrança inválido: ${tipo}`);
    } catch (error) {
      sicoobLogger.error('Erro ao cancelar cobrança', error as Error, {
        id,
        tipo,
      });
      throw error;
    }
  }

  /**
   * Atualizar cobrança. Implementado como cancelamento seguido de nova criação.
   */
  async atualizarCobranca(
    id: string,
    tipo: 'PIX' | 'BOLETO',
    dados: Partial<CobrancaData>
  ): Promise<any> {
    try {
      sicoobLogger.debug('Atualizando cobrança', { id, tipo });

      if (tipo === 'PIX') {
        if (!dados.pix) {
          throw new SicoobValidationError(
            'Dados PIX são obrigatórios para atualização'
          );
        }
        await this.cancelarCobranca(id, tipo);
        return this.criarCobranca({
          tipo: 'PIX',
          descricao: dados.descricao,
          pix: dados.pix,
          metadados: dados.metadados,
        });
      }

      if (tipo === 'BOLETO') {
        if (!dados.boleto) {
          throw new SicoobValidationError(
            'Dados de boleto são obrigatórios para atualização'
          );
        }
        await this.cancelarCobranca(id, tipo);
        return this.criarCobranca({
          tipo: 'BOLETO',
          descricao: dados.descricao,
          boleto: dados.boleto,
          metadados: dados.metadados,
        });
      }

      throw new SicoobValidationError(`Tipo de cobrança inválido: ${tipo}`);
    } catch (error) {
      sicoobLogger.error('Erro ao atualizar cobrança', error as Error, {
        id,
        tipo,
      });
      throw error;
    }
  }

  /**
   * Listar cobranças com paginação.
   */
  async listarCobrancas(tipo: 'PIX' | 'BOLETO', pagina: number = 1) {
    try {
      sicoobLogger.debug('Listando cobranças', { tipo, pagina });

      if (tipo === 'PIX') {
        return this.pixService.listarCobrancas({
          pagina,
          limite: 20,
        });
      }

      if (tipo === 'BOLETO') {
        return this.boletoService.listarBoletos({
          pagina,
          limite: 20,
        });
      }

      throw new SicoobValidationError(`Tipo de cobrança inválido: ${tipo}`);
    } catch (error) {
      sicoobLogger.error('Erro ao listar cobranças', error as Error, { tipo });
      throw error;
    }
  }

  getPixService(): SicoobPixService {
    return this.pixService;
  }

  getBoletoService(): SicoobBoletoService {
    return this.boletoService;
  }

  private validarDadosCobranca(dados: CobrancaData): void {
    if (dados.tipo !== 'PIX' && dados.tipo !== 'BOLETO') {
      throw new SicoobValidationError(
        'Tipo de cobrança deve ser PIX ou BOLETO'
      );
    }

    if (dados.tipo === 'PIX') {
      if (!dados.pix) {
        throw new SicoobValidationError('Payload PIX é obrigatório');
      }
      if (!dados.pix.modalidade) {
        throw new SicoobValidationError('Modalidade do PIX é obrigatória');
      }
      if (dados.pix.modalidade === 'IMEDIATA' && !dados.pix.imediata) {
        throw new SicoobValidationError(
          'Dados para cobrança PIX imediata são obrigatórios'
        );
      }
      if (
        dados.pix.modalidade === 'COM_VENCIMENTO' &&
        !dados.pix.comVencimento
      ) {
        throw new SicoobValidationError(
          'Dados para cobrança PIX com vencimento são obrigatórios'
        );
      }
      return;
    }

    if (dados.tipo === 'BOLETO') {
      if (!dados.boleto || !dados.boleto.dados) {
        throw new SicoobValidationError('Dados de boleto são obrigatórios');
      }
    }
  }

  private criarCobrancaPix(dados: CobrancaData) {
    if (!dados.pix) {
      throw new SicoobValidationError('Payload PIX é obrigatório');
    }

    if (dados.pix.modalidade === 'IMEDIATA') {
      return this.pixService.criarCobrancaImediata(
        dados.pix.imediata as NonNullable<typeof dados.pix.imediata>
      );
    }

    if (dados.pix.modalidade === 'COM_VENCIMENTO') {
      return this.pixService.criarCobrancaComVencimento(
        dados.pix.comVencimento as NonNullable<typeof dados.pix.comVencimento>
      );
    }

    throw new SicoobValidationError(
      `Modalidade PIX inválida: ${dados.pix.modalidade as PixModalidade}`
    );
  }

  private criarCobrancaBoleto(dados: CobrancaData) {
    if (!dados.boleto) {
      throw new SicoobValidationError('Dados de boleto são obrigatórios');
    }

    return this.boletoService.gerarBoleto(dados.boleto.dados);
  }
}
