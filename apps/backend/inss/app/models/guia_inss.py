from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .user import TipoContribuinte


PlanoContribuicao = Literal["normal", "simplificado"]


class EmitirGuiaRequest(BaseModel):
    whatsapp: str = Field(..., description="Número WhatsApp com código do país")
    tipo_contribuinte: TipoContribuinte
    valor_base: float = Field(..., gt=0)
    plano: PlanoContribuicao = Field(default="normal")
    competencia: Optional[str] = Field(default=None, description="Competência no formato MM/AAAA")

    @field_validator("competencia")
    @classmethod
    def validar_competencia(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if len(value) != 7 or value[2] != "/":
            raise ValueError("Competência deve estar no formato MM/AAAA")
        return value


class ComplementacaoRequest(BaseModel):
    whatsapp: str
    competencias: list[str] = Field(..., min_items=1)
    valor_base: float = Field(..., gt=0)


class GuiaINSS(BaseModel):
    id: str
    codigo_gps: str
    competencia: str
    valor: float
    status: str
    pdf_url: Optional[str] = None
    data_vencimento: date

    model_config = dict(from_attributes=True)


class HistoricoGuiaResponse(BaseModel):
    guias: list[GuiaINSS]

