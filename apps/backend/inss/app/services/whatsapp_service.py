from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from typing import Optional

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client as TwilioClient

from ..config import get_settings
from ..utils.validators import validar_whatsapp
from .supabase_service import SupabaseService


@dataclass
class WhatsAppMessageResult:
    sid: str
    status: str
    media_url: Optional[str]


class WhatsAppService:
    """Integracao com WhatsApp Business API via Twilio."""

    def __init__(self, supabase_service: Optional[SupabaseService] = None) -> None:
        try:
            settings = get_settings()
            self.supabase_service = supabase_service or SupabaseService()
            self.account_sid = settings.twilio_account_sid
            self.auth_token = settings.twilio_auth_token
            self.remetente = settings.twilio_whatsapp_number
            self.bucket_pdf = "guias"
            self._twilio_client: Optional[TwilioClient] = None

            credenciais_placeholder = {"", None, "seu-sid", "seu-token", "your-sid", "your-token"}
            remetente_invalido = not self.remetente or not self.remetente.startswith("whatsapp:")
            if (
                self.account_sid in credenciais_placeholder
                or self.auth_token in credenciais_placeholder
                or remetente_invalido
            ):
                print("[WARN] WhatsAppService em modo mock (Twilio desabilitado)")
                self.account_sid = None
                self.auth_token = None
                self.remetente = None
                self._twilio_client = False  # type: ignore[assignment]
            else:
                print("[OK] WhatsAppService inicializado (cliente lazy-loaded)")
        except Exception as exc:  # pragma: no cover
            print(f"[WARN] Problema ao inicializar WhatsAppService: {str(exc)[:60]}...")
            self.supabase_service = supabase_service or SupabaseService()
            self.account_sid = None
            self.auth_token = None
            self.remetente = None
            self.bucket_pdf = "guias"
            self._twilio_client = False  # type: ignore[assignment]

    @property
    def twilio_client(self) -> Optional[TwilioClient]:
        """Lazy initialization do cliente Twilio."""
        if self._twilio_client is None and self.account_sid and self.auth_token:
            try:
                self._twilio_client = TwilioClient(self.account_sid, self.auth_token)
                print("[OK] Cliente Twilio inicializado com sucesso")
            except Exception as exc:  # pragma: no cover
                print(f"[WARN] Problema ao conectar Twilio: {str(exc)[:60]}...")
                self._twilio_client = False  # type: ignore[assignment]
        return self._twilio_client if self._twilio_client else None

    async def enviar_pdf_whatsapp(
        self, numero: str, pdf_bytes: bytes, mensagem: str
    ) -> WhatsAppMessageResult:
        """Envia PDF via WhatsApp usando Twilio."""
        if not validar_whatsapp(numero):
            raise ValueError("Numero de WhatsApp invalido")

        if not self.twilio_client:
            print("[WARN] WhatsApp client indisponivel - retornando mock")
            return WhatsAppMessageResult(sid="mock-sid", status="mock", media_url="mock-url")

        arquivo_id = uuid.uuid4()
        caminho_pdf = f"guias/{arquivo_id}.pdf"
        media_url = await self.supabase_service.subir_pdf(
            bucket=self.bucket_pdf,
            caminho=caminho_pdf,
            conteudo=pdf_bytes,
        )

        try:
            message = await asyncio.to_thread(
                self.twilio_client.messages.create,
                from_=self.remetente,
                to=f"whatsapp:{numero}",
                body=mensagem,
                media_url=[media_url],
            )
        except TwilioRestException as exc:  # pragma: no cover
            print(f"[WARN] Falha ao enviar via Twilio, retornando mock: {exc.msg}")
            return WhatsAppMessageResult(sid="mock-error", status="mock", media_url=media_url)
        except Exception as exc:  # pragma: no cover
            print(f"[WARN] Erro inesperado no envio do WhatsApp: {str(exc)[:60]} - retornando mock")
            return WhatsAppMessageResult(sid="mock-error", status="mock", media_url=media_url)

        return WhatsAppMessageResult(sid=message.sid, status=message.status, media_url=media_url)

    async def enviar_texto(self, numero: str, mensagem: str) -> WhatsAppMessageResult:
        """Envia mensagem de texto simples."""
        if not validar_whatsapp(numero):
            raise ValueError("Numero de WhatsApp invalido")

        if not self.twilio_client:
            print("[WARN] WhatsApp client indisponivel - retornando mock")
            return WhatsAppMessageResult(sid="mock-sid", status="mock", media_url=None)

        try:
            message = await asyncio.to_thread(
                self.twilio_client.messages.create,
                from_=self.remetente,
                to=f"whatsapp:{numero}",
                body=mensagem,
            )
        except TwilioRestException as exc:  # pragma: no cover
            print(f"[WARN] Falha ao enviar via Twilio, retornando mock: {exc.msg}")
            return WhatsAppMessageResult(sid="mock-error", status="mock", media_url=None)
        except Exception as exc:  # pragma: no cover
            print(f"[WARN] Erro inesperado no envio do WhatsApp: {str(exc)[:60]} - retornando mock")
            return WhatsAppMessageResult(sid="mock-error", status="mock", media_url=None)

        return WhatsAppMessageResult(sid=message.sid, status=message.status, media_url=None)
