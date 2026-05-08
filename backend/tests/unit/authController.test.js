import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const controllerPath = require.resolve('../../src/controllers/authController.js');
const utilizadorModelPath = require.resolve('../../src/models/utilizadorModel.js');
const bcryptPath = require.resolve('bcryptjs');
const jwtPath = require.resolve('jsonwebtoken');

describe('authController - Autenticação (US01)', () => {
    let req, res, next, authController, utilizadorModel, bcrypt, jwt;

    beforeEach(() => {
        // Reset dos mocks antes de cada teste
        vi.resetAllMocks();
        delete require.cache[controllerPath];
        delete require.cache[utilizadorModelPath];
        delete require.cache[bcryptPath];
        delete require.cache[jwtPath];

        utilizadorModel = {
            getUtilizadorByEmail: vi.fn(),
            getPerfisDoUtilizador: vi.fn()
        };
        bcrypt = {
            compare: vi.fn()
        };
        jwt = {
            sign: vi.fn()
        };

        require.cache[utilizadorModelPath] = {
            id: utilizadorModelPath,
            filename: utilizadorModelPath,
            loaded: true,
            exports: utilizadorModel
        };
        require.cache[bcryptPath] = {
            id: bcryptPath,
            filename: bcryptPath,
            loaded: true,
            exports: bcrypt
        };
        require.cache[jwtPath] = {
            id: jwtPath,
            filename: jwtPath,
            loaded: true,
            exports: jwt
        };
        authController = require('../../src/controllers/authController.js');

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
            email: 'admin@gmail.com',
            password: 'vivadarte123!',
            tipo: 'ADMIN'
        };

        // Simulação do utilizador na BD (Ativo: 1)
        const mockUtilizador = {
            id_utilizador: 1,
            nome: 'Admin Teste',
            email: 'admin@gmail.com',
            password: 'hash_encriptado',
            ativo: 1
        };

        const mockPerfis = ['Admin'];

        // Configuração dos comportamentos dos mocks
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue(mockUtilizador);
        bcrypt.compare.mockResolvedValue(true);
        utilizadorModel.getPerfisDoUtilizador.mockResolvedValue(mockPerfis);
        jwt.sign.mockReturnValue('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjcsIm5vbWUiOiJUZXN0ZUNhbGVuZGFyIiwiZW1haWwiOiJUZXN0ZUNhbGVuZGFyQGdtYWlsLmNvbSIsInBlcmZpcyI6WyJQcm9mZXNzb3IiXSwicGVyZmlsIjoiUHJvZmVzc29yIiwiaWRfcGVyZmlsIjpudWxsLCJpYXQiOjE3NzgyMDA3MTMsImV4cCI6MTc3ODIyOTUxM30.Jzc8N66neRKs8qDxE20kWVCT_NUYgKsM_tKWVAROa-8');

        // Execução
        await authController.login(req, res, next);

        // Verificações
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            mensagem: 'Login efetuado',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjcsIm5vbWUiOiJUZXN0ZUNhbGVuZGFyIiwiZW1haWwiOiJUZXN0ZUNhbGVuZGFyQGdtYWlsLmNvbSIsInBlcmZpcyI6WyJQcm9mZXNzb3IiXSwicGVyZmlsIjoiUHJvZmVzc29yIiwiaWRfcGVyZmlsIjpudWxsLCJpYXQiOjE3NzgyMDA3MTMsImV4cCI6MTc3ODIyOTUxM30.Jzc8N66neRKs8qDxE20kWVCT_NUYgKsM_tKWVAROa-8'
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
        req.body = { email: 'inativo@entartes.pt', password: '123', tipo: 'PROF' };
        
        // Simulação de conta inativa (ativo: 0)[cite: 6]
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue({
            id_utilizador: 2,
            email: 'inativo@entartes.pt',
            password: 'hash_encriptado',
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
        password: 'hash_encriptado',
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
