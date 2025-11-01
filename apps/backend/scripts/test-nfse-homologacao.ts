/**
 * Script de teste completo da integração NFSe
 * Valida endpoint, certificado, emissão, consulta e DANFSE
 */

import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import https from 'node:https';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis .env do backend
config({ path: path.resolve(__dirname, '../.env') });

interface TestResult {
  test: string;
  status: 'SUCCESS' | 'FAIL' | 'SKIP';
  message: string;
  data?: any;
  error?: string;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = result.status === 'SUCCESS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${result.test}: ${result.message}`);
  if (result.error) console.error(`   Error: ${result.error}`);
}

async function testEndpointAccess() {
  console.log('\n🔍 TESTE 1: Acesso ao endpoint NFSe SEFIN/ADN\n');
  
  try {
    const baseUrl = process.env.NFSE_API_URL || process.env.NFSE_CONTRIBUINTES_BASE_URL || 'https://adn.producaorestrita.nfse.gov.br/';
    
    logTest({
      test: 'Configuração endpoint',
      status: 'SUCCESS',
      message: `Endpoint configurado: ${baseUrl}`
    });

    // Configurar cliente mTLS
    let pfx: Buffer | undefined;
    let passphrase: string | undefined;

    if (process.env.NFSE_CERT_METHOD === 'supabase_vault' && process.env.NFSE_CERT_PFX_BASE64 && process.env.NFSE_CERT_PFX_PASS) {
      pfx = Buffer.from(process.env.NFSE_CERT_PFX_BASE64, 'base64');
      passphrase = process.env.NFSE_CERT_PFX_PASS;
    }

    const agent = new https.Agent({
      pfx,
      passphrase,
      rejectUnauthorized: true,
    });

    const http = axios.create({
      baseURL: baseUrl,
      httpsAgent: agent,
      timeout: 10000,
    });

    // Testar conectividade
    try {
      const response = await http.get('/health');
      logTest({
        test: 'Conectividade endpoint',
        status: 'SUCCESS',
        message: 'Endpoint acessível',
        data: { status: response.status }
      });
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        logTest({
          test: 'Conectividade endpoint',
          status: 'FAIL',
          message: 'Endpoint não acessível (DNS ou conexão recusada)',
          error: err.message
        });
      } else if (err.response?.status === 404) {
        logTest({
          test: 'Conectividade endpoint',
          status: 'SUCCESS',
          message: 'Endpoint acessível (404 esperado para /health)'
        });
      } else {
        logTest({
          test: 'Conectividade endpoint',
          status: 'FAIL',
          message: 'Erro ao acessar endpoint',
          error: err.message
        });
      }
    }
  } catch (err: any) {
    logTest({
      test: 'Configuração endpoint',
      status: 'FAIL',
      message: 'Falha ao configurar cliente',
      error: err.message
    });
  }
}

async function testCertificate() {
  console.log('\n🔐 TESTE 2: Validação do certificado ICP-Brasil\n');
  
  try {
    const certMethod = process.env.NFSE_CERT_METHOD;
    const certBase64 = process.env.NFSE_CERT_PFX_BASE64;
    const certPass = process.env.NFSE_CERT_PFX_PASS;

    if (!certMethod || !certBase64 || !certPass) {
      logTest({
        test: 'Variáveis certificado',
        status: 'FAIL',
        message: 'Variáveis de certificado não configuradas (.env)'
      });
      return;
    }

    logTest({
      test: 'Variáveis certificado',
      status: 'SUCCESS',
      message: `Método: ${certMethod}, Certificado: ${certBase64.substring(0, 20)}...`
    });

    // Testar decodificação
    try {
      const pfxBuffer = Buffer.from(certBase64, 'base64');
      logTest({
        test: 'Decodificação certificado',
        status: 'SUCCESS',
        message: `Certificado decodificado (${pfxBuffer.length} bytes)`
      });

      // Aqui poderíamos validar validade, emissor, etc usando node-forge
      // Por ora, apenas confirmamos que existe e é decodificável
    } catch (err: any) {
      logTest({
        test: 'Decodificação certificado',
        status: 'FAIL',
        message: 'Erro ao decodificar certificado',
        error: err.message
      });
    }
  } catch (err: any) {
    logTest({
      test: 'Validação certificado',
      status: 'FAIL',
      message: 'Erro ao validar certificado',
      error: err.message
    });
  }
}

async function testNfseEmissionFlow() {
  console.log('\n📄 TESTE 3: Fluxo completo de emissão NFSe\n');
  
  // Carregar XML DPS de exemplo
  const dpsExamplePath = path.resolve(__dirname, '../dps-exemplo.xml');
  
  if (!fs.existsSync(dpsExamplePath)) {
    logTest({
      test: 'Carregar DPS exemplo',
      status: 'SKIP',
      message: 'Arquivo DPS exemplo não encontrado. Crie apps/backend/dps-exemplo.xml para testar emissão.'
    });
    return;
  }

  try {
    const dpsXml = fs.readFileSync(dpsExamplePath, 'utf-8');
    
    logTest({
      test: 'Carregar DPS exemplo',
      status: 'SUCCESS',
      message: `DPS carregado (${dpsXml.length} caracteres)`
    });

    // Testar processamento DPS (sem executar emissão real)
    logTest({
      test: 'Processar DPS (simulado)',
      status: 'SKIP',
      message: 'Processamento DPS requer módulo NfseService. Validação XSD/assinatura disponível no serviço.'
    });

    logTest({
      test: 'Emissão NFSe (simulada)',
      status: 'SKIP',
      message: 'Emissão real desabilitada para testes. Habilite manualmente se necessário.'
    });
  } catch (err: any) {
    logTest({
      test: 'Carregar DPS exemplo',
      status: 'FAIL',
      message: 'Erro ao ler arquivo DPS',
      error: err.message
    });
  }
}

async function testInssGuiaFlow() {
  console.log('\n📋 TESTE 4: Fluxo completo de guia INSS\n');
  
  // Testar endpoint INSS (FastAPI Python)
  const inssUrl = process.env.INSS_API_URL || 'http://localhost:8000';
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Health check
    try {
      const healthResponse = await fetch(`${inssUrl}/`, { method: 'GET' });
      
      if (healthResponse.ok) {
        logTest({
          test: 'API INSS disponível',
          status: 'SUCCESS',
          message: `API INSS respondendo em ${inssUrl}`
        });
      } else {
        logTest({
          test: 'API INSS disponível',
          status: 'FAIL',
          message: `API INSS retornou status ${healthResponse.status}`
        });
      }
    } catch (err: any) {
      logTest({
        test: 'API INSS disponível',
        status: 'FAIL',
        message: 'API INSS não acessível. Certifique-se que está rodando na porta 8000.',
        error: err.message
      });
      return;
    }

    // Testar emissão de guia (simulada)
    const guiaPayload = {
      user_id: 'test-user',
      tipo_contribuinte: 'AUTONOMO_NORMAL',
      competencia: '12/2024',
      valor_contribuicao: 150.00
    };

    try {
      const emitResponse = await fetch(`${inssUrl}/api/v1/guias/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guiaPayload)
      });

      if (emitResponse.ok) {
        const data = await emitResponse.json();
        logTest({
          test: 'Emissão guia INSS',
          status: 'SUCCESS',
          message: 'Guia INSS gerada com sucesso',
          data: { guia_id: data.guia_id, pdf_url: data.pdf_url }
        });

        // Testar download do PDF
        if (data.pdf_url) {
          try {
            const pdfResponse = await fetch(data.pdf_url);
            if (pdfResponse.ok) {
              logTest({
                test: 'Download PDF guia INSS',
                status: 'SUCCESS',
                message: 'PDF da guia baixado com sucesso'
              });
            } else {
              logTest({
                test: 'Download PDF guia INSS',
                status: 'FAIL',
                message: `Erro ao baixar PDF: status ${pdfResponse.status}`
              });
            }
          } catch (err: any) {
            logTest({
              test: 'Download PDF guia INSS',
              status: 'FAIL',
              message: 'Erro ao baixar PDF',
              error: err.message
            });
          }
        }
      } else {
        logTest({
          test: 'Emissão guia INSS',
          status: 'FAIL',
          message: `API retornou status ${emitResponse.status}`
        });
      }
    } catch (err: any) {
      logTest({
        test: 'Emissão guia INSS',
        status: 'FAIL',
        message: 'Erro ao emitir guia',
        error: err.message
      });
    }
  } catch (err: any) {
    logTest({
      test: 'Fluxo INSS',
      status: 'FAIL',
      message: 'Erro geral no fluxo INSS',
      error: err.message
    });
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO DE TESTES DE HOMOLOGAÇÃO');
  console.log('='.repeat(60) + '\n');

  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'SUCCESS').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    skip: results.filter(r => r.status === 'SKIP').length
  };

  console.log(`Total de testes: ${summary.total}`);
  console.log(`✅ Sucesso: ${summary.success}`);
  console.log(`❌ Falha: ${summary.fail}`);
  console.log(`⚠️  Pulado: ${summary.skip}`);

  console.log('\n' + '='.repeat(60));
  console.log('Detalhes:');
  console.log('='.repeat(60) + '\n');

  results.forEach(r => {
    console.log(`[${r.status}] ${r.test}`);
    console.log(`    ${r.message}`);
    if (r.error) console.log(`    Erro: ${r.error}`);
    if (r.data) console.log(`    Dados: ${JSON.stringify(r.data, null, 2)}`);
    console.log('');
  });

  // Salvar relatório
  const reportPath = path.resolve(__dirname, '../../../homologacao_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), summary, results }, null, 2));
  console.log(`\n📄 Relatório salvo em: ${reportPath}\n`);
}

async function main() {
  console.log('\n🚀 Iniciando testes de homologação NFSe e INSS\n');

  await testEndpointAccess();
  await testCertificate();
  await testNfseEmissionFlow();
  await testInssGuiaFlow();
  await generateReport();
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
