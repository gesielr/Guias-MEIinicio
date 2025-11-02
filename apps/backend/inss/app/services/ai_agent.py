from __future__ import annotations

from typing import Any, Dict

try:
    from langchain_openai import ChatOpenAI
    LANGCHAIN_AVAILABLE = True
except ImportError:  # pragma: no cover - fallback em ambientes sem LangChain
    LANGCHAIN_AVAILABLE = False

from ..agents import GuiasMEIAgent, UserType
from ..config import get_settings


class INSSChatAgent:
    """Agente conversacional GuiasMEI com prompts especializados por perfil."""

    def __init__(self) -> None:
        settings = get_settings()
        self.llm: Any | None = None

        if LANGCHAIN_AVAILABLE and settings.openai_api_key and settings.openai_api_key != "sua-chave-openai":
            try:
                model_name = getattr(settings, "openai_chat_model", None) or "gpt-5"
                try:
                    self.llm = ChatOpenAI(
                        model=model_name,
                        temperature=0.3,
                        openai_api_key=settings.openai_api_key,
                    )
                except Exception:
                    self.llm = ChatOpenAI(
                        model="gpt-4o",
                        temperature=0.3,
                        openai_api_key=settings.openai_api_key,
                    )
            except Exception as exc:  # pragma: no cover
                print(f"[WARN] Não foi possível inicializar ChatOpenAI: {str(exc)[:60]}...")

        self.conhecimento_sal = """
        REGRAS DO SISTEMA SAL (Sistema de Acréscimos Legais):

        1. CONTRIBUINTE INDIVIDUAL (Autônomo):
           - Código 1007: 20% sobre valor entre R$1.518 e R$8.157,41
           - Código 1163: 11% sobre salário mínimo (R$166,98 em 2025)
           - Não dá direito a aposentadoria por tempo no plano simplificado

        2. PRODUTOR RURAL:
           - Código 1503: 20% sobre valor declarado
           - Segurado especial: 1,3% sobre receita bruta

        3. EMPREGADO DOMÉSTICO:
           - Tabela progressiva de 7,5% a 14%
           - Empregador também contribui

        4. COMPLEMENTAÇÃO:
           - Código 1295: Para quem pagou 11% e quer complementar para 20%
           - Incide juros SELIC sobre valores em atraso
        """

    async def processar_mensagem(
        self,
        mensagem_usuario: str,
        contexto_usuario: Dict[str, Any],
    ) -> str:
        """Processa mensagem do usuário e retorna resposta personalizada."""

        user_type = self._mapear_tipo_usuario(contexto_usuario)

        if not self.llm:
            return self._resposta_padrao(mensagem_usuario, contexto_usuario, user_type)

        agente = GuiasMEIAgent(
            user_type=user_type,
            llm=self.llm,
            extra_sections=[self.conhecimento_sal],
        )

        try:
            return await agente.processar_mensagem(mensagem_usuario, contexto_usuario)
        except Exception as exc:  # pragma: no cover
            print(f"[WARN] Erro ao processar com IA: {str(exc)[:60]}...")
            return self._resposta_padrao(mensagem_usuario, contexto_usuario, user_type)

    def _mapear_tipo_usuario(self, contexto_usuario: Dict[str, Any]) -> UserType:
        bruto = (
            contexto_usuario.get("user_type")
            or contexto_usuario.get("perfil")
            or contexto_usuario.get("tipo_contribuinte")
            or contexto_usuario.get("segmento")
            or ""
        )
        valor = str(bruto).strip().lower()

        if any(palavra in valor for palavra in ("mei", "microempreendedor")):
            return "mei"
        if any(palavra in valor for palavra in ("autonomo", "autônomo", "contribuinte")):
            return "autonomo"
        if any(palavra in valor for palavra in ("parceiro", "contador")):
            return "parceiro"
        if "admin" in valor:
            return "admin"
        return "default"

    def _resposta_padrao(
        self,
        mensagem_usuario: str,
        contexto_usuario: Dict[str, Any],
        user_type: UserType,
    ) -> str:
        """Resposta de fallback quando a IA não está configurada."""
        return (
            "Olá! Estou operando em modo assistente básico.\n\n"
            f"Pergunta recebida: {mensagem_usuario}\n"
            f"Perfil detectado: {user_type}\n"
            f"Contexto fornecido: {contexto_usuario}\n\n"
            "Base de conhecimento do INSS/SAL:\n"
            f"{self.conhecimento_sal}\n\n"
            "Para habilitar respostas com IA completa, configure sua chave OpenAI em apps/backend/.env."
        )
