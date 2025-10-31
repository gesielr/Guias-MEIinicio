"""
Processador de Notificações Sicoob via WhatsApp
Consome a tabela sicoob_notificacoes e envia mensagens automáticas
"""

import asyncio
import os
from typing import Dict, Any, Optional
from datetime import datetime

from supabase import create_client, Client
from app.services.whatsapp_service import WhatsAppService
from app.services.supabase_service import SupabaseService
from app.config import get_settings


class SicoobNotificationProcessor:
    """Processador de notificações Sicoob."""

    def __init__(self):
        settings = get_settings()
        self.supabase: Client = create_client(
            str(settings.supabase_url), settings.supabase_key
        )
        self.supabase_service = SupabaseService()
        self.whatsapp_service = WhatsAppService(supabase_service=self.supabase_service)
        
        # Templates de mensagens
        self.templates = {
            "pagamento_recebido": self._template_pagamento_recebido,
            "pagamento_devolvido": self._template_pagamento_devolvido,
            "boleto_pago": self._template_boleto_pago,
            "boleto_vencido": self._template_boleto_vencido,
            "cobranca_paga": self._template_cobranca_paga,
            "cobranca_cancelada": self._template_cobranca_cancelada,
        }

    async def processar_notificacoes_pendentes(self) -> int:
        """Processa todas as notificações pendentes."""
        print("[INFO] Buscando notificações pendentes...")
        
        try:
            # Buscar notificações pendentes
            response = self.supabase.table("sicoob_notificacoes").select(
                "*, cobranca:sicoob_cobrancas!identificador_cobranca(*)"
            ).eq("status", "PENDENTE").order("criado_em").limit(50).execute()
            
            notificacoes = response.data
            print(f"[INFO] Encontradas {len(notificacoes)} notificações pendentes")
            
            processadas = 0
            for notificacao in notificacoes:
                try:
                    await self._processar_notificacao(notificacao)
                    processadas += 1
                except Exception as e:
                    print(f"[ERROR] Erro ao processar notificação {notificacao['id']}: {e}")
                    await self._marcar_falha(notificacao["id"], str(e))
            
            print(f"[INFO] Processadas {processadas}/{len(notificacoes)} notificações")
            return processadas
            
        except Exception as e:
            print(f"[ERROR] Erro ao buscar notificações: {e}")
            return 0

    async def _processar_notificacao(self, notificacao: Dict[str, Any]) -> None:
        """Processa uma notificação individual."""
        notificacao_id = notificacao["id"]
        tipo_notificacao = notificacao["tipo_notificacao"]
        cobranca = notificacao.get("cobranca", {})
        
        if not cobranca:
            print(f"[WARN] Notificação {notificacao_id} sem cobrança vinculada")
            await self._marcar_falha(notificacao_id, "Cobrança não encontrada")
            return
        
        # Obter número do WhatsApp
        whatsapp = cobranca.get("pagador_whatsapp")
        if not whatsapp:
            print(f"[WARN] Cobrança {cobranca['identificador']} sem WhatsApp")
            await self._marcar_falha(notificacao_id, "WhatsApp não informado")
            return
        
        # Gerar mensagem baseada no template
        template_func = self.templates.get(tipo_notificacao)
        if not template_func:
            print(f"[WARN] Template não encontrado para {tipo_notificacao}")
            mensagem = self._template_generico(cobranca, notificacao["dados_notificacao"])
        else:
            mensagem = template_func(cobranca, notificacao["dados_notificacao"])
        
        # Enviar mensagem
        print(f"[INFO] Enviando notificação {tipo_notificacao} para {whatsapp}")
        
        # Se houver PDF, enviar com mídia
        pdf_url = cobranca.get("pdf_url")
        if pdf_url:
            # TODO: Baixar PDF e enviar como anexo
            resultado = await self.whatsapp_service.enviar_texto(whatsapp, mensagem)
        else:
            resultado = await self.whatsapp_service.enviar_texto(whatsapp, mensagem)
        
        # Marcar como enviada
        if resultado.sid and resultado.status != "mock-error":
            await self._marcar_enviada(notificacao_id)
            print(f"[OK] Notificação enviada: {resultado.sid}")
        else:
            await self._marcar_falha(notificacao_id, "Falha no envio via Twilio")

    async def _marcar_enviada(self, notificacao_id: str) -> None:
        """Marca notificação como enviada."""
        self.supabase.table("sicoob_notificacoes").update({
            "status": "ENVIADA",
            "processado_em": datetime.utcnow().isoformat(),
        }).eq("id", notificacao_id).execute()

    async def _marcar_falha(self, notificacao_id: str, erro: str) -> None:
        """Marca notificação como falha."""
        # Buscar tentativas atuais
        response = self.supabase.table("sicoob_notificacoes").select(
            "tentativas"
        ).eq("id", notificacao_id).single().execute()
        
        tentativas = (response.data.get("tentativas") or 0) + 1
        
        self.supabase.table("sicoob_notificacoes").update({
            "status": "FALHOU" if tentativas >= 3 else "PENDENTE",
            "tentativas": tentativas,
            "ultima_tentativa": datetime.utcnow().isoformat(),
            "erro_mensagem": erro,
        }).eq("id", notificacao_id).execute()

    # ============================================================
    # TEMPLATES DE MENSAGENS
    # ============================================================

    def _template_pagamento_recebido(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template para pagamento PIX recebido."""
        valor = dados.get("valor") or cobranca.get("valor_pago") or cobranca.get("valor_original")
        txid = cobranca.get("identificador")
        
        return f"""✅ *Pagamento Recebido via PIX*

Olá! Confirmamos o recebimento do seu pagamento.

📋 *Identificador:* {txid}
💰 *Valor:* R$ {valor:.2f}
📅 *Data:* {datetime.utcnow().strftime('%d/%m/%Y às %H:%M')}

Obrigado por utilizar nossos serviços! 🙏

_GuiasMEI - Gestão Fiscal Simplificada_"""

    def _template_pagamento_devolvido(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template para pagamento PIX devolvido."""
        txid = cobranca.get("identificador")
        motivo = dados.get("motivo_devolucao", "Não informado")
        
        return f"""⚠️ *Pagamento Devolvido*

Informamos que seu pagamento foi devolvido.

📋 *Identificador:* {txid}
❓ *Motivo:* {motivo}
📅 *Data:* {datetime.utcnow().strftime('%d/%m/%Y às %H:%M')}

Se precisar de ajuda, entre em contato conosco.

_GuiasMEI - Gestão Fiscal Simplificada_"""

    def _template_boleto_pago(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template para boleto pago."""
        valor = dados.get("valor") or cobranca.get("valor_pago") or cobranca.get("valor_original")
        nosso_numero = cobranca.get("identificador")
        
        return f"""✅ *Boleto Pago com Sucesso*

Confirmamos o pagamento do seu boleto.

📋 *Nosso Número:* {nosso_numero}
💰 *Valor:* R$ {valor:.2f}
📅 *Data do Pagamento:* {datetime.utcnow().strftime('%d/%m/%Y')}

Obrigado pela preferência! 🙏

_GuiasMEI - Gestão Fiscal Simplificada_"""

    def _template_boleto_vencido(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template para boleto vencido."""
        nosso_numero = cobranca.get("identificador")
        valor = cobranca.get("valor_original")
        data_vencimento = cobranca.get("data_vencimento")
        
        return f"""⏰ *Boleto Vencido - Ação Necessária*

Seu boleto venceu e precisa de atenção.

📋 *Nosso Número:* {nosso_numero}
💰 *Valor:* R$ {valor:.2f}
📅 *Vencimento:* {data_vencimento}

Para regularizar, solicite um novo boleto atualizado.

_GuiasMEI - Gestão Fiscal Simplificada_"""

    def _template_cobranca_paga(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template para cobrança paga."""
        identificador = cobranca.get("identificador")
        valor = dados.get("valor") or cobranca.get("valor_pago") or cobranca.get("valor_original")
        
        return f"""✅ *Cobrança Quitada*

Sua cobrança foi paga com sucesso!

📋 *Identificador:* {identificador}
💰 *Valor:* R$ {valor:.2f}
📅 *Data:* {datetime.utcnow().strftime('%d/%m/%Y às %H:%M')}

Muito obrigado! 🎉

_GuiasMEI - Gestão Fiscal Simplificada_"""

    def _template_cobranca_cancelada(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template para cobrança cancelada."""
        identificador = cobranca.get("identificador")
        motivo = dados.get("motivo", "Solicitação do usuário")
        
        return f"""❌ *Cobrança Cancelada*

Sua cobrança foi cancelada.

📋 *Identificador:* {identificador}
❓ *Motivo:* {motivo}
📅 *Data:* {datetime.utcnow().strftime('%d/%m/%Y às %H:%M')}

Se tiver dúvidas, estamos à disposição.

_GuiasMEI - Gestão Fiscal Simplificada_"""

    def _template_generico(
        self, cobranca: Dict[str, Any], dados: Dict[str, Any]
    ) -> str:
        """Template genérico para notificações."""
        identificador = cobranca.get("identificador")
        tipo = cobranca.get("tipo")
        status = cobranca.get("status")
        
        return f"""📬 *Atualização de Cobrança*

Tipo: {tipo}
Identificador: {identificador}
Status: {status}

_GuiasMEI - Gestão Fiscal Simplificada_"""


async def main():
    """Função principal para execução do processador."""
    print("=" * 60)
    print("Processador de Notificações Sicoob")
    print("=" * 60)
    
    processor = SicoobNotificationProcessor()
    
    # Processar em loop contínuo (ou pode ser um cron job)
    while True:
        try:
            processadas = await processor.processar_notificacoes_pendentes()
            
            if processadas > 0:
                print(f"\n[OK] {processadas} notificações processadas\n")
            
            # Aguardar 30 segundos antes de processar novamente
            await asyncio.sleep(30)
            
        except KeyboardInterrupt:
            print("\n[INFO] Encerrando processador...")
            break
        except Exception as e:
            print(f"\n[ERROR] Erro no loop principal: {e}")
            await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
