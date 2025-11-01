# 📊 DIAGNÓSTICO: INTEGRAÇÃO CERTIFICADO DIGITAL ICP-BRASIL (CERTISIGN)

**Data:** 1º de novembro de 2025  
**Status:** 🟡 **BANCO DE DADOS PRONTO | BACKEND NÃO INICIADO**  
**Completude Estimada:** **25%** (apenas estrutura de dados)

---

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO

### 1. **Banco de Dados (Supabase) - 🟢 100% PRONTO**

#### Migration: `20251101090000_create_cert_icp_tables.sql`
✅ **Tabelas criadas com compliance total:**

```sql
✓ cert_providers          -- Provedores (Certisign)
✓ cert_enrollments        -- Vínculos usuário↔certificado (SEM chave privada)
✓ sign_requests           -- Solicitações assinatura remota
✓ sign_audit_logs         -- Auditoria LGPD
✓ payment_cert_digital    -- Pagamentos PIX (R$ 150)
```

**✅ Compliance de Segurança Atendido:**
- ❌ **NÃO armazena:** PFX, chave privada, senha
- ✅ **Armazena APENAS:** metadados (external_cert_id, subject, serial, thumbprint, validade)
- ✅ **RLS habilitado:** Usuários veem apenas seus dados
- ✅ **Índices otimizados:** user_id, status, validade, expires_at
- ✅ **Triggers updated_at:** Automáticos
- ✅ **Constraints:** Status, algorithms, document_type

**✅ Auditoria LGPD:**
- ✅ `sign_audit_logs`: Registra evento, IP, user-agent, timestamp
- ✅ Eventos: REQUEST_CREATED, USER_APPROVED, SIGNATURE_RECEIVED
- ✅ Rastreabilidade completa de consentimento

#### Seed: `20251101090500_seed_cert_provider.sql`
✅ **Provider Certisign cadastrado:**
```sql
INSERT INTO cert_providers (nome, api_base_url)
VALUES ('Certisign', 'https://api.certisign.com.br')
```

---

## ❌ O QUE FALTA IMPLEMENTAR

### 2. **Backend (Node.js/TypeScript) - 🔴 0% IMPLEMENTADO**

#### 🔴 **Service Layer - NÃO EXISTE**

**Arquivo esperado:** `apps/backend/src/services/certificate/certificate.service.ts`

**Funções necessárias:**
```typescript
❌ consultarDatasDisponiveis(): Promise<DataDisponivel[]>
❌ solicitarVinculoCertificado(data: EnrollmentRequest): Promise<string>
❌ processarCallbackVinculo(payload: WebhookPayload): Promise<void>
❌ solicitarAssinaturaRemota(userId: string, hash: string): Promise<SignRequest>
❌ processarCallbackAssinatura(payload: WebhookPayload): Promise<void>
❌ buscarCertificadoUsuario(userId: string): Promise<CertEnrollment | null>
❌ validarCertificadoAtivo(enrollmentId: string): Promise<boolean>
❌ gerarHashDPS(xmlContent: string): string
❌ montarXMLDSig(hash: string, signatureValue: string): string
```

**Status:** ❌ **ARQUIVO NÃO CRIADO**

---

#### 🔴 **Webhook Routes - NÃO EXISTE**

**Arquivo esperado:** `apps/backend/src/routes/certisign.routes.ts`

**Rotas necessárias:**
```typescript
❌ POST /api/certisign/webhook/vinculo          -- Callback: certificado emitido
❌ POST /api/certisign/webhook/assinatura       -- Callback: assinatura aprovada
❌ POST /api/certisign/enrollment/solicitar     -- Solicitar certificado
❌ GET  /api/certisign/enrollment/:userId       -- Buscar certificado do usuário
❌ POST /api/certisign/sign/solicitar           -- Solicitar assinatura remota
❌ GET  /api/certisign/sign/:signRequestId      -- Status da assinatura
❌ GET  /api/certisign/datas-disponiveis        -- Consultar datas agendamento
```

**Status:** ❌ **ARQUIVO NÃO CRIADO**

---

#### 🔴 **Controller Layer - NÃO EXISTE**

**Arquivo esperado:** `apps/backend/src/controllers/certisign.controller.ts`

**Funções necessárias:**
```typescript
❌ handleWebhookVinculo(req, res)
❌ handleWebhookAssinatura(req, res)
❌ solicitarEnrollment(req, res)
❌ buscarEnrollment(req, res)
❌ solicitarAssinatura(req, res)
❌ consultarStatusAssinatura(req, res)
❌ consultarDatasDisponiveis(req, res)
```

**Status:** ❌ **ARQUIVO NÃO CRIADO**

---

#### 🔴 **Utilities - NÃO EXISTE**

**Arquivo esperado:** `apps/backend/src/utils/certisign-client.ts`

**Funções necessárias:**
```typescript
❌ validarHMACSignature(payload: any, signature: string): boolean
❌ encryptApiKey(apiKey: string): string
❌ decryptApiKey(encrypted: string): string
❌ criarClienteHTTPS(cert?: Buffer, key?: Buffer): AxiosInstance
❌ montarHeadersAutenticacao(apiKey: string): object
```

**Status:** ❌ **ARQUIVO NÃO CRIADO**

---

### 3. **Integração com NFSe - 🟡 PARCIALMENTE PRONTA**

#### ✅ O que já existe:
- ✅ `apps/backend/src/nfse/services/certificate-monitor.service.ts` - Monitora expiração
- ✅ Estrutura de assinatura XML local (precisa migrar para remota)

#### ❌ O que falta:
```typescript
❌ Modificar fluxo de assinatura NFSe:
   1. Gerar hash da DPS
   2. Chamar CertificateService.solicitarAssinaturaRemota()
   3. Aguardar callback de aprovação
   4. Montar XMLDSig com SignatureValue recebido
   5. Enviar DPS → SEFIN/ADN

❌ Substituir assinatura local por remota
❌ Integrar com cert_enrollments
❌ Validar certificado ativo antes de emitir
```

**Arquivo a modificar:** `apps/backend/src/nfse/services/nfse.service.ts`

---

### 4. **mTLS com Bridge/Proxy - 🔴 NÃO PLANEJADO**

#### Cenário:
- SEFIN/ADN exige mTLS com certificado do prestador (mesmo CNPJ da DPS)
- Certificado está na Certisign (HSM), não no nosso servidor

#### Soluções possíveis:
```
❌ Opção A: Bridge/Connector PKCS#11
   - Certisign disponibiliza biblioteca
   - Certificado aparece como disponível localmente
   - Requires: Validar se Certisign oferece isso

❌ Opção B: Proxy mTLS da Certisign
   - Requisição passa pelo proxy da Certisign
   - Certisign faz handshake mTLS
   - Requires: Confirmar disponibilidade

❌ Opção C: Certificado dual (local + remoto)
   - Manter certificado local APENAS para mTLS
   - Assinatura continua remota
   - Requires: Usuário fornecer PFX (maior risco)
```

**Status:** ❌ **NÃO DECIDIDO**

---

### 5. **WhatsApp + IA (Fluxo Certificado) - 🔴 NÃO IMPLEMENTADO**

#### Prompts IA necessários:
```typescript
❌ PROMPT_MEI_CERTIFICADO_INTRO
❌ PROMPT_MEI_CERTIFICADO_CONSULTA_DATAS
❌ PROMPT_MEI_CERTIFICADO_PAGAMENTO
❌ PROMPT_MEI_CERTIFICADO_POS_PAGAMENTO
❌ PROMPT_MEI_EMITIR_NFSE (verificar certificado)
```

**Arquivo esperado:** `apps/backend/inss/app/services/ai_prompts_certificado.py`

**Status:** ❌ **ARQUIVO NÃO CRIADO**

---

### 6. **Integração Pagamento PIX - 🟡 50% PRONTO**

#### ✅ O que já existe:
- ✅ Sicoob PIX service funcionando
- ✅ Tabela `sicoob_cobrancas` operacional
- ✅ Webhooks de pagamento implementados

#### ❌ O que falta:
```typescript
❌ Criar cobrança PIX R$ 150,00 (certificado)
❌ Vincular payment_cert_digital ↔ sicoob_cobrancas
❌ Processar webhook pagamento → enviar email Rebelo Contábil
❌ Atualizar status enrollment após pagamento
```

**Arquivo a criar:** `apps/backend/src/services/certificate/payment-cert.service.ts`

---

### 7. **Email para Certificadora - 🔴 NÃO IMPLEMENTADO**

#### Template necessário:
```
❌ Para: rebelocontabil@gmail.com
❌ Assunto: [GuiasMEI] Nova Solicitação Certificado - {CERT_ID}
❌ Corpo: Dados usuário, agendamento, status pagamento
❌ Provider: SendGrid / Resend / SMTP
```

**Arquivo esperado:** `apps/backend/src/services/email/cert-notification.service.ts`

**Status:** ❌ **NÃO IMPLEMENTADO**

---

## 📊 CHECKLIST DE IMPLEMENTAÇÃO

### **FASE 1: Estrutura Backend (3-4 dias)**

#### Day 1: Service Layer
```bash
☐ Criar apps/backend/src/services/certificate/
☐ Criar certificate.service.ts (classe principal)
☐ Criar certisign-client.ts (HTTP client)
☐ Criar types.ts (interfaces)
☐ Implementar consultarDatasDisponiveis() [MOCK]
☐ Implementar solicitarVinculoCertificado() [MOCK]
☐ Implementar buscarCertificadoUsuario()
☐ Testes unitários básicos
```

#### Day 2: Webhook Handlers
```bash
☐ Criar apps/backend/src/routes/certisign.routes.ts
☐ Criar apps/backend/src/controllers/certisign.controller.ts
☐ Implementar POST /webhook/vinculo (HMAC validation)
☐ Implementar POST /webhook/assinatura
☐ Integrar com CertificateService
☐ Registrar no index.ts (Fastify)
☐ Testes de rota
```

#### Day 3: Assinatura Remota
```bash
☐ Implementar solicitarAssinaturaRemota()
☐ Implementar processarCallbackAssinatura()
☐ Implementar gerarHashDPS()
☐ Implementar montarXMLDSig()
☐ Integrar com sign_requests table
☐ Auditoria automática (sign_audit_logs)
☐ Testes de fluxo completo
```

#### Day 4: Integração NFSe
```bash
☐ Modificar nfse.service.ts
☐ Substituir assinatura local → remota
☐ Validar certificado ativo antes de emitir
☐ Adicionar retry logic (aprovação pode demorar)
☐ Adicionar timeout (5 min default)
☐ Testes E2E (mock aprovação)
```

---

### **FASE 2: Pagamentos + Emails (2-3 dias)**

#### Day 5: Pagamento PIX
```bash
☐ Criar payment-cert.service.ts
☐ Integrar com Sicoob PIX (criar cobrança R$ 150)
☐ Vincular payment_cert_digital ↔ sicoob_cobrancas
☐ Processar webhook pagamento
☐ Atualizar status enrollment
☐ Testes de pagamento
```

#### Day 6: Email + WhatsApp
```bash
☐ Criar cert-notification.service.ts
☐ Implementar template email Rebelo Contábil
☐ Configurar SendGrid/Resend
☐ Implementar notificação WhatsApp (certificado pronto)
☐ Implementar notificação WhatsApp (aprovação assinatura)
☐ Testes de notificação
```

#### Day 7: Prompts IA
```bash
☐ Criar ai_prompts_certificado.py
☐ Implementar PROMPT_MEI_CERTIFICADO_INTRO
☐ Implementar PROMPT_MEI_CERTIFICADO_CONSULTA_DATAS
☐ Implementar PROMPT_MEI_CERTIFICADO_PAGAMENTO
☐ Implementar PROMPT_MEI_CERTIFICADO_POS_PAGAMENTO
☐ Implementar PROMPT_MEI_EMITIR_NFSE
☐ Integrar com WhatsApp service
☐ Testes de conversação
```

---

### **FASE 3: Produção (2-3 dias)**

#### Day 8-9: Integração Real Certisign
```bash
☐ Obter credenciais Certisign (API key, webhook secret)
☐ Configurar variáveis ambiente
☐ Substituir mocks por chamadas reais
☐ Testar solicitação de certificado real
☐ Testar aprovação no app Certisign
☐ Testar assinatura remota real
☐ Validar XMLDSig com SEFIN/ADN
```

#### Day 10: mTLS Strategy
```bash
☐ Validar necessidade de mTLS com SEFIN
☐ Contatar Certisign (Bridge/Proxy disponível?)
☐ Decidir estratégia (A, B ou C)
☐ Implementar solução escolhida
☐ Testar handshake mTLS
☐ Validar emissão NFSe completa
```

---

### **FASE 4: Testes E2E (2-3 dias)**

#### Day 11-12: Fluxo Completo MEI
```bash
☐ Cadastro MEI → WhatsApp
☐ IA consulta datas disponíveis
☐ IA gera QR Code PIX R$ 150
☐ Usuário paga PIX
☐ Webhook confirma pagamento
☐ Email enviado para rebelocontabil@gmail.com
☐ Certisign processa (3-5 dias - MOCK)
☐ Callback vinculo recebido
☐ WhatsApp notifica usuário
☐ Usuário emite NFSe
☐ Sistema solicita assinatura remota
☐ Usuário aprova no app Certisign
☐ Callback assinatura recebido
☐ XMLDSig montado e enviado
☐ NFSe emitida com sucesso
☐ Taxa R$ 3,00 cobrada
```

#### Day 13: Testes de Segurança
```bash
☐ Validar HMAC signature (webhook)
☐ Validar não armazenamento de chave privada
☐ Validar RLS policies
☐ Validar criptografia API keys
☐ Validar timeout assinatura (5 min)
☐ Validar auditoria completa
☐ Penetration testing básico
```

---

## 📁 ESTRUTURA DE ARQUIVOS A CRIAR

```
apps/backend/src/
├── services/
│   ├── certificate/
│   │   ├── certificate.service.ts          ❌ NÃO EXISTE
│   │   ├── certisign-client.ts             ❌ NÃO EXISTE
│   │   ├── payment-cert.service.ts         ❌ NÃO EXISTE
│   │   ├── types.ts                        ❌ NÃO EXISTE
│   │   └── index.ts                        ❌ NÃO EXISTE
│   └── email/
│       └── cert-notification.service.ts    ❌ NÃO EXISTE
├── routes/
│   └── certisign.routes.ts                 ❌ NÃO EXISTE
├── controllers/
│   └── certisign.controller.ts             ❌ NÃO EXISTE
└── utils/
    └── certisign-hmac.ts                   ❌ NÃO EXISTE

apps/backend/inss/app/services/
└── ai_prompts_certificado.py               ❌ NÃO EXISTE

apps/backend/tests/
├── unit/
│   └── certificate.service.test.ts         ❌ NÃO EXISTE
└── integration/
    └── certisign-flow.test.ts              ❌ NÃO EXISTE
```

---

## 🔐 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

```env
# Certisign API
CERTISIGN_API_KEY=sk_certisign_...           ❌ FALTA
CERTISIGN_API_BASE_URL=https://api.certisign.com.br   ✅ DOCUMENTADO
CERTISIGN_WEBHOOK_SECRET=whsec_...           ❌ FALTA
CERTISIGN_EMAIL_CERTIFICADORA=rebelocontabil@gmail.com   ✅ DOCUMENTADO

# Backend URL (para callbacks)
BACKEND_URL=https://api.guiasmei.com.br      ❌ FALTA

# Email (SendGrid ou SMTP)
SENDGRID_API_KEY=SG...                       ❌ FALTA
EMAIL_FROM=noreply@guiasmei.com.br           ❌ FALTA

# Já existentes (OK)
SUPABASE_URL=...                             ✅ OK
SUPABASE_SERVICE_ROLE_KEY=...               ✅ OK
SICOOB_PIX_...                               ✅ OK
TWILIO_...                                   ✅ OK (mock)
OPENAI_API_KEY=...                           ✅ OK
```

---

## 📊 ESTIMATIVA DE TEMPO

| Fase | Duração | Dependências | Status |
|------|---------|-------------|--------|
| Fase 1: Backend Structure | 3-4 dias | Nenhuma | 🔴 Não iniciada |
| Fase 2: Pagamentos + Emails | 2-3 dias | Fase 1 | 🔴 Não iniciada |
| Fase 3: Produção Real | 2-3 dias | Fase 2 + Credenciais Certisign | 🔴 Não iniciada |
| Fase 4: Testes E2E | 2-3 dias | Fase 3 | 🔴 Não iniciada |
| **TOTAL** | **9-13 dias** | Credenciais Certisign | 🟡 Estimado |

**Prazo estimado:** **15-20 de novembro de 2025**

---

## 🚨 BLOQUEADORES CRÍTICOS

### 1. **Credenciais Certisign (CRÍTICO)**
- ❌ API Key não obtida
- ❌ Webhook Secret não obtido
- ❌ Documentação API Certisign não disponível
- **Ação:** Contatar Certisign URGENTE

### 2. **mTLS Strategy (ALTO)**
- ❌ Não sabemos se SEFIN exige mTLS com cert do prestador
- ❌ Não sabemos se Certisign oferece Bridge/Proxy
- **Ação:** Validar com SEFIN + Certisign

### 3. **Prazo Emissão Certificado (MÉDIO)**
- ⚠️ Documentação menciona 3-5 dias úteis
- ⚠️ Pode atrasar fluxo de teste E2E
- **Ação:** Solicitar certificado teste antecipadamente

---

## ✅ PRÓXIMAS AÇÕES IMEDIATAS

### **HOJE (1º de novembro):**
1. ☐ **Contatar Certisign:**
   - Solicitar credenciais API (sandbox)
   - Obter documentação API completa
   - Validar disponibilidade Bridge/Proxy mTLS
   - Confirmar prazo emissão certificado teste

2. ☐ **Criar estrutura de pastas:**
   ```bash
   mkdir -p apps/backend/src/services/certificate
   mkdir -p apps/backend/src/controllers
   mkdir -p apps/backend/tests/unit
   mkdir -p apps/backend/tests/integration
   ```

3. ☐ **Começar implementação (modo MOCK):**
   - Criar `certificate.service.ts` com funções stub
   - Criar `certisign.routes.ts` básico
   - Criar testes unitários básicos

### **AMANHÃ (2 de novembro):**
1. ☐ Implementar webhook handlers
2. ☐ Implementar assinatura remota (mock)
3. ☐ Integrar com NFSe service
4. ☐ Criar primeiro teste E2E

---

## 📝 CONCLUSÃO

**Status Atual:**
- ✅ **Banco de dados:** 100% pronto e compliant
- ❌ **Backend services:** 0% implementado
- ❌ **Webhooks:** 0% implementado
- ❌ **Integração NFSe:** 0% adaptado
- ❌ **WhatsApp IA:** 0% implementado
- ❌ **Testes E2E:** 0% criados

**Completude Geral:** **25%** (apenas estrutura de dados)

**Próximo passo crítico:** Contatar Certisign e iniciar implementação backend (modo mock).

**Ação mais urgente:** Criar `certificate.service.ts` HOJE.

---

**Gerado por:** GitHub Copilot  
**Próxima Review:** 4 de novembro de 2025

