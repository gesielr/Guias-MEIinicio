// apps/backend/src/utils/certisign/hmac-validator.ts
// Utilitário para validação HMAC de webhooks Certisign

import crypto from 'crypto';

/**
 * Validar assinatura HMAC SHA-256
 * @param payload - Objeto JSON do webhook
 * @param signature - Assinatura recebida no header
 * @param secret - Segredo compartilhado com Certisign
 * @returns true se assinatura válida, false caso contrário
 */
export function validarHMACSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  try {
    // Gerar hash do payload
    const computed = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    // Comparação timing-safe (previne timing attacks)
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  } catch (error) {
    console.error('[HMAC] Erro ao validar assinatura:', error);
    return false;
  }
}

/**
 * Gerar assinatura HMAC para testes
 * @param payload - Objeto JSON
 * @param secret - Segredo
 * @returns Assinatura HMAC hex
 */
export function gerarHMACSignature(payload: any, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
