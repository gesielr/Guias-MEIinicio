import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

const messageSchema = z.object({
  to: z.string().min(8),
  message: z.string().min(1),
  cobrancaId: z.string().optional(), // ID da cobrança relacionada
  tipo: z.enum(['info', 'cobranca', 'notificacao']).optional(),
});

type MessageBody = z.infer<typeof messageSchema>;

export async function registerWhatsappRoutes(app: FastifyInstance) {
  // Endpoint para enviar mensagens do WhatsApp
  app.post("/whatsapp", async (request: FastifyRequest<{ Body: MessageBody }>) => {
    const payload = messageSchema.parse(request.body);
    request.log.info({ payload }, "WhatsApp message dispatched");
    
    // Se houver cobrancaId, registrar histórico
    if (payload.cobrancaId) {
      try {
        // Importar serviço de cobrança dinamicamente
        const { getCobrancaService } = await import('../src/services/sicoob/cobranca-db.service');
        const cobrancaService = getCobrancaService();
        
        await cobrancaService.adicionarHistorico(payload.cobrancaId, {
          tipo: 'whatsapp_enviado',
          dados: {
            destinatario: payload.to,
            mensagem: payload.message,
            tipo: payload.tipo || 'info',
          },
        });
        
        request.log.info({ cobrancaId: payload.cobrancaId }, "Histórico de WhatsApp registrado");
      } catch (error) {
        request.log.error({ error }, "Erro ao registrar histórico de WhatsApp");
      }
    }
    
    return { ok: true };
  });

  // Endpoint para webhook do WhatsApp (receber mensagens)
  app.post("/whatsapp/webhook", async (request: FastifyRequest) => {
    request.log.info({ body: request.body }, "WhatsApp webhook received");
    
    // TODO: Processar mensagens recebidas e integrá-las com a IA
    // Pode consultar cobranças, gerar links de pagamento, etc.
    
    return { ok: true };
  });
}

export default registerWhatsappRoutes;