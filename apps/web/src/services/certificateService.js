const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";

async function handleResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error || response.statusText || "Erro desconhecido";
    throw new Error(message);
  }
  return response.json();
}

export async function getCertificateStatus(userId) {
  const response = await fetch(`${API_BASE_URL}/api/certisign/enrollment/${userId}`, {
    credentials: "include"
  });

  if (response.status === 404) {
    return null;
  }

  return handleResponse(response);
}

export async function getAvailableDates() {
  const response = await fetch(`${API_BASE_URL}/api/certisign/datas-disponiveis`, {
    credentials: "include"
  });
  const data = await handleResponse(response);
  return data.datas ?? [];
}

export async function generateCertificatePayment(payload) {
  const response = await fetch(`${API_BASE_URL}/api/certisign/pagamento/gerar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

export async function requestCertificateEnrollment(payload) {
  const response = await fetch(`${API_BASE_URL}/api/certisign/enrollment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
}

