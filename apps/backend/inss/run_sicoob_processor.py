#!/usr/bin/env python3
"""
Script para iniciar o processador de notificações Sicoob.
Pode ser executado como um serviço ou agendado via cron.
"""

import sys
import os
from pathlib import Path

# Adicionar diretório ao path
sys.path.insert(0, str(Path(__file__).parent))

from process_sicoob_notifications import main
import asyncio

if __name__ == "__main__":
    print("Iniciando Processador de Notificações Sicoob...")
    print("Pressione Ctrl+C para encerrar")
    asyncio.run(main())
