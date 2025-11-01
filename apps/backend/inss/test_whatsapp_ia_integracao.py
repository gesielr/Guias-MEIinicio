#!/usr/bin/env python3
"""
TESTE: WHATSAPP + IA - INTEGRAÇÃO COMPLETA
Valida fluxo completo de comunicação WhatsApp com assistente IA
"""

import asyncio
import sys
from pathlib import Path

# Adicionar app ao path
sys.path.insert(0, str(Path(__file__).parent))

def print_header(titulo: str):
    """Imprime cabeçalho formatado"""
    print("\n" + "=" * 80)
    print(f"  {titulo}")
    print("=" * 80)

def print_subheader(titulo: str):
    """Imprime subcabeçalho formatado"""
    print(f"\n{titulo}")
    print("-" * 80)

def print_success(msg: str):
    """Imprime mensagem de sucesso"""
    print(f"  ✓ {msg}")

def print_error(msg: str):
    """Imprime mensagem de erro"""
    print(f"  ✗ {msg}")

def print_warning(msg: str):
    """Imprime mensagem de aviso"""
    print(f"  ⚠ {msg}")

def print_info(msg: str):
    """Imprime mensagem informativa"""
    print(f"  ℹ {msg}")

async def test_whatsapp_twilio_config():
    """Testa configuração do Twilio WhatsApp"""
    print_subheader("[1/6] Configuração Twilio WhatsApp")
    
    try:
        from app.config import get_settings
        settings = get_settings()
        
        # Verificar credenciais
        credenciais_placeholder = {"", None, "seu-sid", "seu-token"}
        
        if settings.twilio_account_sid in credenciais_placeholder:
            print_warning("TWILIO_ACCOUNT_SID não configurado")
            print_info("Configure em .env: TWILIO_ACCOUNT_SID=seu-valor-real")
            return False
        else:
            print_success(f"TWILIO_ACCOUNT_SID: {settings.twilio_account_sid[:10]}...")
        
        if settings.twilio_auth_token in credenciais_placeholder:
            print_warning("TWILIO_AUTH_TOKEN não configurado")
            print_info("Configure em .env: TWILIO_AUTH_TOKEN=seu-valor-real")
            return False
        else:
            print_success(f"TWILIO_AUTH_TOKEN: {settings.twilio_auth_token[:10]}...")
        
        if not settings.twilio_whatsapp_number or not settings.twilio_whatsapp_number.startswith("whatsapp:"):
            print_error("TWILIO_WHATSAPP_NUMBER deve começar com 'whatsapp:+'")
            return False
        else:
            print_success(f"TWILIO_WHATSAPP_NUMBER: {settings.twilio_whatsapp_number}")
        
        print_success("Configuração Twilio OK")
        return True
        
    except Exception as e:
        print_error(f"Falha ao verificar configuração: {str(e)}")
        return False

async def test_whatsapp_service():
    """Testa inicialização do serviço WhatsApp"""
    print_subheader("[2/6] Serviço WhatsApp")
    
    try:
        from app.services.whatsapp_service import WhatsAppService
        from app.services.supabase_service import SupabaseService
        
        supabase = SupabaseService()
        whatsapp = WhatsAppService(supabase_service=supabase)
        
        print_success("WhatsAppService inicializado")
        
        # Verificar cliente Twilio
        if whatsapp.twilio_client:
            print_success("Cliente Twilio conectado")
        else:
            print_warning("Cliente Twilio em modo mock (credenciais não configuradas)")
            print_info("Configure credenciais reais do Twilio para testes completos")
        
        print_success("Serviço WhatsApp OK")
        return True
        
    except Exception as e:
        print_error(f"Falha ao inicializar serviço: {str(e)}")
        return False

async def test_openai_config():
    """Testa configuração da OpenAI"""
    print_subheader("[3/6] Configuração OpenAI (IA)")
    
    try:
        from app.config import get_settings
        settings = get_settings()
        
        if not settings.openai_api_key or settings.openai_api_key == "sua-chave-openai":
            print_warning("OPENAI_API_KEY não configurado")
            print_info("Configure em .env: OPENAI_API_KEY=sk-...")
            print_info("IA funcionará em modo padrão (sem GPT)")
            return "warning"
        else:
            # Validar formato da chave
            if settings.openai_api_key.startswith("sk-"):
                print_success(f"OPENAI_API_KEY: {settings.openai_api_key[:10]}...")
                print_success("Configuração OpenAI OK")
                return True
            else:
                print_error("OPENAI_API_KEY com formato inválido (deve começar com 'sk-')")
                return False
        
    except Exception as e:
        print_error(f"Falha ao verificar configuração: {str(e)}")
        return False

async def test_ai_agent():
    """Testa inicialização do agente IA"""
    print_subheader("[4/6] Agente IA (ChatAgent)")
    
    try:
        from app.services.ai_agent import INSSChatAgent
        
        agent = INSSChatAgent()
        print_success("INSSChatAgent inicializado")
        
        if agent.llm:
            print_success("LLM (ChatOpenAI) conectado")
            print_info("IA funcionará com GPT da OpenAI")
        else:
            print_warning("LLM não inicializado (modo padrão)")
            print_info("Configure OPENAI_API_KEY para habilitar GPT")
        
        # Testar resposta
        contexto = {
            "whatsapp": "+5548991117268",
            "tipo_contribuinte": "autonomo"
        }
        
        resposta = await agent.processar_mensagem(
            "Qual o valor da contribuição para autônomo?", 
            contexto
        )
        
        if resposta:
            print_success("Agente processou mensagem com sucesso")
            print_info(f"Resposta (primeiros 100 chars): {resposta[:100]}...")
        else:
            print_error("Agente não retornou resposta")
            return False
        
        print_success("Agente IA OK")
        return True
        
    except Exception as e:
        print_error(f"Falha ao testar agente: {str(e)}")
        return False

async def test_webhook_flow():
    """Testa fluxo completo do webhook"""
    print_subheader("[5/6] Fluxo Webhook WhatsApp → IA → Resposta")
    
    try:
        from app.services.whatsapp_service import WhatsAppService
        from app.services.supabase_service import SupabaseService
        from app.services.ai_agent import INSSChatAgent
        
        # Simular payload do webhook
        payload = {
            "From": "whatsapp:+5548991117268",
            "Body": "Quanto preciso pagar de INSS como MEI?"
        }
        
        numero = payload["From"].replace("whatsapp:", "")
        mensagem = payload["Body"]
        
        print_info(f"Simulando webhook: {numero} → {mensagem[:50]}...")
        
        # 1. Validar número
        from app.utils.validators import validar_whatsapp
        if not validar_whatsapp(numero):
            print_error("Número WhatsApp inválido")
            return False
        print_success("Número validado")
        
        # 2. Buscar usuário (opcional)
        supabase = SupabaseService()
        usuario = await supabase.obter_usuario_por_whatsapp(numero)
        print_info(f"Usuário encontrado: {bool(usuario)}")
        
        # 3. Processar com IA
        agent = INSSChatAgent()
        contexto = {
            "whatsapp": numero,
            "tipo_contribuinte": usuario.get("tipo_contribuinte") if usuario else None
        }
        resposta = await agent.processar_mensagem(mensagem, contexto)
        print_success(f"IA processou mensagem ({len(resposta)} chars)")
        
        # 4. Registrar conversa (se usuário existir)
        if usuario:
            await supabase.registrar_conversa(usuario["id"], mensagem, resposta)
            print_success("Conversa registrada no Supabase")
        
        # 5. Enviar resposta via WhatsApp
        whatsapp = WhatsAppService(supabase_service=supabase)
        resultado = await whatsapp.enviar_texto(numero, resposta[:500])  # Limitar resposta
        
        if resultado.sid:
            print_success(f"Resposta enviada via WhatsApp (SID: {resultado.sid})")
        else:
            print_warning("Resposta em modo mock (Twilio não configurado)")
        
        print_success("Fluxo webhook completo OK")
        return True
        
    except Exception as e:
        print_error(f"Falha no fluxo webhook: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def test_pdf_delivery():
    """Testa envio de PDF via WhatsApp"""
    print_subheader("[6/6] Entrega de PDF INSS via WhatsApp")
    
    try:
        from app.services.whatsapp_service import WhatsAppService
        from app.services.supabase_service import SupabaseService
        
        # Criar PDF fake para teste
        pdf_bytes = b"%PDF-1.4\nTeste de PDF INSS\n%%EOF"
        mensagem = "Aqui está sua guia INSS! 📄"
        numero = "+5548991117268"
        
        supabase = SupabaseService()
        whatsapp = WhatsAppService(supabase_service=supabase)
        
        resultado = await whatsapp.enviar_pdf_whatsapp(numero, pdf_bytes, mensagem)
        
        if resultado.sid:
            print_success(f"PDF enviado via WhatsApp (SID: {resultado.sid})")
            if resultado.media_url:
                print_success(f"URL do PDF: {resultado.media_url[:60]}...")
        else:
            print_warning("Envio em modo mock (Twilio não configurado)")
        
        print_success("Entrega de PDF OK")
        return True
        
    except Exception as e:
        print_error(f"Falha ao enviar PDF: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def run_all_tests():
    """Executa todos os testes de integração WhatsApp + IA"""
    print_header("TESTE COMPLETO: WHATSAPP + IA INTEGRATION")
    
    resultados = {
        "twilio_config": False,
        "whatsapp_service": False,
        "openai_config": False,
        "ai_agent": False,
        "webhook_flow": False,
        "pdf_delivery": False
    }
    
    # Teste 1: Configuração Twilio
    resultados["twilio_config"] = await test_whatsapp_twilio_config()
    
    # Teste 2: Serviço WhatsApp
    resultados["whatsapp_service"] = await test_whatsapp_service()
    
    # Teste 3: Configuração OpenAI
    openai_result = await test_openai_config()
    resultados["openai_config"] = openai_result in [True, "warning"]
    
    # Teste 4: Agente IA
    resultados["ai_agent"] = await test_ai_agent()
    
    # Teste 5: Fluxo Webhook
    resultados["webhook_flow"] = await test_webhook_flow()
    
    # Teste 6: Entrega de PDF
    resultados["pdf_delivery"] = await test_pdf_delivery()
    
    # Resumo final
    print_header("RESUMO DOS TESTES")
    
    testes = [
        ("Configuração Twilio WhatsApp", resultados["twilio_config"]),
        ("Serviço WhatsApp", resultados["whatsapp_service"]),
        ("Configuração OpenAI", resultados["openai_config"]),
        ("Agente IA", resultados["ai_agent"]),
        ("Fluxo Webhook Completo", resultados["webhook_flow"]),
        ("Entrega de PDF", resultados["pdf_delivery"]),
    ]
    
    total = len(testes)
    passou = sum(1 for _, resultado in testes if resultado)
    
    for nome, resultado in testes:
        simbolo = "✓" if resultado else "✗"
        status = "PASSOU" if resultado else "FALHOU"
        print(f"  {simbolo} {nome:.<50} {status}")
    
    print("\n" + "=" * 80)
    print(f"  RESULTADO FINAL: {passou}/{total} testes passaram ({passou*100//total}%)")
    print("=" * 80)
    
    if passou == total:
        print_success("\n🎉 TODOS OS TESTES PASSARAM! Sistema WhatsApp + IA pronto!")
    elif passou >= total * 0.8:
        print_warning(f"\n⚠ {passou}/{total} testes OK - Configure credenciais para 100%")
    else:
        print_error(f"\n✗ Apenas {passou}/{total} testes passaram - Verifique erros acima")
    
    return passou == total

if __name__ == "__main__":
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠ Teste interrompido pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n✗ Erro crítico: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
