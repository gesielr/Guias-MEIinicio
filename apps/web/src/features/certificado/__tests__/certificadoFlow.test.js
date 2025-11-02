import { describe, expect, it } from "vitest";
import { resolveStepFromStatus } from "../../certificado/CertificadoFlowPage.jsx";

describe("resolveStepFromStatus", () => {
  it("retorna passo 1 quando não houver inscrição", () => {
    expect(resolveStepFromStatus(null)).toBe(1);
  });

  it("retorna passo 2 para inscrições pendentes", () => {
    expect(resolveStepFromStatus({ status: "PENDING" })).toBe(2);
  });

  it("retorna passo 3 quando certificado estiver ativo", () => {
    expect(resolveStepFromStatus({ status: "ACTIVE" })).toBe(3);
  });

  it("fallback para passo 1 em status desconhecido", () => {
    expect(resolveStepFromStatus({ status: "UNKNOWN" })).toBe(1);
  });
});
