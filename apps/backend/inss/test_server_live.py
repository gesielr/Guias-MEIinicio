#!/usr/bin/env python
"""
Script para testar servidor FastAPI com POST requests
Mantém o servidor rodando e envia requisições
"""
import subprocess
import time
import sys
import requests
import json

def test_server():
    """Testa o servidor enviando POST requests"""
    
    # Espera um pouco para o servidor iniciar
    print("⏳ Aguardando servidor iniciar...")
    time.sleep(4)
    
    # Teste 1: GET /
    print("\n🔵 Teste 1: GET /")
    try:
        r = requests.get("http://127.0.0.1:8003/", timeout=5)
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        if r.status_code == 200:
            print("   ✅ SUCESSO")
        else:
            print("   ❌ ERRO")
    except Exception as e:
        print(f"   ❌ Erro: {e}")
    
    # Teste 2: POST /api/v1/guias/emitir
    print("\n🔵 Teste 2: POST /api/v1/guias/emitir")
    payload = {
        "whatsapp": "5511987654321",
        "tipo_contribuinte": "autonomo",
        "valor_base": 1000.0,
        "plano": "normal",
        "competencia": "02/2025"
    }
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    try:
        r = requests.post("http://127.0.0.1:8003/api/v1/guias/emitir", json=payload, timeout=10)
        print(f"   Status: {r.status_code}")
        if r.status_code == 200:
            print(f"   ✅ SUCESSO - PDF recebido com {len(r.content)} bytes")
        else:
            print(f"   ❌ ERRO - Response: {r.text[:200]}")
    except Exception as e:
        print(f"   ❌ Erro: {type(e).__name__}: {e}")
    
    print("\n✅ Testes concluídos. O servidor continua rodando.")
    print("   Pressione Ctrl+C para encerrar.")

if __name__ == "__main__":
    test_server()
