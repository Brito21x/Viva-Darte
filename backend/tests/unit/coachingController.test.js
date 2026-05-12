import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as coachingController from '../../src/controllers/coachingController.js';
import * as coachingModel from '../../src/models/coachingModel.js'; // Caminho corrigido com base na sua imagem

// 1. Mock do ÚNICO ficheiro de modelo de coaching que tem na pasta
vi.mock('../../src/models/coachingModel.js', () => ({
    criarPedido: vi.fn(),
    encontrarPorId: vi.fn(),
    atualizarEstado: vi.fn(),
    criarCoachingAprovado: vi.fn()
}));

describe('coachingController - Testes Unitários (Vitest)', () => {

    // Limpar o histórico dos mocks antes de cada teste para evitar falsos positivos
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Método: submeterPedido (US05)', () => {
        it('Deve submeter um novo pedido e retornar o status 201 (Created)', async () => {
            // Contexto simulado do Request (req) com base na tabela PEDIDO_COACHING
            const req = {
                body: {
                    formato_aula: 'Solo',
                    duracao_minutos: 60,
                    numero_participantes: 1,
                    data_aula_pretendida: '2026-05-15',
                    hora_inicio_pretendida: '17:00:00',
                    UTILIZADORid_utilizador: 10,
                    ANO_LETIVOid_ano_letivo: 1,
                    MODALIDADEid_modalidade: 1, 
                    UTILIZADORid_utilizador2: 3 
                }
            };

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            };

            // Simulamos que a base de dados inseriu o registo e devolveu o ID 150
            coachingModel.criarPedido.mockResolvedValue({ insertId: 150 });

            // Execução
            await coachingController.submeterPedido(req, res);

            // Validações
            expect(coachingModel.criarPedido).toHaveBeenCalledWith(req.body);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Pedido de coaching submetido com sucesso',
                id_pedido: 150
            }));
        });

        it('Deve retornar status 500 em caso de falha na base de dados', async () => {
            const req = { body: { formato_aula: 'Solo' } };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

            // Simulamos um erro no SQL Azure
            coachingModel.criarPedido.mockRejectedValue(new Error('Falha de conexão SQL'));

            await coachingController.submeterPedido(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ message: 'Erro interno do servidor ao submeter o pedido.' });
        });
    });

    describe('Método: aprovarPedido (US07 e US08)', () => {
        it('Deve aprovar o pedido, criar o registo de coaching e retornar status 200', async () => {
            const idPedidoTeste = 150;
            const req = {
                params: { id_pedido_coaching: idPedidoTeste },
                body: { SALAid_sala: 2 } // Estúdio escolhido
            };
            const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

            const mockPedido = {
                id_pedido_coaching: idPedidoTeste,
                estado: 'Pendente',
                formato_aula: 'Solo',
                duracao_minutos: 60
            };

            // Simular o fluxo de BD
            coachingModel.encontrarPorId.mockResolvedValue(mockPedido);
            coachingModel.atualizarEstado.mockResolvedValue(true);
            coachingModel.criarCoachingAprovado.mockResolvedValue({ id_coaching: 300 });

            // Execução
            await coachingController.aprovarPedido(req, res);

            // Validações
            expect(coachingModel.encontrarPorId).toHaveBeenCalledWith(idPedidoTeste);
            expect(coachingModel.atualizarEstado).toHaveBeenCalledWith(idPedidoTeste, 'Aprovado');
            expect(coachingModel.criarCoachingAprovado).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Pedido aprovado e coaching agendado com sucesso',
                id_coaching: 300
            }));
        });
    });
});