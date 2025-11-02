import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/client";
import {
  generateCertificatePayment,
  getAvailableDates,
  getCertificateStatus,
  requestCertificateEnrollment
} from "../../services/certificateService";

const containerStyle = {
  maxWidth: "960px",
  margin: "40px auto",
  padding: "40px",
  background: "#fff",
  borderRadius: "18px",
  boxShadow: "0 15px 30px rgba(15, 23, 42, 0.08)",
  fontFamily: "'Inter', sans-serif",
  color: "#1f2933"
};

const stepTitles = [
  { id: 1, label: "Pagamento PIX" },
  { id: 2, label: "Validação Certisign" },
  { id: 3, label: "Certificado Ativo" }
];

function Stepper({ currentStep }) {
  return (
    <div style={{ display: "flex", gap: "24px", marginBottom: "32px" }}>
      {stepTitles.map((step, index) => {
        const active = currentStep === step.id;
        const completed = currentStep > step.id;
        return (
          <div
            key={step.id}
            style={{
              flex: 1,
              padding: "18px",
              borderRadius: "14px",
              border: `2px solid ${completed || active ? "#2563eb" : "#e2e8f0"}`,
              background: completed ? "#2563eb" : active ? "#e8f1ff" : "#fff",
              color: completed ? "#fff" : "#1f2937",
              transition: "all .2s ease"
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 600 }}>
              {index + 1}. {step.label}
            </div>
            <p style={{ marginTop: "8px", fontSize: "14px", opacity: 0.8 }}>
              {index === 0 && "Gere o QR Code PIX de R$150 e finalize o pagamento."}
              {index === 1 && "Nossa equipe agenda a validação via Certisign (vide chamada ou presencial)."}
              {index === 2 && "Após a aprovação você será notificado e poderá emitir NFSe automaticamente."}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function resolveStepFromStatus(enrollment) {
  if (!enrollment) return 1;
  if (enrollment.status === 'ACTIVE') return 3;
  if (enrollment.status === 'PENDING') return 2;
  return 1;
}

export default function CertificadoFlowPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dates, setDates] = useState([]);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [qrCodeData, setQrCodeData] = useState(null);
  const [enrollmentRequest, setEnrollmentRequest] = useState({
    dataAgendamento: "",
    telefone: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    async function bootstrap() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login");
          return;
        }
        setUserId(user.id);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, nome, email, telefone, cpf_cnpj, digital_certificate_status")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        const [statusResponse, availableDates] = await Promise.all([
          getCertificateStatus(user.id).catch(() => null),
          getAvailableDates().catch(() => [])
        ]);

        setStatus(statusResponse?.enrollment ?? null);
        setDates(availableDates);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [navigate]);

  const currentStep = useMemo(() => resolveStepFromStatus(status), [status]);

  const handleGeneratePayment = async () => {
    if (!profile || !userId) return;
    try {
      setError("");
      const payload = {
        userId,
        nome: profile.nome || "Cliente GuiasMEI",
        cpf_cnpj: profile.cpf_cnpj || ""
      };
      const cobranca = await generateCertificatePayment(payload);
      setQrCodeData(cobranca);
    } catch (err) {
      setError(`Não foi possível gerar o pagamento PIX: ${err.message}`);
    }
  };

  const handleSubmitEnrollment = async () => {
    if (!userId || !profile) return;
    if (!enrollmentRequest.dataAgendamento) {
      setError("Selecione uma data disponível para o atendimento Certisign.");
      return;
    }

    try {
      setError("");
      await requestCertificateEnrollment({
        userId,
        nome: profile.nome,
        cpf_cnpj: profile.cpf_cnpj,
        email: profile.email,
        telefone: enrollmentRequest.telefone || profile.telefone || "",
        dataAgendamento: enrollmentRequest.dataAgendamento
      });

      const refreshed = await getCertificateStatus(userId).catch(() => null);
      setStatus(refreshed?.enrollment ?? null);
    } catch (err) {
      setError(`Erro ao agendar certificado: ${err.message}`);
    }
  };

  const renderQrCode = () => {
    if (!qrCodeData) return null;
    return (
      <div style={{ marginTop: "24px", padding: "16px", borderRadius: "12px", background: "#f1f5f9" }}>
        <h4>QR Code PIX (válido por 1 hora)</h4>
        <p><strong>Valor:</strong> R$ {qrCodeData.valor?.toFixed(2)}</p>
        <p style={{ wordBreak: "break-word", fontFamily: "monospace", fontSize: "14px" }}>{qrCodeData.qr_code}</p>
        {qrCodeData.qr_code_url && (
          <p>
            <a href={qrCodeData.qr_code_url} target="_blank" rel="noreferrer">
              Abrir QR Code em nova aba
            </a>
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, textAlign: "center" }}>
        <p>Carregando fluxo do certificado...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <button
        style={{ marginBottom: "24px", background: "none", border: "none", color: "#2563eb", cursor: "pointer" }}
        onClick={() => navigate("/dashboard")}
      >
        ← Voltar para o dashboard
      </button>

      <h1 style={{ fontSize: "32px", marginBottom: "12px" }}>Certificado Digital GuiasMEI</h1>
      <p style={{ fontSize: "16px", lineHeight: 1.6, marginBottom: "28px" }}>
        Acompanhe todas as etapas do certificado digital ICP-Brasil. Assim que o pagamento for identificado,
        faremos o agendamento com a Certisign e notificaremos automaticamente por e-mail e WhatsApp.
      </p>

      <Stepper currentStep={currentStep} />

      {error && (
        <div style={{ border: "1px solid #fca5a5", background: "#fee2e2", padding: "16px", borderRadius: "12px", marginBottom: "20px" }}>
          <strong>Ops!</strong> {error}
        </div>
      )}

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "12px" }}>1. Gerar pagamento PIX</h2>
        <p>Utilizamos a integração oficial com o Sicoob. O QR Code possui validade de 1 hora e valor fixo de R$150.</p>
        <button
          style={{
            marginTop: "16px",
            padding: "14px 22px",
            borderRadius: "10px",
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: "16px",
            cursor: "pointer"
          }}
          onClick={handleGeneratePayment}
        >
          Gerar QR Code PIX
        </button>
        {renderQrCode()}
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", marginBottom: "12px" }}>2. Escolher data para validação</h2>
        <p>Após o pagamento, escolha a data preferencial para nossa equipe validar seus dados junto à Certisign.</p>

        <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            type="datetime-local"
            value={enrollmentRequest.dataAgendamento}
            onChange={(event) => setEnrollmentRequest((prev) => ({ ...prev, dataAgendamento: event.target.value }))}
            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db" }}
          />
          <input
            placeholder="WhatsApp com DDD"
            value={enrollmentRequest.telefone}
            onChange={(event) => setEnrollmentRequest((prev) => ({ ...prev, telefone: event.target.value }))}
            style={{ padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db" }}
          />
          <button
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              border: "none",
              background: "#0ea5e9",
              color: "#fff",
              cursor: "pointer"
            }}
            onClick={handleSubmitEnrollment}
          >
            Confirmar Agendamento
          </button>
        </div>

        <div style={{ marginTop: "18px", background: "#f8fafc", padding: "14px", borderRadius: "10px" }}>
          <strong>Datas sugeridas:</strong>
          <ul style={{ marginTop: "8px", marginLeft: "18px" }}>
            {dates.length === 0 ? (
              <li>Nenhuma data disponível no momento.</li>
            ) : (
              dates.map((dateSlot) => (
                <li key={dateSlot.data}>
                  {dateSlot.data} — {dateSlot.horarios.join(", ")}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "22px", marginBottom: "12px" }}>3. Acompanhamento</h2>
        {status ? (
          <div style={{ background: "#ecfdf5", borderRadius: "14px", padding: "18px", border: "1px solid #34d399" }}>
            <p><strong>Status atual:</strong> {status.status}</p>
            <p><strong>Válido até:</strong> {status.valid_until ? new Date(status.valid_until).toLocaleDateString("pt-BR") : "Aguardando emissão"}</p>
            <p><strong>Serial:</strong> {status.serial_number}</p>
          </div>
        ) : (
          <div style={{ background: "#f8fafc", borderRadius: "14px", padding: "18px", border: "1px solid #cbd5f5" }}>
            <p>Aguardando pagamento para iniciar a emissão do certificado.</p>
          </div>
        )}
      </section>
    </div>
  );
}

