import { gunzipSync, gzipSync } from "node:zlib";
import { AxiosError } from "axios";
import { createAdnClient } from "../adapters/adn-client";
import { saveEmission, updateEmissionStatus, hashXml, attachPdf } from "../repositories/nfse-emissions.repo";
import { fetchLatestCredential, getCredentialPfxBuffer } from "../repositories/credentials.repo";
import { signInfDps } from "../crypto/xml-signer";
import { pfxToPem, validateCertificate } from "../crypto/pfx-utils";
import { cleanXml, validateXmlAgainstXsd } from "../utils/xml-utils";
import logger from "../../utils/logger";
import { env } from "../../env";
import { NfseMetricsService } from "../../services/nfse-metrics.service";
import { checkCertificateExpiry } from "../../utils/certificate-checker";
import { fixTribMunOrder } from "../../utils/xml-fixer";
import * as libxmljs from 'libxmljs';
import * as zlib from 'zlib';
import * as fs from 'fs';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

function decodeDpsPayload(base64Gzip: string): string {
  try {
    const gzBuffer = Buffer.from(base64Gzip, "base64");
    const xmlBuffer = gunzipSync(gzBuffer);
    return xmlBuffer.toString("utf8");
  } catch (err) {
    throw new Error("Payload DPS invalido: nao foi possivel decodificar GZip/Base64");
  }
}

export interface EmitNfseDto {
  userId: string;
  versao: string;
  dps_xml_gzip_b64: string;
}

export interface EmitNfseResult {
  protocolo: string;
  chaveAcesso: string | null;
  numeroNfse: string | null;
  status: string;
  situacao: string;
  dataProcessamento: string;
  resposta: any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DPS_XSD_PATH = path.resolve(__dirname, '..', 'xsd', 'DPS_v1.00.xsd');
let dpsXsdSchema: any | null = null;
const tpAmb = env.NFSE_ENVIRONMENT === 'production' ? '1' : '2';

export class NfseService {
  private metricsService: NfseMetricsService;

  constructor() {
    this.metricsService = new NfseMetricsService();
  }

  /**
   * Obtém métricas do sistema NFSe
   * @returns Resumo das métricas
   */
  getMetrics() {
    return this.metricsService.getMetrics();
  }
  /**
   * Verifica se um erro é recuperável e deve ser tentado novamente
   * @param error Erro a ser analisado
   * @returns true se o erro é recuperável, false caso contrário
   */
  private isRetryableError(error: any): boolean {
    // Erros de rede e timeout são recuperáveis
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // Erros HTTP 5xx são recuperáveis
    if (error.response?.status >= 500) {
      return true;
    }

    // Erros HTTP 4xx específicos são recuperáveis
    if (error.response?.status === 429) { // Too Many Requests
      return true;
    }

    // Erros de validação e autenticação NÃO são recuperáveis
    if (error.response?.status === 400 || 
        error.response?.status === 401 || 
        error.response?.status === 403 || 
        error.response?.status === 422) {
      return false;
    }

    // Por padrão, considerar não recuperável
    return false;
  }

  /**
   * Emite NFS-e com lógica de retry e backoff exponencial
   * @param dto Dados da emissão
   * @param maxRetries Número máximo de tentativas (padrão: 3)
   * @returns Resultado da emissão
   */
  async emit(dto: EmitNfseDto, maxRetries = 3): Promise<EmitNfseResult> {
    const startTime = Date.now();
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('[NFSe] Iniciando emissão', { 
          userId: dto.userId, 
          versao: dto.versao, 
          attempt, 
          maxRetries 
        });

        const result = await this.performEmission(dto);
        const duration = Date.now() - startTime;
        
        // Registrar métrica de sucesso
        this.metricsService.recordEmission(true, duration);
        
        logger.info('[NFSe] Emissão realizada com sucesso', { 
          userId: dto.userId, 
          protocolo: result.protocolo, 
          attempt,
          duration 
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Verificar se erro é recuperável
        const isRetryable = this.isRetryableError(error);
        const isLastAttempt = attempt === maxRetries;
        
        logger.warn('[NFSe] Tentativa falhou', { 
          userId: dto.userId, 
          attempt, 
          maxRetries, 
          error: lastError.message, 
          isRetryable 
        });
        
        if (!isRetryable || isLastAttempt) {
          const duration = Date.now() - startTime;
          
          // Registrar métrica de falha
          this.metricsService.recordEmission(false, duration, lastError.message);
          
          logger.error('[NFSe] Emissão falhou definitivamente', { 
            userId: dto.userId, 
            attempt, 
            maxRetries, 
            error: lastError.message, 
            stack: lastError.stack,
            duration 
          });
          throw lastError;
        }
        
        // Backoff exponencial: 1s → 2s → 4s
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        logger.warn(`[NFSe] Tentativa ${attempt}/${maxRetries} falhou, aguardando ${delayMs}ms...`, { 
          userId: dto.userId, 
          delayMs 
        });
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw lastError!;
  }

  /**
   * Executa a emissão propriamente dita (sem retry)
   * @param dto Dados da emissão
   * @returns Resultado da emissão
   */
  private async performEmission(dto: EmitNfseDto): Promise<EmitNfseResult> {
    if (!dto?.versao) {
      throw new Error("Campo versao e obrigatorio");
    }

    if (!dto?.userId) {
      throw new Error("Campo userId e obrigatorio");
    }

    if (!dto?.dps_xml_gzip_b64) {
      throw new Error("Campo dps_xml_gzip_b64 e obrigatorio");
    }

    const originalXml = decodeDpsPayload(dto.dps_xml_gzip_b64);
    let xml = cleanXml(originalXml);
    xml = fixTribMunOrder(xml);
    xml = cleanXml(xml);
    logger.info('[NFSe] XML original decodificado e limpo', { userId: dto.userId, xmlLength: xml.length });

    // Validação XSD obrigatória antes de assinar
    const xsdPath = process.env.NFSE_XSD_PATH || DPS_XSD_PATH;
    const xsdSchema = await this.loadXsdSchema(xsdPath);
    this.validateXmlWithXsd(xml, xsdSchema);

    if (!xml.includes('<Signature')) {
      // Escolher credencial: prioridade para credencial do usuário, depois .env/global
      let credential: Awaited<ReturnType<typeof fetchLatestCredential>> | null = null;
      try {
        credential = await fetchLatestCredential(dto.userId);
      } catch (err) {
        logger.warn("[NFSe] Falha ao buscar credencial no Supabase, utilizando fallback do .env", { userId: dto.userId, error: err });
      }
      let privateKeyPem: string | undefined;
      let certificatePem: string | undefined;
      let certSource = 'unknown';

      if (!credential && process.env.NFSE_CERT_METHOD === 'supabase_vault' && process.env.NFSE_CERT_PFX_BASE64 && process.env.NFSE_CERT_PFX_PASS) {
        const pfxBuffer = Buffer.from(process.env.NFSE_CERT_PFX_BASE64, 'base64');
        ({ privateKeyPem, certificatePem } = pfxToPem(pfxBuffer, process.env.NFSE_CERT_PFX_PASS));
        certSource = 'global (.env)';
      } else if (credential) {
        const pfxBuffer = await getCredentialPfxBuffer(credential.storagePath);
        ({ privateKeyPem, certificatePem } = pfxToPem(pfxBuffer, credential.pass));
        certSource = 'usuario';
      } else {
        throw new Error('Nenhuma credencial PFX encontrada para o usuario');
      }

      // Validação do certificado
      const cnpjOuCpf = undefined; // se tiver, passar aqui
      const certStatus = validateCertificate(certificatePem!, cnpjOuCpf);
      if (certStatus.errors && certStatus.errors.length) {
        logger.error('[NFSe] Erros de certificado', { userId: dto.userId, errors: certStatus.errors });
        throw new Error('Certificado invalido ou com erros. Veja logs.');
      }
      
      // Verificar validade do certificado e registrar métrica
      let pfxBuffer: Buffer;
      if (credential) {
        pfxBuffer = await getCredentialPfxBuffer(credential.storagePath);
      } else {
        pfxBuffer = Buffer.from(process.env.NFSE_CERT_PFX_BASE64!, 'base64');
      }
      
      const daysUntilExpiry = checkCertificateExpiry(pfxBuffer, credential?.pass || process.env.NFSE_CERT_PFX_PASS!);
      this.metricsService.recordCertificateCheck(daysUntilExpiry);
      
      logger.info('[NFSe] Certificado válido', { 
        userId: dto.userId, 
        tipo: certStatus.tipo, 
        doc: certStatus.doc, 
        validade: `${certStatus.notBefore} até ${certStatus.notAfter}`,
        daysUntilExpiry 
      });
      logger.info('[NFSe] Assinando XML com certificado', { userId: dto.userId, certSource });
      xml = signInfDps(xml, { certificatePem: certificatePem!, privateKeyPem: privateKeyPem! });
      logger.info('[NFSe] XML assinado', { userId: dto.userId, xmlLength: xml.length });
    } else {
      logger.info('[NFSe] XML já estava assinado', { userId: dto.userId });
    }

    const xmlHash = hashXml(xml);

         const { http, endpoint } = await createAdnClient({ module: 'contribuintes', tpAmb });
              // Logo antes desta linha:
          // const payload = { versao: dto.versao, dpsXmlGzipB64: ... };

          // Adicione estes logs:
          logger.info('[NFSe] XML FINAL (primeiros 2000 caracteres)', {
            userId: dto.userId,
            xmlPreview: xml.substring(0, 2000),
          });

          // Extrair e logar especificamente a seção <tribMun>
          const tribMunMatch = xml.match(/<tribMun>.*?<\/tribMun>/s);
          if (tribMunMatch) {
            logger.info('[NFSe] Conteúdo de <tribMun> no XML final', {
              userId: dto.userId,
              tribMun: tribMunMatch[0],
            });
          } else {
            logger.warn('[NFSe] Elemento <tribMun> não encontrado no XML final', {
              userId: dto.userId,
            });
          }
    const payload = {
         versao: dto.versao,
        dpsXmlGzipB64: xml === originalXml ? dto.dps_xml_gzip_b64 : gzipSync(Buffer.from(xml, 'utf8')).toString('base64')  // ← Corrigido
      };
      logger.info('[NFSe] Payload final enviado para API Nacional', { userId: dto.userId, payload });

    let response: any;
    try {
      response = await http.post(endpoint, payload, {
        headers: {
          Accept: 'application/json'
        }
      });
    } catch (err) {
      const error = err as AxiosError;
      if (error.response) {
        const upstreamError = new Error('Falha ao comunicar com a API Nacional de NFS-e');
        (upstreamError as any).statusCode = error.response.status;
        (upstreamError as any).data = error.response.data ?? null;
        logger.error('[NFSe] Erro na comunicação com API Nacional', { 
          userId: dto.userId, 
          statusCode: error.response.status, 
          data: error.response.data 
        });
        throw upstreamError;
      }
      logger.error('[NFSe] Erro de rede na comunicação com API Nacional', { userId: dto.userId, error: error.message });
      throw error;
    }

    const protocolo = response.data?.identificadorDps ?? `PROTO-${Date.now()}`;
    const nfseKey = response.data?.chaveAcesso ?? null;
    const situacao = response.data?.situacao ?? 'DESCONHECIDO';
    const numeroNfse = response.data?.numeroNfse ?? null;
    const dataProcessamento = response.data?.dataHoraProcessamento ?? new Date().toISOString();

    const status = nfseKey ? 'AUTORIZADA' : 'EM_FILA';

    // Persistir emissão completa
    await saveEmission({
        protocolo,
        status,
        situacao,
        chaveAcesso: nfseKey,
        numeroNfse,
        dataProcessamento,
        xmlHash,
        response: response.data
    });

    logger.info('[NFSe] Emissão persistida no banco', { 
      userId: dto.userId, 
      protocolo, 
      status, 
      situacao 
    });

    return {
        protocolo,
        chaveAcesso: nfseKey,
        numeroNfse,
        status,
        situacao,
        dataProcessamento,
        resposta: response.data
    };
  }

  /**
   * Simula o processamento do XML DPS: limpeza, validação XSD, compressão GZIP e codificação Base64.
   * @param input Objeto com a propriedade dpsXml (string)
   * @returns Promise<{ ok: boolean, dpsXmlGzipB64?: string, message?: string, error?: string }>
   */
  async testSimNfse(input: { dpsXml: string }): Promise<any> {
    try {
      // 1. Carregar e cachear o XSD
      const xsdSchema = await this.loadXsdSchema(DPS_XSD_PATH);

      // 2. Limpar o XML
      let cleanedXml = this.cleanXmlString(input.dpsXml);
      cleanedXml = this.cleanXmlString(fixTribMunOrder(cleanedXml));

      // 3. Validar XML contra XSD
      this.validateXmlWithXsd(cleanedXml, xsdSchema);

      // 4. Comprimir e codificar em Base64
      const dpsXmlGzipB64 = await this.gzipAndBase64Encode(cleanedXml);

      // 5. Retornar sucesso
      return {
        ok: true,
        dpsXmlGzipB64,
        message: 'XML processado e payload preparado com sucesso.'
      };
    } catch (err: any) {
      // Retornar erro detalhado
      return {
        ok: false,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Carrega e cacheia o schema XSD para validação.
   */
  private async loadXsdSchema(xsdPath: string): Promise<any> {
    if (dpsXsdSchema) return dpsXsdSchema;
    try {
      const xsdContent = fs.readFileSync(xsdPath, 'utf-8');
      const xsdDoc = libxmljs.parseXml(xsdContent, { baseUrl: xsdPath });
      dpsXsdSchema = xsdDoc;
      return dpsXsdSchema;
    } catch (err: any) {
      throw new Error(`Erro ao carregar XSD: ${err.message}`);
    }
  }

  /**
   * Limpa o XML: remove espaços, quebras de linha, tabs e espaços entre tags.
   */
  private cleanXmlString(xml: string): string {
    try {
      let cleaned = xml.replace(/>\s+</g, '><'); // Remove espaços entre tags
      cleaned = cleaned.replace(/[\n\r\t]/g, ''); // Remove quebras de linha e tabs
      cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // Remove espaços no início/fim
      return cleaned;
    } catch (err: any) {
      throw new Error(`Erro ao limpar XML: ${err.message}`);
    }
  }

  /**
   * Valida o XML contra o XSD. Lança erro detalhado se inválido.
   */
  private validateXmlWithXsd(xml: string, xsdSchema: any): void {
    try {
      const xmlDoc = libxmljs.parseXml(xml);
      const isValid = xmlDoc.validate(xsdSchema as any);
      if (!isValid) {
        const errors = xmlDoc.validationErrors.map((e: any) => e.message).join('; ');
        throw new Error(`XML inválido segundo o XSD: ${errors}`);
      }
    } catch (err: any) {
      throw new Error(`Erro na validação XSD: ${err.message}`);
    }
  }

  /**
   * Comprime o XML com GZIP e retorna a string Base64.
   */
  private async gzipAndBase64Encode(xml: string): Promise<string> {
    try {
      const gzip = promisify(zlib.gzip);
      const gzipped = await gzip(Buffer.from(xml, 'utf-8'));
      return gzipped.toString('base64');
    } catch (err: any) {
      throw new Error(`Erro ao comprimir/codificar XML: ${err.message}`);
    }
  }

  /**
   * Consulta o status de uma emissão
   * @param protocolo Protocolo da emissão
   * @returns Dados do status
   */
  async pollStatus(protocolo: string) {
    logger.info('[NFSe] Consultando status da emissão', { protocolo });
    
    const { http, endpoint } = await createAdnClient({ module: "contribuintes", tpAmb });
    const url = `${endpoint}/${encodeURIComponent(protocolo)}`;
    
    try {
      const { data } = await http.get(url, {
        headers: {
          Accept: "application/json"
        }
      });

      const situacao = data?.situacao ?? data?.status ?? "UNKNOWN";
      await updateEmissionStatus(protocolo, situacao, data);

      logger.info('[NFSe] Status consultado com sucesso', { protocolo, situacao });
      return data;
    } catch (error) {
      logger.error('[NFSe] Erro ao consultar status', { protocolo, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Baixa o DANFSe (PDF) de uma emissão
   * @param chave Chave de acesso da NFS-e
   * @returns Buffer do PDF
   */
  async downloadDanfe(chave: string) {
    logger.info('[NFSe] Baixando DANFSe', { chave });
    
    const { http, endpoint } = await createAdnClient({ module: "danfse", tpAmb });
    const url = `${endpoint}/${encodeURIComponent(chave)}`;
    
    try {
      const { data } = await http.get<ArrayBuffer>(url, {
        responseType: "arraybuffer"
      });
      
      const pdfBuffer = Buffer.from(data);
      logger.info('[NFSe] DANFSe baixado com sucesso', { chave, size: pdfBuffer.length });
      
      return pdfBuffer;
    } catch (error) {
      logger.error('[NFSe] Erro ao baixar DANFSe', { chave, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Anexa PDF a uma emissão
   * @param emissionId ID da emissão
   * @param pdf Buffer do PDF
   */
  async attachPdf(emissionId: string, pdf: Buffer) {
    logger.info('[NFSe] Anexando PDF à emissão', { emissionId, pdfSize: pdf.length });
    
    try {
      await attachPdf(emissionId, pdf);
      logger.info('[NFSe] PDF anexado com sucesso', { emissionId });
    } catch (error) {
      logger.error('[NFSe] Erro ao anexar PDF', { emissionId, error: (error as Error).message });
      throw error;
    }
  }
}
