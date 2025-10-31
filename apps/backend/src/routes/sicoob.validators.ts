import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const pixStatusEnum = z
  .enum(['VIGENTE', 'RECEBIDA', 'CANCELADA', 'DEVOLVIDA', 'EXPIRADA'])
  .optional();

const boletoStatusEnum = z
  .enum(['ATIVO', 'PAGO', 'CANCELADO', 'VENCIDO'])
  .optional();

export const criarPixImediataSchema = z.object({
  chave_pix: z.string().min(1),
  solicitacao_pagador: z.string().optional(),
  valor: z.number().positive(),
  expiracao: z.number().int().positive().optional(),
  abatimento: z
    .object({
      tipo: z.enum(['FIXO', 'PERCENTUAL']),
      valor_abatimento: z.number().positive(),
    })
    .optional(),
  juros: z
    .object({
      tipo: z.enum(['SIMPLES', 'COMPOSTO']),
      valor_juros: z.number().nonnegative(),
    })
    .optional(),
  multa: z
    .object({
      tipo: z.enum(['FIXO', 'PERCENTUAL']),
      valor_multa: z.number().nonnegative(),
    })
    .optional(),
  desconto: z
    .object({
      tipo: z.enum(['FIXO', 'PERCENTUAL']),
      valor_desconto: z.number().nonnegative(),
    })
    .optional(),
  infoAdicionais: z
    .array(
      z.object({
        nome: z.string(),
        valor: z.string(),
      })
    )
    .optional(),
});

export const criarPixComVencimentoSchema = criarPixImediataSchema.extend({
  data_vencimento: z.string().min(1),
});

export const listarPixQuerySchema = z.object({
  status: pixStatusEnum,
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
});

export const criarBoletoSchema = z.object({
  beneficiario: z.object({
    nome: z.string().min(1),
    cpf_cnpj: z.string().min(11).max(14),
  }),
  pagador: z.object({
    nome: z.string().min(1),
    cpf_cnpj: z.string().min(11).max(14),
  }),
  valor: z.number().positive(),
  data_vencimento: z.string().min(1),
  descricao: z.string().optional(),
  multa: z.number().nonnegative().optional(),
  juros: z.number().nonnegative().optional(),
  desconto: z
    .object({
      valor: z.number().nonnegative(),
      data_limite: z.string().optional(),
    })
    .optional(),
});

export const listarBoletosQuerySchema = z.object({
  status: boletoStatusEnum,
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  pagina: z.coerce.number().int().min(1).optional(),
  limite: z.coerce.number().int().min(1).max(100).optional(),
});

export const cobrancaGenericaSchema = z.object({
  tipo: z.enum(['PIX', 'BOLETO']),
  descricao: z.string().optional(),
  metadados: z.record(z.any()).optional(),
  pix: z
    .object({
      modalidade: z.enum(['IMEDIATA', 'COM_VENCIMENTO']),
      imediata: criarPixImediataSchema.optional(),
      comVencimento: criarPixComVencimentoSchema.optional(),
    })
    .optional(),
  boleto: z
    .object({
      dados: criarBoletoSchema,
    })
    .optional(),
});

export const txidParamSchema = z.object({
  txid: z.string().min(1),
});

export const nossoNumeroParamSchema = z.object({
  nossoNumero: z.string().min(1),
});

export const cobrancaIdParamSchema = z.object({
  id: z.string().min(1),
});

export function validateParams(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        erro: 'Validação de parâmetros falhou',
        detalhes: result.error.flatten(),
      });
      return;
    }
    req.params = result.data;
    next();
  };
}

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        erro: 'Validação falhou',
        detalhes: result.error.flatten(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        erro: 'Validação de query falhou',
        detalhes: result.error.flatten(),
      });
      return;
    }
    req.query = result.data;
    next();
  };
}
