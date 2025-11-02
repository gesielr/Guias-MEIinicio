import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { getCertWhatsappService } from "../src/services/whatsapp/cert-whatsapp.service";

const outboundSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
  cobrancaId: z.string().optional(),
  tipo: z.enum(["info", "cobranca", "notificacao"]).optional()
});

type OutboundPayload = z.infer<typeof outboundSchema>;

function extractWhatsappNumber(body: any): string | null {
  const from = body?.From ?? body?.from ?? body?.telefone;
  if (typeof from === "string" && from.length > 0) {
    return from;
  }
  return null;
}

function extractMessage(body: any): string {
  return (body?.Body ?? body?.body ?? body?.mensagem ?? "").toString().trim();
}

export async function registerWhatsappRoutes(app: FastifyInstance) {
  const whatsappService = getCertWhatsappService();

  app.post("/whatsapp", async (request: FastifyRequest<{ Body: OutboundPayload }>) => {
    const payload = outboundSchema.parse(request.body);
    request.log.info({ payload }, "Enviando mensagem WhatsApp manual");

    await whatsappService.enviarMensagemDireta(payload.to, payload.message);

    if (payload.cobrancaId) {
      try {
        const { getCobrancaService } = await import("../src/services/sicoob/cobranca-db.service");
        const cobrancaService = getCobrancaService();
        await cobrancaService.adicionarHistorico(payload.cobrancaId, {
          tipo: "whatsapp_enviado",
          dados: {
            destinatario: payload.to,
            mensagem: payload.message,
            tipo: payload.tipo || "info"
          }
        });
      } catch (error) {
        request.log.error({ error }, "Erro ao registrar histórico de WhatsApp");
      }
    }

    return { ok: true };
  });

  app.post("/whatsapp/webhook", async (request: FastifyRequest) => {
    const from = extractWhatsappNumber(request.body);
    const message = extractMessage(request.body);
    request.log.info({ from, message }, "Webhook WhatsApp recebido");

    if (!from || !message) {
      return { ok: false, reason: "payload inválido" };
    }

    const normalized = message.toLowerCase();
    let resposta: string;

    if (normalized.includes("certificado") && normalized.includes("status")) {
      resposta = [
        "🧾 *Status do Certificado Digital*",
        "1. Gere o pagamento PIX de R$150 no painel ou peça o link por aqui.",
        "2. Após o pagamento enviaremos seu agendamento com a Certisign.",
        "3. Quando o certificado estiver ativo você receberá uma notificação automática.",
        "Deseja que eu gere o QR Code novamente?"
      ].join("\n\n");
    } else if (normalized.includes("pagar") || normalized.includes("pix")) {
      resposta = [
        "🔗 *Pagamento do Certificado*",
        "Enviei um novo QR Code PIX de R$150 para você completar o processo.",
        "Depois do pagamento acompanhe por aqui. Qualquer dúvida é só responder."
      ].join("\n\n");
    } else if (normalized.includes("ajuda") || normalized.includes("suporte")) {
      resposta = [
        "👋 *Equipe GuiasMEI*",
        "Estou aqui para ajudar com certificado, NFSe e INSS.",
        "Para falar com um especialista humano basta responder \"humano\" e encaminharemos o atendimento."
      ].join("\n\n");
    } else {
      resposta = [
        "🙋 *Fluxo Certificado GuiasMEI*",
        "1. Gere o pagamento PIX de R$150.",
        "2. Aguarde o contato da Certisign para validar seus documentos.",
        "3. Assim que estiver ativo liberamos a emissão de NFS-e.",
        "Precisa refazer alguma etapa? É só me contar."
      ].join("\n\n");
    }

    await whatsappService.enviarMensagemDireta(from, resposta);
    return { ok: true };
  });
}

export default registerWhatsappRoutes;
