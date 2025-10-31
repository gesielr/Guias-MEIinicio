import * as fs from 'fs';
import { SicoobConfig, CertificateConfig } from './types';
import { pfxToPem } from '../../nfse/crypto/pfx-utils';
import { SicoobCertificateError } from './types';

function loadFile(path: string, description: string): string {
  if (!fs.existsSync(path)) {
    throw new SicoobCertificateError(`${description} não encontrado: ${path}`);
  }
  return fs.readFileSync(path, 'utf8');
}

export function buildCertificateConfig(config: SicoobConfig): CertificateConfig {
  try {
    if (config.pfxBase64 && config.pfxPassphrase) {
      const buffer = Buffer.from(config.pfxBase64, 'base64');
      const { certificatePem, privateKeyPem } = pfxToPem(buffer, config.pfxPassphrase);
      const ca = config.caBase64
        ? Buffer.from(config.caBase64, 'base64').toString('utf8')
        : config.caPath
        ? loadFile(config.caPath, 'CA Sicoob')
        : undefined;

      return {
        cert: certificatePem,
        key: privateKeyPem,
        ca,
      };
    }

    if (!config.certPath || !config.keyPath) {
      throw new SicoobCertificateError(
        'Configuração de certificado inválida. Defina SICOOB_CERT_PFX_BASE64/SICOOB_CERT_PFX_PASS ou SICOOB_CERT_PATH/SICOOB_KEY_PATH.'
      );
    }

    const cert = loadFile(config.certPath, 'Certificado Sicoob');
    const key = loadFile(config.keyPath, 'Chave privada Sicoob');
    const ca = config.caBase64
      ? Buffer.from(config.caBase64, 'base64').toString('utf8')
      : config.caPath
      ? loadFile(config.caPath, 'CA Sicoob')
      : undefined;

    return { cert, key, ca };
  } catch (error) {
    if (error instanceof SicoobCertificateError) {
      throw error;
    }
    throw new SicoobCertificateError(
      `Falha ao preparar certificados Sicoob: ${(error as Error).message}`,
      { cause: error }
    );
  }
}
