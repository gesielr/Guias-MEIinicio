# 🚀 GuiasMEI - Plataforma Completa de Gestão Fiscal

> **Solução inovadora para emissão automatizada de guias GPS e notas fiscais NFS-e através de atendimento via WhatsApp com IA especializada.**

## 🎯 Visão Geral

O **GuiasMEI** é uma plataforma full-stack que revoluciona a gestão fiscal de Microempreendedores Individuais (MEI) e autônomos, oferecendo:

- 🤖 **Atendimento 100% via WhatsApp** com IA especializada em legislação fiscal
- 📄 **Emissão automática** de guias GPS e notas fiscais NFS-e
- 🤝 **Rede de parceiros** (contabilidades) com sistema de comissões
- 🔧 **Painel administrativo** completo para monitoramento e gestão

## 👥 Tipos de Usuários

### 🏢 **MEI (Microempreendedor Individual)**
- **Fluxo**: Homepage → Cadastro → WhatsApp (IA)
- **Funcionalidades**: Emissão GPS/NFS-e via IA
- **Acesso**: Apenas WhatsApp (sem telas web)

### 👤 **Autônomo**
- **Fluxo**: Homepage → Cadastro → WhatsApp (IA)
- **Funcionalidades**: Emissão GPS via IA
- **Acesso**: Apenas WhatsApp (sem telas web)

### 🤝 **Parceiro (Contabilidade)**
- **Fluxo**: Homepage → Cadastro → Dashboard Web
- **Funcionalidades**:
  - Gerenciar clientes
  - Gerar links de convite
  - Acompanhar comissões
  - Relatórios de faturamento

### 🔧 **Administrador**
- **Fluxo**: Login direto → Dashboard Admin
- **Funcionalidades**:
  - Gestão completa de usuários
  - Monitoramento NFSe (5 telas especializadas)
  - Configurações do sistema
  - Analytics e relatórios

## 🏗️ Arquitetura Técnica

### **Frontend (React + Vite)**
```
apps/web/
├── 🏠 Homepage - Landing page e seleção de perfil
├── 👤 Cadastros - MEI, Autônomo, Parceiro
├── 🔐 Autenticação - Login/Logout
├── 📊 Dashboards - Usuário, Parceiro, Admin
├── 🤖 WhatsApp Simulator - Testes locais
└── 📄 Emissões - Telas de emissão (simuladas)
```

### **Backend (Node.js + Fastify)**
```
apps/backend/
├── 🔐 Auth - Autenticação e autorização
├── 📊 Dashboard - APIs de dados
├── 🗺️ GPS - Emissão de guias
├── 📄 NFSe - Emissão de notas fiscais
├── 💰 Payments - Integração Stripe
└── 📱 WhatsApp - Webhooks e automação
```

### **Banco de Dados (Supabase)**
```
📊 Tabelas Principais:
├── profiles - Perfis de usuários
├── partners - Contabilidades parceiras
├── nfse_emissions - Emissões de NFS-e
├── gps_emissions - Emissões de GPS
├── nfse_credentials - Certificados digitais
└── partner_clients - Vínculos parceiro-cliente
```

## 🎨 Interface e Experiência

### **Design System Moderno**
- **Paleta**: Azuis profissionais (#3b82f6, #2563eb)
- **Tipografia**: Inter (moderna e legível)
- **Componentes**: Cards, badges, botões com hover effects
- **Responsividade**: Mobile-first, adaptável

### **Dashboards Especializados**

#### **Dashboard Parceiro** 🤝
- **Métricas**: Clientes, comissões, emissões
- **Gestão**: Adicionar clientes, gerar links
- **Relatórios**: Faturamento, performance
- **Ações Rápidas**: Gerar link, lembrete, relatórios, WhatsApp

#### **Dashboard Admin** 🔧
- **Visão Geral**: Estatísticas globais
- **Gestão NFSe**: 5 telas especializadas
  - 🔐 **Certificados Digitais** - Gestão de certificados de todos os usuários
  - 📊 **Monitoramento de Emissões** - Acompanhamento em tempo real
  - 📈 **Relatórios e Analytics** - Análise completa de dados
  - ⚙️ **Configurações do Sistema** - Gerenciamento de integrações
  - 🔍 **Logs e Auditoria** - Monitoramento de operações

## 🔐 Segurança e Conformidade

### **Criptografia Avançada**
- **Dados Sensíveis**: CPF, CNPJ, PIS criptografados (AES-256-GCM)
- **Certificados**: Senhas PFX criptografadas
- **Transmissão**: HTTPS obrigatório

### **Controle de Acesso**
- **RLS**: Row Level Security no Supabase
- **JWT**: Tokens seguros para autenticação
- **Roles**: Admin, Parceiro, Usuário com permissões específicas

### **Auditoria Completa**
- **Logs**: Todas as ações registradas
- **Rastreabilidade**: Quem fez o quê e quando
- **Compliance**: LGPD e regulamentações fiscais

## 🚀 Integrações Externas

### **APIs Governamentais**
- **Receita Federal**: Validação CNPJ/CPF
- **ADN NFSe**: Emissão de notas fiscais
- **SEFIP**: Geração de guias GPS

### **Serviços de Pagamento**
- **Sicoob PIX**: Cobranças PIX imediatas e com vencimento (✅ Implementado 31/10/2025)
- **Sicoob Boleto**: Geração e gestão de boletos bancários (✅ Implementado 31/10/2025)
- **Stripe**: Processamento internacional (estrutura básica)
- **Webhooks**: Confirmação automática e notificações (✅ Implementado 31/10/2025)

### **Comunicação**
- **WhatsApp Business API**: Atendimento automatizado (✅ Integrado com Sicoob 31/10/2025)
- **Twilio**: SMS e notificações WhatsApp
- **Email**: Confirmações e lembretes
- **Notificações Automáticas**: Sistema de fila para eventos de pagamento

## 🛠️ Tecnologias Utilizadas

### **Frontend**
- **React 18**: Interface moderna e reativa
- **Vite**: Build rápido e eficiente
- **React Router**: Navegação SPA
- **Tailwind CSS**: Estilização utilitária
- **Supabase Client**: Integração banco
- **React Query**: Gerenciamento de estado
- **React Hook Form**: Formulários eficientes

### **Backend - Módulo INSS (Python)**
- **FastAPI 0.120.1**: Framework web moderno assíncrono
- **Uvicorn 0.38.0**: Servidor ASGI
- **Pydantic V2.12.3**: Validação de dados
- **ReportLab 4.0.9**: Geração de PDFs
- **Supabase**: Banco de dados e storage
- **Twilio**: Integração WhatsApp

### **Backend - Módulo NFSe (Node.js)**
- **Node.js**: Runtime JavaScript
- **Fastify 4.26.2**: Framework web rápido
- **TypeScript**: Tipagem estática
- **Zod 3.23.8**: Validação de schemas
- **xml-crypto**: Assinatura digital XML
- **node-forge**: Manipulação de certificados
- **Axios**: Cliente HTTP

### **Banco de Dados**
- **Supabase**: PostgreSQL + Auth + Storage
- **RLS (Row Level Security)**: Segurança a nível de linha
- **Migrations**: Versionamento schema
- **Storage**: Arquivos PDF e certificados

### **Infraestrutura**
- **Vercel**: Deploy frontend (recomendado)
- **Railway/Heroku/GCP**: Deploy backend
- **Supabase Cloud**: Banco de dados
- **GitHub**: Versionamento e CI/CD
- **Cloudflare**: CDN e proteção

## 🚀 Como Rodar Localmente

### **Pré-requisitos**
- Node.js 18+
- Python 3.11+
- Supabase CLI
- Git
- Docker (opcional, para Supabase local)

### **1. Instalação**
```bash
# Clone o repositório
git clone https://github.com/gesielr/guiasMEI.git
cd guiasMEI

# Instale as dependências (raiz)
npm install

# Instale dependências Python (INSS backend)
cd apps/backend/inss
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell
# ou source .venv/bin/activate        # Linux/Mac
pip install -r requirements.txt
cd ../..
```

### **2. Configuração**
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Configure as variáveis de ambiente necessárias:
# Backend INSS (Python):
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+55...

# Backend NFSe (Node.js):
ADN_NFSE_URL=https://...            # Endpoint ADN (INCERTO)
ADN_NFSE_API_KEY=your_api_key

# Frontend:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
STRIPE_SECRET_KEY=sk_test_...
```

### **3. Execução Integrada**

**Opção A: Tudo com npm (recomendado)**
```bash
# Iniciar todos os serviços
npm run dev

# Isso abre:
# - Frontend: http://localhost:5173 (Vite)
# - Backend INSS: http://localhost:8000 (FastAPI)
# - Backend NFSe: http://localhost:3001 (Fastify)
# - Supabase Studio: http://localhost:54323 (se local)
```

**Opção B: Serviços Individuais**
```bash
# Terminal 1 - Frontend
cd apps/web
npm run dev          # http://localhost:5173

# Terminal 2 - Backend INSS (Python)
cd apps/backend/inss
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Terminal 3 - Backend NFSe (Node.js)
cd apps/backend
npm run dev          # http://localhost:3001

# Terminal 4 - Supabase (opcional)
supabase start       # http://localhost:54323
```

### **4. Acesso e Testes**

**Frontend:**
- URL: http://localhost:5173
- Página inicial com seleção de perfil (MEI, Autônomo, Parceiro, Admin)

**Backend INSS (FastAPI):**
- Swagger UI: http://localhost:8000/docs
- Redoc: http://localhost:8000/redoc
- Health: http://localhost:8000/ (GET)
- GPS Emission: http://localhost:8000/api/v1/guias/emitir (POST)

**Backend NFSe (Fastify):**
- Status: http://localhost:3001/health (GET)
- Endpoints NFSe: http://localhost:3001/nfse/* (POST)

**Testes Rápidos:**
```bash
# INSS GPS Emission
cd apps/backend/inss
.\.venv\Scripts\python.exe test_07_requisicoes_http.py

# Todos os testes INSS
.\.venv\Scripts\python.exe -m pytest tests/ -v

# Testes NFSe
cd apps/backend
npm test
```

### **5. Desenvolvimento com Hot Reload**

**Frontend (React):**
- Vite fornece hot reload automático
- Modificar `apps/web/src/**` recarrega automaticamente

**Backend INSS (FastAPI):**
- Flag `--reload` ativa auto-restart on file change
- Modificar `apps/backend/inss/app/**` recarrega automaticamente

**Backend NFSe (Node.js):**
- `tsx watch` ativa hot reload
- Modificar `apps/backend/src/**` recarrega automaticamente

---

## 📁 Estrutura do Projeto

```
guiasMEI/
├── 📱 apps/
│   ├── web/                 # Frontend React
│   │   ├── src/
│   │   │   ├── features/    # Funcionalidades
│   │   │   │   ├── auth/     # Autenticação
│   │   │   │   ├── dashboards/ # Dashboards
│   │   │   │   ├── admin/    # Telas administrativas
│   │   │   │   └── nfse/     # Emissões NFSe
│   │   │   ├── components/  # Componentes reutilizáveis
│   │   │   └── assets/      # Imagens e ícones
│   │   └── public/          # Arquivos estáticos
│   └── backend/             # Backend Node.js
│       ├── src/
│       │   ├── nfse/        # Módulo NFSe
│       │   ├── services/    # Serviços
│       │   └── routes/      # Rotas API
│       └── dist/            # Build produção
├── 📦 packages/             # Pacotes compartilhados
│   ├── config/             # Schemas e tipos
│   ├── sdk/                # Cliente API
│   └── ui/                 # Componentes UI
├── 🗄️ supabase/            # Configuração Supabase
│   ├── functions/          # Edge Functions
│   └── migrations/         # Migrações DB
├── 📚 docs/                # Documentação
└── 🧪 test/                # Testes
```

## 📊 Scripts Disponíveis

### **Root Level (npm)**
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia todos os serviços (frontend + backends) |
| `npm run build` | Build de produção (frontend + packages) |
| `npm test` | Executa testes (todos os pacotes) |
| `npm run lint` | Lint de código (ESLint) |

### **Frontend (apps/web)**
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server com hot reload (Vite) |
| `npm run build` | Build otimizado para produção |
| `npm run preview` | Pré-visualizar build de produção |
| `npm test` | Testes com Vitest |
| `npm run lint` | ESLint check |

### **Backend Node.js (apps/backend)**
| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server com hot reload (tsx watch) |
| `npm run start` | Inicia servidor (sem hot reload) |
| `npm run build` | Build para produção |
| `npm test` | Testes com Vitest |

### **Backend Python (apps/backend/inss)**
```powershell
# Development
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Production
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Tests
.\.venv\Scripts\python.exe -m pytest tests/ -v
.\.venv\Scripts\python.exe test_07_requisicoes_http.py

# Swagger Documentation
# Acesse: http://localhost:8000/docs
```

---

## 🔧 Configuração de Desenvolvimento

### **Variáveis de Ambiente**
```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Sicoob Integration (✅ Implementado 31/10/2025)
SICOOB_ENVIRONMENT=sandbox
SICOOB_API_BASE_URL=https://api-sandbox.sicoob.com.br
SICOOB_AUTH_URL=https://auth-sandbox.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token
SICOOB_CLIENT_ID=seu_client_id
# SICOOB_CLIENT_SECRET é opcional - o Sicoob pode não fornecer
SICOOB_CLIENT_SECRET=
SICOOB_CERT_PFX_BASE64=base64_do_certificado
SICOOB_CERT_PFX_PASS=senha_do_certificado
SICOOB_WEBHOOK_SECRET=seu_webhook_secret
SICOOB_COOPERATIVA=sua_cooperativa
SICOOB_CONTA=sua_conta
# Escopos: pix.read pix.write cob.read cob.write cobv.read cobv.write 
# webhook.read webhook.write boletos_consulta boletos_inclusao boletos_alteracao
# webhooks_consulta webhooks_inclusao webhooks_alteracao
SICOOB_SCOPES=pix.read pix.write cob.read cob.write cobv.read cobv.write webhook.read webhook.write boletos_consulta boletos_inclusao boletos_alteracao webhooks_consulta webhooks_inclusao webhooks_alteracao

# NFSe
ADN_NFSE_CONTRIBUINTES_URL=https://...
ADN_NFSE_PARAMETROS_URL=https://...
ADN_NFSE_DANFSE_URL=https://...

# WhatsApp
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_ID=your_phone_id
```

### **Banco de Dados**
```bash
# Aplicar migrações
supabase db reset

# Visualizar schema
supabase db diff
```

## 💳 Integração Sicoob PIX + Boleto (✅ Implementado 31/10/2025)

### **Visão Geral**
Integração completa com o ecossistema Sicoob para gerenciamento de cobranças via PIX e Boleto, incluindo:
- 🔐 **Autenticação OAuth 2.0 + mTLS** com certificados ICP-Brasil
- 💰 **Cobranças PIX** (imediatas e com vencimento)
- 📄 **Boletos Bancários** (geração, consulta, cancelamento, PDF)
- 🔔 **Webhooks** com validação HMAC e persistência automática
- 📱 **Notificações WhatsApp** automatizadas para eventos de pagamento

### **Arquitetura**

#### **Camada de Serviços (Node.js/TypeScript)**
```
apps/backend/src/services/sicoob/
├── auth.service.ts          # OAuth 2.0 + mTLS (token cache)
├── pix.service.ts            # Cobranças PIX (criar, consultar, listar, cancelar)
├── boleto.service.ts         # Boletos (gerar, consultar, listar, PDF)
├── webhook.service.ts        # Processamento de webhooks (✅ persistência Supabase)
├── cobranca-db.service.ts    # Gerenciamento de cobranças no Supabase (✅ NOVO)
└── certificate.util.ts       # Manipulação de certificados mTLS
```

#### **Camada de Dados (Supabase)**
```sql
-- Migration: 20251031000001_create_sicoob_tables.sql
├── sicoob_cobrancas         # Registro de todas as cobranças PIX/Boleto
├── sicoob_webhook_events    # Histórico de eventos recebidos via webhook
├── sicoob_notificacoes      # Fila de notificações para WhatsApp
└── sicoob_test_logs         # Logs dos scripts de teste
```

#### **Automação WhatsApp (Python)**
```
apps/backend/inss/
├── process_sicoob_notifications.py   # Processador de notificações (✅ NOVO)
└── run_sicoob_processor.py           # Script de execução contínua
```

### **Scripts de Teste**
```bash
# Autenticação (obtém token)
npx tsx apps/backend/scripts/test-sicoob-auth.ts

# Testes de PIX (✅ NOVO)
npx tsx apps/backend/scripts/test-sicoob-pix.ts
# Cria cobranças imediatas/vencimento, consulta, lista e registra no Supabase

# Testes de Boleto (✅ NOVO)
npx tsx apps/backend/scripts/test-sicoob-boleto.ts
# Gera boletos, consulta, lista, baixa PDF e registra no Supabase
```

### **Endpoints API**
```
POST   /api/sicoob/pix/cobranca-imediata      # Criar cobrança PIX imediata
POST   /api/sicoob/pix/cobranca-vencimento    # Criar cobrança PIX com vencimento
GET    /api/sicoob/pix/cobranca/:txid         # Consultar cobrança PIX
GET    /api/sicoob/pix/cobracas               # Listar cobranças PIX
DELETE /api/sicoob/pix/cobranca/:txid         # Cancelar cobrança PIX
GET    /api/sicoob/pix/qrcode/:txid           # Consultar QR Code

POST   /api/sicoob/boleto                     # Gerar boleto
GET    /api/sicoob/boleto/:nossoNumero        # Consultar boleto
GET    /api/sicoob/boletos                    # Listar boletos
DELETE /api/sicoob/boleto/:nossoNumero        # Cancelar boleto
GET    /api/sicoob/boleto/:nossoNumero/pdf    # Baixar PDF do boleto

POST   /api/sicoob/webhook                    # Receber webhooks (✅ com persistência)
```

### **Fluxo de Notificação Automatizada**

#### **1. Criação de Cobrança**
```typescript
// Backend Node registra cobrança no Supabase
await cobrancaDbService.criarCobranca({
  identificador: resultado.txid,
  tipo: 'PIX_IMEDIATA',
  pagador_whatsapp: '+5511999999999',
  valor_original: 100.00,
  qrcode_url: '...',
  metadados: { ... }
});
```

#### **2. Webhook Recebido**
```typescript
// Webhook service persiste evento e cria notificação
await this.persistirEvento(event, 'pix_received');
await this.atualizarStatusCobranca(txid, 'PAGO', { valor_pago: 100.00 });
await this.acionarNotificacao(txid, 'pagamento_recebido', dados);
```

#### **3. Processador Python Envia WhatsApp**
```python
# Script Python consome fila de notificações
processor = SicoobNotificationProcessor()
await processor.processar_notificacoes_pendentes()

# Envia mensagem formatada via WhatsApp
mensagem = self._template_pagamento_recebido(cobranca, dados)
await self.whatsapp_service.enviar_texto(whatsapp, mensagem)
```

### **Segurança**
- ✅ **OAuth 2.0** com refresh automático de tokens
- ✅ **mTLS** (certificados ICP-Brasil em base64)
- ✅ **HMAC SHA-256** para validação de webhooks
- ✅ **Timestamp validation** (tolerância de 5 minutos)
- ✅ **Rate limiting** (60 req/min padrão, 120 req/min webhooks)
- ✅ **Criptografia de dados sensíveis** no Supabase

### **Iniciar Processador de Notificações**
```bash
# Executar processador em loop contínuo
cd apps/backend/inss
python run_sicoob_processor.py

# Ou como job agendado (cron)
# */1 * * * * cd /path/to/inss && python run_sicoob_processor.py
```

### **Monitoramento**
```bash
# Verificar logs de webhook
SELECT * FROM sicoob_webhook_events ORDER BY criado_em DESC LIMIT 10;

# Verificar cobranças pendentes
SELECT * FROM sicoob_cobrancas WHERE status = 'PENDENTE';

# Verificar notificações na fila
SELECT * FROM sicoob_notificacoes WHERE status = 'PENDENTE';
```

## 🚀 Deploy e Produção

### **Frontend (Vercel)**
```bash
npm run build
vercel --prod
```

### **Backend (Railway)**
```bash
npm run build:backend
railway deploy
```

### **Banco (Supabase)**
```bash
supabase db push
supabase functions deploy
```

## 🏁 Próximos Passos - Homologação (Roadmap 2025)

### 🔴 **CRÍTICO - Fazer AGORA (Esta Semana)**

1. **Confirmar Endpoint NFSe com Receita Federal**
   - Status: ❌ BLOQUEADO
   - Impacto: Toda funcionalidade NFSe depende disso
   - Ação: Contato direto com ADN / Receita Federal
   - Prazo: 1-2 dias

2. **Obter Credenciais Reais**
   - Supabase production project
   - Twilio/WhatsApp Business credentials
   - Certificado digital A1 para testes
   - Prazo: 2-3 dias

3. **Testes End-to-End Completos**
   - Fluxo MEI: cadastro → emissão → PDF → WhatsApp
   - Fluxo Parceiro: cadastro → clientes → comissão
   - Fluxo Admin: certificado → emissão → relatório
   - Prazo: 3-4 dias
   - Ferramenta: Cypress.io

4. **Testes de Segurança (OWASP Top 10)**
   - SQL Injection, XSS, CSRF, Auth bypass
   - Rate limiting, API keys, SSL/TLS
   - Prazo: 2-3 dias
   - Prazo Estimado de Conclusão: **6-11 de novembro**

### 🟠 **ALTOS - Fazer Semana 2**

5. **Integração Frontend ↔ Backend**
   - Consumir APIs INSS (emitir, complementação)
   - Consumir APIs NFSe (quando endpoint confirmado)
   - Autenticação Supabase integrada
   - Prazo: 2-3 dias

6. **Performance & Load Testing**
   - 100-1000 usuários simultâneos
   - API response time <500ms (p95)
   - Database query optimization
   - Prazo: 2-3 dias

7. **Integração WhatsApp Business Real**
   - Webhook de produção configurado
   - Envio/recebimento testado
   - Fallback strategy implementada
   - Prazo: 2-3 dias

### 🟡 **MÉDIOS - Semana 3**

8. **Staging Environment Completo**
   - Docker Compose production-like
   - Todos os serviços integrados
   - Dados de teste inclusos

9. **CI/CD Pipeline**
   - GitHub Actions workflow
   - Lint + testes automáticos
   - Build Docker image
   - Deploy automático

10. **Monitoring & Alerting**
    - Logs centralizados (Datadog/ELK)
    - Métricas de aplicação
    - Alertas para downtime

---

## � Checklists Disponíveis

Este projeto inclui 3 checklists para homologação:

1. **`CHECKLIST_HOMOLOGACAO.md`** (109 itens)
   - Checklist completo e detalhado
   - Inclui status, prioridade, responsável
   - Para gestão de projeto formal

2. **`CHECKLIST_HOMOLOGACAO_RESUMIDO.md`** (executivo)
   - Visão geral do status (14% completo)
   - Top 3 riscos identificados
   - Próximas ações urgentes

3. **`PLANO_ACAO_HOMOLOGACAO.md`** (3 fases)
   - Plano de 15 dias para homologação
   - Fase 1: Desbloqueio (2-3 dias)
   - Fase 2: Validação (7-10 dias)
   - Fase 3: Produção (3-5 dias)
   - Estimativa: Go-live até **15 de novembro de 2025**

**Leia os documentos em:**
```
📄 CHECKLIST_HOMOLOGACAO.md
📄 CHECKLIST_HOMOLOGACAO_RESUMIDO.md
📄 PLANO_ACAO_HOMOLOGACAO.md
```

---

## 🔐 Segurança

### **Importante: Credenciais e Secrets**

**NUNCA commit secrets em código!**

✅ **Fazer:**
- Usar `.env` para desenvolvimento
- Usar Vault/Secrets Manager para produção
- Rotation automática de credentials

❌ **Não fazer:**
- Commit de `.env` com valores reais
- Hardcoding de API keys
- Compartilhar credenciais por email

**Proteção de Dados Sensíveis:**
- CPF/CNPJ: Criptografados com AES-256-GCM
- Certificados PFX: Senhas criptografadas
- PDFs: Armazenados em Supabase Storage (privado)
- Logs: Sem dados sensíveis

---

## 📞 Suporte e Documentação

---

**GuiasMEI** - Transformando a gestão fiscal através da tecnologia! 🚀

---

## 📊 STATUS DO PROJETO - OUTUBRO 2025

### 🟢 **Módulo INSS (Python/FastAPI) - PRODUÇÃO PRONTO**
- ✅ HTTP Endpoints funcionando (200 OK)
  - `POST /api/v1/guias/emitir` - Emissão de GPS
  - `POST /api/v1/guias/complementacao` - Complementação
  - `GET /` - Health check
- ✅ Cálculo GPS para: Autônomo, Doméstico, Produtor Rural, Facultativo
- ✅ Geração de PDF com ReportLab
- ✅ Logging completo (console + arquivo)
- ✅ 30+ testes unitários (ALL PASSING)
- ✅ Validação Pydantic V2 (sem erros)
- ✅ Integração Supabase (modo produção pronto)
- ✅ Lifespan context manager com error handling robusto
- ✅ DebugMiddleware para rastreamento HTTP completo
- ✅ Global exception handler

**Último Status:** Todas as correções HTTP 500 resolvidas (30/10/2025)

### 🟡 **Módulo NFSe (Node.js/Fastify) - PARCIALMENTE PRONTO**
- ✅ XML DPS gerado corretamente
- ✅ XSD validation passando (manual v1.2)
- ✅ Digital signature implementado
- ✅ Certificado digital: upload/storage/criptografia
- ❌ **BLOQUEADO**: Endpoint de homologação ADN não confirmado
- ❌ Testes E2E com governo não iniciados

**Ação Necessária:** Confirmar endpoint ADN com Receita Federal

### 🔴 **Frontend (React) - ESTRUTURA PRONTA**
- ✅ Rotas implementadas (Homepage, Cadastros, Dashboards)
- ✅ Design system com Tailwind CSS
- ✅ Componentes estruturados
- ❌ Integração com backend não validada
- ❌ Testes E2E não iniciados

### 📋 **Documentos Criados**
- 📄 `CHECKLIST_HOMOLOGACAO.md` - Checklist completo (109 itens)
- 📄 `CHECKLIST_HOMOLOGACAO_RESUMIDO.md` - Versão executiva
- 📄 `PLANO_ACAO_HOMOLOGACAO.md` - Plano 3 fases de 15 dias
- 📄 Documentação técnica em `docs/`

---

## Novos ajustes do backend (inss) – Atualização OUTUBRO 2025

### ✅ 1. Correção de HTTP 500 Errors (RESOLVIDO)

**Problema 1: Pydantic V1 em V2**
- ❌ Problema: `@validator` decorator não reconhecido
- ✅ Solução: Mudado para `@field_validator` com `@classmethod`
- 📁 Arquivo: `app/models/guia_inss.py`

**Problema 2: Duplicate Route Prefix (PRINCIPAL)**
- ❌ Problema: Rotas ficavam `/api/v1/api/v1/guias/...` (404)
- ✅ Solução: Removido prefix `/api/v1` do `include_router()` em `main.py` linha 187
- 📁 Arquivo: `app/main.py`

**Validação:**
```powershell
# Todos os endpoints retornando 200 OK:
POST /api/v1/guias/emitir           # 200 OK
POST /api/v1/guias/complementacao   # 200 OK
GET  /                               # 200 OK (health check)
```

### ✅ 2. Logging e Error Handling (IMPLEMENTADO)

**Infraestrutura de Logging:**
- Lifespan context manager (linhas 31-77)
- DebugMiddleware HTTP logging (linhas 80-109)
- Global exception handler
- Logs para console + arquivo (`app_debug.log`)
- DEBUG level para desenvolvimento
- Limpeza de caracteres Unicode para compatibilidade Windows

**Benefício:** Visibilidade completa de erros e fluxo de requisições

### ✅ 3. Atualização de Dependências Python

**Removidas (Obsoletas):**
- ❌ `gotrue` (incompatível com Supabase V2)

**Adicionadas/Atualizadas:**
- ✅ `supabase>=2.22.3`
- ✅ `fastapi>=0.120.1`
- ✅ `pydantic>=2.12.3`
- ✅ `reportlab>=4.0.9`

**Recomendação:** Criar novo `.venv` e rodar `pip install -r requirements.txt`

### ✅ 4. Configuração Pydantic V2

**Padrão Adotado:**
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        from_attributes=True  # V2 syntax
    )
```

**Validadores:**
```python
from pydantic import field_validator

class Model(BaseModel):
    @field_validator('field_name')
    @classmethod
    def validate_field(cls, v):
        return v
```

### ✅ 5. Supabase Client - Modo Produção

**Lazy Loading Implementado:**
```python
client = create_client(
    str(settings.supabase_url),
    settings.supabase_key
)
```

**Fallback Mode:**
- Sistema funciona completamente sem Supabase (modo mock)
- Respostas de exemplo retornadas se não conectado
- PDFs podem ser salvos localmente

### ✅ 6. Integração WhatsApp

**Fluxo:**
1. GPS gerado em PDF
2. PDF armazenado no Supabase Storage
3. Link público obtido
4. WhatsApp recebe link via Twilio
5. Conversa registrada no banco

**Mock Mode:**
- Funciona sem Twilio credentials
- Retorna respostas simuladas

### 7. Testes e Validação

**Testes Existentes:**
```
✅ 30+ testes unitários (ALL PASSING)
✅ 3 testes HTTP endpoints (200 OK)
✅ Teste de conformidade INSS
✅ Teste de geração PDF
✅ Teste de cálculo GPS
```

**Rodando Testes:**
```powershell
cd "apps/backend/inss"
.\.venv\Scripts\python.exe -m pytest tests/ -v

# Ou testes específicos:
.\.venv\Scripts\python.exe test_00_sumario_final.py
.\.venv\Scripts\python.exe test_07_requisicoes_http.py
```

### 8. Executando Backend Local

**Opção 1: Desenvolvimento (com reload)**
```powershell
cd "apps/backend/inss"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Opção 2: Produção (sem reload)**
```powershell
cd "apps/backend/inss"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Acesso:**
- API Swagger: `http://localhost:8000/docs`
- Health: `http://localhost:8000/`
- GPS Emission: `POST http://localhost:8000/api/v1/guias/emitir`

### 9. Troubleshooting

**Problema: ModuleNotFoundError**
```powershell
# Solução:
cd "apps/backend/inss"
.\.venv\Scripts\pip.exe install -r requirements.txt
```

**Problema: Port 8000 em uso**
```powershell
# Matar processo Python:
Stop-Process -Name python -Force -ErrorAction SilentlyContinue

# Usar porta diferente:
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 9000
```

**Problema: Certificado SSL/TLS**
```powershell
# Para desenvolvimento local (desabilitar verificação):
$env:PYTHONHTTPSVERIFY=0
```

### 10. Boas Práticas

**Após Alterar requirements.txt:**
```powershell
# Reinstalar:
pip install -r requirements.txt --upgrade

# Verificar pacotes:
pip list
```

**Mantendo Código Limpo:**
```powershell
# Remover venv antiga (se necessário):
Remove-Item -Recurse -Force .venv

# Criar nova:
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Commits Importantes:**
- `df0a383` - HTTP 500 fixes (Pydantic + Route prefix)
- Todos os testes passing após este commit

---

## 📚 Documentação Relacionada

Veja também:
- `docs/guia-aplicativo-guiasMEI.md` - Documentação técnica completa
- `CHECKLIST_HOMOLOGACAO.md` - Checklist com 109 itens
- `CHECKLIST_HOMOLOGACAO_RESUMIDO.md` - Versão executiva
- `PLANO_ACAO_HOMOLOGACAO.md` - Plano de 3 fases para homologação
- `apps/backend/inss/README.md` - README específico do módulo INSS

---