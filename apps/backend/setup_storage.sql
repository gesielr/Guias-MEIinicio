-- Setup de Buckets Supabase Storage para GuiasMEI
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Criar buckets (via Storage API, não SQL diretamente)
-- Os buckets devem ser criados via Dashboard ou Supabase Client
-- 
-- Para criar via CLI:
-- supabase storage create pdf-gps --public false
-- supabase storage create certificados --public false
-- supabase storage create danfse --public false

-- 2. Criar tabela de auditoria para uploads
CREATE TABLE IF NOT EXISTS storage_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    file_size INTEGER,
    content_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ok'
);

CREATE INDEX IF NOT EXISTS idx_storage_audit_bucket ON storage_audit(bucket_name);
CREATE INDEX IF NOT EXISTS idx_storage_audit_usuario ON storage_audit(usuario_id);

-- 3. Habilitar RLS na tabela de auditoria
ALTER TABLE storage_audit ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de segurança (RLS)
-- Usuários podem ver seus próprios uploads
CREATE POLICY "Usuarios podem ver seus uploads"
    ON storage_audit
    FOR SELECT
    USING (auth.uid() = usuario_id);

-- Admin pode ver tudo
CREATE POLICY "Admin pode ver todos os uploads"
    ON storage_audit
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. Função para registrar uploads
CREATE OR REPLACE FUNCTION registrar_upload(
    bucket VARCHAR(255),
    file_path TEXT,
    file_size INTEGER,
    content_type VARCHAR(100)
) RETURNS void AS $$
BEGIN
    INSERT INTO storage_audit (
        bucket_name,
        file_path,
        usuario_id,
        file_size,
        content_type
    ) VALUES (
        bucket,
        file_path,
        auth.uid(),
        file_size,
        content_type
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Atualizar tabela de conversas para referenciar arquivos
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS xml_url TEXT;

-- 7. Extensão para geração de UUIDs (se não estiver habilitada)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Confirmar setup
SELECT 'Storage setup concluído!' AS resultado;
