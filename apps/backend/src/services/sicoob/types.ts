/**
 * Sicoob API Types and Interfaces
 * Define all request/response types for Sicoob integration
 */

// ============================================================
// AUTHENTICATION TYPES
// ============================================================

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface CertificateConfig {
  cert: string;
  key: string;
  ca?: string;
}

// ============================================================
// PIX TYPES
// ============================================================

export interface CobrancaPixImediata {
  chave_pix: string;
  solicitacao_pagador?: string;
  valor: number;
  expiracao?: number;
  abatimento?: {
    tipo: 'FIXO' | 'PERCENTUAL';
    valor_abatimento: number;
  };
  juros?: {
    tipo: 'SIMPLES' | 'COMPOSTO';
    valor_juros: number;
  };
  multa?: {
    tipo: 'FIXO' | 'PERCENTUAL';
    valor_multa: number;
  };
  desconto?: {
    tipo: 'FIXO' | 'PERCENTUAL';
    valor_desconto: number;
  };
  infoAdicionais?: Array<{
    nome: string;
    valor: string;
  }>;
}

export interface CobrancaPixVencimento {
  chave_pix: string;
  solicitacao_pagador?: string;
  valor: number;
  data_vencimento: string; // ISO 8601
  abatimento?: {
    tipo: 'FIXO' | 'PERCENTUAL';
    valor_abatimento: number;
  };
  juros?: {
    tipo: 'SIMPLES' | 'COMPOSTO';
    valor_juros: number;
  };
  multa?: {
    tipo: 'FIXO' | 'PERCENTUAL';
    valor_multa: number;
  };
  desconto?: {
    tipo: 'FIXO' | 'PERCENTUAL';
    valor_desconto: number;
    data_desconto?: string;
  };
  infoAdicionais?: Array<{
    nome: string;
    valor: string;
  }>;
}

export interface CobrancaResponse {
  txid: string;
  qr_code: string;
  qr_code_url?: string;
  valor: number;
  status: 'VIGENTE' | 'RECEBIDA' | 'CANCELADA' | 'DEVOLVIDA' | 'EXPIRADA';
  data_criacao: string;
  data_vencimento?: string;
  chave_pix: string;
  pagador?: {
    cpf?: string;
    cnpj?: string;
    nome?: string;
  };
}

export interface ListaCobrancas {
  cobracas: CobrancaResponse[];
  paginacao: {
    pagina_atual: number;
    total_paginas: number;
    total_itens: number;
  };
}

export interface FiltrosCobranca {
  status?: 'VIGENTE' | 'RECEBIDA' | 'CANCELADA' | 'DEVOLVIDA' | 'EXPIRADA';
  data_inicio?: string;
  data_fim?: string;
  pagina?: number;
  limite?: number;
}

export interface QRCodeResponse {
  txid: string;
  qr_code: string;
  qr_code_url: string;
  valor: number;
  data_criacao: string;
}

// ============================================================
// BOLETO TYPES
// ============================================================

export interface DadosBoleto {
  numero_controle?: string;
  beneficiario: {
    nome: string;
    cpf_cnpj: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  pagador: {
    nome: string;
    cpf_cnpj: string;
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  valor: number;
  data_vencimento: string; // ISO 8601
  tipo_juros?: 'ISENTO' | 'COBRADO';
  valor_juros?: number;
  tipo_multa?: 'ISENTO' | 'FIXO' | 'PERCENTUAL';
  valor_multa?: number;
  descricao?: string;
  instrucoes?: string[];
}

export interface BoletoResponse {
  nosso_numero: string;
  numero_boleto: string;
  valor: number;
  data_vencimento: string;
  status: 'ATIVO' | 'PAGO' | 'CANCELADO' | 'VENCIDO';
  data_pagamento?: string;
  valor_pago?: number;
  beneficiario: {
    nome: string;
    cpf_cnpj: string;
  };
  pagador: {
    nome: string;
    cpf_cnpj: string;
  };
}

export interface ListaBoletos {
  boletos: BoletoResponse[];
  paginacao: {
    pagina_atual: number;
    total_paginas: number;
    total_itens: number;
  };
}

export interface FiltrosBoleto {
  status?: 'ATIVO' | 'PAGO' | 'CANCELADO' | 'VENCIDO';
  data_inicio?: string;
  data_fim?: string;
  pagina?: number;
  limite?: number;
}

// ============================================================
// COBRANCA TYPES
// ============================================================

export type PixModalidade = 'IMEDIATA' | 'COM_VENCIMENTO';

export interface PixCobrancaPayload {
  modalidade: PixModalidade;
  imediata?: CobrancaPixImediata;
  comVencimento?: CobrancaPixVencimento;
}

export interface BoletoCobrancaPayload {
  dados: DadosBoleto;
}

export interface CobrancaData {
  tipo: 'PIX' | 'BOLETO';
  descricao?: string;
  pix?: PixCobrancaPayload;
  boleto?: BoletoCobrancaPayload;
  metadados?: Record<string, any>;
}

// ============================================================
// WEBHOOK TYPES
// ============================================================

export type WebhookEventType =
  | 'pix.received'
  | 'pix.returned'
  | 'boleto.paid'
  | 'boleto.expired'
  | 'cobranca.paid'
  | 'cobranca.cancelled';

export interface WebhookEvent {
  id: string;
  timestamp: string;
  tipo: WebhookEventType;
  dados: Record<string, any>;
  assinatura?: string;
}

export interface WebhookPayload {
  evento_id: string;
  timestamp: string;
  tipo_evento: WebhookEventType;
  dados: Record<string, any>;
}

// ============================================================
// ERROR TYPES
// ============================================================

export class SicoobError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SicoobError';
  }
}

export class SicoobAuthError extends SicoobError {
  constructor(message: string, details?: any) {
    super(message, 401, 'AUTH_ERROR', details);
    this.name = 'SicoobAuthError';
  }
}

export class SicoobValidationError extends SicoobError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'SicoobValidationError';
  }
}

export class SicoobNotFoundError extends SicoobError {
  constructor(message: string, details?: any) {
    super(message, 404, 'NOT_FOUND_ERROR', details);
    this.name = 'SicoobNotFoundError';
  }
}

export class SicoobRateLimitError extends SicoobError {
  constructor(message: string, retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'SicoobRateLimitError';
  }
}

export class SicoobServerError extends SicoobError {
  constructor(message: string, statusCode: number, details?: any) {
    super(message, statusCode, 'SERVER_ERROR', details);
    this.name = 'SicoobServerError';
  }
}

export class SicoobCertificateError extends SicoobError {
  constructor(message: string, details?: any) {
    super(message, 500, 'CERTIFICATE_ERROR', details);
    this.name = 'SicoobCertificateError';
  }
}

// ============================================================
// API CONFIG
// ============================================================

export interface SicoobConfig {
  environment: 'sandbox' | 'production';
  baseUrl: string;
  authUrl: string;
  authValidateUrl?: string;
  clientId: string;
  clientSecret?: string;
  certPath?: string;
  keyPath?: string;
  caPath?: string;
  caBase64?: string;
  pfxBase64?: string;
  pfxPassphrase?: string;
  cooperativa?: string;
  conta?: string;
  webhookSecret?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  scopes?: string[];
}
