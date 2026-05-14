import { describe, it, expect, vi, beforeEach } from "vitest";
import * as inventarioController from "../src/controllers/inventarioController";

const mocks = vi.hoisted(() => ({
  getPecaDetalhes: vi.fn(),
  registarPenalizacao: vi.fn(),
  eliminarPecaCompleta: vi.fn(),
  registarAuditoria: vi.fn(),
}));

vi.mock("../src/models/inventarioModel", () => ({
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

describe("Inventario Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // TESTES: getPecaDetalhes
  // ============================================================================
  describe("getPecaDetalhes", () => {
    it("deve retornar 400 se o ID da peça for inválido", async () => {
      const req = mockRequest({ params: { id: "abc" } });
      const res = mockResponse();
      const next = mockNext();

      await inventarioController.getPecaDetalhes(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "ID de peça inválido.",
      });
    });

    it("deve retornar 404 se a peça não for encontrada", async () => {
      mocks.getPecaDetalhes.mockResolvedValue(null);

      const req = mockRequest({ params: { id: "99" } });
      const res = mockResponse();
      const next = mockNext();

      await inventarioController.getPecaDetalhes(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Peça não encontrada no sistema.",
      });
    });
  });

  // ============================================================================
  // TESTES: registarPenalizacao
  // ============================================================================
  describe("registarPenalizacao", () => {
    it("deve retornar 400 se o tipo de penalização for inválido", async () => {
      const req = mockRequest({
        params: { id: "1" },
        body: { idPeca: 2, tipo: "Furto", valor: 50 },
      });
      const res = mockResponse();
      const next = mockNext();

      await inventarioController.registarPenalizacao(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          mensagem: expect.stringContaining("Tipo inválido"),
        }),
      );
    });

    it("deve retornar 400 se o valor for negativo ou nulo", async () => {
      const req = mockRequest({
        params: { id: "1" },
        body: { idPeca: 2, tipo: "Atraso", valor: -10 },
      });
      const res = mockResponse();
      const next = mockNext();

      await inventarioController.registarPenalizacao(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem:
          "O valor financeiro da penalização deve ser um número positivo.",
      });
    });
  });

  // ============================================================================
  // TESTES: apagarPeca
  // ============================================================================
  describe("apagarPeca", () => {
    it("deve retornar 404 se a peça não for eliminada (não encontrada)", async () => {
      mocks.eliminarPecaCompleta.mockResolvedValue(false);

      const req = mockRequest({ params: { id: "99" } });
      const res = mockResponse();
      const next = mockNext();

      await inventarioController.apagarPeca(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "A peça que tentou apagar não foi encontrada.",
      });
    });
  });
});
