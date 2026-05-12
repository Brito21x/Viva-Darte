import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authController from '../../src/controllers/authController';
import * as UtilizadorModel from '../../src/models/UtilizadorModel';
import bcrypt from 'bcrypt';

// Mock das dependências externas
vi.mock('../../src/models/UtilizadorModel', () => ({
    findByEmail: vi.fn()
}));

vi.mock('bcrypt', () => ({
    default: { compare: vi.fn() },
    compare: vi.fn()
}));

describe('authController - Unidade (Vitest)', () => {
    
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Deve gerar token se a password hash coincidir (US01)', async () => {
        // Contexto do teste
        const emailTeste = 'admin@entartes.pt';
        const mockUser = { 
            id_utilizador: 1, 
            nome: 'Admin', 
            email: emailTeste, 
            password: 'hash_ficticia', // Campo 'password' do DDL[cite: 1]
            ativo: 1 
        };

        // Configuração dos mocks do Vitest
        UtilizadorModel.findByEmail.mockResolvedValue(mockUser);
        vi.mocked(bcrypt.compare).mockResolvedValue(true);

        const req = { body: { email: emailTeste, password: '123' } };
        const res = { 
            status: vi.fn().mockReturnThis(), 
            json: vi.fn() 
        };

        // Execução
        await authController.login(req, res);

        // Validações dentro do bloco 'it' para evitar ReferenceError
        expect(UtilizadorModel.findByEmail).toHaveBeenCalledWith(emailTeste);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            token: expect.any(String)
        }));
    });
});