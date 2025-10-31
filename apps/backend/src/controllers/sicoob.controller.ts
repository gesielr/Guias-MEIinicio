/**
 * Sicoob Controller
 * Endpoints para integração Sicoob
 */

import { Request, Response } from 'express';
import {
  getPixService,
  getBoletoService,
  getCobrancaService,
  getWebhookService,
  getAuthService,
  CobrancaPixImediata,
  CobrancaPixVencimento,
  DadosBoleto,
  SicoobError,
} from '../services/sicoob';
import { getCobrancaService as getCobrancaDbService } from '../services/sicoob/cobranca-db.service';
import { sicoobLogger } from '../utils/sicoob-logger';

export class SicoobController {
  /**
   * PIX - Criar cobrança imediata
   */
  static async criarCobrancaPixImediata(req: Request, res: Response): Promise<void> {
    try {
      const dados: CobrancaPixImediata = req.body;
      const pixService = getPixService();

      const resultado = await pixService.criarCobrancaImediata(dados);

      // Salvar no Supabase
      try {
        const cobrancaDbService = getCobrancaDbService();
        await cobrancaDbService.criarCobranca({
          user_id: (req as any).user?.id, // Se houver autenticação
          identificador: resultado.txid,
          tipo: 'PIX_IMEDIATA',
          status: 'PENDENTE',
          pagador_nome: dados.devedor?.nome,
          pagador_cpf_cnpj: dados.devedor?.cpf || dados.devedor?.cnpj,
          valor_original: parseFloat(dados.valor.original),
          qrcode_url: resultado.pixCopiaECola,
          qrcode_base64: resultado.qrcode,
          metadados: { dados_originais: dados },
        });
      } catch (dbError) {
        sicoobLogger.error('Erro ao salvar cobrança no banco', dbError as Error);
        // Continua mesmo se falhar no DB
      }

      res.status(201).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * PIX - Criar cobrança com vencimento
   */
  static async criarCobrancaPixVencimento(req: Request, res: Response): Promise<void> {
    try {
      const dados: CobrancaPixVencimento = req.body;
      const pixService = getPixService();

      const resultado = await pixService.criarCobrancaComVencimento(dados);

      // Salvar no Supabase
      try {
        const cobrancaDbService = getCobrancaDbService();
        await cobrancaDbService.criarCobranca({
          user_id: (req as any).user?.id,
          identificador: resultado.txid,
          tipo: 'PIX_VENCIMENTO',
          status: 'PENDENTE',
          pagador_nome: dados.devedor?.nome,
          pagador_cpf_cnpj: dados.devedor?.cpf || dados.devedor?.cnpj,
          valor_original: parseFloat(dados.valor.original),
          data_vencimento: dados.calendario?.dataDeVencimento,
          qrcode_url: resultado.pixCopiaECola,
          qrcode_base64: resultado.qrcode,
          metadados: { dados_originais: dados },
        });
      } catch (dbError) {
        sicoobLogger.error('Erro ao salvar cobrança no banco', dbError as Error);
      }

      res.status(201).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * PIX - Consultar cobrança
   */
  static async consultarCobrancaPix(req: Request, res: Response): Promise<void> {
    try {
      const { txid } = req.params;
      const pixService = getPixService();

      const resultado = await pixService.consultarCobranca(txid);

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * PIX - Listar cobranças
   */
  static async listarCobrancasPix(req: Request, res: Response): Promise<void> {
    try {
      const { status, data_inicio, data_fim, pagina, limite } = req.query;
      const pixService = getPixService();

      const filtros = {
        status: status as any,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        pagina: pagina ? parseInt(pagina as string) : 1,
        limite: limite ? parseInt(limite as string) : 20,
      };

      const resultado = await pixService.listarCobrancas(filtros);

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * PIX - Cancelar cobrança
   */
  static async cancelarCobrancaPix(req: Request, res: Response): Promise<void> {
    try {
      const { txid } = req.params;
      const pixService = getPixService();

      await pixService.cancelarCobranca(txid);

      res.status(204).send();
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * PIX - Consultar QR Code
   */
  static async consultarQRCode(req: Request, res: Response): Promise<void> {
    try {
      const { txid } = req.params;
      const pixService = getPixService();

      const resultado = await pixService.consultarQRCode(txid);

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Boleto - Gerar boleto
   */
  static async gerarBoleto(req: Request, res: Response): Promise<void> {
    try {
      const dados: DadosBoleto = req.body;
      const boletoService = getBoletoService();

      const resultado = await boletoService.gerarBoleto(dados);

      // Salvar no Supabase
      try {
        const cobrancaDbService = getCobrancaDbService();
        await cobrancaDbService.criarCobranca({
          user_id: (req as any).user?.id,
          identificador: resultado.nossoNumero,
          tipo: 'BOLETO',
          status: 'PENDENTE',
          pagador_nome: dados.pagador?.nome,
          pagador_cpf_cnpj: dados.pagador?.cpfCnpj,
          valor_original: parseFloat(dados.valorNominal),
          data_vencimento: dados.dataVencimento,
          linha_digitavel: resultado.linhaDigitavel,
          pdf_url: resultado.urlPdf,
          metadados: { dados_originais: dados },
        });
      } catch (dbError) {
        sicoobLogger.error('Erro ao salvar boleto no banco', dbError as Error);
      }

      res.status(201).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Boleto - Consultar boleto
   */
  static async consultarBoleto(req: Request, res: Response): Promise<void> {
    try {
      const { nossoNumero } = req.params;
      const boletoService = getBoletoService();

      const resultado = await boletoService.consultarBoleto(nossoNumero);

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Boleto - Listar boletos
   */
  static async listarBoletos(req: Request, res: Response): Promise<void> {
    try {
      const { status, data_inicio, data_fim, pagina, limite } = req.query;
      const boletoService = getBoletoService();

      const filtros = {
        status: status as any,
        data_inicio: data_inicio as string,
        data_fim: data_fim as string,
        pagina: pagina ? parseInt(pagina as string) : 1,
        limite: limite ? parseInt(limite as string) : 20,
      };

      const resultado = await boletoService.listarBoletos(filtros);

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Boleto - Cancelar boleto
   */
  static async cancelarBoleto(req: Request, res: Response): Promise<void> {
    try {
      const { nossoNumero } = req.params;
      const boletoService = getBoletoService();

      await boletoService.cancelarBoleto(nossoNumero);

      res.status(204).send();
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Boleto - Baixar PDF
   */
  static async baixarPDFBoleto(req: Request, res: Response): Promise<void> {
    try {
      const { nossoNumero } = req.params;
      const boletoService = getBoletoService();

      const buffer = await boletoService.baixarPDF(nossoNumero);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="boleto-${nossoNumero}.pdf"`
      );
      res.send(buffer);
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Cobrança - Criar cobrança genérica
   */
  static async criarCobranca(req: Request, res: Response): Promise<void> {
    try {
      const dados = req.body;
      const cobrancaService = getCobrancaService();

      const resultado = await cobrancaService.criarCobranca(dados);

      res.status(201).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Cobrança - Consultar cobrança
   */
  static async consultarCobranca(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tipo } = req.query;
      const cobrancaService = getCobrancaService();

      const resultado = await cobrancaService.consultarCobranca(
        id,
        (tipo as any) || 'PIX'
      );

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Cobrança - Atualizar cobrança
   */
  static async atualizarCobranca(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tipo } = req.query;
      const dados = req.body;
      const cobrancaService = getCobrancaService();

      const resultado = await cobrancaService.atualizarCobranca(
        id,
        (tipo as any) || 'PIX',
        dados
      );

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Cobrança - Cancelar cobrança
   */
  static async cancelarCobranca(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { tipo } = req.query;
      const cobrancaService = getCobrancaService();

      await cobrancaService.cancelarCobranca(id, (tipo as any) || 'PIX');

      res.status(204).send();
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Cobrança - Listar cobranças
   */
  static async listarCobrancas(req: Request, res: Response): Promise<void> {
    try {
      const { tipo, pagina } = req.query;
      const cobrancaService = getCobrancaService();

      const resultado = await cobrancaService.listarCobrancas(
        (tipo as any) || 'PIX',
        pagina ? parseInt(pagina as string) : 1
      );

      res.status(200).json({
        sucesso: true,
        dados: resultado,
      });
    } catch (error) {
      SicoobController.handleError(res, error);
    }
  }

  /**
   * Webhook - Receber webhook
   */
  static async receberWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookService = getWebhookService();
      const payload = req.body;
      const signature = (req as any).sicoobSignature;

      await webhookService.processWebhook(payload, signature);

      res.status(200).json({
        sucesso: true,
        mensagem: 'Webhook processado',
      });
    } catch (error) {
      sicoobLogger.error('Erro ao processar webhook', error as Error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro ao processar webhook',
      });
    }
  }

  /**
   * Health Check
   */
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const authService = getAuthService();

      // Tentar validar token
      const isHealthy = await authService.validateToken(
        await authService.getAccessToken()
      );

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      sicoobLogger.error('Health check falhou', error as Error);
      res.status(503).json({
        status: 'down',
        erro: (error as Error).message,
      });
    }
  }

  /**
   * Tratador de erros centralizado
   */
  private static handleError(res: Response, error: any): void {
    if (error instanceof SicoobError) {
      res.status(error.statusCode).json({
        sucesso: false,
        erro: error.message,
        codigo: error.code,
        detalhes: error.details,
      });
    } else {
      sicoobLogger.error('Erro não tratado', error as Error);
      res.status(500).json({
        sucesso: false,
        erro: 'Erro interno do servidor',
      });
    }
  }
}
