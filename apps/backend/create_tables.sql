-- SQL para criar tabelas faltantes

-- Tabela de conversas (IA)
CREATE TABLE IF NOT EXISTS conversas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    mensagem TEXT NOT NULL,
    resposta TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON conversas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_conversas_created ON conversas(created_at DESC);
