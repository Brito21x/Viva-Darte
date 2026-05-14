import { describe, it, expect, vi, beforeEach } from "vitest";
import * as coachingController from "../src/controllers/coachingController";

const mocks = vi.hoisted(() => ({
  utilizadorTemPerfil: vi.fn(),
  getCoachingCabecalhoCancelamento: vi.fn(),

  adicionarDisponibilidadeProfessor: vi.fn(),
  getDisponibilidadesProfessor: vi.fn(),
  criarPedidoCoaching: vi.fn(),
  professorTemDisponibilidadeNoSlot: vi.fn(),
  cancelarCoaching: vi.fn(),
  calcularCustoAutomatico: vi.fn(),
  registarAuditoria: vi.fn(),
}));

vi.mock("../src/models/coachingModel", () => ({
  __esModule: true,
  default: mocks,
  ...mocks,
}));

vi.mock("../src/models/precoCoachingModel", () => ({
  __esModule: true,
  default: mocks,
  ...mocks,
}));

vi.mock("../src/middlewares/auth", () => ({
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
  utilizador: { id: 1, perfis: ["Professor"] },
  ...dados,
});

const mockResponse = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => vi.fn();

describe("Coaching Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // TESTES: adicionarDisponibilidade
  // ============================================================================
  describe("adicionarDisponibilidade", () => {
    it("deve retornar 400 se faltarem parâmetros obrigatórios", async () => {
      const req = mockRequest({ body: { diaSemana: 2 } }); // Faltam horas
      const res = mockResponse();
      const next = mockNext();

      await coachingController.adicionarDisponibilidade(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "diaSemana, horaInicio e horaFim são obrigatórios.",
      });
    });

    it("deve retornar 400 se o dia da semana for inválido", async () => {
      const req = mockRequest({
        body: { diaSemana: 8, horaInicio: "10:00", horaFim: "11:00" },
      });
      const res = mockResponse();
      const next = mockNext();

      await coachingController.adicionarDisponibilidade(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "diaSemana deve ser entre 1 (Segunda) e 7 (Domingo).",
      });
    });
  });

  // ============================================================================
  // TESTES: criarPedidoCoaching
  // ============================================================================
  describe("criarPedidoCoaching", () => {
    it("deve retornar 403 se o utilizador não for Encarregado de Educação (EE)", async () => {
      mocks.utilizadorTemPerfil.mockReturnValue(false);

      const req = mockRequest({ body: {} });
      const res = mockResponse();
      const next = mockNext();

      await coachingController.criarPedidoCoaching(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Apenas EE pode pedir aulas.",
      });
    });
  });

  // ============================================================================
  // TESTES: cancelarCoaching
  // ============================================================================
  describe("cancelarCoaching", () => {
    it("deve retornar 400 se o coaching já estiver cancelado ou não existir", async () => {
      mocks.getCoachingCabecalhoCancelamento.mockResolvedValue(null);

      const req = mockRequest({ params: { id: "50" } });
      const res = mockResponse();
      const next = mockNext();

      await coachingController.cancelarCoaching(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        mensagem: "Coaching inválido ou já cancelado.",
      });
    });
  });
});
