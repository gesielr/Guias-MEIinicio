import axios, { AxiosInstance } from "axios";
import { readFile } from "node:fs/promises";
import https from "node:https";
import { env } from "../../env";

interface CreateAdnClientOptions {
  module: "contribuintes" | "parametros" | "danfse";
  tpAmb: '1' | '2'; // 1-Produção, 2-Homologação
}

async function loadPfxBuffer(): Promise<Buffer | undefined> {
  if (env.NFSE_CERT_PFX_BASE64) {
    return Buffer.from(env.NFSE_CERT_PFX_BASE64, "base64");
  }
  if (env.NFSE_CERT_PFX_PATH) {
    return await readFile(env.NFSE_CERT_PFX_PATH);
  }
  return undefined;
}

function sanitizeUrl(input: string): string {
  return input.trim().replace(/\r/g, "").replace(/^['"]|['"]$/g, "");
}

function resolveBaseUrl(
  module: CreateAdnClientOptions["module"],
  tpAmb: CreateAdnClientOptions["tpAmb"]
): string {
  const moduleOverrides: Record<CreateAdnClientOptions["module"], string | undefined> = {
    contribuintes: tpAmb === '1' ? env.NFSE_PRODUCAO_BASE_URL : env.NFSE_HOMOLOGACAO_BASE_URL,
    parametros: undefined, // Não há override para parametros ainda
    danfse: undefined, // Não há override para danfse ainda
  };

  const override = moduleOverrides[module];
  if (override) {
    return sanitizeUrl(override).replace(/\/$/, "");
  }

  const baseUrl = tpAmb === '1'
    ? env.NFSE_PRODUCAO_BASE_URL || 'https://sefin.nfse.gov.br/sefinnacional'
    : env.NFSE_HOMOLOGACAO_BASE_URL || 'https://sefin.hom.nfse.gov.br/sefinnacional';


  const sanitizedBase = sanitizeUrl(baseUrl);
  const baseWithSlash = sanitizedBase.endsWith("/") ? sanitizedBase : `${sanitizedBase}/`;
  const modulePath = module === "contribuintes" ? "contribuintes" : module;

  return new URL(modulePath, baseWithSlash).toString().replace(/\/$/, "");
}

export async function createAdnClient(
  options: CreateAdnClientOptions
): Promise<{ http: AxiosInstance; endpoint: string }> {
  const pfx = await loadPfxBuffer();

  if (!pfx && !env.NFSE_CERT_PKCS11_LIBRARY) {
    throw new Error("Nenhuma credencial NFSe configurada (PFX ou PKCS#11)");
  }

  const httpsAgent = new https.Agent({
    pfx,
    passphrase: env.NFSE_CERT_PFX_PASS,
    rejectUnauthorized: true
  });

  const endpoint = resolveBaseUrl(options.module, options.tpAmb);
  console.info(`[SEFIN] endpoint (${options.module}) = ${endpoint}`);

  const http = axios.create({
    httpsAgent,
    headers: {
      Accept: "application/json"
    },
    timeout: 60000
  });

  return { http, endpoint };
}
