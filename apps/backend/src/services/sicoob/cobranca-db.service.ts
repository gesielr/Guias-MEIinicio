/**
 * Sicoob Cobrança Service
 * Gerenciamento de cobranças no Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sicoobLogger } from '../../utils/sicoob-logger';

export interface CobrancaData {
  user_id?: string;
  identificador: string;
  tipo: 'PIX_IMEDIATA' | 'PIX_VENCIMENTO' | 'BOLETO';
  status?: 'PENDENTE' | 'PAGO' | 'VENCIDO' | 'CANCELADO' | 'DEVOLVIDO';
  pagador_nome?: string;
  pagador_cpf_cnpj?: string;
  pagador_whatsapp?: string;
  valor_original: number;
  valor_pago?: number;
  data_vencimento?: string;
  data_pagamento?: string;
  qrcode_url?: string;
  qrcode_base64?: string;
  pdf_url?: string;
  linha_digitavel?: string;
  metadados?: any;
}

export class SicoobCobrancaService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase não configurado');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    sicoobLogger.info('SicoobCobrancaService inicializado');
  }

  /**
   * Criar nova cobrança
   */
  async criarCobranca(dados: CobrancaData): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('sicoob_cobrancas')
        .insert({
          ...dados,
          status: dados.status || 'PENDENTE',
          criado_em: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        sicoobLogger.error('Erro ao criar cobrança', error as any);
        throw error;
      }

      sicoobLogger.info('Cobrança criada', { identificador: dados.identificador });
      return data;
    } catch (error) {
      sicoobLogger.error('Erro ao criar cobrança', error as Error);
      throw error;
    }
  }

  /**
   * Atualizar cobrança existente
   */
  async atualizarCobranca(
    identificador: string,
    atualizacoes: Partial<CobrancaData>
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('sicoob_cobrancas')
        .update({
          ...atualizacoes,
          atualizado_em: new Date().toISOString(),
        })
        .eq('identificador', identificador)
        .select()
        .single();

      if (error) {
        sicoobLogger.error('Erro ao atualizar cobrança', error as any);
        throw error;
      }

      sicoobLogger.info('Cobrança atualizada', { identificador });
      return data;
    } catch (error) {
      sicoobLogger.error('Erro ao atualizar cobrança', error as Error);
      throw error;
    }
  }

  /**
   * Buscar cobrança por identificador
   */
  async buscarCobranca(identificador: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('sicoob_cobrancas')
        .select('*')
        .eq('identificador', identificador)
        .single();

      if (error) {
        sicoobLogger.error('Erro ao buscar cobrança', error as any);
        throw error;
      }

      return data;
    } catch (error) {
      sicoobLogger.error('Erro ao buscar cobrança', error as Error);
      throw error;
    }
  }

  /**
   * Listar cobranças por usuário
   */
  async listarCobrancasPorUsuario(
    userId: string,
    filtros?: { status?: string; tipo?: string }
  ): Promise<any[]> {
    try {
      let query = this.supabase
        .from('sicoob_cobrancas')
        .select('*')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false });

      if (filtros?.status) {
        query = query.eq('status', filtros.status);
      }

      if (filtros?.tipo) {
        query = query.eq('tipo', filtros.tipo);
      }

      const { data, error } = await query;

      if (error) {
        sicoobLogger.error('Erro ao listar cobranças', error as any);
        throw error;
      }

      return data || [];
    } catch (error) {
      sicoobLogger.error('Erro ao listar cobranças', error as Error);
      throw error;
    }
  }

  /**
   * Adicionar entrada ao histórico da cobrança
   */
  async adicionarHistorico(
    identificador: string,
    entrada: { tipo: string; dados: any; timestamp?: string }
  ): Promise<void> {
    try {
      const cobranca = await this.buscarCobranca(identificador);
      const historicoAtual = cobranca.historico || [];

      const novaEntrada = {
        ...entrada,
        timestamp: entrada.timestamp || new Date().toISOString(),
      };

      const { error } = await this.supabase
        .from('sicoob_cobrancas')
        .update({
          historico: [...historicoAtual, novaEntrada],
          atualizado_em: new Date().toISOString(),
        })
        .eq('identificador', identificador);

      if (error) {
        sicoobLogger.error('Erro ao adicionar histórico', error as any);
        throw error;
      }

      sicoobLogger.debug('Histórico adicionado', { identificador });
    } catch (error) {
      sicoobLogger.error('Erro ao adicionar histórico', error as Error);
      throw error;
    }
  }

  /**
   * Buscar cobranças pendentes de notificação
   */
  async buscarCobrancasParaNotificar(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('sicoob_notificacoes')
        .select(`
          *,
          cobranca:sicoob_cobrancas!identificador_cobranca(*)
        `)
        .eq('status', 'PENDENTE')
        .order('criado_em', { ascending: true })
        .limit(50);

      if (error) {
        sicoobLogger.error('Erro ao buscar notificações pendentes', error as any);
        throw error;
      }

      return data || [];
    } catch (error) {
      sicoobLogger.error('Erro ao buscar notificações', error as Error);
      throw error;
    }
  }

  /**
   * Marcar notificação como enviada
   */
  async marcarNotificacaoEnviada(notificacaoId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('sicoob_notificacoes')
        .update({
          status: 'ENVIADA',
          processado_em: new Date().toISOString(),
        })
        .eq('id', notificacaoId);

      if (error) {
        sicoobLogger.error('Erro ao marcar notificação como enviada', error as any);
        throw error;
      }

      sicoobLogger.debug('Notificação marcada como enviada', { notificacaoId });
    } catch (error) {
      sicoobLogger.error('Erro ao marcar notificação', error as Error);
      throw error;
    }
  }

  /**
   * Marcar notificação como falha
   */
  async marcarNotificacaoFalhou(
    notificacaoId: string,
    erroMensagem: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('sicoob_notificacoes')
        .update({
          status: 'FALHOU',
          tentativas: this.supabase.rpc('increment', { row_id: notificacaoId }),
          ultima_tentativa: new Date().toISOString(),
          erro_mensagem: erroMensagem,
        })
        .eq('id', notificacaoId);

      if (error) {
        sicoobLogger.error('Erro ao marcar notificação como falha', error as any);
        throw error;
      }

      sicoobLogger.debug('Notificação marcada como falha', { notificacaoId });
    } catch (error) {
      sicoobLogger.error('Erro ao marcar notificação como falha', error as Error);
      throw error;
    }
  }
}

// Instância singleton
let cobrancaServiceInstance: SicoobCobrancaService | null = null;

export function getCobrancaService(): SicoobCobrancaService {
  if (!cobrancaServiceInstance) {
    cobrancaServiceInstance = new SicoobCobrancaService();
  }
  return cobrancaServiceInstance;
}
