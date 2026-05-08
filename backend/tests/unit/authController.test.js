import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authController from '../../src/controllers/authController.js';
import * as utilizadorModel from '../../src/models/authModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock das dependências externas
vi.mock('../../src/models/authModel.js');
vi.mock('bcryptjs');
vi.mock('jsonwebtoken');

describe('authController - Autenticação (US01)', () => {
    let req, res, next;

    beforeEach(() => {
        // Reset dos mocks antes de cada teste
        vi.clearAllMocks();

        // Simulação dos objetos Express
        req = {
            body: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };
        next = vi.fn();
    });

    it('Deve efetuar login com sucesso para um Administrador', async () => {
        // Dados de entrada
        req.body = {
            email: 'admin@entartes.pt',
            password: 'password123',
            tipo: 'ADMIN'
        };

        // Simulação do utilizador na BD (Ativo: 1)
        const mockUtilizador = {
            id_utilizador: 1,
            nome: 'Admin Teste',
            email: 'admin@entartes.pt',
            password: 'hash_encriptado',
            ativo: 1
        };

        const mockPerfis = ['Admin'];

        // Configuração dos comportamentos dos mocks
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue(mockUtilizador);
        bcrypt.compare.mockResolvedValue(true);
        utilizadorModel.getPerfisDoUtilizador.mockResolvedValue(mockPerfis);
        jwt.sign.mockReturnValue('token_gerado_123');

        // Execução
        await authController.login(req, res, next);

        // Verificações
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContext({
            mensagem: 'Login efetuado',
            token: 'token_gerado_123'
        }));
    });

    it('Deve retornar 401 para credenciais inválidas (email inexistente)', async () => {
        req.body = { email: 'naoexiste@teste.com', password: '123' };
        
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue(null);

        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ mensagem: 'Credenciais inválidas.' });
    });

    it('Deve retornar 403 quando a conta do utilizador está desativada', async () => {
        req.body = { email: 'inativo@entartes.pt', password: '123' };
        
        // Simulação de conta inativa (ativo: 0)[cite: 6]
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue({
            id_utilizador: 2,
            email: 'inativo@entartes.pt',
            ativo: 0 
        });

        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ 
            mensagem: 'Conta desativada. Aguarde a aprovação da administração.' 
        });
    });

    it('Deve retornar 403 se o utilizador não tiver o perfil solicitado', async () => {
    req.body = { 
        email: 'admin@gmail.com.', 
        password: 'vivadarte123!',
        tipo: 'ADMIN' // Solicita perfil Admin
    };

    // 1. Simular que o utilizador existe e está ativo[cite: 6]
    utilizadorModel.getUtilizadorByEmail.mockResolvedValue({
        id_utilizador: 3,
        email: 'TesteagendaEE@admin.com',
        password: 'qwerty123!',
        ativo: 1
    });

    // 2. IMPORTANTE: Simular que a password está CORRETA para passar o check do 401
    bcrypt.compare.mockResolvedValue(true);

    // 3. Simular que o utilizador tem apenas o perfil 'Professor' na BD
    utilizadorModel.getPerfisDoUtilizador.mockResolvedValue(['Professor']);

    await authController.login(req, res, next);

    // Agora sim, como a password passou, ele vai validar o perfil e dar 403
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ mensagem: 'Acesso negado.' });
});
    it('Deve retornar 400 se faltar o email ou a password', async () => {
        req.body = { email: 'teste@teste.pt' }; // Falta password

        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ 
            mensagem: 'Email e palavra-passe são obrigatórios.' 
        });
    });
});
