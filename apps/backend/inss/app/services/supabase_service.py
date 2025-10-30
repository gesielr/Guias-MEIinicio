from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from ..config import get_settings


class SupabaseService:
    """Servicos utilitarios para acesso ao Supabase com fallback offline."""

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None) -> None:
        settings = get_settings()
        self.url = url or str(settings.supabase_url)
        self.key = key or settings.supabase_key
        self._client: Any = None

    @property
    def client(self):
        """Retorna instancia do cliente Supabase (ou None quando indisponivel)."""
        if self._client is None:
            try:
                from supabase import create_client

                self._client = create_client(self.url, self.key)
            except Exception as exc:  # pragma: no cover - somente logamos
                print(f"[WARN] Problema ao conectar Supabase: {str(exc)[:60]}...")
                print("  Sistema funcionara em modo limitado (sem persistencia)")
                self._client = False  # marca que a tentativa ja ocorreu

        return self._client if self._client else None

    async def create_record(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.client:
            print("[WARN] Supabase indisponivel - criando registro em memoria")
            return data

        def _create():
            return self.client.table(table).insert(data).execute()

        try:
            result = await asyncio.to_thread(_create)
            return result.data[0] if result.data else {}
        except Exception as exc:  # pragma: no cover
            print(f"[ERROR] Erro ao criar registro: {str(exc)[:60]}...")
            return data

    async def get_records(
        self, table: str, filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []

        def _get():
            query = self.client.table(table).select("*")
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            return query.execute()

        try:
            result = await asyncio.to_thread(_get)
            return result.data or []
        except Exception as exc:  # pragma: no cover
            print(f"[ERROR] Erro ao buscar registros: {str(exc)[:60]}...")
            return []

    async def upload_file(
        self,
        bucket: str,
        file_path: str,
        file_data: bytes,
        content_type: str = "application/pdf",
    ) -> str:
        if not self.client:
            print("[WARN] Supabase indisponivel - arquivo nao sera armazenado")
            return f"temp://{file_path}"

        try:
            def _upload():
                return self.client.storage.from_(bucket).upload(
                    file_path, file_data, {"content-type": content_type}
                )

            await asyncio.to_thread(_upload)

            def _get_public_url():
                return self.client.storage.from_(bucket).get_public_url(file_path)

            public_url = await asyncio.to_thread(_get_public_url)
            if not public_url:
                raise RuntimeError("Nao foi possivel obter URL publica do arquivo")
            return public_url
        except Exception as exc:  # pragma: no cover
            print(f"[ERROR] Erro ao fazer upload: {str(exc)[:60]}...")
            return f"temp://{file_path}"

    async def obter_usuario_por_whatsapp(self, whatsapp: str) -> Optional[Dict[str, Any]]:
        """Obtem usuario pelo numero de WhatsApp."""
        if not self.client:
            print("[WARN] Supabase indisponivel - retornando None")
            return None

        try:
            records = await self.get_records("usuarios", {"whatsapp": whatsapp})
            return records[0] if records else None
        except Exception as exc:  # pragma: no cover
            print(f"[ERROR] Erro ao obter usuario: {str(exc)[:60]}...")
            return None

    async def criar_usuario(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria novo usuario."""
        if not self.client:
            print("[WARN] Supabase indisponivel - retornando dados em memoria")
            return {**data, "id": f"mock-{data.get('whatsapp', 'unknown')}"}

        try:
            return await self.create_record("usuarios", data)
        except Exception as exc:  # pragma: no cover
            print(f"[ERROR] Erro ao criar usuario: {str(exc)[:60]}...")
            return {**data, "id": f"error-{data.get('whatsapp', 'unknown')}"}

    async def salvar_guia(self, user_id: str, guia_data: Dict[str, Any]) -> Dict[str, Any]:
        """Salva guia no banco de dados."""
        if not self.client:
            print("[WARN] Supabase indisponivel - guia nao sera persistida")
            return {**guia_data, "id": "mock-guia", "user_id": user_id}

        try:
            data = {**guia_data, "user_id": user_id}
            return await self.create_record("guias", data)
        except Exception as exc:  # pragma: no cover
            print(f"[ERROR] Erro ao salvar guia: {str(exc)[:60]}...")
            return {**guia_data, "id": "error-guia", "user_id": user_id}

    async def subir_pdf(self, bucket: str, caminho: str, conteudo: bytes) -> str:
        """Alias para upload_file - mantem compatibilidade retroativa."""
        return await self.upload_file(bucket, caminho, conteudo, content_type="application/pdf")
