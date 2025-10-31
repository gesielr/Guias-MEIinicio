import 'dotenv/config';
import { initializeSicoobServices, getBoletoService } from '../src/services/sicoob';
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

  // Obter serviço de Boleto
  const boletoService = getBoletoService();

  // Teste 1: Gerar boleto
  console.log('\n=== Teste 1: Gerar Boleto ===');
  try {
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + 15); // 15 dias

    const boleto = await boletoService.gerarBoleto({
      numeroContrato: process.env.SICOOB_CONTRATO || '123456',
      modalidade: '01', // Simples
      numeroContaCorrente: process.env.SICOOB_CONTA || '12345',
      especieDocumento: 'DM', // Duplicata Mercantil
      dataEmissao: new Date().toISOString().split('T')[0],
      dataVencimento: dataVencimento.toISOString().split('T')[0],
      valorNominal: '350.75',
      pagador: {
        cpfCnpj: '12345678909',
        nome: 'Carlos Souza Teste',
        endereco: {
          logradouro: 'Rua Exemplo',
          numero: '100',
          bairro: 'Centro',
          cidade: 'São Paulo',
          uf: 'SP',
          cep: '01000000',
        },
      },
      beneficiario: {
        nome: 'Empresa Teste Ltda',
        cpfCnpj: process.env.SICOOB_CNPJ_BENEFICIARIO || '12345678000190',
      },
      descricao: 'Teste de geração de boleto via sandbox',
    });

    console.log('✓ Boleto gerado:', {
      nossoNumero: boleto.nossoNumero,
      linhaDigitavel: boleto.linhaDigitavel,
      codigoBarras: boleto.codigoBarras?.substring(0, 20) + '...',
    });

    // Registrar no Supabase
    await registrarNoSupabase('boleto_gerado', boleto);

    // Teste 2: Consultar boleto recém-criado
    if (boleto.nossoNumero) {
      console.log('\n=== Teste 2: Consultar Boleto ===');
      try {
        const consultaBoleto = await boletoService.consultarBoleto(boleto.nossoNumero);
        console.log('✓ Boleto consultado:', {
          nossoNumero: consultaBoleto.nossoNumero,
          status: consultaBoleto.situacao,
          valor: consultaBoleto.valorNominal,
        });

        await registrarNoSupabase('boleto_consultado', consultaBoleto);
      } catch (error: any) {
        console.error('✗ Erro ao consultar boleto:', error.message);
      }
    }
  } catch (error: any) {
    console.error('✗ Erro ao gerar boleto:', error.message);
  }

  // Teste 3: Listar boletos
  console.log('\n=== Teste 3: Listar Boletos ===');
  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30); // 30 dias atrás

    const lista = await boletoService.listarBoletos({
      data_inicio: dataInicio.toISOString().split('T')[0],
      data_fim: new Date().toISOString().split('T')[0],
      pagina: 1,
      limite: 10,
    });

    console.log('✓ Boletos listados:', {
      total: lista.paginacao?.totalRegistros || 0,
      registros: lista.boletos?.length || 0,
    });

    await registrarNoSupabase('boleto_lista', lista);
  } catch (error: any) {
    console.error('✗ Erro ao listar boletos:', error.message);
  }

  // Teste 4: Baixar PDF de boleto (se houver um boleto criado)
  console.log('\n=== Teste 4: Baixar PDF do Boleto ===');
  try {
    const nossoNumeroTeste = 'teste123'; // Substitua por um nossoNumero válido
    const pdfBuffer = await boletoService.baixarPDF(nossoNumeroTeste);
    console.log('✓ PDF baixado:', {
      tamanho: pdfBuffer.length,
      tipo: 'Buffer',
    });
  } catch (error: any) {
    console.error('✗ Erro ao baixar PDF (esperado em sandbox sem boleto prévio):', error.message);
  }

  console.log('\n=== Testes de Boleto concluídos ===');
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
      categoria: 'boleto',
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
  console.error('❌ Falha nos testes de Boleto:', err);
  process.exit(1);
});
