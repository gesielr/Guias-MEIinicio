// apps/backend/src/services/certificate/types.ts
// Tipos TypeScript para integração com Certificado Digital ICP-Brasil (Certisign)

export interface CertProvider {
  id: string;
  nome: string;
  api_base_url: string;
  api_key_encrypted: string | null;
  webhook_secret: string | null;
  ativo: boolean;
}

export interface CertEnrollment {
  id: string;
  user_id: string;
  provider_id: string;
  external_cert_id: string;
  subject: string;
  serial_number: string;
  thumbprint: string;
  valid_from: Date;
  valid_until: Date;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  enrolled_at: Date;
  approved_at: Date | null;
  last_used_at: Date | null;
}

export interface SignRequest {
  id: string;
  enrollment_id: string;
  user_id: string;
  document_type: 'DPS' | 'EVENTO_NFSE' | 'CANCELAMENTO';
  document_id: string | null;
  hash_algorithm: 'SHA256' | 'SHA512';
  hash_value: string;
  external_sign_id: string | null;
  qr_code_url: string | null;
  signature_value: string | null;
  signature_algorithm: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  user_consent_at: Date | null;
  user_ip: string | null;
  user_agent: string | null;
  requested_at: Date;
  completed_at: Date | null;
  expires_at: Date;
}

export interface DataDisponivel {
  data: string; // YYYY-MM-DD
  horarios: string[]; // ['09:00', '14:00', '16:30']
}

export interface EnrollmentRequest {
  userId: string;
  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
  dataAgendamento: string; // ISO 8601
}

export interface WebhookPayload {
  solicitacao_id?: string;
  sign_request_id?: string;
  external_cert_id?: string;
  status: string;
  subject?: string;
  serial_number?: string;
  thumbprint?: string;
  valid_from?: string;
  valid_until?: string;
  signature_value?: string;
  signature_algorithm?: string;
  signed_at?: string;
  user_device?: string;
  user_location?: string;
}

export interface SignatureRequestPayload {
  userId: string;
  hash: string;
  documentType: 'DPS' | 'EVENTO_NFSE' | 'CANCELAMENTO';
  documentId?: string;
}
