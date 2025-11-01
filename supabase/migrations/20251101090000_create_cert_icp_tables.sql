-- Certificado Digital ICP-Brasil: Tabelas base (providers, enrollments, sign requests, auditoria, pagamentos)
-- Observação de compliance: NUNCA armazenar PFX/chave privada/senha. Somente metadados do certificado e logs.

-- Tabela de certificadoras/provedores (ex.: Certisign)
CREATE TABLE IF NOT EXISTS public.cert_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    api_base_url TEXT NOT NULL,
    api_key_encrypted TEXT, -- armazenar criptografado (AES-256, KMS externo)
    webhook_secret TEXT, -- segredo para validar callbacks (HMAC)
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cert_providers_nome UNIQUE (nome)
);

CREATE INDEX IF NOT EXISTS idx_cert_providers_ativo ON public.cert_providers(ativo);

-- Tabela de vínculos de certificado com usuário (sem material sigiloso)
CREATE TABLE IF NOT EXISTS public.cert_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.cert_providers(id),

    -- Metadados do certificado (NÃO armazenar PFX/chave privada)
    external_cert_id VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,              -- Ex.: CN=NOME:CPF/CNPJ
    serial_number VARCHAR(255) NOT NULL,
    thumbprint VARCHAR(255) NOT NULL,   -- SHA-256

    -- Validade
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','EXPIRED','REVOKED')),

    -- Auditoria
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_cert_enrollments_external_cert_id UNIQUE (external_cert_id)
);

CREATE INDEX IF NOT EXISTS idx_cert_enrollments_user ON public.cert_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_enrollments_status ON public.cert_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_cert_enrollments_validity ON public.cert_enrollments(valid_until) WHERE status = 'ACTIVE';

-- Tabela de solicitações de assinatura remota
CREATE TABLE IF NOT EXISTS public.sign_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES public.cert_enrollments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contexto do documento
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('DPS','EVENTO_NFSE','CANCELAMENTO')),
    document_id UUID,

    -- Hash a ser assinado
    hash_algorithm VARCHAR(20) NOT NULL DEFAULT 'SHA256' CHECK (hash_algorithm IN ('SHA256','SHA512')),
    hash_value TEXT NOT NULL,

    -- Identificador externo e QRCode (retornados pela certificadora)
    external_sign_id TEXT,
    qr_code_url TEXT,

    -- Resposta da certificadora
    signature_value TEXT,        -- Base64 (DER/PKCS#1)
    signature_algorithm VARCHAR(50), -- Ex.: RSA-SHA256

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),

    -- Consentimento do usuário
    user_consent_at TIMESTAMPTZ,
    user_ip VARCHAR(45),
    user_agent TEXT,

    -- Timestamps
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sign_requests_enrollment ON public.sign_requests(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_sign_requests_status ON public.sign_requests(status);
CREATE INDEX IF NOT EXISTS idx_sign_requests_expires ON public.sign_requests(expires_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_sign_requests_external ON public.sign_requests(external_sign_id);

-- Tabela de auditoria (LGPD)
CREATE TABLE IF NOT EXISTS public.sign_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sign_request_id UUID NOT NULL REFERENCES public.sign_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES public.cert_enrollments(id),

    event_type VARCHAR(100) NOT NULL, -- REQUEST_CREATED | USER_APPROVED | SIGNATURE_RECEIVED | ...
    event_data JSONB DEFAULT '{}'::jsonb,

    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sign_audit_user ON public.sign_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sign_audit_timestamp ON public.sign_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_sign_audit_event_type ON public.sign_audit_logs(event_type);

-- Tabela de pagamentos para certificado digital (via PIX Sicoob)
CREATE TABLE IF NOT EXISTS public.payment_cert_digital (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Relacionamento com cobrança Sicoob (opcional, facilita JOIN)
    sicoob_cobranca_id UUID REFERENCES public.sicoob_cobrancas(id) ON DELETE SET NULL,

    -- PIX
    txid VARCHAR(255) NOT NULL UNIQUE,
    qr_code TEXT NOT NULL,
    valor DECIMAL(10,2) NOT NULL DEFAULT 150.00,

    -- Status do pagamento
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','EXPIRED','CANCELLED')),
    paid_at TIMESTAMPTZ,

    -- Vincular ao enrollment quando ativo
    enrollment_id UUID REFERENCES public.cert_enrollments(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_cert_user ON public.payment_cert_digital(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_cert_status ON public.payment_cert_digital(status);
CREATE INDEX IF NOT EXISTS idx_payment_cert_enrollment ON public.payment_cert_digital(enrollment_id);

-- Triggers para updated_at (reutiliza função pública já existente se criada anteriormente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

CREATE TRIGGER trg_updated_at_cert_providers
  BEFORE UPDATE ON public.cert_providers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_updated_at_cert_enrollments
  BEFORE UPDATE ON public.cert_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_updated_at_sign_requests
  BEFORE UPDATE ON public.sign_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_updated_at_payment_cert_digital
  BEFORE UPDATE ON public.payment_cert_digital
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.cert_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cert_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_cert_digital ENABLE ROW LEVEL SECURITY;

-- Políticas: cert_providers (somente service role/servidor - nenhuma policy de SELECT para usuários comuns)
-- Observação: o service key do Supabase ignora RLS, portanto não é necessário expor políticas permissivas aqui.

-- Políticas: cert_enrollments
CREATE POLICY "Usuário pode ver seus próprios enrollments"
  ON public.cert_enrollments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas: sign_requests
CREATE POLICY "Usuário pode ver suas próprias solicitações de assinatura"
  ON public.sign_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas: sign_audit_logs
CREATE POLICY "Usuário pode ver logs próprios"
  ON public.sign_audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Políticas: payment_cert_digital
CREATE POLICY "Usuário pode ver seus próprios pagamentos de certificado"
  ON public.payment_cert_digital
  FOR SELECT
  USING (auth.uid() = user_id);

-- Comentários (documentação)
COMMENT ON TABLE public.cert_providers IS 'Provedores de certificado digital (ex.: Certisign). Armazena apenas metadados e segredos de integração.';
COMMENT ON TABLE public.cert_enrollments IS 'Vínculo de certificado digital com usuário. Somente metadados; nunca armazena material sensível.';
COMMENT ON TABLE public.sign_requests IS 'Solicitações de assinatura remota (hashes, status, valores de assinatura e expirabilidade).';
COMMENT ON TABLE public.sign_audit_logs IS 'Logs de auditoria para consentimento, aprovação e eventos relacionados à assinatura (LGPD).';
COMMENT ON TABLE public.payment_cert_digital IS 'Pagamentos para emissão de certificado digital (PIX Sicoob).';
