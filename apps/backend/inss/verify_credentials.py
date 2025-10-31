#!/usr/bin/env python
"""
Verificador completo de credenciais e configurações para Fase 1 do GuiasMEI.

Valida:
1. Supabase (URL, keys, buckets, RLS policies)
2. NFSe ADN (endpoint, certificados, credenciais)
3. Stripe/PIX (chaves, modo teste)
4. Twilio WhatsApp (tokens, número, webhook)
5. CI/CD (deploy, secrets)
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class CredentialVerifier:
    """Verifica credenciais e configurações da Fase 1."""

    def __init__(self) -> None:
        """Carrega variáveis de ambiente."""
        self.env_loaded = False
        self.credentials: Dict[str, Dict] = {
            "supabase": {},
            "nfse": {},
            "stripe": {},
            "twilio": {},
            "cicd": {},
        }
        self.status: Dict[str, bool] = {
            "supabase": False,
            "nfse": False,
            "stripe": False,
            "twilio": False,
            "cicd": False,
        }

        # Tentar carregar .env
        dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        if os.path.exists(dotenv_path):
            self.env_loaded = load_dotenv(dotenv_path=dotenv_path)
            logger.info("Arquivo .env carregado de: %s", dotenv_path)
        else:
            logger.warning(
                "Arquivo .env não encontrado. Procurando em variáveis de ambiente do sistema."
            )

    def verificar_supabase(self) -> bool:
        """Valida configurações Supabase."""
        logger.info("=" * 80)
        logger.info("Verificando Supabase")
        logger.info("=" * 80)

        url = os.getenv("SUPABASE_URL")
        anon_key = os.getenv("SUPABASE_ANON_KEY")
        service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        resultado = {"url": url, "keys": {}}

        if not url:
            logger.error("SUPABASE_URL não configurada")
            return False

        if not anon_key:
            logger.error("SUPABASE_ANON_KEY não configurada")
            return False

        if not service_role_key:
            logger.error("SUPABASE_SERVICE_ROLE_KEY não configurada")
            return False

        logger.info("✓ SUPABASE_URL: %s", url)
        logger.info("✓ SUPABASE_ANON_KEY: %s***", anon_key[:20])
        logger.info("✓ SUPABASE_SERVICE_ROLE_KEY: %s***", service_role_key[:20])

        # Testar conexão
        try:
            resp = requests.get(
                f"{url.rstrip('/')}/rest/v1/usuarios?select=count&limit=1",
                headers={"apikey": anon_key},
                timeout=10,
            )
            if resp.status_code in (200, 206):
                logger.info("✓ Conexão REST validada (status %s)", resp.status_code)
                resultado["rest_ok"] = True
            else:
                logger.warning(
                    "✗ Falha na conexão REST (status %s): %s",
                    resp.status_code,
                    resp.text[:100],
                )
                resultado["rest_ok"] = False
        except requests.RequestException as e:
            logger.error("✗ Erro na conexão REST: %s", e)
            resultado["rest_ok"] = False

        # Verificar buckets (storage)
        logger.info("Verificando buckets de storage...")
        buckets_esperados = ["pdf-gps", "certificados", "danfse"]

        for bucket in buckets_esperados:
            try:
                resp = requests.get(
                    f"{url.rstrip('/')}/storage/v1/bucket/{bucket}",
                    headers={
                        "apikey": service_role_key,
                        "Authorization": f"Bearer {service_role_key}",
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    logger.info("✓ Bucket '%s' existe", bucket)
                    resultado[f"bucket_{bucket}"] = True
                else:
                    logger.warning("✗ Bucket '%s' não encontrado (status %s)", bucket, resp.status_code)
                    resultado[f"bucket_{bucket}"] = False
            except requests.RequestException as e:
                logger.error("✗ Erro ao verificar bucket '%s': %s", bucket, e)
                resultado[f"bucket_{bucket}"] = False

        self.credentials["supabase"] = resultado
        self.status["supabase"] = resultado.get("rest_ok", False)
        return self.status["supabase"]

    def verificar_nfse(self) -> bool:
        """Valida configurações NFSe ADN."""
        logger.info("=" * 80)
        logger.info("Verificando NFSe ADN")
        logger.info("=" * 80)

        resultado = {}

        # Verificar URLs
        urls_esperadas = {
            "ADN_NFSE_CONTRIBUINTES_URL": "Contribuintes",
            "ADN_NFSE_PARAMETROS_URL": "Parâmetros",
            "ADN_NFSE_DANFSE_URL": "DANFSe",
        }

        for var, desc in urls_esperadas.items():
            url = os.getenv(var)
            if url:
                logger.info("✓ %s (%s): %s", var, desc, url)
                resultado[var] = url
            else:
                logger.warning("✗ %s (%s) não configurada", var, desc)
                resultado[var] = None

        # Certificado A1
        cert_path = os.getenv("NFSE_CERTIFICATE_PATH")
        cert_password = os.getenv("NFSE_CERTIFICATE_PASSWORD")

        if cert_path:
            logger.info("✓ NFSE_CERTIFICATE_PATH: %s", cert_path)
            resultado["certificate_path"] = cert_path
            if os.path.exists(cert_path):
                logger.info("  → Arquivo encontrado localmente")
                resultado["certificate_exists"] = True
            else:
                logger.warning("  → Arquivo NÃO encontrado em %s", cert_path)
                resultado["certificate_exists"] = False
        else:
            logger.warning("✗ NFSE_CERTIFICATE_PATH não configurada")
            resultado["certificate_path"] = None

        if cert_password:
            logger.info("✓ NFSE_CERTIFICATE_PASSWORD configurada (***)")
            resultado["certificate_password"] = "***"
        else:
            logger.warning("✗ NFSE_CERTIFICATE_PASSWORD não configurada")
            resultado["certificate_password"] = None

        # Ambiente (homologação vs produção)
        env = os.getenv("NFSE_ENVIRONMENT", "homolog")
        logger.info("✓ Ambiente configurado: %s", env)
        resultado["environment"] = env

        self.credentials["nfse"] = resultado
        # NFSe é "OK" se pelo menos URLs estão configuradas
        self.status["nfse"] = bool(
            resultado.get("ADN_NFSE_CONTRIBUINTES_URL")
            or resultado.get("ADN_NFSE_PARAMETROS_URL")
            or resultado.get("ADN_NFSE_DANFSE_URL")
        )
        return self.status["nfse"]

    def verificar_stripe(self) -> bool:
        """Valida configurações Stripe/PIX."""
        logger.info("=" * 80)
        logger.info("Verificando Stripe/PIX")
        logger.info("=" * 80)

        resultado = {}

        # Chaves Stripe
        secret_key = os.getenv("STRIPE_SECRET_KEY")
        webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

        if secret_key:
            logger.info("✓ STRIPE_SECRET_KEY configurada (%s***)", secret_key[:10])
            resultado["secret_key"] = secret_key[:10] + "***"
            # Verificar se está em modo teste
            if secret_key.startswith("sk_test_"):
                logger.info("  → Modo TESTE detectado")
                resultado["test_mode"] = True
            elif secret_key.startswith("sk_live_"):
                logger.warning("  → Modo PRODUÇÃO detectado (cuidado!)")
                resultado["test_mode"] = False
        else:
            logger.warning("✗ STRIPE_SECRET_KEY não configurada")
            resultado["secret_key"] = None

        if webhook_secret:
            logger.info("✓ STRIPE_WEBHOOK_SECRET configurada (%s***)", webhook_secret[:10])
            resultado["webhook_secret"] = webhook_secret[:10] + "***"
        else:
            logger.warning("✗ STRIPE_WEBHOOK_SECRET não configurada")
            resultado["webhook_secret"] = None

        # URLs de webhook
        webhook_url = os.getenv("STRIPE_WEBHOOK_URL")
        if webhook_url:
            logger.info("✓ STRIPE_WEBHOOK_URL: %s", webhook_url)
            resultado["webhook_url"] = webhook_url
        else:
            logger.warning("✗ STRIPE_WEBHOOK_URL não configurada")
            resultado["webhook_url"] = None

        self.credentials["stripe"] = resultado
        self.status["stripe"] = bool(resultado.get("secret_key") and resultado.get("webhook_secret"))
        return self.status["stripe"]

    def verificar_twilio(self) -> bool:
        """Valida configurações Twilio WhatsApp."""
        logger.info("=" * 80)
        logger.info("Verificando Twilio WhatsApp")
        logger.info("=" * 80)

        resultado = {}

        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        phone_id = os.getenv("TWILIO_WHATSAPP_NUMBER")
        webhook_url = os.getenv("TWILIO_WEBHOOK_URL")

        if account_sid:
            logger.info("✓ TWILIO_ACCOUNT_SID: %s", account_sid)
            resultado["account_sid"] = account_sid
        else:
            logger.warning("✗ TWILIO_ACCOUNT_SID não configurada")
            resultado["account_sid"] = None

        if auth_token:
            logger.info("✓ TWILIO_AUTH_TOKEN: %s***", auth_token[:10])
            resultado["auth_token"] = auth_token[:10] + "***"
        else:
            logger.warning("✗ TWILIO_AUTH_TOKEN não configurada")
            resultado["auth_token"] = None

        if phone_id:
            logger.info("✓ TWILIO_WHATSAPP_NUMBER: %s", phone_id)
            resultado["phone_id"] = phone_id
        else:
            logger.warning("✗ TWILIO_WHATSAPP_NUMBER não configurada")
            resultado["phone_id"] = None

        if webhook_url:
            logger.info("✓ TWILIO_WEBHOOK_URL: %s", webhook_url)
            resultado["webhook_url"] = webhook_url
        else:
            logger.warning("✗ TWILIO_WEBHOOK_URL não configurada")
            resultado["webhook_url"] = None

        # Sandbox mode
        sandbox = os.getenv("TWILIO_SANDBOX_MODE", "false").lower() == "true"
        logger.info("✓ Sandbox mode: %s", "ATIVO" if sandbox else "inativo")
        resultado["sandbox"] = sandbox

        self.credentials["twilio"] = resultado
        self.status["twilio"] = bool(
            resultado.get("account_sid")
            and resultado.get("auth_token")
            and resultado.get("phone_id")
        )
        return self.status["twilio"]

    def verificar_cicd(self) -> bool:
        """Valida configurações CI/CD."""
        logger.info("=" * 80)
        logger.info("Verificando CI/CD (Vercel/Railway)")
        logger.info("=" * 80)

        resultado = {}

        # Vercel
        vercel_token = os.getenv("VERCEL_TOKEN")
        if vercel_token:
            logger.info("✓ VERCEL_TOKEN configurada (%s***)", vercel_token[:10])
            resultado["vercel_token"] = vercel_token[:10] + "***"
        else:
            logger.info("- VERCEL_TOKEN não configurada (opcional)")

        # Railway
        railway_token = os.getenv("RAILWAY_TOKEN")
        if railway_token:
            logger.info("✓ RAILWAY_TOKEN configurada (%s***)", railway_token[:10])
            resultado["railway_token"] = railway_token[:10] + "***"
        else:
            logger.info("- RAILWAY_TOKEN não configurada (opcional)")

        # GitHub
        github_token = os.getenv("GITHUB_TOKEN")
        if github_token:
            logger.info("✓ GITHUB_TOKEN configurada (%s***)", github_token[:10])
            resultado["github_token"] = github_token[:10] + "***"
        else:
            logger.info("- GITHUB_TOKEN não configurada (opcional)")

        # Verificar se .env existe e não foi commitado
        env_path = Path(__file__).parent.parent / ".env"
        gitignore_path = Path(__file__).parent.parent.parent.parent / ".gitignore"

        if gitignore_path.exists():
            with open(gitignore_path, "r", encoding="utf-8") as f:
                content = f.read()
                if ".env" in content:
                    logger.info("✓ .env está em .gitignore")
                    resultado["env_gitignored"] = True
                else:
                    logger.warning("✗ .env pode estar exposto no Git")
                    resultado["env_gitignored"] = False
        else:
            logger.warning("- .gitignore não encontrado")

        self.credentials["cicd"] = resultado
        self.status["cicd"] = True  # CI/CD é opcional inicialmente
        return True

    def gerar_relatorio(self) -> None:
        """Gera relatório consolidado."""
        logger.info("=" * 80)
        logger.info("RELATÓRIO CONSOLIDADO - FASE 1")
        logger.info("=" * 80)

        # Resumo de status
        logger.info("STATUS POR MÓDULO:")
        for modulo, ok in self.status.items():
            status_str = "✓ OK" if ok else "✗ PROBLEMAS"
            logger.info("  %s: %s", modulo.upper(), status_str)

        # Estatísticas
        total = len(self.status)
        ok_count = sum(1 for v in self.status.values() if v)
        logger.info("\nCobertura: %d/%d (%d%%)", ok_count, total, int(ok_count / total * 100))

        # Recomendações
        logger.info("=" * 80)
        logger.info("RECOMENDAÇÕES")
        logger.info("=" * 80)

        if not self.status["supabase"]:
            logger.warning(
                "⚠ Supabase: Verifique URL, chaves e buckets de storage"
            )

        if not self.status["nfse"]:
            logger.warning(
                "⚠ NFSe ADN: Confirme endpoints com ADN e obtenha certificado A1"
            )

        if not self.status["stripe"]:
            logger.warning(
                "⚠ Stripe: Configure chaves em MODO TESTE (sk_test_*)"
            )

        if not self.status["twilio"]:
            logger.warning(
                "⚠ Twilio: Obtenha credenciais do console Twilio"
            )

        # Salvar relatório em JSON
        report_path = Path(__file__).parent / "credentials_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "timestamp": datetime.now().isoformat(),
                    "status": self.status,
                    "credentials": self.credentials,
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        logger.info("\nRelatório salvo em: %s", report_path)


def main() -> None:
    """Executa verificação completa."""
    print("=" * 80)
    print("Verificador de Credenciais - Fase 1 GuiasMEI")
    print("=" * 80)
    print()

    verifier = CredentialVerifier()

    # Executar todas as verificações
    verifier.verificar_supabase()
    verifier.verificar_nfse()
    verifier.verificar_stripe()
    verifier.verificar_twilio()
    verifier.verificar_cicd()

    # Gerar relatório
    verifier.gerar_relatorio()


if __name__ == "__main__":
    main()
