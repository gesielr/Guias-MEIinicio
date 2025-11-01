-- Seed inicial do provedor de certificados (Certisign)
-- Observação: segredos (api_key_encrypted, webhook_secret) devem ser gerenciados via ambiente/KMS, não em migrações.

INSERT INTO public.cert_providers (nome, api_base_url, api_key_encrypted, webhook_secret, ativo)
VALUES (
  'Certisign',
  'https://api.certisign.com.br',
  NULL,
  NULL,
  TRUE
)
ON CONFLICT (nome) DO NOTHING;
