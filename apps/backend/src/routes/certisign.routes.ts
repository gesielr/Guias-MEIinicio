// apps/backend/src/routes/certisign.routes.ts
// Rotas para integração com Certificado Digital ICP-Brasil (Certisign)

import { FastifyInstance } from 'fastify';
import {
  handleWebhookVinculo,
  handleWebhookAssinatura,
  consultarDatasDisponiveis,
  solicitarEnrollment,
  buscarEnrollment,
  solicitarAssinatura,
  consultarStatusAssinatura,
  gerarPixCertificado
} from '../controllers/certisign.controller';

export async function certisignRoutes(fastify: FastifyInstance) {
  // ========================================
  // WEBHOOKS (Certisign → Backend)
  // Sem autenticação - validação HMAC no controller
  // ========================================
  
  fastify.post('/api/certisign/webhook/vinculo', {
    schema: {
      description: 'Webhook: Certificado emitido pela Certisign',
      tags: ['Certisign', 'Webhooks'],
      body: {
        type: 'object',
        properties: {
          solicitacao_id: { type: 'string' },
          external_cert_id: { type: 'string' },
          status: { type: 'string' },
          subject: { type: 'string' },
          serial_number: { type: 'string' },
          thumbprint: { type: 'string' },
          valid_from: { type: 'string' },
          valid_until: { type: 'string' }
        }
      }
    }
  }, handleWebhookVinculo);

  fastify.post('/api/certisign/webhook/assinatura', {
    schema: {
      description: 'Webhook: Assinatura aprovada pelo usuário',
      tags: ['Certisign', 'Webhooks'],
      body: {
        type: 'object',
        properties: {
          sign_request_id: { type: 'string' },
          signature_value: { type: 'string' },
          signature_algorithm: { type: 'string' },
          signed_at: { type: 'string' },
          user_device: { type: 'string' },
          user_location: { type: 'string' }
        }
      }
    }
  }, handleWebhookAssinatura);

  // ========================================
  // ENDPOINTS PÚBLICOS
  // ========================================

  fastify.get('/api/certisign/datas-disponiveis', {
    schema: {
      description: 'Consultar datas disponíveis para agendamento de certificado',
      tags: ['Certisign', 'Public'],
      response: {
        200: {
          type: 'object',
          properties: {
            datas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  data: { type: 'string', example: '2025-11-05' },
                  horarios: { type: 'array', items: { type: 'string' }, example: ['09:00', '14:00'] }
                }
              }
            }
          }
        }
      }
    }
  }, consultarDatasDisponiveis);

  // ========================================
  // ENDPOINTS PROTEGIDOS
  // TODO: Adicionar middleware de autenticação JWT
  // ========================================

  fastify.post('/api/certisign/enrollment', {
    schema: {
      description: 'Solicitar vinculação de certificado digital',
      tags: ['Certisign', 'Enrollment'],
      body: {
        type: 'object',
        required: ['userId', 'nome', 'cpf_cnpj', 'email', 'telefone', 'dataAgendamento'],
        properties: {
          userId: { type: 'string' },
          nome: { type: 'string' },
          cpf_cnpj: { type: 'string' },
          email: { type: 'string' },
          telefone: { type: 'string' },
          dataAgendamento: { type: 'string', format: 'date-time' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            external_cert_id: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, solicitarEnrollment);

  fastify.get('/api/certisign/enrollment/:userId', {
    schema: {
      description: 'Buscar certificado digital do usuário',
      tags: ['Certisign', 'Enrollment'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            enrollment: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, buscarEnrollment);

  fastify.post('/api/certisign/sign/solicitar', {
    schema: {
      description: 'Solicitar assinatura remota de documento',
      tags: ['Certisign', 'Signature'],
      body: {
        type: 'object',
        required: ['userId', 'hash', 'documentType'],
        properties: {
          userId: { type: 'string' },
          hash: { type: 'string' },
          documentType: { type: 'string', enum: ['DPS', 'EVENTO_NFSE', 'CANCELAMENTO'] },
          documentId: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            sign_request_id: { type: 'string' },
            qr_code_url: { type: 'string' },
            status: { type: 'string' },
            expires_at: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, solicitarAssinatura);

  fastify.get('/api/certisign/sign/:signRequestId', {
    schema: {
      description: 'Consultar status de assinatura',
      tags: ['Certisign', 'Signature'],
      params: {
        type: 'object',
        properties: {
          signRequestId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sign_request_id: { type: 'string' },
            status: { type: 'string' },
            signature_value: { type: 'string' },
            completed_at: { type: 'string' },
            expires_at: { type: 'string' }
          }
        }
      }
    }
  }, consultarStatusAssinatura);

  // ========================================
  // PAGAMENTO CERTIFICADO (PIX)
  // ========================================

  fastify.post('/api/certisign/pagamento/gerar', {
    schema: {
      description: 'Gerar PIX de R$150 para pagamento do certificado digital',
      tags: ['Certisign', 'Payment'],
      body: {
        type: 'object',
        required: ['userId', 'nome', 'cpf_cnpj'],
        properties: {
          userId: { type: 'string' },
          nome: { type: 'string' },
          cpf_cnpj: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            txid: { type: 'string' },
            qr_code: { type: 'string' },
            qr_code_url: { type: 'string' },
            valor: { type: 'number', example: 150.0 },
            message: { type: 'string' }
          }
        }
      }
    }
  }, gerarPixCertificado);
}
