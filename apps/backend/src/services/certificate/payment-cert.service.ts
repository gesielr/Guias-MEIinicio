// apps/backend/src/services/certificate/payment-cert.service.ts
// Service para geração de PIX (R$ 150,00) para certificado digital e persistência no Supabase

import { getPixService } from "../sicoob";
import type { CobrancaPixImediata, CobrancaResponse } from "../sicoob/types";
import { createSupabaseClients } from "../../../services/supabase";

const { admin } = createSupabaseClients();

export interface GerarPixCertificadoInput {
  userId: string;
  nome: string;
  cpf_cnpj: string; // somente dígitos
}

export interface GerarPixCertificadoOutput {
  txid: string;
  qr_code: string;
  qr_code_url?: string;
  valor: number;
}

export class PaymentCertService {
  private readonly valorCertificado = 150.0;

  /**
   * Gerar cobrança PIX imediata de R$ 150,00 para pagamento do certificado digital.
   * - Salva registro em payment_cert_digital com status PENDING
   */
  async gerarCobrancaPIX(input: GerarPixCertificadoInput): Promise<GerarPixCertificadoOutput> {
    const pixService = getPixService();

    const chavePix = process.env.SICOOB_PIX_CHAVE;
    if (!chavePix) {
      throw new Error("Variável de ambiente SICOOB_PIX_CHAVE não configurada");
    }

    // Monta payload no padrão PADI PIX (Bacen)
    const payload: CobrancaPixImediata = {
      calendario: { expiracao: 3600 }, // 1h para pagar
      devedor: this.toDevedor(input.nome, input.cpf_cnpj),
      valor: { original: this.valorCertificado.toFixed(2) },
      chave: chavePix,
      solicitacaoPagador: "Certificado Digital ICP-Brasil - GuiasMEI",
      infoAdicionais: [
        { nome: "produto", valor: "certificado_digital" },
        { nome: "plataforma", valor: "guiasmei" }
      ]
    };

    // Cria cobrança na API Sicoob
    const cobranca: CobrancaResponse = await pixService.criarCobrancaImediata(payload);

    // Persistir cobrança na tabela payment_cert_digital
    await admin
      .from("payment_cert_digital")
      .insert({
        user_id: input.userId,
        txid: cobranca.txid,
        qr_code: cobranca.qr_code || cobranca.qr_code_url || "",
        valor: this.valorCertificado,
        status: "PENDING"
      });

    return {
      txid: cobranca.txid,
      qr_code: cobranca.qr_code,
      qr_code_url: cobranca.qr_code_url,
      valor: this.valorCertificado
    };
  }

  /**
   * Atualiza pagamento como confirmado e vincula a um enrollment (opcional em passo futuro)
   */
  async marcarPagamentoComoPago(txid: string): Promise<void> {
    await admin
      .from("payment_cert_digital")
      .update({ status: "PAID", paid_at: new Date() })
      .eq("txid", txid);
  }

  private toDevedor(nome: string, cpfOuCnpj: string) {
    const onlyDigits = cpfOuCnpj.replace(/\D+/g, "");
    if (onlyDigits.length <= 11) {
      return { nome, cpf: onlyDigits };
    }
    return { nome, cnpj: onlyDigits };
  }
}

// Singleton opcional
let instance: PaymentCertService | null = null;
export function getPaymentCertService(): PaymentCertService {
  if (!instance) instance = new PaymentCertService();
  return instance;
}
