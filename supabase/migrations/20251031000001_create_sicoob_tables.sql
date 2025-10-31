-- Tabela para registrar cobranças do Sicoob (PIX e Boleto)
CREATE TABLE IF NOT EXISTS public.sicoob_cobrancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Identificador da cobrança (txid para PIX, nossoNumero para Boleto)
    identificador TEXT NOT NULL UNIQUE,
    
    -- Tipo de cobrança
    tipo TEXT NOT NULL CHECK (tipo IN ('PIX_IMEDIATA', 'PIX_VENCIMENTO', 'BOLETO')),
    
    -- Status da cobrança
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO', 'DEVOLVIDO')),
    
    -- Dados do pagador
    pagador_nome TEXT,
    pagador_cpf_cnpj TEXT,
    pagador_whatsapp TEXT,
    
    -- Valores
    valor_original DECIMAL(10, 2) NOT NULL,
    valor_pago DECIMAL(10, 2),
    
    -- Datas
    data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_vencimento DATE,
    data_pagamento TIMESTAMPTZ,
    data_cancelamento TIMESTAMPTZ,
    
    -- URLs e recursos
    qrcode_url TEXT,
    qrcode_base64 TEXT,
    pdf_url TEXT,
    linha_digitavel TEXT,
    
    -- Histórico e metadados
    historico JSONB DEFAULT '[]'::jsonb,
    metadados JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sicoob_cobrancas_user_id ON public.sicoob_cobrancas(user_id);
CREATE INDEX idx_sicoob_cobrancas_identificador ON public.sicoob_cobrancas(identificador);
CREATE INDEX idx_sicoob_cobrancas_status ON public.sicoob_cobrancas(status);
CREATE INDEX idx_sicoob_cobrancas_tipo ON public.sicoob_cobrancas(tipo);
CREATE INDEX idx_sicoob_cobrancas_pagador_whatsapp ON public.sicoob_cobrancas(pagador_whatsapp);

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_sicoob_cobrancas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sicoob_cobrancas_updated_at
    BEFORE UPDATE ON public.sicoob_cobrancas
    FOR EACH ROW
    EXECUTE FUNCTION update_sicoob_cobrancas_updated_at();

-- Tabela para eventos de webhook
CREATE TABLE IF NOT EXISTS public.sicoob_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id TEXT NOT NULL,
    tipo_evento TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    dados JSONB NOT NULL,
    processado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sicoob_webhook_events_evento_id ON public.sicoob_webhook_events(evento_id);
CREATE INDEX idx_sicoob_webhook_events_tipo_evento ON public.sicoob_webhook_events(tipo_evento);

-- Tabela para notificações pendentes
CREATE TABLE IF NOT EXISTS public.sicoob_notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identificador_cobranca TEXT NOT NULL,
    tipo_notificacao TEXT NOT NULL,
    dados_notificacao JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ENVIADA', 'FALHOU')),
    tentativas INTEGER DEFAULT 0,
    ultima_tentativa TIMESTAMPTZ,
    erro_mensagem TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processado_em TIMESTAMPTZ
);

CREATE INDEX idx_sicoob_notificacoes_status ON public.sicoob_notificacoes(status);
CREATE INDEX idx_sicoob_notificacoes_identificador ON public.sicoob_notificacoes(identificador_cobranca);

-- Tabela para logs de teste (usada pelos scripts de teste)
CREATE TABLE IF NOT EXISTS public.sicoob_test_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_teste TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('pix', 'boleto', 'auth')),
    dados_resposta JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    ambiente TEXT NOT NULL CHECK (ambiente IN ('sandbox', 'production')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sicoob_test_logs_categoria ON public.sicoob_test_logs(categoria);
CREATE INDEX idx_sicoob_test_logs_ambiente ON public.sicoob_test_logs(ambiente);

-- RLS (Row Level Security)
ALTER TABLE public.sicoob_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sicoob_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sicoob_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sicoob_test_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para sicoob_cobrancas
CREATE POLICY "Usuários podem ver suas próprias cobranças"
    ON public.sicoob_cobrancas
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role pode inserir cobranças"
    ON public.sicoob_cobrancas
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role pode atualizar cobranças"
    ON public.sicoob_cobrancas
    FOR UPDATE
    USING (true);

-- Políticas para sicoob_webhook_events (somente service role)
CREATE POLICY "Service role pode inserir eventos"
    ON public.sicoob_webhook_events
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role pode ler eventos"
    ON public.sicoob_webhook_events
    FOR SELECT
    USING (true);

-- Políticas para sicoob_notificacoes (somente service role)
CREATE POLICY "Service role pode gerenciar notificações"
    ON public.sicoob_notificacoes
    FOR ALL
    USING (true);

-- Políticas para sicoob_test_logs (somente service role)
CREATE POLICY "Service role pode gerenciar logs de teste"
    ON public.sicoob_test_logs
    FOR ALL
    USING (true);

-- Comentários para documentação
COMMENT ON TABLE public.sicoob_cobrancas IS 'Registra todas as cobranças criadas via Sicoob (PIX e Boleto)';
COMMENT ON TABLE public.sicoob_webhook_events IS 'Armazena eventos recebidos via webhook do Sicoob';
COMMENT ON TABLE public.sicoob_notificacoes IS 'Fila de notificações para serem enviadas via WhatsApp';
COMMENT ON TABLE public.sicoob_test_logs IS 'Logs dos testes de integração com Sicoob';
