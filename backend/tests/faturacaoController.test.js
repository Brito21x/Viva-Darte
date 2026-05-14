import { describe, it, expect, vi, beforeEach } from "vitest";
import * as faturacaoController from "../src/controllers/faturacaoController";

const mocks = vi.hoisted(() => ({
  getFaturaPorId: vi.fn(),

  getFaturas: vi.fn(),
  getResumoFaturacao: vi.fn(),
  registarPagamento: vi.fn(),
  cancelarFatura: vi.fn(),
  getTabelaPrecos: vi.fn(),
  atualizarPreco: vi.fn(),
  getLinhasDaFatura: vi.fn(),
  registarAuditoria: vi.fn(),
}));

vi.mock("../src/models/faturacaoModel", () => ({
  __esModule: true,
  default: mocks,
  ...mocks,
}));

vi.mock("../src/helpers/auditoriaHelper", () => ({
  __esModule: true,
  default: { registarAuditoria: mocks.registarAuditoria },
  registarAuditoria: mocks.registarAuditoria,
}));

const mockRequest = (dados = {}) => ({
  params: {},
  body: {},
  query: {},
  utilizador: { id: 1 },
  ...dados,
});

const mockResponse = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => vi.fn();

describe("Faturação Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // TESTES: getFaturaPorId
  // ============================================================================
  describe("getFaturaPorId", () => {
    it("deve retornar 400 se o ID da fatura for inválido", async () => {
      const req = mockRequest({ params: { id: "abc" } });
      const res = mockResponse();
      const next = mockNext();

      await faturacaoController.getFaturaPorId(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "ID de fatura inválido.",
      });
    });

    it("deve retornar 404 se a fatura não for encontrada", async () => {
      mocks.getFaturaPorId.mockResolvedValue(null);

      const req = mockRequest({ params: { id: "99" } });
      const res = mockResponse();
      const next = mockNext();

      await faturacaoController.getFaturaPorId(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Fatura não encontrada.",
      });
    });
  });

  // ============================================================================
  // TESTES: registarPagamento
  // ============================================================================
  describe("registarPagamento", () => {
    it("deve retornar 400 se o método de pagamento estiver ausente", async () => {
      const req = mockRequest({ params: { id: "1" }, body: {} });
      const res = mockResponse();
      const next = mockNext();

      await faturacaoController.registarPagamento(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "O método de pagamento é obrigatório.",
      });
    });
  });

  // ============================================================================
  // TESTES: cancelarFatura
  // ============================================================================
  describe("cancelarFatura", () => {
    it("deve retornar 409 se tentar cancelar uma fatura já paga", async () => {
      mocks.getFaturaPorId.mockResolvedValue({
        id_faturacao: 2,
        estado_pagamento: "Pago",
      });

      const req = mockRequest({ params: { id: "2" } });
      const res = mockResponse();
      const next = mockNext();

      await faturacaoController.cancelarFatura(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Não é possível cancelar uma fatura já paga.",
      });
    });
  });
});
