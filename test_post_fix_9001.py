#!/usr/bin/env python3
"""Teste rápido dos endpoints POST após correções."""

import time
import requests
import json

def test_emitir_guia():
    """Test POST /api/v1/guias/emitir"""
    url = "http://localhost:9001/api/v1/guias/emitir"
    
    payload = {
        "whatsapp": "5511987654321",
        "tipo_contribuinte": "autonomo",
        "valor_base": 1000.00,
        "plano": "normal",
        "competencia": "02/2025"
    }
    
    print(f"\n[BLUE] Testando POST /api/v1/guias/emitir")
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"   [OK] SUCESSO - Response: {response.json()}")
            return True
        else:
            print(f"   [ERROR] ERRO - Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"   [ERROR] EXCECAO: {str(e)}")
        return False

def test_complementacao():
    """Test POST /api/v1/guias/complementacao"""
    url = "http://localhost:9001/api/v1/guias/complementacao"
    
    payload = {
        "whatsapp": "5511987654321",
        "competencias": ["01/2025", "02/2025"],
        "valor_base": 1000.00
    }
    
    print(f"\n[BLUE] Testando POST /api/v1/guias/complementacao")
    print(f"   Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"   [OK] SUCESSO - Response: {response.json()}")
            return True
        else:
            print(f"   [ERROR] ERRO - Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"   [ERROR] EXCECAO: {str(e)}")
        return False

def test_get():
    """Test GET / endpoint"""
    url = "http://localhost:9001/"
    
    print(f"\n[BLUE] Testando GET /")
    
    try:
        response = requests.get(url, timeout=5)
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print(f"   [OK] SUCESSO - Response: {response.json()}")
            return True
        else:
            print(f"   [ERROR] ERRO")
            return False
    except Exception as e:
        print(f"   [ERROR] EXCECAO: {str(e)}")
        return False

if __name__ == "__main__":
    # Wait for server to be ready
    print("Aguardando servidor iniciar...")
    time.sleep(3)
    
    results = []
    
    # Test GET first (should always work)
    results.append(("GET /", test_get()))
    
    # Test POST endpoints
    results.append(("POST /emitir", test_emitir_guia()))
    results.append(("POST /complementacao", test_complementacao()))
    
    # Summary
    print("\n" + "="*50)
    print("RESUMO DOS TESTES:")
    print("="*50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "[OK] PASS" if result else "[ERROR] FAIL"
        print(f"{status} - {name}")
    
    print(f"\nTotal: {passed}/{total} testes passaram")
    
    if passed == total:
        print("\n[SUCCESS] TODOS OS TESTES PASSARAM!")
    else:
        print(f"\n[WARN] {total - passed} teste(s) falharam")
