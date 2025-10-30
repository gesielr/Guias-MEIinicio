from __future__ import annotations

import sys
import traceback
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings
from .routes import inss, users, webhook

# Configure logging ANTES de tudo
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app_debug.log')
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager com tratamento de erro robusto
    """
    logger.info("=" * 80)
    logger.info("[START] INICIANDO LIFESPAN CONTEXT MANAGER")
    logger.info("=" * 80)
    
    try:
        # ===== STARTUP =====
        logger.info("[CONFIG] Carregando configuracoes...")
        settings = get_settings()
        logger.info(f"[OK] App Name: {settings.app_name}")
        logger.info(f"[OK] App Version: {settings.app_version}")
        
        logger.info("=" * 80)
        logger.info("[OK] LIFESPAN STARTUP COMPLETO - SERVIDOR PRONTO")
        logger.info("=" * 80)
        
        yield  # PONTO CRITICO: Servidor roda aqui
        
    except Exception as e:
        logger.error("=" * 80)
        logger.error("[ERROR] ERRO CRITICO NO LIFESPAN STARTUP")
        logger.error("=" * 80)
        logger.error(f"Tipo: {type(e).__name__}")
        logger.error(f"Mensagem: {str(e)}")
        logger.error("Stack Trace:")
        logger.error(traceback.format_exc())
        logger.error("=" * 80)
        
        # NAO re-raise aqui, ou o servidor nao inicia
        # Em vez disso, crie um app em modo degradado
        app.state.startup_error = str(e)
        yield  # Permite servidor iniciar mesmo com erro
        
    finally:
        # ===== SHUTDOWN =====
        logger.info("=" * 80)
        logger.info("[STOP] INICIANDO SHUTDOWN DO LIFESPAN")
        logger.info("=" * 80)
        
        try:
            logger.info("[OK] SHUTDOWN COMPLETO")
            
        except Exception as e:
            logger.error(f"[ERROR] Erro no shutdown: {e}")
            logger.error(traceback.format_exc())


# ===== MIDDLEWARE DE DEBUG =====
class DebugMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        logger.info("=" * 80)
        logger.info(f"[REQUEST] {request.method} {request.url.path}")
        logger.info(f"   Headers: {dict(request.headers)}")
        logger.info("=" * 80)
        
        start_time = time.time()
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            logger.info("=" * 80)
            logger.info(f"[RESPONSE] Status {response.status_code}")
            logger.info(f"   Tempo: {process_time:.3f}s")
            logger.info("=" * 80)
            
            return response
            
        except Exception as e:
            logger.error("=" * 80)
            logger.error(f"[ERROR] MIDDLEWARE: {type(e).__name__}")
            logger.error(f"   Mensagem: {str(e)}")
            logger.error(f"   Stack Trace:")
            logger.error(traceback.format_exc())
            logger.error("=" * 80)
            raise


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name, 
        version=settings.app_version, 
        lifespan=lifespan,
        debug=True
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Adiciona middleware de debug APOS CORS
    logger.info("[DEBUG] Adding DebugMiddleware...")
    app.add_middleware(DebugMiddleware)

    # ===== EXCEPTION HANDLER GLOBAL =====
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("=" * 80)
        logger.error("[ERROR] EXCECAO NAO TRATADA CAPTURADA")
        logger.error("=" * 80)
        logger.error(f"URL: {request.method} {request.url}")
        logger.error(f"Tipo: {type(exc).__name__}")
        logger.error(f"Mensagem: {str(exc)}")
        logger.error("Stack Trace:")
        logger.error(traceback.format_exc())
        logger.error("=" * 80)
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": str(exc),
                "type": type(exc).__name__
            }
        )

    # ===== ROTA DE HEALTH CHECK =====
    @app.get("/")
    async def root():
        logger.info("[ROUTE] Rota raiz (/) chamada")
        
        # Verifica se houve erro no startup
        if hasattr(app.state, 'startup_error'):
            logger.warning(f"[WARN] Servidor em modo degradado: {app.state.startup_error}")
            return {
                "status": "degraded",
                "message": "Servidor iniciou com erros",
                "error": app.state.startup_error
            }
        
        return {
            "status": "ok",
            "message": "INSS Guias API esta funcionando",
            "version": "1.0.0"
        }

    @app.get("/health")
    async def health_check():
        logger.info("[ROUTE] Health check chamado")
        return {
            "status": "healthy",
            "timestamp": time.time()
        }

    # ===== INCLUDE ROUTERS COM TRY-EXCEPT =====
    logger.info("[ROUTERS] Incluindo routers...")

    try:
        logger.info("   [OK] Incluindo router INSS...")
        app.include_router(inss.router, tags=["INSS"])
        
        logger.info("   [OK] Incluindo router Webhook...")
        app.include_router(webhook.router, prefix="/webhook", tags=["Webhook"])
        
        logger.info("   [OK] Incluindo router Users...")
        app.include_router(users.router, prefix="/api/v1", tags=["Users"])
        
        logger.info("[OK] Todos os routers incluidos com sucesso")
        
    except Exception as e:
        logger.error("=" * 80)
        logger.error("[ERROR] ERRO AO INCLUIR ROUTERS")
        logger.error("=" * 80)
        logger.error(f"Tipo: {type(e).__name__}")
        logger.error(f"Mensagem: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error("=" * 80)
        # Nao re-raise, permite app iniciar sem routers

    return app


app = create_app()
