-- Migration: Criar tabela para logs de testes Sicoob (PIX e Boleto)
-- Data: 31/10/2025

-- Criar tabela de logs de testes
create table if not exists public.sicoob_test_logs (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  ambiente text not null,
  categoria text not null,
  tipo_teste text not null,
  dados_resposta jsonb not null,
  created_at timestamptz not null default now()
);

-- Criar índices para consultas frequentes
create index if not exists idx_sicoob_test_logs_timestamp on public.sicoob_test_logs (timestamp desc);
create index if not exists idx_sicoob_test_logs_categoria on public.sicoob_test_logs (categoria);
create index if not exists idx_sicoob_test_logs_tipo_teste on public.sicoob_test_logs (tipo_teste);
create index if not exists idx_sicoob_test_logs_ambiente on public.sicoob_test_logs (ambiente);

-- Comentários para documentação
comment on table public.sicoob_test_logs is 'Logs de testes de integração Sicoob (PIX e Boleto)';
comment on column public.sicoob_test_logs.timestamp is 'Data/hora do teste executado';
comment on column public.sicoob_test_logs.ambiente is 'Ambiente: sandbox ou production';
comment on column public.sicoob_test_logs.categoria is 'Categoria do teste: pix, boleto, webhook';
comment on column public.sicoob_test_logs.tipo_teste is 'Tipo específico: cob_imediata, cob_vencimento, boleto_gerado, etc';
comment on column public.sicoob_test_logs.dados_resposta is 'Resposta completa da API em formato JSON';

-- Habilitar RLS (Row Level Security)
alter table public.sicoob_test_logs enable row level security;

-- Política: Admin pode ler todos os logs
create policy "Admin pode ler logs de testes Sicoob"
  on public.sicoob_test_logs
  for select
  using (auth.jwt() ->> 'role' = 'admin' or auth.jwt() ->> 'role' = 'service_role');

-- Política: Service role pode inserir logs
create policy "Service role pode inserir logs de testes"
  on public.sicoob_test_logs
  for insert
  with check (true);
