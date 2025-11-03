// apps/backend/src/services/whatsapp/cert-whatsapp.service.ts
// Serviço especializado em notificações WhatsApp relacionadas ao fluxo de certificado digital

import twilio from "twilio";
import { createSupabaseClients } from "../../../services/supabase";

const { admin } = createSupabaseClients();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

function sanitizeWhatsApp(number?: string | null): string | null {
  if (!number) return null;

  // Remove tudo que não for dígito
  const digits = number.replace(/\D+/g, "");
  if (digits.length < 10) return null;

  if (number.startsWith("whatsapp:")) {
    return number;
  }

  // Assume número brasileiro (55) se vier com DDD
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `whatsapp:+${full}`;
}

export class CertWhatsappService {
  private enabled: boolean;
  private client: twilio.Twilio | null = null;

  constructor() {
    this.enabled = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER);
    if (this.enabled) {
      this.client = twilio(TWILIO_ACCOUNT_SID!, TWILIO_AUTH_TOKEN!);
      console.log("[WHATSAPP] Twilio configurado para notificações de certificado.");
    } else {
      console.warn("[WHATSAPP] Variáveis Twilio ausentes. Notificações serão apenas logadas.");
    }
  }

  private async sendMessage(to: string, body: string): Promise<void> {
    if (!this.enabled || !this.client) {
      console.log("[WHATSAPP:MOCK]", { from: TWILIO_WHATSAPP_NUMBER, to, body });
      return;
    }

    try {
      await this.client.messages.create({
        from: TWILIO_WHATSAPP_NUMBER!,
        to,
        body
      });
      console.log("[WHATSAPP] Mensagem enviada", { to });
    } catch (error: any) {
      console.error("[WHATSAPP] Falha ao enviar mensagem", {
        to,
        error: error?.message || error
      });
    }
  }

  /**
   * Notifica o usuário que o pagamento foi confirmado.
   */
  async notificarPagamentoConfirmado(userId: string): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, telefone")
      .eq("id", userId)
      .single();

    const numero = sanitizeWhatsApp(profile?.telefone);
    if (!numero) {
      console.warn("[WHATSAPP] Telefone inválido ou ausente para enviar confirmação de pagamento.", {
        userId,
        telefone: profile?.telefone
      });
      return;
    }

    const mensagem = [
      `Olá, ${profile?.nome ?? "empreendedor(a)"}! 🎉`,
      "Recebemos o pagamento do seu Certificado Digital GuiasMEI.",
      "Nossa equipe e a Certisign vão entrar em contato em até 48h para agendar a validação.",
      "Assim que o certificado estiver ativo avisaremos por aqui."
    ].join("\n\n");

    await this.sendMessage(numero, mensagem);
  }

  /**
   * Dispara notificação quando o certificado entrar em estado ativo.
   */

  async notificarPagamentoExpirado(userId: string): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, telefone")
      .eq("id", userId)
      .single();

    const numero = sanitizeWhatsApp(profile?.telefone);
    if (!numero) {
      console.warn("[WHATSAPP] Telefone inválido ao avisar pagamento expirado.", {
        userId,
        telefone: profile?.telefone
      });
      return;
    }

    const mensagem = [
      `Olá, ${profile?.nome ?? "empreendedor(a)"}!`,
      "O QR Code do seu certificado digital expirou.",
      "Você pode gerar um novo link no painel GuiasMEI ou chamar nossa equipe por aqui."
    ].join("\n\n");

    await this.sendMessage(numero, mensagem);
  }

  async notificarCertificadoExpirando(userId: string, diasRestantes: number): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, telefone")
      .eq("id", userId)
      .single();

    const numero = sanitizeWhatsApp(profile?.telefone);
    if (!numero) {
      console.warn("[WHATSAPP] Telefone inválido ao avisar certificado expirando.", {
        userId,
        telefone: profile?.telefone
      });
      return;
    }

    const mensagem = [
      `Olá, ${profile?.nome ?? "empreendedor(a)"}!`,
      `Seu certificado digital expira em ${diasRestantes} dia(s).`,
      "Renove com antecedência para continuar emitindo NFS-e sem interrupções.",
      "Qualquer dúvida é só responder esta mensagem."
    ].join("\n\n");

    await this.sendMessage(numero, mensagem);
  }

  async enviarMensagemDireta(telefoneDestino: string, mensagem: string): Promise<void> {
    const numero = sanitizeWhatsApp(telefoneDestino);
    if (!numero) {
      console.warn('[WHATSAPP] Telefone inválido ao enviar mensagem direta.', { telefoneDestino });
      return;
    }

    await this.sendMessage(numero, mensagem);
  }

  async notificarCertificadoAtivo(userId: string): Promise<void> {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, nome, telefone")
      .eq("id", userId)
      .single();

    const numero = sanitizeWhatsApp(profile?.telefone);
    if (!numero) {
      console.warn("[WHATSAPP] Telefone inválido ao avisar certificado ativo.", {
        userId,
        telefone: profile?.telefone
      });
      return;
    }

    const mensagem = [
      `Boa notícia, ${profile?.nome ?? "empreendedor(a)"}! ✅`,
      "Seu certificado digital GuiasMEI já está ativo e pronto para uso.",
      "Agora você pode emitir NFS-e diretamente pela plataforma.",
      "Se precisar de ajuda é só responder esta mensagem."
    ].join("\n\n");

    await this.sendMessage(numero, mensagem);
  }
}

let instance: CertWhatsappService | null = null;
export function getCertWhatsappService(): CertWhatsappService {
  if (!instance) instance = new CertWhatsappService();
  return instance;
}

