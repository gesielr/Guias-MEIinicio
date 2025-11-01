// apps/backend/src/services/email/cert-notification.service.ts
// Serviço de notificações por email relacionadas ao certificado digital
// MODO MOCK: loga em console; pronto para plugar SendGrid/Resend

import { createSupabaseClients } from "../../../services/supabase";

const { admin } = createSupabaseClients();

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
}

export class CertNotificationService {
  private from = process.env.EMAIL_FROM || "noreply@guiasmei.com.br";
  private certificadora = process.env.CERTISIGN_EMAIL_CERTIFICADORA || "rebelocontabil@gmail.com";

  // Placeholder de provedor de email (SendGrid/Resend)
  private async sendEmail(payload: SendEmailPayload): Promise<void> {
    // TODO: integrar com SendGrid/Resend; por enquanto, modo MOCK
    // eslint-disable-next-line no-console
    console.log("[EMAIL:MOCK] →", { from: this.from, ...payload });
  }

  /**
   * Notifica a certificadora com os dados do cliente após pagamento confirmado
   */
  async notificarCertificadora(userId: string): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, email, telefone, cpf_cnpj")
      .eq("id", userId)
      .single();

    const { data: payment } = await admin
      .from("payment_cert_digital")
      .select("txid, paid_at, valor")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const html = `
      <h2>Nova Solicitação de Certificado Digital</h2>
      <p>Olá, Rebelo Contábil!</p>
      <h3>Dados do Cliente</h3>
      <ul>
        <li><strong>Nome:</strong> ${profile?.nome ?? ""}</li>
        <li><strong>CPF/CNPJ:</strong> ${profile?.cpf_cnpj ?? ""}</li>
        <li><strong>Email:</strong> ${profile?.email ?? ""}</li>
        <li><strong>WhatsApp:</strong> ${profile?.telefone ?? ""}</li>
      </ul>
      <h3>Pagamento</h3>
      <ul>
        <li><strong>Status:</strong> CONFIRMADO</li>
        <li><strong>Valor:</strong> R$ ${(payment?.valor ?? 150).toFixed(2)}</li>
        <li><strong>TXID:</strong> ${payment?.txid ?? ""}</li>
        <li><strong>Data:</strong> ${payment?.paid_at ?? new Date().toISOString()}</li>
      </ul>
      <p>Próximos passos: contato com cliente, validação e emissão do certificado.</p>
    `;

    await this.sendEmail({
      to: this.certificadora,
      subject: `[GuiasMEI] Nova Solicitação Certificado - ${profile?.nome ?? userId}`,
      html,
    });
  }

  /**
   * Notifica o usuário após pagamento confirmado
   */
  async notificarUsuarioPagamentoConfirmado(userId: string): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, email")
      .eq("id", userId)
      .single();

    if (!profile?.email) return;

    const html = `
      <h2>Pagamento Confirmado! 🎉</h2>
      <p>Olá, ${profile?.nome ?? ""}!</p>
      <p>Seu pagamento foi confirmado. A certificadora entrará em contato em até 48h.</p>
      <p>O certificado será emitido em 3-5 dias úteis.</p>
    `;

    await this.sendEmail({
      to: profile.email,
      subject: "Pagamento Confirmado - Certificado Digital",
      html,
    });
  }

  /**
   * Notifica o usuário quando o certificado estiver ativo
   */
  async notificarUsuarioCertificadoAtivo(userId: string): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, email")
      .eq("id", userId)
      .single();

    if (!profile?.email) return;

    const html = `
      <h2>Seu Certificado Está Ativo! 🔐</h2>
      <p>Olá, ${profile?.nome ?? ""}!</p>
      <p>Seu certificado digital foi emitido e está pronto para uso. Agora você pode emitir NFS-e na plataforma GuiasMEI.</p>
    `;

    await this.sendEmail({
      to: profile.email,
      subject: "Certificado Digital Ativo - GuiasMEI",
      html,
    });
  }
}

// Singleton opcional
let instance: CertNotificationService | null = null;
export function getCertNotificationService(): CertNotificationService {
  if (!instance) instance = new CertNotificationService();
  return instance;
}
