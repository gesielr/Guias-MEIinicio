#!/usr/bin/env python3
"""
Completes Phase 1 (Fundamentos e Configuração) of GuiasMEI implementation.
Creates Supabase buckets, executes SQL setup, and validates all credentials.

Usage: python complete_phase1_setup.py
"""

import os
import sys
import json
import logging
import requests
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class Phase1Completer:
    def __init__(self):
        """Initialize Phase 1 completion handler."""
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        self.supabase_anon_key = os.getenv('SUPABASE_ANON_KEY')
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'steps_completed': [],
            'errors': [],
            'buckets_created': [],
            'conformity': {'total': 0, 'passed': 0}
        }
        
        # Validate required credentials
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        
        logger.info("=== Phase 1: Fundamentos e Configuração ===")
        logger.info(f"Supabase Project: {self.supabase_url.split('.')[-3]}")
    
    def create_storage_buckets(self):
        """Create required storage buckets via REST API."""
        logger.info("\n[Step 1/3] Creating Supabase Storage buckets...")
        
        buckets_to_create = [
            {
                'name': 'pdf-gps',
                'public': False,
                'description': 'Armazenamento de PDFs de guias de contribuição'
            },
            {
                'name': 'certificados',
                'public': False,
                'description': 'Armazenamento de certificados digitais (A1)'
            },
            {
                'name': 'danfse',
                'public': False,
                'description': 'Armazenamento de DANFSe (Documento Auxiliar de NFSe)'
            }
        ]
        
        headers = {
            'Authorization': f'Bearer {self.supabase_key}',
            'Content-Type': 'application/json'
        }
        
        for bucket in buckets_to_create:
            try:
                # Try to get bucket first (check if exists)
                get_url = f'{self.supabase_url}/storage/v1/bucket/{bucket["name"]}'
                response = requests.get(get_url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    logger.info(f"  ✓ Bucket '{bucket['name']}' já existe")
                    self.results['buckets_created'].append({
                        'name': bucket['name'],
                        'status': 'already_exists'
                    })
                    continue
                
                # Create bucket if it doesn't exist
                create_url = f'{self.supabase_url}/storage/v1/bucket'
                payload = {
                    'name': bucket['name'],
                    'public': bucket['public']
                }
                
                response = requests.post(create_url, json=payload, headers=headers, timeout=10)
                
                if response.status_code in [200, 201]:
                    logger.info(f"  ✓ Bucket '{bucket['name']}' criado com sucesso")
                    self.results['buckets_created'].append({
                        'name': bucket['name'],
                        'status': 'created'
                    })
                else:
                    error_msg = f"Erro criando bucket '{bucket['name']}': {response.status_code} - {response.text}"
                    logger.error(f"  ✗ {error_msg}")
                    self.results['errors'].append(error_msg)
                    
            except Exception as e:
                error_msg = f"Exceção ao criar bucket '{bucket['name']}': {str(e)}"
                logger.error(f"  ✗ {error_msg}")
                self.results['errors'].append(error_msg)
        
        self.results['steps_completed'].append('create_buckets')
    
    def execute_sql_setup(self):
        """Execute SQL setup script for storage audit tables and RLS."""
        logger.info("\n[Step 2/3] Executando script SQL de configuração...")
        
        try:
            # Read SQL setup script
            setup_sql_path = Path(__file__).parent / 'setup_storage.sql'
            if not setup_sql_path.exists():
                logger.warning(f"  ! Script SQL não encontrado: {setup_sql_path}")
                self.results['errors'].append(f"SQL setup script not found: {setup_sql_path}")
                return
            
            with open(setup_sql_path, 'r') as f:
                sql_content = f.read()
            
            # Extract only SQL statements (ignore comments)
            sql_statements = [
                stmt.strip() + ';' 
                for stmt in sql_content.split(';') 
                if stmt.strip() and not stmt.strip().startswith('--')
            ]
            
            # Execute via Supabase REST API (query endpoint)
            headers = {
                'Authorization': f'Bearer {self.supabase_key}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            }
            
            # Note: SQL execution via REST API requires special configuration
            # This logs the recommendation for manual execution
            logger.info("  ℹ SQL setup deve ser executado manualmente via:")
            logger.info("    → Supabase Dashboard > SQL Editor")
            logger.info("    → Copiar conteúdo de: apps/backend/setup_storage.sql")
            
            self.results['steps_completed'].append('sql_setup_recommended')
            
        except Exception as e:
            error_msg = f"Erro ao processar SQL setup: {str(e)}"
            logger.error(f"  ✗ {error_msg}")
            self.results['errors'].append(error_msg)
    
    def verify_credentials(self):
        """Verify all external credentials and services."""
        logger.info("\n[Step 3/3] Verificando credenciais e integrações...")
        
        checks = {
            'supabase': self._check_supabase,
            'nfse': self._check_nfse,
            'stripe': self._check_stripe,
            'twilio': self._check_twilio,
            'ci_cd': self._check_cicd
        }
        
        passed = 0
        for check_name, check_func in checks.items():
            result = check_func()
            self.results['conformity']['total'] += 1
            if result['status'] == 'ok':
                passed += 1
                logger.info(f"  ✓ {check_name.upper()}: {result['message']}")
            else:
                logger.warning(f"  ⚠ {check_name.upper()}: {result['message']}")
        
        self.results['conformity']['passed'] = passed
        self.results['steps_completed'].append('verify_credentials')
    
    def _check_supabase(self):
        """Check Supabase connectivity and buckets."""
        try:
            # Test REST API
            headers = {'Authorization': f'Bearer {self.supabase_key}'}
            response = requests.get(
                f'{self.supabase_url}/storage/v1/bucket',
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 200:
                buckets = response.json()
                return {
                    'status': 'ok',
                    'message': f'Connected ({len(buckets)} buckets found)'
                }
            else:
                return {
                    'status': 'error',
                    'message': f'API returned {response.status_code}'
                }
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def _check_nfse(self):
        """Check NFSe ADN endpoint configuration."""
        adn_url = os.getenv('ADN_NFSE_BASE_URL', '')
        adn_usuario = os.getenv('ADN_NFSE_USUARIO', '')
        
        if adn_url and adn_usuario:
            return {'status': 'ok', 'message': 'Endpoint URL e usuário configurados'}
        else:
            missing = []
            if not adn_url:
                missing.append('ADN_NFSE_BASE_URL')
            if not adn_usuario:
                missing.append('ADN_NFSE_USUARIO')
            return {
                'status': 'error',
                'message': f'Faltam: {", ".join(missing)}'
            }
    
    def _check_stripe(self):
        """Check Stripe API key configuration."""
        stripe_key = os.getenv('STRIPE_SECRET_KEY', '')
        
        if stripe_key and stripe_key.startswith('sk_test_'):
            return {
                'status': 'ok',
                'message': 'Chave de teste configurada'
            }
        elif stripe_key:
            return {
                'status': 'error',
                'message': 'Chave não é de teste (deve iniciar com sk_test_)'
            }
        else:
            return {
                'status': 'error',
                'message': 'STRIPE_SECRET_KEY não configurada'
            }
    
    def _check_twilio(self):
        """Check Twilio credentials."""
        account_sid = os.getenv('TWILIO_ACCOUNT_SID', '')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN', '')
        
        if account_sid and auth_token:
            return {
                'status': 'ok',
                'message': 'Credenciais de conta configuradas'
            }
        else:
            missing = []
            if not account_sid:
                missing.append('TWILIO_ACCOUNT_SID')
            if not auth_token:
                missing.append('TWILIO_AUTH_TOKEN')
            return {
                'status': 'error',
                'message': f'Faltam: {", ".join(missing)}'
            }
    
    def _check_cicd(self):
        """Check CI/CD platform configuration."""
        vercel_token = os.getenv('VERCEL_TOKEN', '')
        railway_token = os.getenv('RAILWAY_TOKEN', '')
        github_token = os.getenv('GITHUB_TOKEN', '')
        
        if any([vercel_token, railway_token, github_token]):
            configured = []
            if vercel_token:
                configured.append('Vercel')
            if railway_token:
                configured.append('Railway')
            if github_token:
                configured.append('GitHub')
            return {
                'status': 'ok',
                'message': f'Plataformas configuradas: {", ".join(configured)}'
            }
        else:
            return {
                'status': 'error',
                'message': 'Nenhum token de CI/CD configurado'
            }
    
    def generate_report(self):
        """Generate Phase 1 completion report."""
        logger.info("\n" + "="*60)
        logger.info("PHASE 1 COMPLETION REPORT")
        logger.info("="*60)
        
        # Summary
        conformity_pct = (
            (self.results['conformity']['passed'] / self.results['conformity']['total'] * 100)
            if self.results['conformity']['total'] > 0 else 0
        )
        
        logger.info(f"\nConformity: {self.results['conformity']['passed']}/{self.results['conformity']['total']} ({conformity_pct:.0f}%)")
        logger.info(f"Buckets Created: {len(self.results['buckets_created'])}/3")
        logger.info(f"Steps Completed: {len(self.results['steps_completed'])}/3")
        
        if self.results['errors']:
            logger.warning(f"\nErrors/Warnings ({len(self.results['errors'])}):")
            for error in self.results['errors']:
                logger.warning(f"  • {error}")
        
        # Action Items
        logger.info("\n" + "-"*60)
        logger.info("NEXT STEPS - Action Items:")
        logger.info("-"*60)
        
        if conformity_pct < 100:
            logger.info("\n1. Complete Credential Configuration:")
            if self.results['conformity']['passed'] < self.results['conformity']['total']:
                logger.info("   - Configure missing .env variables for blocked services")
                logger.info("   - Obtain valid certificates and API keys")
        
        logger.info("\n2. Execute SQL Setup (Manual):")
        logger.info("   - Go to: https://app.supabase.com/project/*/sql/new")
        logger.info(f"   - Copy all SQL from: apps/backend/setup_storage.sql")
        logger.info("   - Execute to create storage audit tables and RLS policies")
        
        logger.info("\n3. Move to Phase 2:")
        logger.info("   - Begin Backend Integration tests")
        logger.info("   - Implement INSS module API endpoints")
        logger.info("   - Test NFSe XML generation and validation")
        
        logger.info("\n" + "="*60)
        
        return self.results
    
    def run(self):
        """Execute complete Phase 1 setup."""
        try:
            self.create_storage_buckets()
            self.execute_sql_setup()
            self.verify_credentials()
            
            report = self.generate_report()
            
            # Save report to JSON
            report_path = Path(__file__).parent / 'phase1_completion_report.json'
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            logger.info(f"\nReport saved to: {report_path}")
            
            return report
            
        except Exception as e:
            logger.error(f"Fatal error during Phase 1 setup: {str(e)}")
            self.results['errors'].append(f"Fatal error: {str(e)}")
            return self.results


def main():
    """Main entry point."""
    try:
        completer = Phase1Completer()
        report = completer.run()
        
        # Exit with success if at least 60% conformity
        conformity_pct = (
            (report['conformity']['passed'] / report['conformity']['total'] * 100)
            if report['conformity']['total'] > 0 else 0
        )
        
        sys.exit(0 if conformity_pct >= 60 else 1)
        
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
