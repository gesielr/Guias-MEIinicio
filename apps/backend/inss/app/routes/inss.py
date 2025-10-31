from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, status
from starlette.concurrency import run_in_threadpool

from ..models.guia_inss import ComplementacaoRequest, EmitirGuiaRequest
from ..services.inss_calculator import CalculoSAL, INSSCalculator
from ..services.pdf_generator import GPSGenerator
from ..services.supabase_service import SupabaseService
from ..services.whatsapp_service import WhatsAppService
from ..utils.constants import SAL_CLASSES, calcular_vencimento_padrao
from ..utils.validators import normalizar_competencia, validar_whatsapp

router = APIRouter(prefix="/api/v1/guias", tags=["Guias INSS"])

calculator = INSSCalculator()
supabase_service = SupabaseService()
pdf_generator = GPSGenerator()
whatsapp_service = WhatsAppService(supabase_service=supabase_service)


async def _obter_ou_criar_usuario(payload: dict[str, Any]) -> dict[str, Any]:
    whatsapp = payload["whatsapp"]
    usuario = await supabase_service.obter_usuario_por_whatsapp(whatsapp)
    if usuario:
        return usuario
    return await supabase_service.criar_usuario(
        {
            "whatsapp": whatsapp,
            "nome": payload.get("nome"),
            "cpf": payload.get("cpf"),
            "nit": payload.get("nit"),
            "tipo_contribuinte": payload.get("tipo_contribuinte"),
        }
    )


def _calcular_por_tipo(request: EmitirGuiaRequest) -> CalculoSAL:
    if request.tipo_contribuinte in {"autonomo", "autonomo_simplificado"}:
        plano = "simplificado" if request.tipo_contribuinte == "autonomo_simplificado" else request.plano
        return calculator.calcular_contribuinte_individual(request.valor_base, plano)
    if request.tipo_contribuinte == "domestico":
        return calculator.calcular_domestico(request.valor_base)
    if request.tipo_contribuinte == "produtor_rural":
        return calculator.calcular_produtor_rural(request.valor_base, segurado_especial=False)
    if request.tipo_contribuinte == "complementacao":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Utilize o endpoint /api/v1/guias/complementacao para este tipo.",
        )
    if request.tipo_contribuinte == "facultativo_baixa_renda":
        valor = calculator.salario_minimo_2025 * SAL_CLASSES["facultativo_baixa_renda"]["aliquota"]
        return CalculoSAL(
            codigo_gps=SAL_CLASSES["facultativo_baixa_renda"]["codigo_gps"],
            valor=round(valor, 2),
            descricao=SAL_CLASSES["facultativo_baixa_renda"]["descricao"],
            detalhes={"base_calculo": calculator.salario_minimo_2025, "aliquota": 0.05},
        )
    if request.tipo_contribuinte == "facultativo":
        base = max(calculator.salario_minimo_2025, request.valor_base)
        valor = base * SAL_CLASSES["facultativo"]["aliquota"]
        return CalculoSAL(
            codigo_gps=SAL_CLASSES["facultativo"]["codigo_gps"],
            valor=round(valor, 2),
            descricao=SAL_CLASSES["facultativo"]["descricao"],
            detalhes={"base_calculo": base, "aliquota": 0.20},
        )
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de contribuinte não suportado.")


@router.post("/emitir")
async def emitir_guia(request: EmitirGuiaRequest):
    """
    Emite guia INSS e envia via WhatsApp.
    """
    try:
        if not validar_whatsapp(request.whatsapp):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="WhatsApp inválido.")

        calculo = _calcular_por_tipo(request)
        
        competencia = request.competencia or datetime.utcnow().strftime("%m/%Y")
        competencia = normalizar_competencia(competencia)
        vencimento = calcular_vencimento_padrao(competencia)

        usuario = await _obter_ou_criar_usuario(
            {"whatsapp": request.whatsapp, "tipo_contribuinte": request.tipo_contribuinte}
        )

        dados_contribuinte = {
            "nome": usuario.get("nome"),
            "cpf": usuario.get("cpf"),
            "nit": usuario.get("nit"),
            "whatsapp": request.whatsapp,
        }

        try:
            pdf_bytes = await run_in_threadpool(
                pdf_generator.gerar_guia,
                dados_contribuinte,
                calculo.valor,
                calculo.codigo_gps,
                competencia,
            )
        except Exception as pdf_error:
            import traceback
            raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(pdf_error)}")

        guia_salva = await supabase_service.salvar_guia(
            user_id=usuario["id"],
            guia_data={
                "codigo_gps": calculo.codigo_gps,
                "competencia": competencia,
                "valor": calculo.valor,
                "status": "pendente",
                "data_vencimento": vencimento.isoformat(),
            },
        )

        mensagem = (
            f"Sua guia do INSS código {calculo.codigo_gps} no valor de R$ {calculo.valor:,.2f} está pronta. "
            f"Vencimento em {vencimento.strftime('%d/%m/%Y')}."
        )
        
        envio = await whatsapp_service.enviar_pdf_whatsapp(request.whatsapp, pdf_bytes, mensagem)

        return {
            "guia": guia_salva,
            "whatsapp": {"sid": envio.sid, "status": envio.status, "media_url": envio.media_url},
            "detalhes_calculo": calculo.detalhes,
        }
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")


@router.post("/complementacao")
async def emitir_complementacao(request: ComplementacaoRequest):
    """
    Emite guia de complementação 11% → 20%.
    """
    try:
        if not validar_whatsapp(request.whatsapp):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="WhatsApp inválido.")

        competencias = [normalizar_competencia(item) for item in request.competencias]
        calculo = calculator.calcular_complementacao(competencias, request.valor_base)
        competencia_principal = competencias[-1]
        vencimento = calcular_vencimento_padrao(competencia_principal)

        usuario = await _obter_ou_criar_usuario({"whatsapp": request.whatsapp, "tipo_contribuinte": "complementacao"})

        dados_contribuinte = {
            "nome": usuario.get("nome"),
            "cpf": usuario.get("cpf"),
            "nit": usuario.get("nit"),
            "whatsapp": request.whatsapp,
        }

        pdf_bytes = await run_in_threadpool(
            pdf_generator.gerar_guia,
            dados_contribuinte,
            calculo.valor,
            calculo.codigo_gps,
            competencia_principal,
        )

        guia_salva = await supabase_service.salvar_guia(
            user_id=usuario["id"],
            guia_data={
                "codigo_gps": calculo.codigo_gps,
                "competencia": competencia_principal,
                "valor": calculo.valor,
                "status": "pendente",
                "data_vencimento": vencimento.isoformat(),
            },
        )

        mensagem = (
            f"Complementação gerada (código {calculo.codigo_gps}). "
            f"Total com juros: R$ {calculo.valor:,.2f}. Vencimento {vencimento.strftime('%d/%m/%Y')}."
        )
        
        envio = await whatsapp_service.enviar_pdf_whatsapp(request.whatsapp, pdf_bytes, mensagem)

        return {
            "guia": guia_salva,
            "whatsapp": {"sid": envio.sid, "status": envio.status, "media_url": envio.media_url},
            "detalhes_calculo": calculo.detalhes,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")

