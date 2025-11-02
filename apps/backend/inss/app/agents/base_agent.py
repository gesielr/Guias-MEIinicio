"""Agente base para o assistente GuiasMEI."""

from __future__ import annotations

from typing import Any, Dict, Iterable, Literal, Optional

from .prompts.system_prompts import (
    AUTONOMO_SYSTEM_PROMPT,
    BASE_SYSTEM_PROMPT,
    LAST_UPDATE,
    MEI_SYSTEM_PROMPT,
    PARCEIRO_SYSTEM_PROMPT,
    PROMPT_VERSION,
)

UserType = Literal["mei", "autonomo", "parceiro", "admin", "default"]


class GuiasMEIAgent:
    """Agente conversacional configurável por tipo de usuário."""

    def __init__(
        self,
        user_type: UserType,
        llm: Any | None = None,
        extra_sections: Optional[Iterable[str]] = None,
    ) -> None:
        self.user_type = user_type
        self.llm = llm
        self.extra_sections = list(extra_sections or [])
        self.system_prompt = self._build_system_prompt()

    def _build_system_prompt(self) -> str:
        prompt_parts = [BASE_SYSTEM_PROMPT.strip()]

        if self.user_type == "mei":
            prompt_parts.append(MEI_SYSTEM_PROMPT.strip())
        elif self.user_type == "autonomo":
            prompt_parts.append(AUTONOMO_SYSTEM_PROMPT.strip())
        elif self.user_type == "parceiro":
            prompt_parts.append(PARCEIRO_SYSTEM_PROMPT.strip())

        prompt_parts.extend(section.strip() for section in self.extra_sections if section)

        prompt_parts.append(
            f"# METADADOS\nVersão do prompt: {PROMPT_VERSION}\nÚltima atualização: {LAST_UPDATE}"
        )

        return "\n\n".join(prompt_parts)

    def _format_user_input(self, mensagem: str, contexto: Dict[str, Any]) -> str:
        contexto_fmt = "\n".join(
            f"- {chave}: {valor}"
            for chave, valor in contexto.items()
            if valor not in (None, "", [], {})
        )
        contexto_bloco = contexto_fmt or "- (sem dados adicionais fornecidos)"
        return (
            "## CONTEXTO DO USUÁRIO\n"
            f"{contexto_bloco}\n\n"
            "## INSTRUÇÃO\n"
            f"{mensagem}\n"
        )

    async def processar_mensagem(
        self,
        mensagem: str,
        contexto: Dict[str, Any],
    ) -> str:
        if not self.llm:
            raise RuntimeError("LLM não configurado para GuiasMEIAgent.")

        try:
            from langchain.schema import HumanMessage, SystemMessage
        except ImportError as exc:  # pragma: no cover - somente logamos em runtime
            raise RuntimeError("Dependências LangChain indisponíveis.") from exc

        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=self._format_user_input(mensagem, contexto)),
        ]

        resposta = await self.llm.ainvoke(messages)
        return getattr(resposta, "content", str(resposta))

