import cron from "node-cron";
import { CertificateMonitoringService } from "./certificate-monitoring.service";

const monitoringService = new CertificateMonitoringService();

export function startCertificateScheduler() {
  // Checa pagamentos expirados a cada 15 minutos
  cron.schedule("*/15 * * * *", async () => {
    try {
      await monitoringService.expirePendingPayments();
    } catch (err) {
      console.error("[CERT-MONITOR] Erro ao expirar pagamentos pendentes", err);
    }
  });

  // Envia lembretes de certificados diariamente às 09:00
  cron.schedule("0 9 * * *", async () => {
    try {
      await monitoringService.notifyExpiringCertificates();
    } catch (err) {
      console.error("[CERT-MONITOR] Erro ao enviar lembretes de certificados", err);
    }
  });

  // Reprocessa notificações de webhook que falharam a cada 30 minutos
  cron.schedule("*/30 * * * *", async () => {
    try {
      await monitoringService.retryFailedWebhookNotifications();
    } catch (err) {
      console.error("[CERT-MONITOR] Erro ao reprocessar notificações Sicoob", err);
    }
  });
}

