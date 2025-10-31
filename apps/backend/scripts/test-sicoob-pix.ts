import 'dotenv/config';
import { initializeSicoobServices, getPixService } from '../src/services/sicoob';
import { createClient } from '@supabase/supabase-js';

async function main() {
  // Inicializar serviços Sicoob
  initializeSicoobServices({
    environment: process.env.SICOOB_ENVIRONMENT as 'sandbox' | 'production',
    baseUrl: process.env.SICOOB_API_BASE_URL!,
    authUrl: process.env.SICOOB_AUTH_URL!,
    authValidateUrl: process.env.SICOOB_AUTH_VALIDATE_URL,
    clientId: process.env.SICOOB_CLIENT_ID!,
    clientSecret: process.env.SICOOB_CLIENT_SECRET || undefined,
    certPath: process.env.SICOOB_CERT_PATH || undefined,
    keyPath: process.env.SICOOB_KEY_PATH || undefined,
    caPath: process.env.SICOOB_CA_PATH || undefined,
    caBase64: process.env.SICOOB_CA_BASE64 || undefined,
    pfxBase64: process.env.SICOOB_CERT_PFX_BASE64 || undefined,
    pfxPassphrase: process.env.SICOOB_CERT_PFX_PASS || undefined,
    webhookSecret: process.env.SICOOB_WEBHOOK_SECRET,
    cooperativa: process.env.SICOOB_COOPERATIVA,
    conta: process.env.SICOOB_CONTA,
    scopes: process.env.SICOOB_SCOPES
      ? process.env.SICOOB_SCOPES.split(/[,\s]+/).filter(Boolean)
      : undefined,
  });

  console.log('✓ Serviços Sicoob inicializados');

  // Obter serviço PIX
  const pixService = getPixService();

  // Teste 1: Criar cobrança PIX imediata
  console.log('\n=== Teste 1: Criar Cobrança PIX Imediata ===');
  try {
    const cobrancaImediata = await pixService.criarCobrancaImediata({
      calendario: {
        expiracao: 3600, // 1 hora
      },
      devedor: {
        cpf: '12345678909',
        nome: 'João da Silva Teste',
      },
      valor: {
        original: '100.00',
      },
      chave: process.env.SICOOB_PIX_CHAVE || 'sua-chave-pix@exemplo.com',
      solicitacaoPagador: 'Teste de cobrança PIX imediata',
    });

    console.log('✓ Cobrança PIX imediata criada:', {
      txid: cobrancaImediata.txid,
      status: cobrancaImediata.status,
      qrcode: cobrancaImediata.pixCopiaECola?.substring(0, 50) + '...',
    });

    // Registrar no Supabase
    await registrarNoSupabase('pix_imediata', cobrancaImediata);
  } catch (error: any) {
    console.error('✗ Erro ao criar cobrança PIX imediata:', error.message);
  }

  // Teste 2: Criar cobrança PIX com vencimento
  console.log('\n=== Teste 2: Criar Cobrança PIX com Vencimento ===');
  try {
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 7); // 7 dias

    const cobrancaVencimento = await pixService.criarCobrancaComVencimento({
      calendario: {
        dataDeVencimento: dataVencimento.toISOString().split('T')[0],
        validadeAposVencimento: 30,
      },
      devedor: {
        cpf: '12345678909',
        nome: 'Maria Santos Teste',
      },
      valor: {
        original: '250.50',
      },
      chave: process.env.SICOOB_PIX_CHAVE || 'sua-chave-pix@exemplo.com',
      solicitacaoPagador: 'Teste de cobrança PIX com vencimento',
    });

    console.log('✓ Cobrança PIX com vencimento criada:', {
      txid: cobrancaVencimento.txid,
      status: cobrancaVencimento.status,
      vencimento: dataVencimento.toISOString().split('T')[0],
    });

    // Registrar no Supabase
    await registrarNoSupabase('pix_vencimento', cobrancaVencimento);
  } catch (error: any) {
    console.error('✗ Erro ao criar cobrança PIX com vencimento:', error.message);
  }

  // Teste 3: Consultar cobrança PIX
  console.log('\n=== Teste 3: Consultar Cobrança PIX ===');
  try {
    const txidTeste = 'teste123'; // Substitua por um txid válido
    const consulta = await pixService.consultarCobranca(txidTeste);
    console.log('✓ Cobrança consultada:', consulta);
  } catch (error: any) {
    console.error('✗ Erro ao consultar cobrança (esperado em sandbox sem cobrança prévia):', error.message);
  }

  // Teste 4: Listar cobranças PIX
  console.log('\n=== Teste 4: Listar Cobranças PIX ===');
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30); // 30 dias atrás

    const lista = await pixService.listarCobrancas({
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: new Date().toISOString().split('T')[0],
      pagina: 1,
      limite: 10,
    });

    console.log('✓ Cobranças listadas:', {
      total: lista.parametros?.paginacao?.quantidadeDePaginas || 0,
      registros: lista.cobs?.length || 0,
    });

    // Registrar no Supabase
    await registrarNoSupabase('pix_lista', lista);
  } catch (error: any) {
    console.error('✗ Erro ao listar cobranças:', error.message);
  }

  console.log('\n=== Testes de PIX concluídos ===');
}

async function registrarNoSupabase(tipo: string, dados: any): Promise<void> {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('⚠ Supabase não configurado, pulando registro');
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.from('sicoob_test_logs').insert({
      tipo_teste: tipo,
      categoria: 'pix',
      dados_resposta: dados,
      timestamp: new Date().toISOString(),
      ambiente: process.env.SICOOB_ENVIRONMENT || 'sandbox',
    });

    if (error) {
      console.error('⚠ Erro ao registrar no Supabase:', error.message);
    } else {
      console.log('✓ Resposta registrada no Supabase');
    }
  } catch (error: any) {
    console.error('⚠ Erro ao conectar com Supabase:', error.message);
  }
}

main().catch((err) => {
  console.error('❌ Falha nos testes de PIX:', err);
  process.exit(1);
});
