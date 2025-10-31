# Integração Sicoob - Documentação Completa

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Configuração](#configuração)
3. [Autenticação](#autenticação)
4. [APIs - PIX](#apis-pix)
5. [APIs - Boleto](#apis-boleto)
6. [Cobrança Consolidada](#cobrança-consolidada)
7. [Webhooks](#webhooks)
8. [Tratamento de Erros](#tratamento-de-erros)
9. [Testes](#testes)
10. [Troubleshooting](#troubleshooting)

---

## Visão Geral

A integração Sicoob permite gerenciar pagamentos via PIX e Boleto bancário em sua aplicação GuiasMEI.

### Recursos Principais

- ✅ **PIX Imediato**: Cobranças instantâneas sem vencimento
- ✅ **PIX com Vencimento**: Cobranças com data de expiração
- ✅ **Boleto Bancário**: Emissão, consulta e cancelamento
- ✅ **Gestão Consolidada**: Gerenciar PIX e Boleto através da mesma API
- ✅ **Webhooks**: Processamento de eventos em tempo real
- ✅ **Autenticação Segura**: OAuth 2.0 + mTLS com certificados ICP-Brasil
- ✅ **Cache Inteligente**: Renovação automática de tokens
- ✅ **Retry Automático**: Backoff exponencial em falhas

### Arquitetura

```
┌─────────────────┐
│  Express App    │
└────────┬────────┘
         │
         ├── Routes: /api/sicoob/*
         │
         ├── Middleware
         │   └── sicoobWebhookMiddleware (validação de webhooks)
         │
         ├── Controllers: SicoobController
         │   └── Endpoints HTTP
         │
         └── Services
             ├── AuthService (OAuth 2.0 + mTLS)
             ├── PixService (PIX cobranças)
             ├── BoletoService (Boletos)
             ├── CobrancaService (Consolidada)
             ├── WebhookService (Processamento)
             └── Utils
                 ├── sicoob-logger (Logging)
                 └── sicoob-cache (Token cache)
```

---

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto backend com as seguintes variáveis:

```env
# Ambiente: sandbox ou production
SICOOB_ENVIRONMENT=sandbox

# URLs da API
SICOOB_API_BASE_URL=https://api-sandbox.sicoob.com.br
SICOOB_AUTH_URL=https://auth-sandbox.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token

# Credenciais OAuth 2.0
SICOOB_CLIENT_ID=seu_client_id_aqui
SICOOB_CLIENT_SECRET=seu_client_secret_aqui

# Certificados mTLS (ICP-Brasil)
SICOOB_CERT_PATH=./certificates/sicoob-cert.pem
SICOOB_KEY_PATH=./certificates/sicoob-key.pem
SICOOB_CA_PATH=./certificates/sicoob-ca.pem

# Segredo do webhook
SICOOB_WEBHOOK_SECRET=seu_webhook_secret_aqui

# Configurações Opcionais
SICOOB_TIMEOUT=30000
SICOOB_RETRY_ATTEMPTS=3
SICOOB_RETRY_DELAY=1000
```

### 2. Configuração de Certificados

#### Obter certificados

1. Acesse o portal da Sicoob
2. Gere certificados ICP-Brasil no formato PEM
3. Download dos arquivos:
   - `sicoob-cert.pem`: Certificado público
   - `sicoob-key.pem`: Chave privada
   - `sicoob-ca.pem`: Certificado raiz (opcional)

#### Armazenar certificados

```bash
# Criar diretório
mkdir -p apps/backend/certificates

# Copiar arquivos
cp seu-cert.pem apps/backend/certificates/sicoob-cert.pem
cp seu-key.pem apps/backend/certificates/sicoob-key.pem
cp sua-ca.pem apps/backend/certificates/sicoob-ca.pem

# Proteger permissões (Linux/Mac)
chmod 600 apps/backend/certificates/sicoob-*.pem
```

#### .gitignore

```gitignore
# Certificados (nunca fazer commit)
certificates/*.pem
```

### 3. Registrar Rotas

No seu arquivo principal de Express (`src/index.ts` ou `src/main.ts`):

```typescript
import { registerSicoobRoutes } from './routes/sicoob.routes';
import { initializeSicoobServices } from './services/sicoob/index';

// Inicializar serviços Sicoob
const sicoobConfig = {
  environment: process.env.SICOOB_ENVIRONMENT,
  baseUrl: process.env.SICOOB_API_BASE_URL,
  authUrl: process.env.SICOOB_AUTH_URL,
  clientId: process.env.SICOOB_CLIENT_ID,
  clientSecret: process.env.SICOOB_CLIENT_SECRET,
  certPath: process.env.SICOOB_CERT_PATH,
  keyPath: process.env.SICOOB_KEY_PATH,
  caPath: process.env.SICOOB_CA_PATH,
  timeout: parseInt(process.env.SICOOB_TIMEOUT || '30000'),
  retryAttempts: parseInt(process.env.SICOOB_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.SICOOB_RETRY_DELAY || '1000'),
};

initializeSicoobServices(sicoobConfig);

// Registrar rotas
const webhookSecret = process.env.SICOOB_WEBHOOK_SECRET;
registerSicoobRoutes(app, webhookSecret, '/api/sicoob');
```

---

## Autenticação

### OAuth 2.0 + mTLS

A integração utiliza fluxo OAuth 2.0 Client Credentials com autenticação mTLS:

1. **Renovação Automática**: Tokens são renovados 5 minutos antes de expirar
2. **Cache Inteligente**: Tokens são armazenados em memória
3. **Retry Automático**: 3 tentativas com backoff exponencial
4. **Validação de Certificados**: mTLS com certificados ICP-Brasil

### Fluxo de Autenticação

```
┌──────────────────────────────────────────┐
│ Requisição API                           │
└──────────────┬───────────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ Cache Token? │
        └──┬───────┬───┘
        Sim│       │Não/Expirado
           │       │
           │       ▼
           │   ┌──────────────────┐
           │   │ Renovar Token?   │
           │   │ (< 5 min)        │
           │   └──┬─────────────┬─┘
           │      │Sim          │Não
           │      │             │
           │      ▼             ▼
           │   Request        Return
           │   OAuth          Cached
           │   ↓              ↓
           └──→ Validar mTLS
                ↓
           OAuth Response
                ↓
           Cache Token
                ↓
           Usar em API
```

### Exemplo de Uso

```typescript
import { getAuthService } from './services/sicoob/index';

// Obter token (automático)
const authService = getAuthService();
const token = await authService.getAccessToken();

// Forçar renovação
await authService.refreshToken();

// Validar token
const isValid = await authService.validateToken(token);
```

---

## APIs - PIX

### Criar Cobrança PIX Imediata

**Endpoint**: `POST /api/sicoob/pix/cobranca-imediata`

**Body**:
```json
{
  "chave_pix": "12345678901234567890123456789012",
  "valor": 100.50,
  "descricao": "Pagamento de serviço",
  "solicitacao_confirmacao": false
}
```

**Response (201)**:
```json
{
  "sucesso": true,
  "dados": {
    "txid": "abc123def456",
    "qr_code": "00020126580014br.gov.bcb.brcode01051.0.0...",
    "url_qr_code": "https://api.sicoob.com.br/qrcode/abc123def456",
    "data_criacao": "2024-02-20T10:30:00Z"
  }
}
```

**Validações**:
- `chave_pix`: Deve ter 32 caracteres (UUID) ou ser CPF/CNPJ/email válido
- `valor`: Deve ser > 0
- `descricao`: Máximo 140 caracteres (opcional)

### Criar Cobrança PIX com Vencimento

**Endpoint**: `POST /api/sicoob/pix/cobranca-vencimento`

**Body**:
```json
{
  "chave_pix": "12345678901234567890123456789012",
  "valor": 250.75,
  "descricao": "Pagamento com vencimento",
  "data_vencimento": "2024-03-20"
}
```

**Response (201)**:
```json
{
  "sucesso": true,
  "dados": {
    "txid": "xyz789abc123",
    "qr_code": "00020126580014br.gov.bcb.brcode01051.0.0...",
    "url_qr_code": "https://api.sicoob.com.br/qrcode/xyz789abc123",
    "data_vencimento": "2024-03-20",
    "data_criacao": "2024-02-20T10:30:00Z"
  }
}
```

**Validações**:
- `data_vencimento`: Não pode ser no passado, formato YYYY-MM-DD
- Outros: Igual ao PIX imediato

### Consultar Cobrança PIX

**Endpoint**: `GET /api/sicoob/pix/cobranca/:txid`

**Parameters**:
- `txid` (path): ID da transação

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "txid": "abc123def456",
    "chave_pix": "12345678901234567890123456789012",
    "valor": 100.50,
    "status": "ATIVA",
    "data_criacao": "2024-02-20T10:30:00Z",
    "data_vencimento": null,
    "pagamentos": [
      {
        "valor": 100.50,
        "data_pagamento": "2024-02-20T10:35:00Z"
      }
    ]
  }
}
```

### Listar Cobranças PIX

**Endpoint**: `GET /api/sicoob/pix/cobracas`

**Query Parameters**:
- `status`: ATIVA, PAGA, CANCELADA (opcional)
- `data_inicio`: YYYY-MM-DD (opcional)
- `data_fim`: YYYY-MM-DD (opcional)
- `pagina`: Número da página (default: 1)
- `limite`: Itens por página (default: 25)

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "pagina": 1,
    "total": 100,
    "limite": 25,
    "cobracas": [
      {
        "txid": "abc123def456",
        "valor": 100.50,
        "status": "ATIVA",
        "data_criacao": "2024-02-20T10:30:00Z"
      }
    ]
  }
}
```

### Cancelar Cobrança PIX

**Endpoint**: `DELETE /api/sicoob/pix/cobranca/:txid`

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "txid": "abc123def456",
    "status": "CANCELADA",
    "data_cancelamento": "2024-02-20T11:00:00Z"
  }
}
```

### Consultar QR Code PIX

**Endpoint**: `GET /api/sicoob/pix/qrcode/:txid`

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "txid": "abc123def456",
    "qr_code": "00020126580014br.gov.bcb.brcode01051.0.0...",
    "url_qr_code": "https://api.sicoob.com.br/qrcode/abc123def456"
  }
}
```

---

## APIs - Boleto

### Gerar Boleto

**Endpoint**: `POST /api/sicoob/boleto`

**Body**:
```json
{
  "beneficiario_cpf_cnpj": "12345678901234",
  "beneficiario_nome": "Empresa LTDA",
  "pagador_cpf_cnpj": "98765432109876",
  "pagador_nome": "Cliente",
  "valor": 500.50,
  "data_vencimento": "2024-03-20",
  "numero_documento": "DOC-001",
  "instrucoes": "Instrução de pagamento"
}
```

**Response (201)**:
```json
{
  "sucesso": true,
  "dados": {
    "nosso_numero": "123456789012",
    "codigo_barras": "12345.67890 12345.678901 12345.678901 1 12345678901234",
    "url_boleto": "https://api.sicoob.com.br/boletos/123456789012",
    "data_criacao": "2024-02-20T10:30:00Z"
  }
}
```

**Validações**:
- CPF/CNPJ: Formato válido
- `valor`: Deve ser > 0
- `data_vencimento`: Não pode ser no passado
- Todos os campos são obrigatórios

### Consultar Boleto

**Endpoint**: `GET /api/sicoob/boleto/:nossoNumero`

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "nosso_numero": "123456789012",
    "codigo_barras": "12345.67890 12345.678901 12345.678901 1 12345678901234",
    "valor": 500.50,
    "status": "ATIVO",
    "data_vencimento": "2024-03-20",
    "pagador_nome": "Cliente",
    "data_criacao": "2024-02-20T10:30:00Z"
  }
}
```

### Listar Boletos

**Endpoint**: `GET /api/sicoob/boletos`

**Query Parameters**:
- `status`: ATIVO, PAGO, CANCELADO, VENCIDO (opcional)
- `data_inicio`: YYYY-MM-DD (opcional)
- `data_fim`: YYYY-MM-DD (opcional)
- `pagina`: Número da página (default: 1)
- `limite`: Itens por página (default: 25)

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "pagina": 1,
    "total": 50,
    "limite": 25,
    "boletos": [
      {
        "nosso_numero": "123456789012",
        "valor": 500.50,
        "status": "ATIVO",
        "data_vencimento": "2024-03-20"
      }
    ]
  }
}
```

### Cancelar Boleto

**Endpoint**: `DELETE /api/sicoob/boleto/:nossoNumero`

**Response (200)**:
```json
{
  "sucesso": true,
  "dados": {
    "nosso_numero": "123456789012",
    "status": "CANCELADO",
    "data_cancelamento": "2024-02-20T11:00:00Z"
  }
}
```

### Baixar PDF do Boleto

**Endpoint**: `GET /api/sicoob/boleto/:nossoNumero/pdf`

**Response (200)**: Arquivo PDF

```typescript
// Exemplo de uso com fetch
const response = await fetch(
  '/api/sicoob/boleto/123456789012/pdf'
);
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'boleto-123456789012.pdf';
link.click();
```

---

## Cobrança Consolidada

APIs genéricas que funcionam com PIX e Boleto:

### Criar Cobrança

**Endpoint**: `POST /api/sicoob/cobranca`

**Body (PIX)**:
```json
{
  "tipo": "pix",
  "chave_pix": "12345678901234567890123456789012",
  "valor": 100.50,
  "descricao": "Pagamento"
}
```

**Body (Boleto)**:
```json
{
  "tipo": "boleto",
  "beneficiario_cpf_cnpj": "12345678901234",
  "beneficiario_nome": "Empresa",
  "pagador_cpf_cnpj": "98765432109876",
  "pagador_nome": "Cliente",
  "valor": 500.50,
  "data_vencimento": "2024-03-20",
  "numero_documento": "DOC-001"
}
```

### Consultar Cobrança

**Endpoint**: `GET /api/sicoob/cobranca/:id`

**Query Parameters**:
- `tipo`: pix ou boleto

### Atualizar Cobrança

**Endpoint**: `PUT /api/sicoob/cobranca/:id`

**Nota**: Implementado como cancel + recreate

### Cancelar Cobrança

**Endpoint**: `DELETE /api/sicoob/cobranca/:id`

**Query Parameters**:
- `tipo`: pix ou boleto

### Listar Cobranças

**Endpoint**: `GET /api/sicoob/cobrancas`

**Query Parameters**:
- `tipo`: pix, boleto ou ambos (default)
- `pagina`: Número da página (default: 1)

---

## Webhooks

### Configuração

Os webhooks permitem receber eventos em tempo real quando cobranças são pagas ou canceladas.

#### 1. Registrar URL do Webhook

No portal da Sicoob:
1. Acesse "Configurações" → "Webhooks"
2. Adicione a URL: `https://seu-dominio.com/api/sicoob/webhook`
3. Copie o Secret fornecido

#### 2. Configurar Environment

```env
SICOOB_WEBHOOK_SECRET=seu_webhook_secret_aqui
```

### Tipos de Eventos

| Evento | Descrição | Quando Dispara |
|--------|-----------|----------------|
| `pix.received` | PIX recebido | Quando pagamento é confirmado |
| `pix.returned` | PIX devolvido | Quando devolução é processada |
| `boleto.paid` | Boleto pago | Quando boleto é compensado |
| `boleto.expired` | Boleto vencido | No vencimento |
| `cobranca.paid` | Cobrança paga | PIX ou Boleto pago |
| `cobranca.cancelled` | Cobrança cancelada | Após cancelamento |

### Payload do Webhook

```json
{
  "id": "evt_123456789",
  "tipo": "pix.received",
  "data_criacao": "2024-02-20T10:35:00Z",
  "dados": {
    "txid": "abc123def456",
    "valor": 100.50,
    "data_pagamento": "2024-02-20T10:35:00Z",
    "pagador": {
      "cpf": "12345678901",
      "nome": "João Silva"
    }
  }
}
```

### Validação de Webhooks

O middleware valida automaticamente:

1. **Assinatura HMAC SHA256**: Verifica integridade
2. **Timestamp**: Previne replay attacks (5 minutos de tolerância)
3. **Formato**: Valida estrutura do payload

### Registrar Handler de Webhook

```typescript
import { getWebhookService } from './services/sicoob/index';

const webhookService = getWebhookService();

// PIX Recebido
webhookService.on('pix.received', async (evento) => {
  console.log('PIX Recebido:', evento.dados);
  // Atualizar banco de dados
  // Enviar confirmação por email
  // Notificar cliente
});

// Boleto Pago
webhookService.on('boleto.paid', async (evento) => {
  console.log('Boleto Pago:', evento.dados);
  // Processar pagamento
});

// Cobrança Cancelada
webhookService.on('cobranca.cancelled', async (evento) => {
  console.log('Cobrança Cancelada:', evento.dados);
  // Atualizar status
});
```

### Retry Automático

O webhook implementa retry automático:

- **Tentativas**: Até 3 vezes
- **Delay**: 1s, 2s, 4s (exponencial)
- **Timeout**: 30 segundos

---

## Tratamento de Erros

### Tipos de Erro

| Erro | Status | Causa | Ação |
|------|--------|-------|------|
| `SicoobValidationError` | 400 | Dados inválidos | Validar entrada |
| `SicoobAuthError` | 401 | Autenticação falhou | Verificar credenciais |
| `SicoobNotFoundError` | 404 | Recurso não encontrado | Verificar ID |
| `SicoobRateLimitError` | 429 | Rate limit atingido | Aguardar/Retry |
| `SicoobServerError` | 5xx | Erro no servidor Sicoob | Retry automático |
| `SicoobCertificateError` | 500 | Erro de certificado mTLS | Verificar certificates |

### Response de Erro

```json
{
  "sucesso": false,
  "erro": {
    "tipo": "SicoobValidationError",
    "mensagem": "Valor deve ser maior que zero",
    "codigo": "VALIDATION_ERROR",
    "detalhes": {
      "campo": "valor",
      "valor_enviado": -100
    }
  }
}
```

### Tratamento em Código

```typescript
import { SicoobValidationError, SicoobAuthError } from './services/sicoob/types';

try {
  await pixService.criarCobrancaImediata(dados);
} catch (error) {
  if (error instanceof SicoobValidationError) {
    console.error('Validação falhou:', error.message);
    // Mostrar mensagem ao usuário
  } else if (error instanceof SicoobAuthError) {
    console.error('Autenticação falhou:', error.message);
    // Renovar token e tentar novamente
  } else {
    console.error('Erro desconhecido:', error);
    // Log e alertar
  }
}
```

---

## Testes

### Executar Testes

```bash
# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Todos os testes
npm run test

# Com cobertura
npm run test:coverage
```

### Estrutura de Testes

```
tests/
├── unit/
│   ├── sicoob-auth.test.ts          # Testes de autenticação
│   ├── sicoob-pix.test.ts           # Testes de PIX
│   └── sicoob-boleto.test.ts        # Testes de Boleto
└── integration/
    └── sicoob-api.test.ts           # Testes de fluxo completo
```

### Exemplos de Testes

```typescript
import { describe, it, expect } from 'vitest';
import { SicoobPixService } from '../../services/sicoob/pix.service';

describe('PIX Service', () => {
  it('should create immediate charge', async () => {
    const pixService = new SicoobPixService(mockAuthService);
    
    const resultado = await pixService.criarCobrancaImediata({
      chave_pix: '12345678901234567890123456789012',
      valor: 100.50,
      descricao: 'Teste'
    });
    
    expect(resultado.txid).toBeDefined();
    expect(resultado.qr_code).toBeDefined();
  });
});
```

---

## Troubleshooting

### Erro: "Certificate required"

**Causa**: Certificados não encontrados ou caminho inválido

**Solução**:
```bash
# Verificar se arquivos existem
ls -la apps/backend/certificates/

# Verificar permissões
chmod 600 apps/backend/certificates/sicoob-*.pem

# Verificar caminho no .env
echo $SICOOB_CERT_PATH
```

### Erro: "Unauthorized (401)"

**Causa**: Credenciais OAuth inválidas

**Solução**:
1. Verificar `SICOOB_CLIENT_ID` e `SICOOB_CLIENT_SECRET`
2. Validar que estão corretos no portal Sicoob
3. Testar com credenciais sandbox primeiro

### Erro: "Rate Limit (429)"

**Causa**: Muitas requisições simultâneas

**Solução**:
```typescript
// Implementar fila de requisições
import PQueue from 'p-queue';

const queue = new PQueue({ concurrency: 5 });

// Usar fila para requisições
queue.add(() => pixService.criarCobrancaImediata(dados));
```

### Erro: "Network Error (ECONNREFUSED)"

**Causa**: API Sicoob indisponível

**Solução**:
1. Verificar status: https://status.sicoob.com.br
2. Validar conectividade de rede
3. Verificar firewall/proxy
4. Retry automático (3 tentativas com backoff)

### Webhook não recebe eventos

**Causa**: URL não acessível ou Secret incorreto

**Solução**:
1. Validar que URL é pública e acessível
2. Testar com `ngrok`: `ngrok http 3000`
3. Verificar Secret no `.env`
4. Verificar logs: `tail -f logs/sicoob-*.log`
5. Testar manualmente: `curl -X POST http://localhost:3000/api/sicoob/webhook`

### Logs com dados sensíveis

**Verifique**: Dados sensíveis são automaticamente mascarados:
- `access_token` → `***MASKED***`
- `secret` → `***MASKED***`
- `cpf` → `***MASKED***`
- `chave_pix` → `***MASKED***`

Verificar arquivo: `logs/sicoob-YYYY-MM-DD.log`

---

## Referências

- [Documentação Oficial Sicoob](https://www.sicoob.com.br/api)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [mTLS Guide](https://www.cloudflare.com/learning/access-management/what-is-mutual-tls-mtls/)
- [PIX Specification](https://www.bcb.gov.br/pix)
- [ICP-Brasil Certificates](https://www.iti.gov.br/)

---

## Suporte

Para dúvidas ou problemas:

1. Verificar documentação acima
2. Consultar logs: `logs/sicoob-*.log`
3. Testar manualmente com `curl` ou Postman
4. Contatar suporte Sicoob: support@sicoob.com.br
5. Abrir issue no repositório

---

**Versão**: 1.0.0  
**Data**: 2024-02-20  
**Atualizado**: 2024-02-20
