import axios, { AxiosInstance } from "axios";
import { readFile } from "node:fs/promises";
import https from "node:https";
import { env } from "../../env";

interface CreateAdnClientOptions {
  module: "contribuintes" | "parametros" | "danfse";
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

function resolveBaseUrl(module: CreateAdnClientOptions["module"]): string {
  const sanitizedBase = env.NFSE_BASE_URL.trim().replace(/\r/g, "").replace(/^['"]|['"]$/g, "");
  const modulePath =
    module === "contribuintes"
      ? "nfse"
      : module === "parametros"
        ? "parametros"
        : "danfse";
  const baseWithSlash = sanitizedBase.endsWith("/") ? sanitizedBase : `${sanitizedBase}/`;
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

  const endpoint = resolveBaseUrl(options.module);
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
