// apps/backend/src/services/certificate/certificate.service.ts
// Service para integração com Certificado Digital ICP-Brasil (Certisign)
// MODO MOCK: Implementação inicial sem chamadas reais à API

import { createSupabaseClients } from '../../../services/supabase';
import {
  CertProvider,
  CertEnrollment,
  SignRequest,
  DataDisponivel,
  EnrollmentRequest,
  WebhookPayload,
  SignatureRequestPayload
} from './types';
import crypto from 'crypto';

const { admin } = createSupabaseClients();

export class CertificateService {
  private provider: CertProvider | null = null;

  constructor(private providerNome: string = 'Certisign') {
    // Provider será inicializado na primeira chamada
  }

  /**
   * Inicializar provider do banco de dados
   */
  private async inicializarProvider(): Promise<void> {
    if (this.provider) {
      return; // Já inicializado
    }

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
   * TODO: Substituir por chamada real à API Certisign
   */
  async consultarDatasDisponiveis(): Promise<DataDisponivel[]> {
    console.log('[MOCK] Consultando datas disponíveis na Certisign...');
    
    const hoje = new Date();
    const datas: DataDisponivel[] = [];

    // Gerar próximos 6 dias úteis
    for (let i = 5; i <= 10; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      
      // Pular fins de semana
      if (data.getDay() === 0 || data.getDay() === 6) {
        continue;
      }

      datas.push({
        data: data.toISOString().split('T')[0],
        horarios: ['09:00', '11:00', '14:00', '16:30']
      });
    }

    return datas;
  }

  /**
   * Solicitar vinculação de certificado (MOCK)
   * TODO: Substituir por chamada real à API Certisign
   */
  async solicitarVinculoCertificado(data: EnrollmentRequest): Promise<string> {
    console.log('[MOCK] Solicitando certificado digital para:', data.nome);

    await this.inicializarProvider();

    if (!this.provider) {
      throw new Error('Provider não inicializado');
    }

    // Criar enrollment PENDING no banco
    const { data: enrollment, error } = await admin
      .from('cert_enrollments')
      .insert({
        user_id: data.userId,
        provider_id: this.provider.id,
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
      null,
      data.userId,
      enrollment.id,
      'ENROLLMENT_REQUESTED',
      { 
        data_agendamento: data.dataAgendamento,
        nome: data.nome,
        cpf_cnpj: data.cpf_cnpj 
      }
    );

    console.log('[MOCK] Enrollment criado com sucesso:', enrollment.external_cert_id);
    return enrollment.external_cert_id;
  }

  /**
   * Processar callback de vinculação (certificado emitido)
   */
  async processarCallbackVinculo(payload: WebhookPayload): Promise<void> {
    console.log('[INFO] Processando callback vinculo:', payload.external_cert_id);

    // Buscar enrollment pelo ID temporário ou external_cert_id
    const { data: enrollment, error } = await admin
      .from('cert_enrollments')
      .select('*')
      .or(`external_cert_id.eq.${payload.solicitacao_id || payload.external_cert_id}`)
      .single();

    if (error || !enrollment) {
      throw new Error('Enrollment não encontrado');
    }

    // Atualizar com dados reais do certificado
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
      { 
        external_cert_id: payload.external_cert_id,
        valid_until: payload.valid_until
      }
    );

    console.log('[SUCCESS] Certificado ativado com sucesso');
    // TODO: Notificar usuário via WhatsApp
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
   * Validar se certificado está ativo e válido
   */
  async validarCertificadoAtivo(enrollmentId: string): Promise<boolean> {
    const { data, error } = await admin
      .from('cert_enrollments')
      .select('status, valid_until')
      .eq('id', enrollmentId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.status === 'ACTIVE' && new Date(data.valid_until) > new Date();
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
      throw new Error('Usuário não possui certificado digital ativo. Solicite em /api/certisign/enrollment');
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
      { 
        hash, 
        document_type: documentType,
        qr_code_url: mockResponse.qr_code_url
      }
    );

    console.log('[MOCK] Assinatura solicitada. QR Code:', mockResponse.qr_code_url);
    // TODO: Notificar usuário via WhatsApp com QR Code

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

    console.log('[SUCCESS] Assinatura recebida e processada');
    // TODO: Continuar fluxo de emissão NFSe
  }

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
   * Usado quando não há webhook disponível
   */
  async aguardarAprovacaoAssinatura(
    signRequestId: string,
    timeoutMs: number = 5 * 60 * 1000 // 5 minutos
  ): Promise<SignRequest> {
    const inicio = Date.now();
    const intervalo = 3000; // 3 segundos

    console.log('[INFO] Aguardando aprovação de assinatura...');

    while (Date.now() - inicio < timeoutMs) {
      const signRequest = await this.buscarSignRequest(signRequestId);

      if (!signRequest) {
        throw new Error('SignRequest não encontrado');
      }

      if (signRequest.status === 'APPROVED') {
        console.log('[SUCCESS] Assinatura aprovada!');
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
   * TODO: Implementar montagem completa conforme especificação XML-DSig
   */
  montarXMLDSig(hash: string, signatureValue: string, certificateThumbprint: string): string {
    // Template básico XMLDSig
    // Na produção, usar biblioteca xml-crypto ou equivalente
    return `
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignedInfo>
    <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <Reference URI="">
      <Transforms>
        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
        <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      </Transforms>
      <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <DigestValue>${Buffer.from(hash, 'hex').toString('base64')}</DigestValue>
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
   * Registrar auditoria (LGPD compliance)
   */
  private async registrarAuditoria(
    signRequestId: string | null,
    userId: string,
    enrollmentId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    try {
      await admin.from('sign_audit_logs').insert({
        sign_request_id: signRequestId,
        user_id: userId,
        enrollment_id: enrollmentId,
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ERROR] Falha ao registrar auditoria:', error);
      // Não falhar operação principal por erro de auditoria
    }
  }
}

// Singleton instance
let certificateServiceInstance: CertificateService | null = null;

export function getCertificateService(): CertificateService {
  if (!certificateServiceInstance) {
    certificateServiceInstance = new CertificateService();
  }
  return certificateServiceInstance;
}
