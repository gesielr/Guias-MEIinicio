import type { FastifyInstance } from "fastify";
import { NfseService } from "../services/nfse.service";
import { emitNfseSchema, cancelSchema } from "../dto/create-dps.dto";

export async function registerNfseController(app: FastifyInstance) {
  const service = new NfseService();

  app.post("/nfse", async (request, reply) => {
    const contentType = request.headers["content-type"] ?? "";
    if (!contentType.includes("application/json")) {
      return reply.code(415).send({
        error: "Unsupported Media Type",
        message: "Content-Type deve ser application/json"
      });
    }

    const parseResult = emitNfseSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: "Payload invalido",
        details: parseResult.error.flatten()
      });
    }

    try {
      const result = await service.emit(parseResult.data);
      request.log.info({
        scope: "nfse:emit",
        protocolo: result.protocolo,
        situacao: result.situacao
      });
      return reply.code(201).send(result);
    } catch (error) {
      request.log.error({ err: error, scope: "nfse:emit" });

      if (error instanceof Error && error.message.includes("Payload DPS invalido")) {
        return reply.code(400).send({ error: "Bad Request", message: error.message });
      }

      const statusCode = (error as any)?.statusCode;
      if (statusCode) {
        return reply.code(statusCode).send({
          error: "Upstream Error",
          message: (error as Error).message,
          details: (error as any)?.data ?? null
        });
      }

      throw error;
    }
  });

  // rota antiga mantida para compatibilidade - orienta uso do novo endpoint
  app.post("/services/nfse", async (_request, reply) => {
    return reply
      .code(410)
      .send({ error: "Endpoint substituido", message: "Utilize POST /nfse com payload JSON (dps_xml_gzip_b64)." });
  });

  const handleCredentialUpload = async (request: any, reply: any) => {
    const body = request.body as unknown;
    const dto = (await import("../dto/credential.dto")).credentialSchema.parse(body);

    if (!dto.pfxBase64) {
      return reply.badRequest("Arquivo PFX nao enviado");
    }

    const pfxBuffer = Buffer.from(dto.pfxBase64, "base64");
    if (pfxBuffer.length < 1000 || pfxBuffer.length > 30000) {
      return reply.badRequest("Arquivo PFX fora do tamanho esperado (1KB ~ 30KB)");
    }

    try {
      const forge = await import("node-forge");
      const f = forge.default ?? forge;
      const asn1 = f.asn1.fromDer(pfxBuffer.toString("binary"));
      f.pkcs12.pkcs12FromAsn1(asn1, dto.pass);
    } catch {
      return reply.badRequest("Arquivo nao e um PFX valido ou senha incorreta");
    }

    const { storeCredential } = await import("../repositories/credentials.repo");
    const created = await storeCredential({
      userId: dto.userId,
      type: dto.type,
      subject: dto.subject,
      document: dto.document,
      notAfter: dto.notAfter,
      pfxBase64: dto.pfxBase64,
      pass: dto.pass
    });
    return created;
  };

  app.post("/nfse/credentials", handleCredentialUpload);
  app.post("/services/nfse/credentials", handleCredentialUpload);

  app.get("/nfse/:id", async (request) => {
    const { id } = request.params as { id: string };
    return service.pollStatus(id);
  });

  app.post("/nfse/:id/cancel", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as unknown;
    const dto = cancelSchema.parse({ protocolo: id, ...(body ?? {}) });
    return { canceled: true, protocolo: dto.protocolo };
  });

  app.get("/nfse/:id/pdf", async (request, reply) => {
    const { id } = request.params as { id: string };
    const pdf = await service.downloadDanfe(id);

    reply.type("application/pdf");
    reply.header("Content-Disposition", `inline; filename=NFSe-${id}.pdf`);
    return reply.send(pdf);
  });

  app.get("/nfse/:id/storage-pdf", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { getEmissionPdfStoragePath, downloadPdfFromStorage } = await import("../repositories/nfse-emissions.repo");
    const storagePath = await getEmissionPdfStoragePath(id);

    if (!storagePath) {
      return reply.notFound("PDF nao disponivel para esta emissao");
    }

    const pdf = await downloadPdfFromStorage(storagePath);
    reply.type("application/pdf");
    reply.header("Content-Disposition", `inline; filename=NFSe-${id}.pdf`);
    return reply.send(pdf);
  });

  /**
   * Endpoint para obter métricas do sistema NFSe
   */
  app.get("/nfse/metrics", async (request, reply) => {
    try {
      const metrics = service.getMetrics();
      return reply.send(metrics);
    } catch (error) {
      request.log.error({ err: error, scope: "nfse:metrics" });
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Erro ao obter métricas do sistema NFSe"
      });
    }
  });
}




