GuiasMEI – Guia Completo do Sistema
1. Resumo Executivo
O GuiasMEI é uma plataforma full-stack voltada para microempreendedores, autônomos e parceiros contábeis. O objetivo é automatizar a rotina fiscal (emissão de GPS e NFSe, monitoramento, comissões) promovendo atendimento integrado via web e WhatsApp com apoio de IA.

Status atual
Concluído: Autenticação Supabase, dashboards (usuário, parceiro e admin), 5 telas administrativas NFSe, painel de parceiro redesenhado, backend modular Fastify, criptografia sensível (AES-256-GCM), integrações básicas (Supabase, Stripe/PIX esqueleto).
Em andamento: Integração real com o emissor nacional de NFSe, testes ponta a ponta, automação WhatsApp Business, IA especializada.
 - Endpoints alinhados ao Swagger oficial (POST https://sefin.nfse.gov.br/sefinnacional/nfse, GET /danfse/{chave}, parâmetros em /parametros_municipais) aguardando reteste com ambiente Sefin.
Planejado: Monitoramento completo, deploy definitivo, automação por voz, multi-tenant, app mobile e marketplace.
2. Arquitetura
Visão geral
Frontend: React 18 + Vite, React Router, Tailwind. Componentização e design system próprio.
Backend: Node.js + Fastify + TypeScript. Schemas com Zod, Axios para integrações.
Banco: Supabase (PostgreSQL + Auth + Storage) com políticas RLS e migrações versionadas.
Infra: Vercel (frontend), Railway (backend), Supabase Cloud. CI/CD planejado via GitHub Actions.
Princípios: separação de responsabilidades, segurança, escalabilidade, manutenibilidade e performance.
Camadas
Apresentação: interface web responsiva, dashboards específicos e simulador de WhatsApp.
Integração: autenticação (Supabase Auth), pagamentos (Stripe/PIX), WhatsApp, emissor nacional (ADN).
Negócio: módulos do backend (Auth, Dashboards, NFSe, GPS, Pagamentos, IA, WhatsApp, Parceiros, Auditoria).
Persistência: tabelas Supabase, buckets de storage, logs e auditoria.
Orquestração: filas e workers (BullMQ), monitoramento (padrão previsto com Grafana/Sentry) e automações agendadas.
3. Perfis de usuário e fluxos
Perfil	Fluxo principal	Funcionalidades chave	Status
MEI	Landing → cadastro → atendimento WhatsApp	Emissão GPS, NFSe via comandos/IA	Cadastro pronto; IA/WhatsApp em desenvolvimento
Autônomo	Landing → cadastro → atendimento WhatsApp	Emissão GPS e suporte fiscal	Cadastro pronto; IA/WhatsApp em desenvolvimento
Parceiro	Landing → cadastro → dashboard web	Gestor de clientes, links de convite, comissões	Dashboard funcional e renovado
Administrador	Login direto → dashboard admin	Gestão de usuários, NFSe (5 telas), configurações	Implementado
4. Módulo NFSe
Estrutura implementada
Gestão de certificados digitais (upload, armazenamento seguro, validação).
Monitoramento de emissões e relatórios.
Configurações de integração com ADN.
Logs e auditoria específicos.
APIs para emissão, consulta de status e download de DANFSe.
Checklist pré-produção (principal)
Carregar certificado A1 válido do contribuinte (PFX com chave e cadeia).
Confirmar variáveis de ambiente (NFSE_BASE_URL, NFSE_CONTRIBUINTES_BASE_URL, NFSE_PARAMETROS_BASE_URL, NFSE_DANFSE_BASE_URL, NFSE_CERT_* etc.).
Homologar emissão com ADN (ambiente pr ou produção).
Testar status polling e download de PDF.
Validar armazenamento de PDFs no Supabase.
Configurar alertas/logs.
Garantir fallback seguro e rotinas de autenticação.
Fluxo de emissão (resumo)
1. Usuário aciona (via WhatsApp ou dashboard).
2. Backend valida dados e prepara XML.
3. XML é assinado (certificado A1).
4. Payload é enviado ao ADN NFSe.
5. Sistema armazena protocolo, monitora status e baixa PDF.
6. Usuário recebe retorno (WhatsApp ou painel).
5. Segurança e compliance
Criptografia: AES-256-GCM para dados sensíveis (CPF, CNPJ, senhas de PFX). Tráfego via HTTPS.
Autenticação: Supabase Auth, políticas RLS por perfil.
Segregação: chaves e segredos em Vault/Supabase, logs de auditoria.
Certificados: armazenamento em bucket com chaves criptografadas; validação de validade/doc.
Compliance: LGPD, boas práticas OECD/OCDE, monitoramento de acessos.
6. Integrações
Serviço/Integração	Status	Observações
Supabase Auth/DB/storage	Concluído	RLS, migrações, buckets para PDFs/certs
Stripe & PIX	Estrutura básica	Falta integrar Webhooks e checkout
WhatsApp Business API	Em andamento	Simulador implementado; integração real pendente
ADN NFSe (Receita Federal)	Em desenvolvimento	Estrutura pronta; finais testes/homologação pendentes
IA Atendimento	Planejado	Especialização fiscal e automação de comandos
Monitoramento (Grafana/sentry)	Planejado	Logs estruturados prontos, faltam dashboards/alertas
7. Monitoramento e métricas (planejado)
KPIs de negócio: usuários ativos, parceiros, emissões, receita e comissões.
KPIs técnicos: tempo de resposta (<200ms), disponibilidade (99,9%), error rate (<0,1%), throughput (≥1000 req/s).
Alertas previstos: falhas API (Slack/e-mail), uso de CPU, erros de pagamento, expiração de certificado.
Logs estruturados: Fastify + pino (JSON), rastreabilidade de requisições e auditoria.
8. Roadmap técnico
Fase 1 – Fundação (concluída)
Arquitetura base, frontend/backend completos, Supabase, dashboards, telas NFSe.

Fase 2 – NFSe real (em andamento)
Integração ADN, testes E2E, monitoramento, storage de PDFs, suporte a certificados com fallback seguro.

Fase 3 – WhatsApp + IA (planejada)
Conectar WhatsApp Business, treinar IA fiscal, automação de comandos, disparos de lembretes.

Fase 4 – Escala (futuro)
Multi-tenant, API pública, aplicativos mobile, marketplace de serviços.

9. Operação e deploy
Ambientes: development (local), staging (Vercel/Railway/Supabase), production (configuração final pendente).
CI/CD: pipeline GitHub Actions planejado (checkout, lint, testes, deploy).
Backups: automáticos no Supabase, replicação em múltiplas regiões, versionamento Git.
Procedimentos:
Atualização de certificados: reexportar PFX válido, atualizar .env/secret e reiniciar backend.
Emissão manual de teste: preparar XML via scripts (scripts/generate-dps.js e scripts/sign-dps.mjs), chamar /nfse/test-sim, montar payload (payload.json) e enviar via Invoke-RestMethod.
Suporte NFSe: coletar XML assinado, JSON da requisição e resposta da Sefin – base para abertura de chamado.
10. Próximos passos imediatos
Homologar emissão: repetir fluxo com certificado correto e payload real; coletar logs.
Ajustar endpoints ADN: preencher todos os NFSE_*_BASE_URL.
Implementar monitoramento: definir alertas básicos (expiração de certificados, falhas NFSe).
WhatsApp: concluir integração oficial e roteamento das respostas da IA.
Documentação: migrar este guia para docs/guia-aplicativo-guiasMEI.md e arquivar os arquivos anteriores para evitar redundância.
Este guia unifica as informações de arquitetura, funcionalidades, integrações, segurança, operação e roadmap do GuiasMEI. Ao manter apenas esse documento dentro da pasta docs/, garantimos que toda a equipe tenha uma referência única e atualizada do projeto.
