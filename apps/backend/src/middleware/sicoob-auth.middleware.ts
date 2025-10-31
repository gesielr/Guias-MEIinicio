import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';
import { sicoobLogger } from '../utils/sicoob-logger';

export interface AuthenticatedRequest extends Request {
  authContext?: Record<string, any>;
}

export function createSicoobJwtMiddleware(options?: {
  audience?: string;
  issuer?: string;
  headerName?: string;
}) {
  const secret = process.env.SICOOB_JWT_SECRET?.trim();

  if (!secret) {
    sicoobLogger.debug('SICOOB_JWT_SECRET não configurado; middleware JWT será ignorado');
  }

  const headerName = options?.headerName ?? 'authorization';

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!secret) {
      next();
      return;
    }

    try {
      const header = req.headers[headerName];
      if (!header || (Array.isArray(header) && header.length === 0)) {
        res.status(401).json({ error: 'Token JWT ausente' });
        return;
      }

      const rawToken = Array.isArray(header) ? header[0] : header;
      const token = rawToken.startsWith('Bearer ')
        ? rawToken.slice(7).trim()
        : rawToken.trim();

      if (!token) {
        res.status(401).json({ error: 'Token JWT inválido' });
        return;
      }

      const payload = verifyJwt(token, secret, {
        issuer: options?.issuer,
        audience: options?.audience,
      });

      req.authContext = payload;
      next();
    } catch (error) {
      sicoobLogger.warn('Token JWT inválido', {
        reason: (error as Error).message,
        path: req.path,
      });
      res.status(401).json({ error: 'Token JWT inválido' });
    }
  };
}

function verifyJwt(
  token: string,
  secret: string,
  {
    issuer,
    audience,
  }: {
    issuer?: string;
    audience?: string;
  } = {}
) {
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Formato JWT inválido');
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error('Assinatura inválida');
  }

  const header = decodeSegment(encodedHeader);
  if (header.alg !== 'HS256') {
    throw new Error(`Algoritmo não suportado: ${header.alg}`);
  }

  const payload = decodeSegment(encodedPayload);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now >= payload.exp) {
    throw new Error('Token expirado');
  }
  if (payload.nbf && now < payload.nbf) {
    throw new Error('Token ainda não é válido');
  }
  if (issuer && payload.iss !== issuer) {
    throw new Error('Issuer inválido');
  }
  if (audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) {
      throw new Error('Audience inválida');
    }
  }

  return payload;
}

function decodeSegment(segment: string): any {
  const decoded = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(decoded);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return cryptoTimingSafeEqual(aBuffer, bBuffer);
}
