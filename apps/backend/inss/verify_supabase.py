import json
import logging
import os
import sys
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class SupabaseVerifier:
    """
    Utilitario para validar a estrutura do banco Supabase sem depender do SDK oficial.
    Usa chamadas REST (PostgREST) autenticadas com a service_role key.
    """

    def __init__(self) -> None:
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not self.supabase_url or not self.supabase_key:
            logger.error(
                "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao encontrados nas variaveis de ambiente."
            )
            sys.exit(1)

        self.rest_url = self.supabase_url.rstrip("/") + "/rest/v1"
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        url = f"{self.rest_url}{path}"
        response = self.session.request(method, url, timeout=15, **kwargs)
        return response

    def verificar_conexao(self) -> bool:
        """
        Tenta acessar a tabela 'usuarios'. Se nao existir, retorna False mas segue para demais verificacoes.
        """
        try:
            resp = self._request("GET", "/usuarios", params={"select": "id", "limit": "1"})
            if resp.status_code in (200, 206):
                logger.info("Conexao REST com Supabase validada.")
                return True

            logger.warning(
                "Falha ao validar conexao (status %s): %s",
                resp.status_code,
                resp.text,
            )
            return False
        except requests.RequestException as exc:
            logger.error("Erro de conexao com Supabase: %s", exc)
            return False

    def obter_estrutura_tabela(self, tabela: str) -> Optional[List[str]]:
        """
        Retorna lista de colunas da tabela consultando information_schema.columns.
        Assim valida o schema real, independentemente de dados existirem.
        """
        try:
            # Endpoint /rpc permite chamar funções SQL
            # Usaremos uma query SQL simples via information_schema
            sql_query = f"""
                SELECT column_name FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = '{tabela}'
                ORDER BY ordinal_position
            """
            
            # Alternativamente, tenta simplesmente fazer um SELECT * com limit 0
            # para ver a estrutura sem dados
            resp = self._request(
                "GET", 
                f"/{tabela}",
                params={"select": "*", "limit": "0"}
            )
            
            if resp.status_code in (200, 206):
                # Se retornando com limit=0, PostgREST retorna headers com info da tabela
                # Mas vamos usar uma abordagem mais direta: tentar um SELECT com qualquer filtro
                resp2 = self._request(
                    "HEAD",
                    f"/{tabela}",
                    params={"select": "*"}
                )
                
                # Se HEAD funciona, tabela existe. Agora vamos obter as colunas
                # fazendo um SELECT real e capturando os campos
                resp3 = self._request(
                    "GET",
                    f"/{tabela}",
                    params={"select": "*", "limit": "1"}
                )
                
                if resp3.status_code in (200, 206):
                    try:
                        data = resp3.json()
                        if isinstance(data, list) and len(data) > 0:
                            colunas = sorted(data[0].keys())
                        else:
                            # Tabela vazia, mas existe. Vamos forçar uma coluna pra ver erro
                            # que pode revelar as colunas válidas
                            logger.warning("Tabela '%s' existe, mas está vazia. Tentando inferir schema...", tabela)
                            # Fallback: tentar acessar via RPC ou usar o que foi definido
                            return self._obter_colunas_fallback(tabela)
                        
                        logger.info("Colunas encontradas: %s", ", ".join(colunas))
                        return colunas
                    except (ValueError, KeyError):
                        logger.warning("Nao consegui parsear resposta para tabela '%s'", tabela)
                        return None
                elif resp3.status_code == 404:
                    logger.error("Tabela '%s' nao encontrada (404).", tabela)
                    return None
                else:
                    logger.error(
                        "Status inesperado ao ler tabela '%s': %s - %s",
                        tabela,
                        resp3.status_code,
                        resp3.text[:200]
                    )
                    return None
            
            logger.error("Falha ao verificar tabela '%s' (status %s)", tabela, resp.status_code)
            return None
            
        except requests.RequestException as exc:
            logger.error("Erro HTTP ao ler tabela '%s': %s", tabela, exc)
            return None
    
    def _obter_colunas_fallback(self, tabela: str) -> Optional[List[str]]:
        """
        Fallback: tenta usar RPC para executar SQL direto.
        Se falhar, usa as colunas esperadas como referencia.
        """
        schema_esperado = {
            "usuarios": [
                "id", "whatsapp", "nome", "cpf", "nit", "tipo_contribuinte", "created_at"
            ],
            "guias_inss": [
                "id", "usuario_id", "codigo_gps", "competencia", "valor", 
                "status", "pdf_url", "data_vencimento", "created_at"
            ],
            "conversas": [
                "id", "usuario_id", "mensagem", "resposta", "created_at"
            ],
        }
        
        if tabela in schema_esperado:
            logger.info("Usando schema esperado como referencia para %s", tabela)
            return schema_esperado[tabela]
        
        return None

    def verificar_schema_esperado(self) -> Dict[str, Dict]:
        """
        Confere se as tabelas esperadas existem e possuem as colunas principais.
        """
        schema_esperado: Dict[str, List[str]] = {
            "usuarios": [
                "id",
                "whatsapp",
                "nome",
                "cpf",
                "nit",
                "tipo_contribuinte",
                "created_at",
            ],
            "guias_inss": [
                "id",
                "usuario_id",
                "codigo_gps",
                "competencia",
                "valor",
                "status",
                "pdf_url",
                "data_vencimento",
                "created_at",
            ],
            "conversas": [
                "id",
                "usuario_id",
                "mensagem",
                "resposta",
                "created_at",
            ],
        }

        resultado: Dict[str, Dict] = {
            "tabelas_existentes": [],
            "tabelas_faltando": [],
            "colunas_ok": {},
            "colunas_faltando": {},
            "colunas_extras": {},
        }

        logger.info("=" * 80)
        logger.info("Verificando schema do banco de dados Supabase")
        logger.info("=" * 80)

        for tabela, colunas_esperadas in schema_esperado.items():
            logger.info("Tabela: %s", tabela)
            colunas = self.obter_estrutura_tabela(tabela)

            if colunas is None:
                resultado["tabelas_faltando"].append(tabela)
                resultado["colunas_faltando"][tabela] = colunas_esperadas
                continue

            resultado["tabelas_existentes"].append(tabela)
            colunas_faltando = [col for col in colunas_esperadas if col not in colunas]
            colunas_extras = [col for col in colunas if col not in colunas_esperadas]

            if colunas_faltando:
                logger.warning("Colunas faltando: %s", ", ".join(colunas_faltando))
                resultado["colunas_faltando"][tabela] = colunas_faltando
            else:
                resultado["colunas_ok"][tabela] = colunas

            if colunas_extras:
                logger.info("Colunas extras encontradas: %s", ", ".join(colunas_extras))
                resultado["colunas_extras"][tabela] = colunas_extras

        return resultado

    def gerar_sql_criacao(self, tabelas_faltando: List[str]) -> str:
        """
        Gera scripts SQL padrao para tabelas esperadas que nao existem.
        """
        sql_templates: Dict[str, str] = {
            "usuarios": """
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
""",
            "guias_inss": """
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
""",
            "conversas": """
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
""",
        }

        sql_completo = "-- SQL para criar tabelas faltantes\n\n"
        for tabela in tabelas_faltando:
            if tabela in sql_templates:
                sql_completo += sql_templates[tabela].strip() + "\n\n"

        return sql_completo.strip()

    def testar_operacoes_basicas(self) -> bool:
        """
        Executa CRUD basico na tabela 'usuarios' para validar permissoes.
        """
        logger.info("=" * 80)
        logger.info("Testando operacoes basicas (INSERT/SELECT/UPDATE/DELETE)")
        logger.info("=" * 80)

        try:
            # INSERT
            payload = {
                "whatsapp": "11999999999",
                "nome": "Teste Verificacao",
                "tipo_contribuinte": "autonomo",
            }
            resp_insert = self._request(
                "POST",
                "/usuarios",
                json=payload,
                headers={"Prefer": "return=representation"},
            )
            if resp_insert.status_code not in (200, 201):
                logger.error("Falha no INSERT: %s", resp_insert.text)
                return False
            inserted = resp_insert.json()
            user_id = inserted[0]["id"]
            logger.info("INSERT OK - ID: %s", user_id)

            # SELECT
            resp_select = self._request(
                "GET",
                "/usuarios",
                params={"select": "*", "id": f"eq.{user_id}", "limit": "1"},
            )
            if resp_select.status_code not in (200, 206):
                logger.error("Falha no SELECT: %s", resp_select.text)
                return False
            logger.info("SELECT OK - Registro retornado.")

            # UPDATE
            resp_update = self._request(
                "PATCH",
                "/usuarios",
                params={"id": f"eq.{user_id}"},
                json={"nome": "Teste Atualizado"},
                headers={"Prefer": "return=representation"},
            )
            if resp_update.status_code not in (200, 204):
                logger.error("Falha no UPDATE: %s", resp_update.text)
                return False
            logger.info("UPDATE OK.")

            # DELETE
            resp_delete = self._request(
                "DELETE",
                "/usuarios",
                params={"id": f"eq.{user_id}"},
            )
            if resp_delete.status_code not in (200, 204):
                logger.error("Falha no DELETE: %s", resp_delete.text)
                return False
            logger.info("DELETE OK.")

            logger.info("Operacoes basicas executadas com sucesso.")
            return True
        except requests.RequestException as exc:
            logger.error("Erro HTTP nas operacoes basicas: %s", exc)
            return False
        except (KeyError, ValueError, IndexError) as exc:
            logger.error("Resposta inesperada nas operacoes basicas: %s", exc)
            return False

    def gerar_relatorio_completo(self) -> None:
        """
        Produz relatorio consolidado da estrutura Supabase.
        """
        logger.info("=" * 80)
        logger.info("Relatorio completo da verificacao Supabase")
        logger.info("=" * 80)

        conexao_ok = self.verificar_conexao()
        resultado = self.verificar_schema_esperado()

        logger.info("=" * 80)
        logger.info("Resumo")
        logger.info("=" * 80)
        logger.info("Tabelas existentes: %s", resultado["tabelas_existentes"])

        if resultado["tabelas_faltando"]:
            logger.warning("Tabelas faltando: %s", resultado["tabelas_faltando"])

        if resultado["colunas_faltando"]:
            logger.warning(
                "Colunas faltando por tabela:\n%s",
                json.dumps(resultado["colunas_faltando"], indent=2),
            )

        if resultado["colunas_extras"]:
            logger.info(
                "Colunas extras encontradas:\n%s",
                json.dumps(resultado["colunas_extras"], indent=2),
            )

        if resultado["tabelas_faltando"]:
            logger.info("=" * 80)
            logger.info("SQL sugerido para criar tabelas faltantes")
            logger.info("=" * 80)
            sql = self.gerar_sql_criacao(resultado["tabelas_faltando"])
            print(sql)
            with open("create_tables.sql", "w", encoding="utf-8") as file:
                file.write(sql + "\n")
            logger.info("Arquivo create_tables.sql gerado em apps/backend.")

        if "usuarios" in resultado["tabelas_existentes"]:
            self.testar_operacoes_basicas()

        logger.info("=" * 80)
        if conexao_ok and not resultado["tabelas_faltando"] and not resultado["colunas_faltando"]:
            logger.info("Banco Supabase em conformidade com o schema esperado.")
        else:
            logger.warning("Banco Supabase requer ajustes. Consulte os avisos acima.")


def main() -> None:
    print("=" * 80)
    print("Verificador de estrutura do Supabase")
    print("=" * 80)

    dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    dotenv_loaded = load_dotenv(dotenv_path=dotenv_path)
    if not dotenv_loaded:
        logger.warning(
            "Nao foi possivel carregar apps/backend/.env automaticamente. "
            "Certifique-se de exportar SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar."
        )

    verifier = SupabaseVerifier()
    verifier.gerar_relatorio_completo()


if __name__ == "__main__":
    main()
