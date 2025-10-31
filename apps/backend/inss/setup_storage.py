#!/usr/bin/env python
"""
Setup de buckets Supabase Storage para GuiasMEI.

Cria os buckets necessários:
- pdf-gps: Armazena PDFs gerados de GPS
- certificados: Armazena certificados PFX dos contribuintes
- danfse: Armazena DANFSe (notas fiscais XML/PDF)
"""

import logging
import os
import sys

import requests
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class StorageSetup:
    """Gerencia criação de buckets Supabase Storage."""

    def __init__(self) -> None:
        """Inicializa com credenciais Supabase."""
        # Carregar .env
        dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        load_dotenv(dotenv_path=dotenv_path)

        self.url = os.getenv("SUPABASE_URL")
        self.service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not self.url or not self.service_key:
            logger.error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados")
            sys.exit(1)

        self.storage_url = f"{self.url.rstrip('/')}/storage/v1"
        self.headers = {
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }

    def criar_bucket(self, nome: str, publico: bool = False) -> bool:
        """Cria um bucket no Storage."""
        logger.info("Criando bucket: %s (público: %s)", nome, publico)

        payload = {"name": nome, "public": publico}

        try:
            resp = requests.post(
                f"{self.storage_url}/buckets",
                json=payload,
                headers=self.headers,
                timeout=15,
            )

            if resp.status_code in (200, 201):
                logger.info("✓ Bucket '%s' criado com sucesso", nome)
                return True
            elif resp.status_code == 400 and "already exists" in resp.text:
                logger.warning("⚠ Bucket '%s' já existe", nome)
                return True
            else:
                logger.error(
                    "✗ Erro ao criar bucket '%s' (status %s): %s",
                    nome,
                    resp.status_code,
                    resp.text[:200],
                )
                return False
        except requests.RequestException as e:
            logger.error("✗ Erro de conexão ao criar bucket '%s': %s", nome, e)
            return False

    def configurar_politica_rls(self, bucket: str, politica: str) -> bool:
        """Configura política RLS para bucket."""
        logger.info("Configurando RLS para bucket: %s", bucket)
        logger.info("Política: %s", politica)

        # Esta é uma operação mais complexa que geralmente é feita via SQL
        # ou dashboard do Supabase. Por enquanto, logamos a recomendação.
        logger.info(
            "⚠ RLS deve ser configurada manualmente no dashboard Supabase "
            "ou via SQL migration."
        )
        return True

    def setup_completo(self) -> bool:
        """Executa setup completo de buckets."""
        logger.info("=" * 80)
        logger.info("Setup de Storage Supabase")
        logger.info("=" * 80)

        buckets = {
            "pdf-gps": {"publico": False, "descricao": "PDFs de guias GPS"},
            "certificados": {
                "publico": False,
                "descricao": "Certificados PFX dos contribuintes",
            },
            "danfse": {"publico": False, "descricao": "DANFSe de notas fiscais"},
        }

        resultados = {}
        for nome, config in buckets.items():
            logger.info("→ %s: %s", nome, config["descricao"])
            resultado = self.criar_bucket(nome, config.get("publico", False))
            resultados[nome] = resultado

        # Resumo
        logger.info("=" * 80)
        logger.info("RESUMO")
        logger.info("=" * 80)
        ok_count = sum(1 for v in resultados.values() if v)
        total = len(resultados)
        logger.info("Buckets criados/existentes: %d/%d", ok_count, total)

        if ok_count == total:
            logger.info("✓ Storage setup concluído com sucesso!")
            return True
        else:
            logger.warning("⚠ Alguns buckets falharam. Verifique os erros acima.")
            return False

    def listar_buckets(self) -> None:
        """Lista buckets existentes."""
        logger.info("=" * 80)
        logger.info("Listando buckets existentes")
        logger.info("=" * 80)

        try:
            resp = requests.get(
                f"{self.storage_url}/buckets",
                headers=self.headers,
                timeout=15,
            )

            if resp.status_code in (200, 206):
                buckets = resp.json()
                if buckets:
                    for bucket in buckets:
                        logger.info("  - %s (público: %s)", bucket["name"], bucket.get("public", False))
                else:
                    logger.info("Nenhum bucket encontrado")
            else:
                logger.error("Erro ao listar buckets (status %s): %s", resp.status_code, resp.text)
        except requests.RequestException as e:
            logger.error("Erro de conexão ao listar buckets: %s", e)


def main() -> None:
    """Executa setup de storage."""
    print("=" * 80)
    print("Setup de Buckets Supabase Storage - GuiasMEI")
    print("=" * 80)
    print()

    setup = StorageSetup()

    # Listar buckets atuais
    setup.listar_buckets()
    print()

    # Criar buckets faltantes
    success = setup.setup_completo()

    print()
    if success:
        logger.info("✓ Próxima etapa: Configurar RLS (Row Level Security) no dashboard")
        logger.info("  Dashboard: https://app.supabase.com/")
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
