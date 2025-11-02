// apps/backend/src/services/certificate/certificate-monitoring.service.ts
// Rotinas agendadas para acompanhar pagamentos, certificados e webhooks relacionados ao fluxo de certificado digital.

import { differenceInMinutes, differenceInCalendarDays } from "date-fns";
import { createSupabaseClients } from "../../../services/supabase";
import { getCertNotificationService } from "../email/cert-notification.service";
import { getCertWhatsappService } from "../whatsapp/cert-whatsapp.service";
import { sicoobLogger } from "../../utils/sicoob-logger";
import { getWebhookService } from "../sicoob";
import type { WebhookPayload } from "../sicoob/webhook.service";

const { admin } = createSupabaseClients();

export class CertificateMonitoringService {
  private emailService = getCertNotificationService();
  private whatsappService = getCertWhatsappService();

  /**
   * Marca pagamentos PIX que expiraram e informa o usuário.
   */
  async expirePendingPayments(): Promise<void> {
    const limite = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h
    const { data: pendentes, error } = await admin
      .from("payment_cert_digital")
      .select("id, user_id, txid, created_at, status")
      .eq("status", "PENDING")
      .lt("created_at", limite);

    if (error) {
      sicoobLogger.error("Monitoramento pagamento: falha ao buscar pendentes", error);
      return;
    }

    if (!pendentes || pendentes.length === 0) {
      return;
    }

    for (const pagamento of pendentes) {
      try {
        await admin
          .from("payment_cert_digital")
          .update({ status: "EXPIRED", updated_at: new Date() })
          .eq("id", pagamento.id);

        const createdAt = pagamento.created_at ? new Date(pagamento.created_at as string) : new Date(0);

        await this.emailService.notificarUsuarioPagamentoExpirado(pagamento.user_id);
        await this.whatsappService.notificarPagamentoExpirado(pagamento.user_id);

        sicoobLogger.warn("Pagamento certificado expirado automaticamente", {
          txid: pagamento.txid,
          user_id: pagamento.user_id,
          minutosAbertos: differenceInMinutes(new Date(), createdAt)
        });
      } catch (err) {
        sicoobLogger.error("Erro ao expirar pagamento certificado", err as Error, {
          txid: pagamento.txid,
          user_id: pagamento.user_id
        });
      }
    }
  }

  /**
   * Envia lembretes para certificados que expiram em até 30 dias.
   * Utiliza sign_audit_logs para evitar notificações duplicadas num intervalo de 24h.
   */
  async notifyExpiringCertificates(): Promise<void> {
    const limiteSuperior = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const agora = new Date().toISOString();

    const { data: certificados, error } = await admin
      .from("cert_enrollments")
      .select("id, user_id, valid_until")
      .eq("status", "ACTIVE")
      .gte("valid_until", agora)
      .lte("valid_until", limiteSuperior);

    if (error) {
      sicoobLogger.error("Monitoramento certificado: falha ao buscar vencimentos", error);
      return;
    }

    if (!certificados || certificados.length === 0) {
      return;
    }

    for (const cert of certificados) {
      const validUntilDate = cert.valid_until ? new Date(cert.valid_until as string) : new Date();
      const diasRestantes = Math.max(0, differenceInCalendarDays(validUntilDate, new Date()));

      // Verifica se já notificamos nas últimas 24h
      const { data: historico } = await admin
        .from("cert_expiry_notifications")
        .select("id, notified_at")
        .eq("enrollment_id", cert.id)
        .gte("notified_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (historico && historico.length > 0) {
        continue;
      }

      try {
        await this.emailService.notificarUsuarioCertificadoExpirando(cert.user_id, diasRestantes);
        await this.whatsappService.notificarCertificadoExpirando(cert.user_id, diasRestantes);

        await admin.from("cert_expiry_notifications").insert({
          enrollment_id: cert.id,
          user_id: cert.user_id,
          days_until_expiry: diasRestantes,
          notified_at: new Date().toISOString()
        });

        sicoobLogger.info("Lembrete de certificado prestes a expirar enviado", {
          enrollment_id: cert.id,
          user_id: cert.user_id,
          diasRestantes
        });
      } catch (err) {
        sicoobLogger.error("Erro ao enviar lembrete de expiração de certificado", err as Error, {
          enrollment_id: cert.id,
          user_id: cert.user_id
        });
      }
    }
  }

  /**
   * Reexecuta callbacks do Sicoob que ficaram presos na fila de notificações.
   * Busca eventos de notificação marcados como falha para tentar reenfileirar.
   */
  async retryFailedWebhookNotifications(): Promise<void> {
    const webhookService = this.safeGetWebhookService();
    if (!webhookService) {
      return;
    }

    const { data: falhas, error } = await admin
      .from("sicoob_notificacoes")
      .select("id, identificador_cobranca, dados_notificacao, tentativas")
      .eq("status", "FALHOU")
      .lt("tentativas", 5)
      .limit(20);

    if (error) {
      sicoobLogger.error("Monitoramento webhook: falha ao buscar notificações", error);
      return;
    }

    if (!falhas || falhas.length === 0) {
      return;
    }

    for (const notificacao of falhas) {
      const payload: WebhookPayload = {
        evento_id: notificacao.identificador_cobranca,
        tipo_evento: notificacao.dados_notificacao?.tipo_evento ?? "pix.received",
        timestamp: notificacao.dados_notificacao?.timestamp ?? new Date().toISOString(),
        dados: notificacao.dados_notificacao?.dados ?? notificacao.dados_notificacao
      };

      try {
        await webhookService.processWebhook(payload);
        await admin
          .from("sicoob_notificacoes")
          .update({
            status: "ENVIADA",
            processado_em: new Date().toISOString(),
            tentativas: (notificacao.tentativas ?? 0) + 1
          })
          .eq("id", notificacao.id);

        sicoobLogger.info("Webhook reprocessado com sucesso", {
          identificador: notificacao.identificador_cobranca
        });
      } catch (err) {
        await admin
          .from("sicoob_notificacoes")
          .update({
            tentativas: (notificacao.tentativas ?? 0) + 1,
            ultima_tentativa: new Date().toISOString(),
            erro_mensagem: (err as Error).message?.slice(0, 200) ?? "erro desconhecido"
          })
          .eq("id", notificacao.id);

        sicoobLogger.error("Falha ao reprocessar webhook Sicoob", err as Error, {
          identificador: notificacao.identificador_cobranca
        });
      }
    }
  }

  private safeGetWebhookService() {
    try {
      return getWebhookService();
    } catch (err) {
      sicoobLogger.warn("WebhookService não inicializado. Ignorando reprocessamento automático.", err as Error);
      return null;
    }
  }
}

