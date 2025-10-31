-- SQL para criar tabelas faltantes

-- Tabela de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(255),
    cpf VARCHAR(14),
    nit VARCHAR(20),
    tipo_contribuinte VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp ON usuarios(whatsapp);
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON usuarios(cpf);

-- Tabela de guias INSS
CREATE TABLE IF NOT EXISTS guias_inss (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_gps VARCHAR(10) NOT NULL,
    competencia VARCHAR(7) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    pdf_url TEXT,
    data_vencimento DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guias_usuario ON guias_inss(usuario_id);
CREATE INDEX IF NOT EXISTS idx_guias_status ON guias_inss(status);
CREATE INDEX IF NOT EXISTS idx_guias_competencia ON guias_inss(competencia);

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
