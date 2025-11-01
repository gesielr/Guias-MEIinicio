/**
 * Sicoob Webhook Service
 * Processamento e validação de webhooks
 */

import * as crypto from 'crypto';
import { WebhookEvent, WebhookEventType, WebhookPayload } from './types';
import { sicoobLogger } from '../../utils/sicoob-logger';
import { getPaymentCertService } from '../certificate/payment-cert.service';
import { getCertNotificationService } from '../email/cert-notification.service';
import { createSupabaseClients } from '../../../services/supabase';

const { admin } = createSupabaseClients();

export type WebhookHandler = (event: WebhookEvent) => Promise<void>;

export class SicoobWebhookService {
  private webhookSecret: string;
  private handlers: Map<WebhookEventType, WebhookHandler[]> = new Map();
  private eventQueue: WebhookEvent[] = [];
  private isProcessing: boolean = false;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
    sicoobLogger.info('SicoobWebhookService inicializado');
  }

  /**
   * Validar assinatura HMAC do webhook
   */
  validateSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (isValid) {
        sicoobLogger.debug('Assinatura do webhook validada com sucesso');
      } else {
        sicoobLogger.warn('Assinatura do webhook inválida');
      }

      return isValid;
    } catch (error) {
      sicoobLogger.error('Erro ao validar assinatura do webhook', error as Error);
      return false;
    }
  }

  /**
   * Verificar timestamp para evitar replay attacks
   */
  validateTimestamp(timestamp: string, toleranceSeconds: number = 300): boolean {
    try {
      const eventTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - eventTime) / 1000;

      if (timeDiff > toleranceSeconds) {
        sicoobLogger.warn('Timestamp fora da tolerância', {
          timeDiff,
          tolerance: toleranceSeconds,
        });
        return false;
      }

      sicoobLogger.debug('Timestamp validado com sucesso', { timeDiff });
      return true;
    } catch (error) {
      sicoobLogger.error('Erro ao validar timestamp', error as Error);
      return false;
    }
  }

  /**
   * Processar webhook recebido
   */
  async processWebhook(payload: WebhookPayload, signature?: string): Promise<void> {
    try {
      sicoobLogger.debug('Processando webhook', {
        eventoId: payload.evento_id,
        tipo: payload.tipo_evento,
      });

      // Validar assinatura se fornecida
      if (signature) {
        const isValid = this.validateSignature(
          JSON.stringify(payload),
          signature
        );
        if (!isValid) {
          throw new Error('Assinatura do webhook inválida');
        }
      }

      // Validar timestamp
      if (!this.validateTimestamp(payload.timestamp)) {
        throw new Error('Timestamp do webhook fora da tolerância');
      }

      // Converter para WebhookEvent
      const event: WebhookEvent = {
        id: payload.evento_id,
        timestamp: payload.timestamp,
        tipo: payload.tipo_evento,
        dados: payload.dados,
      };

      // Adicionar à fila
      this.eventQueue.push(event);

      // Processar fila
      await this.processQueue();

      sicoobLogger.info('Webhook processado com sucesso', {
        eventoId: event.id,
        tipo: event.tipo,
      });
    } catch (error) {
      sicoobLogger.error('Erro ao processar webhook', error as Error, payload);
      throw error;
    }
  }

  /**
   * Registrar handler para tipo de evento
   */
  on(eventType: WebhookEventType, handler: WebhookHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    sicoobLogger.debug('Handler registrado para evento', { eventType });
  }

  /**
   * Remover handler
   */
  off(eventType: WebhookEventType, handler: WebhookHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Processar fila de eventos
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (!event) break;

        await this.executeHandlers(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Executar handlers para evento
   */
  private async executeHandlers(event: WebhookEvent): Promise<void> {
    const handlers = this.handlers.get(event.tipo) || [];

    sicoobLogger.debug('Executando handlers', {
      tipo: event.tipo,
      quantidade: handlers.length,
    });

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        sicoobLogger.error('Erro ao executar handler de webhook', error as Error, {
          eventoId: event.id,
          tipo: event.tipo,
        });

        // Retry automático
        await this.retryHandler(handler, event);
      }
    }
  }

  /**
   * Retry automático com backoff exponencial
   */
  private async retryHandler(
    handler: WebhookHandler,
    event: WebhookEvent,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<void> {
    for (let i = 1; i <= maxRetries; i++) {
      try {
        sicoobLogger.debug(`Retry do handler (tentativa ${i}/${maxRetries})`, {
          eventoId: event.id,
        });

        await new Promise((resolve) => setTimeout(resolve, delayMs * i));
        await handler(event);
        return;
      } catch (error) {
        sicoobLogger.warn(`Retry falhou (tentativa ${i}/${maxRetries})`, {
          error: (error as Error).message,
          eventoId: event.id,
        });

        if (i === maxRetries) {
          sicoobLogger.error('Máximo de retries atingido para handler', error as Error, {
            eventoId: event.id,
            tipo: event.tipo,
          });
        }
      }
    }
  }

  /**
   * Handlers padrão de eventos
   */
  setupDefaultHandlers(): void {
    // PIX Recebido
    this.on('pix.received', async (event: WebhookEvent) => {
      sicoobLogger.info('PIX recebido', {
        txid: event.dados.txid,
        valor: event.dados.valor,
      });
      
      // Persistir evento no Supabase
      await this.persistirEvento(event, 'pix_received');
      
      // Atualizar status da cobrança
      await this.atualizarStatusCobranca(event.dados.txid, 'PAGO', {
        valor_pago: event.dados.valor,
        data_pagamento: event.timestamp,
      });
      
      // Acionar fila de notificação
      await this.acionarNotificacao(event.dados.txid, 'pagamento_recebido', event.dados);

      // Integração fluxo Certificado Digital
      try {
        // Verifica se este TXID pertence a um pagamento de certificado
        const { data: pagamento } = await admin
          .from('payment_cert_digital')
          .select('user_id, status')
          .eq('txid', event.dados.txid)
          .single();

        if (pagamento) {
          if (pagamento.status !== 'PAID') {
            const paymentService = getPaymentCertService();
            await paymentService.marcarPagamentoComoPago(event.dados.txid);

            const notify = getCertNotificationService();
            await notify.notificarCertificadora(pagamento.user_id);
            await notify.notificarUsuarioPagamentoConfirmado(pagamento.user_id);

            sicoobLogger.info('Fluxo Certificado: pagamento confirmado e notificações enviadas', {
              txid: event.dados.txid,
              user_id: pagamento.user_id,
            });
          } else {
            sicoobLogger.debug('Fluxo Certificado: pagamento já estava marcado como PAID', {
              txid: event.dados.txid,
            });
          }
        }
      } catch (err) {
        sicoobLogger.error('Erro no fluxo Certificado após PIX recebido', err as Error, {
          txid: event.dados.txid,
        });
      }
    });

    // PIX Devolvido
    this.on('pix.returned', async (event: WebhookEvent) => {
      sicoobLogger.info('PIX devolvido', {
        txid: event.dados.txid,
        motivo: event.dados.motivo,
      });
      
      // Persistir evento no Supabase
      await this.persistirEvento(event, 'pix_returned');
      
      // Atualizar status da cobrança
      await this.atualizarStatusCobranca(event.dados.txid, 'DEVOLVIDO', {
        motivo_devolucao: event.dados.motivo,
        data_devolucao: event.timestamp,
      });
      
      // Acionar notificação
      await this.acionarNotificacao(event.dados.txid, 'pagamento_devolvido', event.dados);
    });

    // Boleto Pago
    this.on('boleto.paid', async (event: WebhookEvent) => {
      sicoobLogger.info('Boleto pago', {
        nossoNumero: event.dados.nosso_numero,
        valor: event.dados.valor,
      });
      
      // Persistir evento no Supabase
      await this.persistirEvento(event, 'boleto_paid');
      
      // Atualizar status da cobrança
      await this.atualizarStatusCobranca(event.dados.nosso_numero, 'PAGO', {
        valor_pago: event.dados.valor,
        data_pagamento: event.timestamp,
      });
      
      // Acionar notificação
      await this.acionarNotificacao(event.dados.nosso_numero, 'boleto_pago', event.dados);
    });

    // Boleto Vencido
    this.on('boleto.expired', async (event: WebhookEvent) => {
      sicoobLogger.warn('Boleto vencido', {
        nossoNumero: event.dados.nosso_numero,
      });
      
      // Persistir evento no Supabase
      await this.persistirEvento(event, 'boleto_expired');
      
      // Atualizar status da cobrança
      await this.atualizarStatusCobranca(event.dados.nosso_numero, 'VENCIDO', {
        data_vencimento: event.timestamp,
      });
      
      // Notificar usuário
      await this.acionarNotificacao(event.dados.nosso_numero, 'boleto_vencido', event.dados);
    });

    // Cobrança Paga
    this.on('cobranca.paid', async (event: WebhookEvent) => {
      sicoobLogger.info('Cobrança paga', {
        id: event.dados.id,
        valor: event.dados.valor,
      });
      
      // Persistir evento no Supabase
      await this.persistirEvento(event, 'cobranca_paid');
      
      // Atualizar status da cobrança
      await this.atualizarStatusCobranca(event.dados.id, 'PAGO', {
        valor_pago: event.dados.valor,
        data_pagamento: event.timestamp,
      });
      
      // Processar pagamento
      await this.acionarNotificacao(event.dados.id, 'cobranca_paga', event.dados);
    });

    // Cobrança Cancelada
    this.on('cobranca.cancelled', async (event: WebhookEvent) => {
      sicoobLogger.info('Cobrança cancelada', {
        id: event.dados.id,
      });
      
      // Persistir evento no Supabase
      await this.persistirEvento(event, 'cobranca_cancelled');
      
      // Atualizar status da cobrança
      await this.atualizarStatusCobranca(event.dados.id, 'CANCELADO', {
        data_cancelamento: event.timestamp,
        motivo: event.dados.motivo,
      });
      
      // Processar cancelamento
      await this.acionarNotificacao(event.dados.id, 'cobranca_cancelada', event.dados);
    });

    sicoobLogger.info('Handlers padrão de webhooks registrados');
  }

  /**
   * Obter fila de eventos
   */
  getEventQueue(): WebhookEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Limpar fila de eventos
   */
  clearEventQueue(): void {
    this.eventQueue = [];
    sicoobLogger.debug('Fila de eventos limpa');
  }

  /**
   * Persistir evento no Supabase
   */
  private async persistirEvento(event: WebhookEvent, tipo: string): Promise<void> {
    try {
      // Implementar integração com Supabase
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        sicoobLogger.warn('Supabase não configurado, pulando persistência de evento');
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase.from('sicoob_webhook_events').insert({
        evento_id: event.id,
        tipo_evento: tipo,
        timestamp: event.timestamp,
        dados: event.dados,
        processado_em: new Date().toISOString(),
      });

      if (error) {
        sicoobLogger.error('Erro ao persistir evento no Supabase', error as any);
      } else {
        sicoobLogger.debug('Evento persistido no Supabase', { eventoId: event.id });
      }
    } catch (error) {
      sicoobLogger.error('Erro ao conectar com Supabase para persistir evento', error as Error);
    }
  }

  /**
   * Atualizar status da cobrança no Supabase
   */
  private async atualizarStatusCobranca(
    identificador: string,
    novoStatus: string,
    dadosAdicionais: any
  ): Promise<void> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        sicoobLogger.warn('Supabase não configurado, pulando atualização de status');
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase
        .from('sicoob_cobrancas')
        .update({
          status: novoStatus,
          historico: dadosAdicionais,
          atualizado_em: new Date().toISOString(),
        })
        .eq('identificador', identificador);

      if (error) {
        sicoobLogger.error('Erro ao atualizar status da cobrança', error as any);
      } else {
        sicoobLogger.debug('Status da cobrança atualizado', { identificador, novoStatus });
      }
    } catch (error) {
      sicoobLogger.error('Erro ao atualizar status da cobrança', error as Error);
    }
  }

  /**
   * Acionar fila de notificação
   */
  private async acionarNotificacao(
    identificador: string,
    tipoNotificacao: string,
    dados: any
  ): Promise<void> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        sicoobLogger.warn('Supabase não configurado, pulando notificação');
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase.from('sicoob_notificacoes').insert({
        identificador_cobranca: identificador,
        tipo_notificacao: tipoNotificacao,
        dados_notificacao: dados,
        status: 'PENDENTE',
        criado_em: new Date().toISOString(),
      });

      if (error) {
        sicoobLogger.error('Erro ao acionar notificação', error as any);
      } else {
        sicoobLogger.debug('Notificação acionada', { identificador, tipoNotificacao });
      }
    } catch (error) {
      sicoobLogger.error('Erro ao acionar notificação', error as Error);
    }
  }
}
