import forge from 'node-forge';
import logger from '../utils/logger';

/**
 * Verifica a validade de um certificado digital PFX
 * @param pfxBuffer Buffer do arquivo PFX
 * @param passphrase Senha do certificado
 * @returns Número de dias até a expiração
 * @throws Error se o certificado for inválido ou não encontrado
 */
export function checkCertificateExpiry(pfxBuffer: Buffer, passphrase: string): number {
  try {
    logger.debug('[NFSe] Verificando validade do certificado', { bufferSize: pfxBuffer.length });
    
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
    
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    
    if (!certBag?.cert) {
      throw new Error('Certificado não encontrado no arquivo PFX');
    }
    
    const cert = certBag.cert;
    const notAfter = cert.validity.notAfter;
    const now = new Date();
    
    // Calcular dias até expiração
    const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Logs de alerta baseados na proximidade da expiração
    if (daysUntilExpiry < 0) {
      logger.error('[NFSe] Certificado EXPIRADO!', { 
        daysUntilExpiry, 
        notAfter: notAfter.toISOString(),
        subject: cert.subject.toString()
      });
    } else if (daysUntilExpiry < 7) {
      logger.error('[NFSe] Certificado expira em menos de 7 dias!', { 
        daysUntilExpiry, 
        notAfter: notAfter.toISOString(),
        subject: cert.subject.toString()
      });
    } else if (daysUntilExpiry < 30) {
      logger.warn('[NFSe] Certificado expira em menos de 30 dias', { 
        daysUntilExpiry, 
        notAfter: notAfter.toISOString(),
        subject: cert.subject.toString()
      });
    } else {
      logger.info('[NFSe] Certificado válido', { 
        daysUntilExpiry, 
        notAfter: notAfter.toISOString(),
        subject: cert.subject.toString()
      });
    }
    
    return daysUntilExpiry;
  } catch (error) {
    logger.error('[NFSe] Erro ao verificar validade do certificado', { 
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error;
  }
}

/**
 * Extrai informações detalhadas de um certificado PFX
 * @param pfxBuffer Buffer do arquivo PFX
 * @param passphrase Senha do certificado
 * @returns Informações detalhadas do certificado
 */
export function extractCertificateInfo(pfxBuffer: Buffer, passphrase: string): {
  subject: string;
  issuer: string;
  notBefore: Date;
  notAfter: Date;
  serialNumber: string;
  daysUntilExpiry: number;
} {
  try {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
    
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    
    if (!certBag?.cert) {
      throw new Error('Certificado não encontrado no arquivo PFX');
    }
    
    const cert = certBag.cert;
    const now = new Date();
    const daysUntilExpiry = Math.floor((cert.validity.notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      subject: cert.subject.toString(),
      issuer: cert.issuer.toString(),
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter,
      serialNumber: cert.serialNumber,
      daysUntilExpiry
    };
  } catch (error) {
    logger.error('[NFSe] Erro ao extrair informações do certificado', { 
      error: (error as Error).message 
    });
    throw error;
  }
}
