# 🚀 PLANO DE IMPLEMENTAÇÃO: CERTIFICADO DIGITAL ICP-BRASIL

**Data Início:** 1º de novembro de 2025  
**Prazo Estimado:** 9-13 dias úteis  
**Estratégia:** Implementação incremental com mocks → produção

---

## 📋 PRINCÍPIOS DE IMPLEMENTAÇÃO

### ✅ **FAZER (Compliance & Segurança)**
1. ✅ Sempre usar assinatura REMOTA (nunca local)
2. ✅ NUNCA armazenar chave privada/PFX/senha
3. ✅ Armazenar APENAS metadados (external_cert_id, subject, thumbprint)
4. ✅ Validar HMAC em todos os webhooks
5. ✅ Registrar auditoria completa (LGPD)
6. ✅ Timeout de 5 minutos para aprovação
7. ✅ Criptografar API keys (AES-256)
8. ✅ Implementar com mocks primeiro (teste sem custo)

### ❌ **NÃO FAZER (Proibido)**
1. ❌ Armazenar material criptográfico sensível
2. ❌ Gerar assinatura localmente
3. ❌ Pular validação HMAC
4. ❌ Expor API keys em logs
5. ❌ Deploy sem testes de segurança
6. ❌ Ignorar consentimento do usuário

---

## 🎯 FASE 1: ESTRUTURA BACKEND (Dias 1-4)

### **DAY 1: Service Layer Foundation**

#### 1.1 Criar estrutura de pastas
```bash
cd apps/backend/src
mkdir -p services/certificate
mkdir -p services/email
mkdir -p controllers
mkdir -p utils/certisign
cd services/certificate
```

#### 1.2 Criar arquivo `types.ts`
```typescript
// apps/backend/src/services/certificate/types.ts

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
```

#### 1.3 Criar arquivo `certificate.service.ts` (MOCK)
```typescript
// apps/backend/src/services/certificate/certificate.service.ts

import { createSupabaseClients } from '../../supabase';
import {
  CertProvider,
  CertEnrollment,
  SignRequest,
  DataDisponivel,
  EnrollmentRequest,
  WebhookPayload
} from './types';
import crypto from 'crypto';

const { admin } = createSupabaseClients();

export class CertificateService {
  private provider: CertProvider | null = null;

  constructor(private providerNome: string = 'Certisign') {
    this.inicializarProvider();
  }

  private async inicializarProvider(): Promise<void> {
    const { data, error } = await admin
      .from('cert_providers')
      .select('*')
      .eq('nome', this.providerNome)
      .eq('ativo', true)
      .single();

    if (error || !data) {
      throw new Error(`Provider ${this.providerNome} não encontrado ou inativo`);
    }

    this.provider = data;
  }

  /**
   * Consultar datas disponíveis para agendamento (MOCK)
   */
  async consultarDatasDisponiveis(): Promise<DataDisponivel[]> {
    // TODO: Substituir por chamada real à API Certisign
    console.log('[MOCK] Consultando datas disponíveis...');
    
    const hoje = new Date();
    const datas: DataDisponivel[] = [];

    for (let i = 5; i <= 10; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      datas.push({
        data: data.toISOString().split('T')[0],
        horarios: ['09:00', '14:00', '16:30']
      });
    }

    return datas;
  }

  /**
   * Solicitar vinculação de certificado (MOCK)
   */
  async solicitarVinculoCertificado(data: EnrollmentRequest): Promise<string> {
    // TODO: Substituir por chamada real à API Certisign
    console.log('[MOCK] Solicitando certificado para:', data.nome);

    if (!this.provider) {
      await this.inicializarProvider();
    }

    // Criar enrollment PENDING no banco
    const { data: enrollment, error } = await admin
      .from('cert_enrollments')
      .insert({
        user_id: data.userId,
        provider_id: this.provider!.id,
        external_cert_id: `MOCK_CERT_${Date.now()}`, // Será substituído pelo real
        subject: `CN=${data.nome}:${data.cpf_cnpj}`,
        serial_number: 'PENDING',
        thumbprint: 'PENDING',
        valid_from: new Date(),
        valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar enrollment: ${error.message}`);
    }

    // Registrar auditoria
    await this.registrarAuditoria(
      enrollment.id,
      data.userId,
      enrollment.id,
      'ENROLLMENT_REQUESTED',
      { data_agendamento: data.dataAgendamento }
    );

    return enrollment.external_cert_id;
  }

  /**
   * Processar callback de vinculação (certificado emitido)
   */
  async processarCallbackVinculo(payload: WebhookPayload): Promise<void> {
    console.log('[INFO] Processando callback vinculo:', payload.external_cert_id);

    // Buscar enrollment
    const { data: enrollment, error } = await admin
      .from('cert_enrollments')
      .select('*')
      .eq('external_cert_id', payload.solicitacao_id || payload.external_cert_id)
      .single();

    if (error || !enrollment) {
      throw new Error('Enrollment não encontrado');
    }

    // Atualizar com dados reais
    const { error: updateError } = await admin
      .from('cert_enrollments')
      .update({
        external_cert_id: payload.external_cert_id!,
        subject: payload.subject!,
        serial_number: payload.serial_number!,
        thumbprint: payload.thumbprint!,
        valid_from: new Date(payload.valid_from!),
        valid_until: new Date(payload.valid_until!),
        status: 'ACTIVE',
        approved_at: new Date()
      })
      .eq('id', enrollment.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar enrollment: ${updateError.message}`);
    }

    // Registrar auditoria
    await this.registrarAuditoria(
      null,
      enrollment.user_id,
      enrollment.id,
      'CERTIFICATE_ISSUED',
      { external_cert_id: payload.external_cert_id }
    );

    // TODO: Notificar usuário via WhatsApp
    console.log('[TODO] Notificar usuário via WhatsApp');
  }

  /**
   * Buscar certificado ativo do usuário
   */
  async buscarCertificadoUsuario(userId: string): Promise<CertEnrollment | null> {
    const { data, error } = await admin
      .from('cert_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as CertEnrollment;
  }

  /**
   * Solicitar assinatura remota
   */
  async solicitarAssinaturaRemota(
    userId: string,
    hash: string,
    documentType: 'DPS' | 'EVENTO_NFSE' | 'CANCELAMENTO',
    documentId?: string
  ): Promise<SignRequest> {
    console.log('[INFO] Solicitando assinatura remota para usuário:', userId);

    // Buscar certificado ativo
    const enrollment = await this.buscarCertificadoUsuario(userId);
    if (!enrollment) {
      throw new Error('Usuário não possui certificado digital ativo');
    }

    // Criar sign_request
    const { data: signRequest, error } = await admin
      .from('sign_requests')
      .insert({
        enrollment_id: enrollment.id,
        user_id: userId,
        document_type: documentType,
        document_id: documentId,
        hash_algorithm: 'SHA256',
        hash_value: hash,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar sign_request: ${error.message}`);
    }

    // TODO: Chamar API Certisign (mock por enquanto)
    console.log('[MOCK] Solicitando assinatura à Certisign...');
    const mockResponse = {
      sign_request_id: `SIGN_MOCK_${Date.now()}`,
      qr_code_url: `https://app.certisign.com.br/aprovar/${signRequest.id}`
    };

    // Atualizar com dados do provider
    await admin
      .from('sign_requests')
      .update({
        external_sign_id: mockResponse.sign_request_id,
        qr_code_url: mockResponse.qr_code_url
      })
      .eq('id', signRequest.id);

    // Registrar auditoria
    await this.registrarAuditoria(
      signRequest.id,
      userId,
      enrollment.id,
      'SIGNATURE_REQUESTED',
      { hash, document_type: documentType }
    );

    // TODO: Notificar usuário via WhatsApp com QR Code
    console.log('[TODO] Notificar usuário via WhatsApp:', mockResponse.qr_code_url);

    return { ...signRequest, ...mockResponse } as SignRequest;
  }

  /**
   * Processar callback de assinatura aprovada
   */
  async processarCallbackAssinatura(payload: WebhookPayload): Promise<void> {
    console.log('[INFO] Processando callback assinatura:', payload.sign_request_id);

    // Buscar sign_request
    const { data: signRequest, error } = await admin
      .from('sign_requests')
      .select('*')
      .eq('external_sign_id', payload.sign_request_id)
      .single();

    if (error || !signRequest) {
      throw new Error('SignRequest não encontrado');
    }

    // Atualizar com signature_value
    const { error: updateError } = await admin
      .from('sign_requests')
      .update({
        signature_value: payload.signature_value!,
        signature_algorithm: payload.signature_algorithm!,
        status: 'APPROVED',
        completed_at: new Date(),
        user_consent_at: new Date(payload.signed_at!)
      })
      .eq('id', signRequest.id);

    if (updateError) {
      throw new Error(`Erro ao atualizar sign_request: ${updateError.message}`);
    }

    // Registrar auditoria
    await this.registrarAuditoria(
      signRequest.id,
      signRequest.user_id,
      signRequest.enrollment_id,
      'SIGNATURE_RECEIVED',
      {
        device: payload.user_device,
        location: payload.user_location,
        signed_at: payload.signed_at
      }
    );

    // TODO: Continuar fluxo de emissão NFSe
    console.log('[TODO] Continuar fluxo NFSe com signature_value');
  }

  /**
   * Gerar hash SHA-256 de conteúdo XML
   */
  gerarHashDPS(xmlContent: string): string {
    return crypto
      .createHash('sha256')
      .update(xmlContent, 'utf8')
      .digest('hex');
  }

  /**
   * Montar XMLDSig com SignatureValue recebido
   */
  montarXMLDSig(hash: string, signatureValue: string, certificateThumbprint: string): string {
    // TODO: Implementar montagem completa do XMLDSig conforme especificação
    // Por enquanto, retorna template básico
    return `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <Reference URI="">
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <DigestValue>${hash}</DigestValue>
    </Reference>
  </SignedInfo>
  <SignatureValue>${signatureValue}</SignatureValue>
  <KeyInfo>
    <X509Data>
      <X509Certificate>${certificateThumbprint}</X509Certificate>
    </X509Data>
  </KeyInfo>
</Signature>
    `.trim();
  }

  /**
   * Registrar auditoria
   */
  private async registrarAuditoria(
    signRequestId: string | null,
    userId: string,
    enrollmentId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    await admin.from('sign_audit_logs').insert({
      sign_request_id: signRequestId,
      user_id: userId,
      enrollment_id: enrollmentId,
      event_type: eventType,
      event_data: eventData,
      timestamp: new Date()
    });
  }
}
```

**✅ Checklist Day 1:**
- [ ] Estrutura de pastas criada
- [ ] `types.ts` implementado
- [ ] `certificate.service.ts` implementado (modo MOCK)
- [ ] Testes unitários básicos criados
- [ ] Documentação inline completa

---

### **DAY 2: Webhook Handlers**

#### 2.1 Criar arquivo `certisign.controller.ts`
```typescript
// apps/backend/src/controllers/certisign.controller.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { CertificateService } from '../services/certificate/certificate.service';
import { WebhookPayload } from '../services/certificate/types';
import crypto from 'crypto';

const certService = new CertificateService();

/**
 * Validar assinatura HMAC do webhook
 */
function validarHMACSignature(payload: any, signature: string, secret: string): boolean {
  const computed = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

/**
 * Webhook: Certificado emitido pela Certisign
 */
export async function handleWebhookVinculo(
  request: FastifyRequest<{ Body: WebhookPayload }>,
  reply: FastifyReply
) {
  try {
    const signature = request.headers['x-certisign-signature'] as string;
    const secret = process.env.CERTISIGN_WEBHOOK_SECRET!;

    // Validar HMAC
    if (!validarHMACSignature(request.body, signature, secret)) {
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    // Processar callback
    await certService.processarCallbackVinculo(request.body);

    return reply.code(200).send({ status: 'ok' });
  } catch (error: any) {
    console.error('[ERROR] Webhook vinculo:', error.message);
    return reply.code(400).send({ error: error.message });
  }
}

/**
 * Webhook: Assinatura aprovada pelo usuário
 */
export async function handleWebhookAssinatura(
  request: FastifyRequest<{ Body: WebhookPayload }>,
  reply: FastifyReply
) {
  try {
    const signature = request.headers['x-certisign-signature'] as string;
    const secret = process.env.CERTISIGN_WEBHOOK_SECRET!;

    // Validar HMAC
    if (!validarHMACSignature(request.body, signature, secret)) {
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    // Processar callback
    await certService.processarCallbackAssinatura(request.body);

    return reply.code(200).send({ status: 'ok' });
  } catch (error: any) {
    console.error('[ERROR] Webhook assinatura:', error.message);
    return reply.code(400).send({ error: error.message });
  }
}

/**
 * Consultar datas disponíveis
 */
export async function consultarDatasDisponiveis(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const datas = await certService.consultarDatasDisponiveis();
    return reply.code(200).send({ datas });
  } catch (error: any) {
    console.error('[ERROR] Consultar datas:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * Solicitar vinculação de certificado
 */
export async function solicitarEnrollment(
  request: FastifyRequest<{ Body: any }>,
  reply: FastifyReply
) {
  try {
    const externalCertId = await certService.solicitarVinculoCertificado(request.body);
    return reply.code(201).send({ external_cert_id: externalCertId });
  } catch (error: any) {
    console.error('[ERROR] Solicitar enrollment:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}

/**
 * Buscar certificado do usuário
 */
export async function buscarEnrollment(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  try {
    const { userId } = request.params;
    const enrollment = await certService.buscarCertificadoUsuario(userId);
    
    if (!enrollment) {
      return reply.code(404).send({ error: 'Certificado não encontrado' });
    }

    return reply.code(200).send({ enrollment });
  } catch (error: any) {
    console.error('[ERROR] Buscar enrollment:', error.message);
    return reply.code(500).send({ error: error.message });
  }
}
```

#### 2.2 Criar arquivo `certisign.routes.ts`
```typescript
// apps/backend/src/routes/certisign.routes.ts

import { FastifyInstance } from 'fastify';
import {
  handleWebhookVinculo,
  handleWebhookAssinatura,
  consultarDatasDisponiveis,
  solicitarEnrollment,
  buscarEnrollment
} from '../controllers/certisign.controller';

export async function certisignRoutes(fastify: FastifyInstance) {
  // Webhooks (sem autenticação, validação HMAC no controller)
  fastify.post('/api/certisign/webhook/vinculo', handleWebhookVinculo);
  fastify.post('/api/certisign/webhook/assinatura', handleWebhookAssinatura);

  // Endpoints públicos
  fastify.get('/api/certisign/datas-disponiveis', consultarDatasDisponiveis);

  // Endpoints protegidos (TODO: adicionar middleware autenticação)
  fastify.post('/api/certisign/enrollment', solicitarEnrollment);
  fastify.get('/api/certisign/enrollment/:userId', buscarEnrollment);
}
```

#### 2.3 Registrar rotas no `index.ts`
```typescript
// apps/backend/src/index.ts

import { certisignRoutes } from './routes/certisign.routes';

// ... código existente ...

// Registrar rotas
await fastify.register(certisignRoutes);
```

**✅ Checklist Day 2:**
- [ ] Controller criado com validação HMAC
- [ ] Rotas webhook implementadas
- [ ] Rotas públicas implementadas
- [ ] Integrado ao Fastify
- [ ] Testes de rota criados

---

### **DAY 3: Assinatura Remota Completa**

#### 3.1 Adicionar método no `certificate.service.ts`
```typescript
/**
 * Buscar sign_request por ID
 */
async buscarSignRequest(signRequestId: string): Promise<SignRequest | null> {
  const { data, error } = await admin
    .from('sign_requests')
    .select('*')
    .eq('id', signRequestId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as SignRequest;
}

/**
 * Aguardar aprovação de assinatura (polling)
 */
async aguardarAprovacaoAssinatura(
  signRequestId: string,
  timeoutMs: number = 5 * 60 * 1000 // 5 minutos
): Promise<SignRequest> {
  const inicio = Date.now();
  const intervalo = 3000; // 3 segundos

  while (Date.now() - inicio < timeoutMs) {
    const signRequest = await this.buscarSignRequest(signRequestId);

    if (!signRequest) {
      throw new Error('SignRequest não encontrado');
    }

    if (signRequest.status === 'APPROVED') {
      return signRequest;
    }

    if (signRequest.status === 'REJECTED') {
      throw new Error('Assinatura rejeitada pelo usuário');
    }

    if (signRequest.status === 'EXPIRED') {
      throw new Error('Solicitação de assinatura expirou');
    }

    // Aguardar antes de próximo check
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }

  // Expirar após timeout
  await admin
    .from('sign_requests')
    .update({ status: 'EXPIRED' })
    .eq('id', signRequestId);

  throw new Error('Timeout: assinatura não aprovada em 5 minutos');
}
```

**✅ Checklist Day 3:**
- [ ] Método `aguardarAprovacaoAssinatura` implementado
- [ ] Timeout configurável
- [ ] Polling com intervalo adequado
- [ ] Atualização status EXPIRED
- [ ] Testes de timeout criados

---

### **DAY 4: Integração com NFSe**

#### 4.1 Modificar `nfse.service.ts`
```typescript
// apps/backend/src/nfse/services/nfse.service.ts

import { CertificateService } from '../../services/certificate/certificate.service';

const certService = new CertificateService();

export class NFSeService {
  // ... código existente ...

  /**
   * Emitir NFS-e com assinatura remota
   */
  async emitirNFSe(userId: string, dpsData: any): Promise<any> {
    // 1. Validar certificado ativo
    const enrollment = await certService.buscarCertificadoUsuario(userId);
    if (!enrollment) {
      throw new Error('Usuário não possui certificado digital ativo. Solicite em /certificado');
    }

    // 2. Gerar XML da DPS
    const xmlDPS = this.gerarXMLDPS(dpsData);

    // 3. Gerar hash SHA-256
    const hash = certService.gerarHashDPS(xmlDPS);

    // 4. Solicitar assinatura remota
    const signRequest = await certService.solicitarAssinaturaRemota(
      userId,
      hash,
      'DPS',
      dpsData.id
    );

    // 5. Aguardar aprovação (polling ou webhook)
    // Opção A: Polling
    const signApproved = await certService.aguardarAprovacaoAssinatura(signRequest.id);

    // 6. Montar XMLDSig
    const xmlDSig = certService.montarXMLDSig(
      hash,
      signApproved.signature_value!,
      enrollment.thumbprint
    );

    // 7. Inserir XMLDSig na DPS
    const dpsAssinada = this.inserirXMLDSig(xmlDPS, xmlDSig);

    // 8. Enviar para SEFIN/ADN
    const resultado = await this.enviarDPSParaSEFIN(dpsAssinada);

    // 9. Registrar emissão
    await this.registrarEmissao(userId, resultado);

    return resultado;
  }

  // ... resto do código ...
}
```

**✅ Checklist Day 4:**
- [ ] NFSe service modificado
- [ ] Validação certificado ativo
- [ ] Integração com assinatura remota
- [ ] Polling de aprovação implementado
- [ ] Montagem XMLDSig integrada
- [ ] Testes E2E básicos criados

---

## 🎯 FASE 2: PAGAMENTOS + EMAILS (Dias 5-7)

### **DAY 5: Pagamento PIX Certificado**

#### 5.1 Criar `payment-cert.service.ts`
```typescript
// apps/backend/src/services/certificate/payment-cert.service.ts

import { createSupabaseClients } from '../../supabase';
import { getSicoobPixService } from '../sicoob';

const { admin } = createSupabaseClients();
const pixService = getSicoobPixService();

export class PaymentCertService {
  /**
   * Criar cobrança PIX para certificado (R$ 150,00)
   */
  async criarCobrancaPIX(userId: string, userWhatsApp: string): Promise<any> {
    // 1. Criar cobrança PIX no Sicoob
    const cobranca = await pixService.criarCobrancaImediata({
      valor: 150.00,
      chave: process.env.SICOOB_PIX_CHAVE!,
      solicitacaoPagador: 'Certificado Digital ICP-Brasil - GuiasMEI',
      infoAdicionais: [
        { nome: 'userId', valor: userId },
        { nome: 'tipo', valor: 'certificado' }
      ]
    });

    // 2. Registrar no payment_cert_digital
    const { data: payment, error } = await admin
      .from('payment_cert_digital')
      .insert({
        user_id: userId,
        txid: cobranca.txid,
        qr_code: cobranca.qrcode,
        valor: 150.00,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao registrar pagamento: ${error.message}`);
    }

    return {
      txid: cobranca.txid,
      qr_code: cobranca.qrcode,
      valor: 150.00,
      payment_id: payment.id
    };
  }

  /**
   * Processar webhook de pagamento confirmado
   */
  async processarPagamentoConfirmado(txid: string): Promise<void> {
    // 1. Buscar payment_cert_digital
    const { data: payment, error } = await admin
      .from('payment_cert_digital')
      .select('*')
      .eq('txid', txid)
      .single();

    if (error || !payment) {
      throw new Error('Pagamento não encontrado');
    }

    // 2. Atualizar status
    await admin
      .from('payment_cert_digital')
      .update({
        status: 'PAID',
        paid_at: new Date()
      })
      .eq('id', payment.id);

    // 3. TODO: Enviar email para certificadora
    console.log('[TODO] Enviar email para rebelocontabil@gmail.com');

    // 4. TODO: Notificar usuário via WhatsApp
    console.log('[TODO] Notificar usuário: pagamento confirmado');
  }
}
```

**✅ Checklist Day 5:**
- [ ] Service de pagamento criado
- [ ] Integração com Sicoob PIX
- [ ] Registro em `payment_cert_digital`
- [ ] Webhook de pagamento integrado
- [ ] Testes de pagamento criados

---

### **DAY 6: Email para Certificadora**

#### 6.1 Criar `cert-notification.service.ts`
```typescript
// apps/backend/src/services/email/cert-notification.service.ts

import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export class CertNotificationService {
  /**
   * Enviar email para certificadora
   */
  async enviarEmailSolicitacaoCertificado(data: any): Promise<void> {
    const msg = {
      to: process.env.CERTISIGN_EMAIL_CERTIFICADORA!,
      from: process.env.EMAIL_FROM!,
      subject: `[GuiasMEI] Nova Solicitação Certificado - ${data.solicitacao_id}`,
      html: this.templateEmailCertificadora(data)
    };

    await sgMail.send(msg);
    console.log('[EMAIL] Enviado para certificadora');
  }

  private templateEmailCertificadora(data: any): string {
    return `
      <h2>Nova Solicitação de Certificado Digital</h2>
      <p>Um novo cliente solicitou certificado digital ICP-Brasil através da plataforma GuiasMEI.</p>
      
      <h3>Dados do Cliente:</h3>
      <ul>
        <li><strong>Nome:</strong> ${data.nome}</li>
        <li><strong>CNPJ:</strong> ${data.cnpj}</li>
        <li><strong>Email:</strong> ${data.email}</li>
        <li><strong>WhatsApp:</strong> ${data.telefone}</li>
      </ul>

      <h3>Agendamento:</h3>
      <ul>
        <li><strong>Data:</strong> ${data.dataAgendamento}</li>
      </ul>

      <h3>Pagamento:</h3>
      <ul>
        <li><strong>Status:</strong> CONFIRMADO (PIX R$ 150,00)</li>
        <li><strong>TXID:</strong> ${data.txid}</li>
      </ul>

      <h3>Próximos Passos:</h3>
      <ol>
        <li>Entrar em contato com o cliente via WhatsApp</li>
        <li>Realizar validação presencial/remota</li>
        <li>Emitir certificado digital ICP-Brasil</li>
        <li>Enviar metadados via webhook GuiasMEI</li>
      </ol>

      <p>---<br>Plataforma GuiasMEI<br>https://guiasmei.com.br</p>
    `;
  }
}
```

**✅ Checklist Day 6:**
- [ ] Service de email criado
- [ ] Template email implementado
- [ ] Integração SendGrid configurada
- [ ] Testes de envio de email criados

---

### **DAY 7: Prompts IA WhatsApp**

#### 7.1 Criar `ai_prompts_certificado.py`
```python
# apps/backend/inss/app/services/ai_prompts_certificado.py

PROMPT_MEI_CERTIFICADO_INTRO = """
Você é o assistente virtual da GuiasMEI. Um usuário MEI acabou de se cadastrar.

🎯 Seu objetivo:
1. Dar boas-vindas calorosas
2. Explicar a importância do CERTIFICADO DIGITAL ICP-BRASIL para emitir notas fiscais com segurança
3. Perguntar se o usuário já possui certificado digital
4. Se NÃO possuir, oferecer emissão via parceria com Certisign

💡 Tom: Amigável, claro, educativo.
📱 Formato: Mensagens curtas (max 3 linhas por vez)
🚫 Nunca mencionar detalhes técnicos (XML, DPS, APIs, etc)

Contexto do usuário:
- Nome: {{nome}}
- CNPJ: {{cnpj}}
- Tipo: MEI
"""

PROMPT_MEI_CERTIFICADO_CONSULTA_DATAS = """
O usuário não possui certificado digital e quer emitir um.

🎯 Seu objetivo:
1. Informar que o certificado custa R$ 150,00 (pagamento único)
2. Consultar datas disponíveis via função consultar_datas_certisign()
3. Mostrar as 3 próximas datas/horários disponíveis
4. Perguntar qual data/horário prefere

💡 Tom: Empolgado, facilitador.
📱 Formato: Lista de datas clara e objetiva

Exemplo:
"📅 Datas disponíveis para emissão:

1️⃣ 05/11 às 14h
2️⃣ 06/11 às 10h
3️⃣ 07/11 às 16h

Qual prefere? Digite o número (1, 2 ou 3)"
"""

# ... outros prompts ...
```

**✅ Checklist Day 7:**
- [ ] Prompts IA criados
- [ ] Integração com WhatsApp service
- [ ] Funções consultar_datas_certisign() implementada
- [ ] Testes de conversação criados

---

## 🎯 PRÓXIMOS PASSOS (A PARTIR DO DAY 8)

### FASE 3: PRODUÇÃO REAL (Dias 8-10)
- Obter credenciais Certisign
- Substituir mocks por API real
- Testar com certificado real
- Validar mTLS strategy

### FASE 4: TESTES E2E (Dias 11-13)
- Fluxo MEI completo
- Testes de segurança
- Penetration testing
- Go-live

---

## 📝 VARIÁVEIS .ENV NECESSÁRIAS

```env
# Certisign
CERTISIGN_API_KEY=sk_certisign_...
CERTISIGN_API_BASE_URL=https://api.certisign.com.br
CERTISIGN_WEBHOOK_SECRET=whsec_...
CERTISIGN_EMAIL_CERTIFICADORA=rebelocontabil@gmail.com

# Backend
BACKEND_URL=https://api.guiasmei.com.br

# Email
SENDGRID_API_KEY=SG...
EMAIL_FROM=noreply@guiasmei.com.br
```

---

**INICIAR IMPLEMENTAÇÃO:** Day 1 AGORA! 🚀
