# 📊 ANÁLISE GAP - Certificado Digital ICP-Brasil

**Data:** 01/11/2025  
**Comparação:** Day 1 (implementado) vs. FLUXO_COMPLETO_CERTIFICADO_DIGITAL.md

---

## ✅ RESUMO EXECUTIVO

### Status Geral: **35% Completo**

| Componente | Status | Progresso | Observações |
|------------|--------|-----------|-------------|
| **Database Schema** | ✅ Completo | 100% | 5 tabelas criadas via migrations |
| **Backend Service Layer** | ✅ Completo | 100% | CertificateService MOCK funcional |
| **API Endpoints** | ✅ Completo | 100% | 7 endpoints REST implementados |
| **Webhooks** | ✅ Completo | 100% | 2 webhooks com validação HMAC |
| **Integração NFSe** | ❌ Pendente | 0% | Precisa modificar nfse.service.ts |
| **Payment Service** | ❌ Pendente | 0% | Integração Sicoob PIX R$ 150 |
| **Email Service** | ❌ Pendente | 0% | Notificações certificadora/usuário |
| **WhatsApp + IA (MEI)** | ❌ Pendente | 0% | Prompts GPT-4o certificado |
| **WhatsApp + IA (Autônomo)** | ✅ Parcial | 83% | INSS funcional, falta certificado |
| **Dashboard Admin** | ❌ Pendente | 0% | Configurações de tarifas |
| **Jobs Automáticos** | ❌ Pendente | 0% | Expiração, notificações |
| **Testes E2E** | ❌ Pendente | 0% | Fluxo completo MEI/Autônomo |
| **Segurança (JWT)** | ⚠️ Parcial | 90% | Falta JWT auth endpoints |

---

## 📋 DETALHAMENTO POR COMPONENTE

### 1. ✅ DATABASE SCHEMA (100% COMPLETO)

#### Status: Implementado
**Arquivos:**
- ✅ `supabase/migrations/20251101090000_create_cert_icp_tables.sql` (218 linhas)
- ✅ `supabase/migrations/20251101090500_seed_cert_provider.sql` (seed Certisign)

**Tabelas criadas:**
1. ✅ `cert_providers` - Certificadoras (Certisign)
2. ✅ `cert_enrollments` - Vínculos certificado ↔ usuário
3. ✅ `sign_requests` - Solicitações de assinatura
4. ✅ `sign_audit_logs` - Auditoria LGPD
5. ✅ `payment_cert_digital` - Pagamentos PIX R$ 150

**Compliance:**
- ✅ NUNCA armazena chave privada/PFX/senha
- ✅ RLS policies habilitadas
- ✅ Indexes otimizados
- ✅ Constraints e validações

**Action:** Nenhuma. Schemas prontos para uso.

---

### 2. ✅ BACKEND SERVICE LAYER (100% COMPLETO)

#### Status: Implementado (MODO MOCK)
**Arquivos:**
- ✅ `apps/backend/src/services/certificate/types.ts` (94 linhas)
- ✅ `apps/backend/src/services/certificate/certificate.service.ts` (455 linhas)
- ✅ `apps/backend/src/services/certificate/index.ts` (4 linhas)

**Funcionalidades:**
- ✅ `consultarDatasDisponiveis()` - Mock: retorna próximos 6 dias úteis
- ✅ `solicitarVinculoCertificado()` - Cria enrollment PENDING no DB
- ✅ `processarCallbackVinculo()` - Atualiza enrollment com dados reais
- ✅ `buscarCertificadoUsuario()` - Busca certificado ACTIVE
- ✅ `validarCertificadoAtivo()` - Verifica validade
- ✅ `solicitarAssinaturaRemota()` - Cria sign_request no DB
- ✅ `processarCallbackAssinatura()` - Atualiza com signature_value
- ✅ `aguardarAprovacaoAssinatura()` - Polling fallback (3s interval)
- ✅ `gerarHashDPS()` - SHA-256 de XML
- ✅ `montarXMLDSig()` - Template XMLDSig básico
- ✅ `registrarAuditoria()` - LGPD compliant

**Observações:**
- ⚠️ Todas as funções estão em MODO MOCK
- ⚠️ Não faz chamadas reais à API Certisign
- ⚠️ `montarXMLDSig()` é template básico (produção precisa xml-crypto)
- ✅ Estrutura pronta para substituir por API real

**Action:** Nenhuma por enquanto. Mock funcional para testes.

---

### 3. ✅ API ENDPOINTS (100% COMPLETO)

#### Status: Implementado
**Arquivos:**
- ✅ `apps/backend/src/controllers/certisign.controller.ts` (188 linhas)
- ✅ `apps/backend/src/routes/certisign.routes.ts` (151 linhas)
- ✅ `apps/backend/src/index.ts` (rotas registradas)

**Endpoints:**

| Método | Rota | Função | Status |
|--------|------|--------|--------|
| GET | `/api/certisign/datas-disponiveis` | Consultar datas | ✅ |
| POST | `/api/certisign/enrollment` | Solicitar certificado | ✅ |
| GET | `/api/certisign/enrollment/:userId` | Buscar certificado | ✅ |
| POST | `/api/certisign/sign/solicitar` | Solicitar assinatura | ✅ |
| GET | `/api/certisign/sign/:signRequestId` | Status assinatura | ✅ |
| POST | `/api/certisign/webhook/vinculo` | Callback certificado | ✅ |
| POST | `/api/certisign/webhook/assinatura` | Callback assinatura | ✅ |

**Segurança:**
- ✅ Webhooks com validação HMAC timing-safe
- ✅ Schema validation (Fastify schemas)
- ✅ Error handling completo
- ⚠️ **FALTA:** Autenticação JWT nos endpoints protegidos

**Action:** Adicionar middleware JWT auth (próximo sprint).

---

### 4. ❌ INTEGRAÇÃO NFSe (0% - CRÍTICO)

#### Status: Não implementado
**Arquivo a modificar:** `apps/backend/src/nfse/services/nfse.service.ts`

**Fluxo atual (assinatura local):**
```typescript
// ❌ Código atual (inseguro - armazena PFX)
const xmlAssinado = await xmlbuilder.signXml(dpsXml, certificado_pfx);
```

**Fluxo necessário (assinatura remota):**
```typescript
// ✅ Código esperado (seguro - assinatura remota)
import { getCertificateService } from '../services/certificate';

const certService = getCertificateService();

// 1. Gerar hash do DPS
const hash = certService.gerarHashDPS(dpsXml);

// 2. Solicitar assinatura remota
const signRequest = await certService.solicitarAssinaturaRemota(
  userId,
  hash,
  'DPS',
  dpsId
);

// 3. Notificar usuário via WhatsApp (QR Code)
await whatsappService.enviarMensagem(
  userPhone,
  `🔐 Aprove a assinatura da NFSe no app Certisign: ${signRequest.qr_code_url}`
);

// 4. Aguardar aprovação (polling ou webhook)
const signApproved = await certService.aguardarAprovacaoAssinatura(
  signRequest.id,
  5 * 60 * 1000 // 5 minutos
);

// 5. Montar XMLDSig com signature_value
const xmlDSig = certService.montarXMLDSig(
  hash,
  signApproved.signature_value!,
  enrollment.thumbprint
);

// 6. Inserir XMLDSig no DPS
const dpsAssinado = insertSignatureInDPS(dpsXml, xmlDSig);

// 7. Enviar para Sefin
const response = await sefinClient.enviarDPS(dpsAssinado);
```

**Tasks:**
1. [ ] Buscar arquivo `nfse.service.ts`
2. [ ] Identificar função `emitirNFSe()` ou similar
3. [ ] Substituir assinatura local por remota
4. [ ] Adicionar try/catch para timeout (5min)
5. [ ] Testar com certificado mockado
6. [ ] Validar XMLDSig gerado com XSD

**Prioridade:** 🔴 CRÍTICA (bloqueia emissão NFSe)

---

### 5. ❌ PAYMENT SERVICE (0% - CRÍTICO)

#### Status: Não implementado
**Arquivo a criar:** `apps/backend/src/services/certificate/payment-cert.service.ts`

**Integrações necessárias:**
1. ✅ SicoobService (já existe e funcional)
2. ❌ Integração certificado ↔ pagamento
3. ❌ Webhook Sicoob → trigger email certificadora

**Código esperado:**
```typescript
// apps/backend/src/services/certificate/payment-cert.service.ts

import { getSicoobService } from '../sicoob';
import { supabase } from '../../config/supabase';
import { EmailService } from '../email/cert-notification.service';

export class PaymentCertService {
  private sicoobService = getSicoobService();
  private emailService = new EmailService();

  /**
   * Gerar cobrança PIX para certificado (R$ 150,00)
   */
  async gerarCobrancaPIX(
    userId: string,
    nome: string,
    cpf_cnpj: string
  ): Promise<{ txid: string; qr_code: string }> {
    // 1. Gerar cobrança Sicoob
    const cobranca = await this.sicoobService.criarCobrancaImediata({
      valor: 150.00,
      calendario: { expiracao: 3600 }, // 1 hora
      devedor: {
        nome,
        cpf: cpf_cnpj
      },
      solicitacaoPagador: 'Certificado Digital ICP-Brasil - GuiasMEI'
    });

    // 2. Salvar payment_cert_digital
    const { data: payment } = await supabase
      .from('payment_cert_digital')
      .insert({
        user_id: userId,
        txid: cobranca.txid,
        qr_code: cobranca.qrcode,
        valor: 150.00,
        status: 'PENDING'
      })
      .select()
      .single();

    return {
      txid: cobranca.txid,
      qr_code: cobranca.qrcode
    };
  }

  /**
   * Processar webhook pagamento confirmado
   */
  async processarPagamentoConfirmado(txid: string): Promise<void> {
    // 1. Atualizar payment_cert_digital
    const { data: payment } = await supabase
      .from('payment_cert_digital')
      .update({
        status: 'PAID',
        paid_at: new Date()
      })
      .eq('txid', txid)
      .select()
      .single();

    // 2. Enviar email para certificadora
    await this.emailService.notificarCertificadora(payment.user_id);

    // 3. Notificar usuário via WhatsApp
    await this.emailService.notificarUsuarioPagamentoConfirmado(payment.user_id);
  }
}
```

**Tasks:**
1. [ ] Criar `payment-cert.service.ts`
2. [ ] Integrar com SicoobService
3. [ ] Modificar webhook Sicoob para chamar `processarPagamentoConfirmado()`
4. [ ] Testar geração de QR Code PIX
5. [ ] Testar callback pagamento confirmado

**Prioridade:** 🔴 CRÍTICA (bloqueia fluxo completo)

---

### 6. ❌ EMAIL SERVICE (0% - IMPORTANTE)

#### Status: Não implementado
**Arquivo a criar:** `apps/backend/src/services/email/cert-notification.service.ts`

**Templates necessários:**

#### Template 1: Email Certificadora (rebelocontabil@gmail.com)
```typescript
async notificarCertificadora(userId: string): Promise<void> {
  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: payment } = await supabase
    .from('payment_cert_digital')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const emailHtml = `
    <h2>Nova Solicitação de Certificado Digital</h2>
    <p>Olá, Rebelo Contábil!</p>
    
    <h3>Dados do Cliente:</h3>
    <ul>
      <li><strong>Nome:</strong> ${user.nome}</li>
      <li><strong>CNPJ/CPF:</strong> ${user.cpf_cnpj}</li>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>WhatsApp:</strong> ${user.telefone}</li>
    </ul>
    
    <h3>Pagamento:</h3>
    <ul>
      <li><strong>Status:</strong> CONFIRMADO ✅</li>
      <li><strong>Valor:</strong> R$ 150,00</li>
      <li><strong>TXID:</strong> ${payment.txid}</li>
      <li><strong>Data:</strong> ${new Date(payment.paid_at).toLocaleString('pt-BR')}</li>
    </ul>
    
    <h3>Próximos Passos:</h3>
    <ol>
      <li>Entrar em contato com o cliente via WhatsApp</li>
      <li>Realizar validação presencial/remota</li>
      <li>Emitir certificado digital ICP-Brasil A1/A3</li>
      <li>Enviar metadados via callback GuiasMEI</li>
    </ol>
    
    <p><em>Plataforma GuiasMEI - guiasmei.com.br</em></p>
  `;

  await sendEmail({
    to: 'rebelocontabil@gmail.com',
    subject: `[GuiasMEI] Nova Solicitação Certificado - ${user.nome}`,
    html: emailHtml
  });
}
```

#### Template 2: Email Usuário (pagamento confirmado)
```typescript
async notificarUsuarioPagamentoConfirmado(userId: string): Promise<void> {
  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const emailHtml = `
    <h2>Pagamento Confirmado! 🎉</h2>
    <p>Olá, ${user.nome}!</p>
    
    <p>Seu pagamento de <strong>R$ 150,00</strong> foi confirmado com sucesso!</p>
    
    <h3>Próximos Passos:</h3>
    <ul>
      <li>✅ A Rebelo Contábil já recebeu suas informações</li>
      <li>📞 Eles entrarão em contato em até 48h</li>
      <li>📅 Certificado emitido em 3-5 dias úteis</li>
    </ul>
    
    <p>Você poderá emitir notas fiscais assim que o certificado estiver ativo.</p>
    
    <p><em>Plataforma GuiasMEI - guiasmei.com.br</em></p>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Pagamento Confirmado - Certificado Digital',
    html: emailHtml
  });
}
```

**Configuração:**
```bash
# .env
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@guiasmei.com.br
CERTISIGN_EMAIL_CERTIFICADORA=rebelocontabil@gmail.com
```

**Tasks:**
1. [ ] Criar `cert-notification.service.ts`
2. [ ] Configurar SendGrid/Resend
3. [ ] Implementar 3 templates:
   - Solicitação → certificadora
   - Pagamento confirmado → usuário
   - Certificado pronto → usuário
4. [ ] Testar envio de emails

**Prioridade:** 🟡 IMPORTANTE

---

### 7. ❌ WHATSAPP + IA (MEI) (0% - IMPORTANTE)

#### Status: Não implementado
**Arquivo a criar:** `apps/backend/inss/app/services/ai_prompts_certificado.py`

**Prompts necessários:**

```python
# PROMPT 1: Introdução certificado
PROMPT_MEI_CERTIFICADO_INTRO = """
Você é o assistente virtual da GuiasMEI. Um usuário MEI acabou de se cadastrar.

🎯 Seu objetivo:
1. Dar boas-vindas calorosas
2. Explicar a importância do CERTIFICADO DIGITAL ICP-BRASIL
3. Perguntar se o usuário já possui certificado digital
4. Se NÃO, oferecer emissão via Certisign

Contexto:
- Nome: {{nome}}
- CNPJ: {{cnpj}}
- Tipo: MEI
"""

# PROMPT 2: Consultar datas
PROMPT_MEI_CERTIFICADO_CONSULTA_DATAS = """
O usuário não possui certificado. Seu objetivo:
1. Informar preço: R$ 150,00 (pagamento único)
2. Chamar função: consultar_datas_certisign()
3. Mostrar 3 próximas datas disponíveis
4. Perguntar qual prefere

Exemplo:
"📅 Datas disponíveis:
1️⃣ 05/11 às 14h
2️⃣ 06/11 às 10h
3️⃣ 07/11 às 16h

Qual prefere? (1, 2 ou 3)"
"""

# PROMPT 3: Pagamento PIX
PROMPT_MEI_CERTIFICADO_PAGAMENTO = """
Usuário escolheu data {{data}}. Seu objetivo:
1. Confirmar data
2. Chamar função: gerar_pix_certificado()
3. Enviar QR Code PIX
4. Explicar próximos passos

Exemplo:
"✅ Agendado para {{data}}!
💳 Pagamento: R$ 150,00
[QR CODE PIX]
📋 Após pagamento:
- Confirmação em 5min
- Certificadora contata em 48h
- Certificado em 3-5 dias
- NFSe por R$ 3,00/nota"
"""

# PROMPT 4: Pós-pagamento
PROMPT_MEI_CERTIFICADO_POS_PAGAMENTO = """
Pagamento confirmado! Seu objetivo:
1. Parabenizar
2. Informar que certificadora recebeu email
3. Prazo de contato: 24-48h
4. Perguntar se tem dúvidas
"""

# PROMPT 5: Emitir NFSe
PROMPT_MEI_EMITIR_NFSE = """
Usuário quer emitir nota fiscal. Seu objetivo:
1. Verificar se tem certificado ativo
2. Se SIM: coletar dados da nota
3. Se NÃO: informar que precisa solicitar certificado

Exemplo (COM certificado):
"📝 Vou te ajudar!
1️⃣ Valor (ex: R$ 1.500)
2️⃣ Nome do cliente
3️⃣ CNPJ/CPF cliente
4️⃣ Descrição do serviço"

Exemplo (SEM certificado):
"⚠️ Para emitir NFS-e, você precisa de certificado digital.
Quer solicitar? R$ 150,00 (pagamento único)"
"""
```

**Funções GPT-4o (function calling):**
```python
FUNCTIONS_CERTIFICADO = [
    {
        "name": "consultar_datas_certisign",
        "description": "Consultar datas disponíveis para agendamento de certificado",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "gerar_pix_certificado",
        "description": "Gerar QR Code PIX de R$ 150,00 para pagamento de certificado",
        "parameters": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string"},
                "nome": {"type": "string"},
                "cpf_cnpj": {"type": "string"}
            },
            "required": ["user_id", "nome", "cpf_cnpj"]
        }
    }
]
```

**Integração com WhatsAppService:**
```typescript
// apps/backend/src/services/whatsapp/whatsapp.service.ts

import { openai } from '../openai';
import { getCertificateService } from '../certificate';
import { PaymentCertService } from '../certificate/payment-cert.service';

const certService = getCertificateService();
const paymentService = new PaymentCertService();

// Handler para function calling
async function handleFunctionCall(functionName: string, args: any) {
  switch (functionName) {
    case 'consultar_datas_certisign':
      return await certService.consultarDatasDisponiveis();
    
    case 'gerar_pix_certificado':
      const { user_id, nome, cpf_cnpj } = args;
      const pix = await paymentService.gerarCobrancaPIX(user_id, nome, cpf_cnpj);
      return {
        qr_code: pix.qr_code,
        txid: pix.txid,
        valor: 150.00
      };
    
    default:
      throw new Error(`Função desconhecida: ${functionName}`);
  }
}
```

**Tasks:**
1. [ ] Criar `ai_prompts_certificado.py`
2. [ ] Adicionar prompts ao sistema GPT-4o
3. [ ] Implementar function calling (consultar_datas, gerar_pix)
4. [ ] Integrar com WhatsAppService existente
5. [ ] Testar conversa completa via WhatsApp mock
6. [ ] Adicionar notificações: certificado pronto, assinatura pendente

**Prioridade:** 🟡 IMPORTANTE

---

### 8. ✅ WHATSAPP + IA (AUTÔNOMO) (83% COMPLETO)

#### Status: Parcial
**O que já existe:**
- ✅ Fluxo INSS completo (28/28 testes)
- ✅ Prompts GPT-4o para guias GPS
- ✅ Geração automática de guias

**O que falta:**
- ⚠️ Integrar prompts de certificado no fluxo existente
- ⚠️ Notificações de certificado expirando

**Action:** Baixa prioridade (fluxo Autônomo não precisa certificado).

---

### 9. ❌ DASHBOARD ADMIN (0% - OPCIONAL)

#### Status: Não implementado
**Arquivo a criar:** `apps/web/src/features/dashboards/ConfiguracoesTarifas.jsx`

**Funcionalidades:**
- [ ] Configurar taxa NFSe (R$ 3,00)
- [ ] Configurar taxa INSS (6%)
- [ ] Configurar preço certificado (R$ 150,00)
- [ ] Configurar comissão parceiro (20%)
- [ ] Simulação de receita
- [ ] Salvar em `system_config` (Supabase)

**Prioridade:** 🟢 OPCIONAL (pode ser hardcoded por enquanto)

---

### 10. ❌ JOBS AUTOMÁTICOS (0% - OPCIONAL)

#### Status: Não implementado
**Jobs necessários:**

1. **Expirar sign_requests** (cada 1 minuto)
```typescript
// Marcar como EXPIRED após 5 minutos
UPDATE sign_requests
SET status = 'EXPIRED'
WHERE status = 'PENDING'
AND expires_at < NOW();
```

2. **Notificar certificados expirando** (diário)
```typescript
// Notificar 30 dias antes da expiração
SELECT * FROM cert_enrollments
WHERE status = 'ACTIVE'
AND valid_until BETWEEN NOW() AND NOW() + INTERVAL '30 days';
```

3. **Cleanup logs antigos** (semanal)
```typescript
// LGPD: deletar logs > 90 dias
DELETE FROM sign_audit_logs
WHERE timestamp < NOW() - INTERVAL '90 days';
```

**Prioridade:** 🟢 OPCIONAL (pode ser manual por enquanto)

---

### 11. ❌ TESTES E2E (0% - CRÍTICO PARA PRODUÇÃO)

#### Status: Não implementado
**Testes necessários:**

1. **Fluxo MEI completo**
   - [ ] Cadastro → WhatsApp redirect
   - [ ] Conversa IA → consultar datas
   - [ ] Gerar PIX → pagamento
   - [ ] Webhook Sicoob → email certificadora
   - [ ] Callback Certisign → enrollment ACTIVE
   - [ ] Emitir NFSe → solicitar assinatura
   - [ ] Aprovar assinatura → XMLDSig
   - [ ] Enviar DPS → Sefin

2. **Fluxo Autônomo completo**
   - [ ] Cadastro → WhatsApp redirect
   - [ ] Conversa IA → escolher contribuição
   - [ ] Gerar guia GPS
   - [ ] Enviar PDF WhatsApp

3. **Testes de segurança**
   - [ ] Validação HMAC inválida
   - [ ] Timeout assinatura (5min)
   - [ ] Certificado expirado
   - [ ] CNPJ mismatch (DPS ↔ Certificado)

**Prioridade:** 🔴 CRÍTICA (antes de produção)

---

## 🎯 PLANO DE AÇÃO PRIORITIZADO

### **SPRINT 1 (Esta Semana) - Fundação Backend** 🔴

**Objetivo:** Completar fluxo de pagamento e notificações

**Tasks:**
1. ✅ Verificar migrations (COMPLETO)
2. [ ] Criar `payment-cert.service.ts`
3. [ ] Integrar Sicoob PIX R$ 150
4. [ ] Modificar webhook Sicoob para certificado
5. [ ] Criar `cert-notification.service.ts`
6. [ ] Configurar SendGrid/Resend
7. [ ] Testar fluxo: enrollment → pagamento → email

**Entregas:**
- ✅ Pagamento PIX funcional
- ✅ Email certificadora automático
- ✅ Webhook Sicoob → email

**Estimativa:** 8-10 horas

---

### **SPRINT 2 (Próxima Semana) - Integração NFSe** 🔴

**Objetivo:** NFSe com assinatura remota

**Tasks:**
1. [ ] Localizar `nfse.service.ts`
2. [ ] Substituir assinatura local por remota
3. [ ] Implementar fluxo de espera (polling)
4. [ ] Testar emissão NFSe com certificado mockado
5. [ ] Validar XMLDSig com XSD
6. [ ] Adicionar tratamento de timeout

**Entregas:**
- ✅ NFSe emitida com assinatura remota
- ✅ XMLDSig válido conforme especificação

**Estimativa:** 12-16 horas

---

### **SPRINT 3 (Semana 3) - WhatsApp + IA** 🟡

**Objetivo:** Conversação completa via WhatsApp

**Tasks:**
1. [ ] Criar `ai_prompts_certificado.py`
2. [ ] Implementar function calling GPT-4o
3. [ ] Integrar com WhatsAppService
4. [ ] Testar conversa completa (mock)
5. [ ] Adicionar notificações (certificado pronto, assinatura pendente)

**Entregas:**
- ✅ Conversa IA certificado funcional
- ✅ Notificações WhatsApp

**Estimativa:** 10-12 horas

---

### **SPRINT 4 (Semana 4) - Testes E2E** 🔴

**Objetivo:** Validar fluxo completo antes de produção

**Tasks:**
1. [ ] Testar fluxo MEI completo
2. [ ] Testar fluxo Autônomo completo
3. [ ] Testes de segurança (HMAC, timeout, certificado expirado)
4. [ ] Ajustes baseados em testes

**Entregas:**
- ✅ Fluxo MEI 100% testado
- ✅ Fluxo Autônomo 100% testado
- ✅ Segurança validada

**Estimativa:** 8-10 horas

---

### **SPRINT 5 (Semana 5) - Produção** 🟢

**Objetivo:** Deploy e homologação real

**Tasks:**
1. [ ] Obter credenciais Certisign (API key, webhook secret)
2. [ ] Configurar email produção (rebelocontabil@gmail.com)
3. [ ] Deploy backend (Vercel/Railway)
4. [ ] Configurar webhooks públicos
5. [ ] Testar com certificado real (sandbox)
6. [ ] Monitorar primeiros usuários

**Entregas:**
- ✅ Sistema em produção
- ✅ Certificado real testado
- ✅ Monitoramento ativo

**Estimativa:** 6-8 horas

---

## 📊 MÉTRICAS DE PROGRESSO

| Sprint | Status | Progresso | ETA |
|--------|--------|-----------|-----|
| Sprint 1 (Pagamentos) | 🔴 Pendente | 0% | Semana 1 |
| Sprint 2 (NFSe) | 🔴 Pendente | 0% | Semana 2 |
| Sprint 3 (WhatsApp IA) | 🟡 Pendente | 0% | Semana 3 |
| Sprint 4 (Testes E2E) | 🔴 Pendente | 0% | Semana 4 |
| Sprint 5 (Produção) | 🟢 Pendente | 0% | Semana 5 |

**Total estimado:** 5 semanas (44-56 horas)

---

## ✅ PRÓXIMA AÇÃO IMEDIATA

### **Começar Sprint 1: Payment Service**

**Quer que eu implemente agora?**

1. ✅ Criar `payment-cert.service.ts`
2. ✅ Integrar com SicoobService existente
3. ✅ Criar `cert-notification.service.ts` com templates de email
4. ✅ Testar geração de QR Code PIX R$ 150

**Comandos:**
```bash
# Criar arquivos
touch apps/backend/src/services/certificate/payment-cert.service.ts
touch apps/backend/src/services/email/cert-notification.service.ts

# Instalar dependências (se necessário)
cd apps/backend
npm install @sendgrid/mail # ou resend
```

**Posso começar?** 🚀
