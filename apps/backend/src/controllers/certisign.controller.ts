// apps/backend/src/controllers/certisign.controller.ts
// Controller para endpoints de certificado digital ICP-Brasil (Certisign)

import { FastifyRequest, FastifyReply } from 'fastify';
import { getCertificateService } from '../services/certificate';
import { 
  WebhookPayload, 
  EnrollmentRequest,
  SignatureRequestPayload 
} from '../services/certificate/types';
import crypto from 'crypto';
import { getPaymentCertService } from '../services/certificate/payment-cert.service';

const certService = getCertificateService();
const paymentService = getPaymentCertService();

/**
 * Validar assinatura HMAC do webhook Certisign
 */
function validarHMACSignature(payload: any, signature: string, secret: string): boolean {
  try {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  } catch (error) {
    console.error('[ERROR] Falha ao validar HMAC:', error);
    return false;
  }
}

/**
 * POST /api/certisign/webhook/vinculo
 * Webhook: Certificado emitido pela Certisign
 */
export async function handleWebhookVinculo(
  request: FastifyRequest<{ Body: WebhookPayload }>,
  reply: FastifyReply
) {
  try {
    console.log('[WEBHOOK] Recebido callback de vinculo');

    // Validar HMAC signature
    const signature = request.headers['x-certisign-signature'] as string;
    const secret = process.env.CERTISIGN_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[ERROR] CERTISIGN_WEBHOOK_SECRET não configurado');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    if (!signature || !validarHMACSignature(request.body, signature, secret)) {
      console.error('[ERROR] HMAC signature inválida');
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    // Processar callback
    await certService.processarCallbackVinculo(request.body);

    return reply.code(200).send({ status: 'ok', message: 'Vinculo processado com sucesso' });
  } catch (error: any) {
    console.error('[ERROR] Webhook vinculo:', error.message);
    return reply.code(400).send({ error: error.message });
  }
}

/**
 * POST /api/certisign/webhook/assinatura
 * Webhook: Assinatura aprovada pelo usuário
 */
export async function handleWebhookAssinatura(
  request: FastifyRequest<{ Body: WebhookPayload }>,
  reply: FastifyReply
) {
  try {
    console.log('[WEBHOOK] Recebido callback de assinatura');

    // Validar HMAC signature
    const signature = request.headers['x-certisign-signature'] as string;
    const secret = process.env.CERTISIGN_WEBHOOK_SECRET;

    if (!secret) {
      console.error('[ERROR] CERTISIGN_WEBHOOK_SECRET não configurado');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }

    if (!signature || !validarHMACSignature(request.body, signature, secret)) {
      console.error('[ERROR] HMAC signature inválida');
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    // Processar callback
    await certService.processarCallbackAssinatura(request.body);

    return reply.code(200).send({ status: 'ok', message: 'Assinatura processada com sucesso' });
  } catch (error: any) {
    console.error('[ERROR] Webhook assinatura:', error.message);
    return reply.code(400).send({ error: error.message });
  }
}

/**
 * GET /api/certisign/datas-disponiveis
 * Consultar datas disponíveis para agendamento
 */
export async function consultarDatasDisponiveis(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    console.log('[API] Consultando datas disponíveis');
    const datas = await certService.consultarDatasDisponiveis();
    return reply.code(200).send({ datas });
  } catch (error: any) {
    console.error('[ERROR] Consultar datas:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * POST /api/certisign/enrollment
 * Solicitar vinculação de certificado
 */
export async function solicitarEnrollment(
  request: FastifyRequest<{ Body: EnrollmentRequest }>,
  reply: FastifyReply
) {
  try {
    console.log('[API] Solicitando enrollment para usuário:', request.body.userId);

    // Validar payload
    const { userId, nome, cpf_cnpj, email, telefone, dataAgendamento } = request.body;
    if (!userId || !nome || !cpf_cnpj || !email || !telefone || !dataAgendamento) {
      return reply.code(400).send({ 
        error: 'Campos obrigatórios: userId, nome, cpf_cnpj, email, telefone, dataAgendamento' 
      });
    }

    const externalCertId = await certService.solicitarVinculoCertificado(request.body);
    
    return reply.code(201).send({ 
      external_cert_id: externalCertId,
      status: 'PENDING',
      message: 'Solicitação criada. Aguardando processamento da certificadora (3-5 dias úteis).'
    });
  } catch (error: any) {
    console.error('[ERROR] Solicitar enrollment:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * GET /api/certisign/enrollment/:userId
 * Buscar certificado do usuário
 */
export async function buscarEnrollment(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    console.log('[API] Buscando certificado do usuário:', userId);

    const enrollment = await certService.buscarCertificadoUsuario(userId);
    
    if (!enrollment) {
      return reply.code(404).send({ 
        error: 'Certificado não encontrado ou expirado',
        message: 'Usuário não possui certificado digital ativo.'
      });
    }

    return reply.code(200).send({ enrollment });
  } catch (error: any) {
    console.error('[ERROR] Buscar enrollment:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * POST /api/certisign/sign/solicitar
 * Solicitar assinatura remota
 */
export async function solicitarAssinatura(
  request: FastifyRequest<{ Body: SignatureRequestPayload }>,
  reply: FastifyReply
) {
  try {
    console.log('[API] Solicitando assinatura remota para usuário:', request.body.userId);

    // Validar payload
    const { userId, hash, documentType, documentId } = request.body;
    if (!userId || !hash || !documentType) {
      return reply.code(400).send({ 
        error: 'Campos obrigatórios: userId, hash, documentType' 
      });
    }

    const signRequest = await certService.solicitarAssinaturaRemota(
      userId,
      hash,
      documentType,
      documentId
    );

    return reply.code(201).send({
      sign_request_id: signRequest.id,
      qr_code_url: signRequest.qr_code_url,
      status: signRequest.status,
      expires_at: signRequest.expires_at,
      message: 'Assinatura solicitada. Usuário deve aprovar no app Certisign em até 5 minutos.'
    });
  } catch (error: any) {
    console.error('[ERROR] Solicitar assinatura:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * GET /api/certisign/sign/:signRequestId
 * Consultar status de assinatura
 */
export async function consultarStatusAssinatura(
  request: FastifyRequest<{ Params: { signRequestId: string } }>,
  reply: FastifyReply
) {
  try {
    const { signRequestId } = request.params;
    console.log('[API] Consultando status de assinatura:', signRequestId);

    const signRequest = await certService.buscarSignRequest(signRequestId);

    if (!signRequest) {
      return reply.code(404).send({ 
        error: 'Solicitação de assinatura não encontrada' 
      });
    }

    return reply.code(200).send({
      sign_request_id: signRequest.id,
      status: signRequest.status,
      signature_value: signRequest.signature_value,
      completed_at: signRequest.completed_at,
      expires_at: signRequest.expires_at
    });
  } catch (error: any) {
    console.error('[ERROR] Consultar status assinatura:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * POST /api/certisign/pagamento/gerar
 * Gerar PIX de R$150 para pagamento do certificado digital
 */
export async function gerarPixCertificado(
  request: FastifyRequest<{ Body: { userId: string; nome: string; cpf_cnpj: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId, nome, cpf_cnpj } = request.body || {} as any;

    if (!userId || !nome || !cpf_cnpj) {
      return reply.code(400).send({
        error: 'Campos obrigatórios: userId, nome, cpf_cnpj'
      });
    }

    const cobranca = await paymentService.gerarCobrancaPIX({ userId, nome, cpf_cnpj });

    return reply.code(201).send({
      txid: cobranca.txid,
      qr_code: cobranca.qr_code,
      qr_code_url: cobranca.qr_code_url,
      valor: cobranca.valor,
      message: 'Cobração PIX criada. Validade de 1 hora.'
    });
  } catch (error: any) {
    console.error('[ERROR] Gerar PIX Certificado:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}
