import { describe, it, expect, vi, beforeEach } from 'vitest';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authController = require('../src/controllers/authController');
const utilizadorModel = require('../src/models/authModel');

describe('AuthController - Função login', () => {
    let req, res, next;

    beforeEach(() => {
        req = { body: {} };
        res = {
            status: vi.fn().mockReturnThis(), 
            json: vi.fn()
        };
        next = vi.fn();
        vi.clearAllMocks();

        // A NOSSA FÓRMULA MÁGICA:
        // Injetar a simulação diretamente em TODOS os módulos!
        utilizadorModel.getUtilizadorByEmail = vi.fn();
        utilizadorModel.getPerfisDoUtilizador = vi.fn();
        bcrypt.compare = vi.fn();
        jwt.sign = vi.fn();
    });

    it('Deve retornar 400 se faltar o email ou a password', async () => {
        req.body = { email: 'teste@escola.pt' }; 
        
        await authController.login(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ mensagem: 'Email e palavra-passe são obrigatórios.' });
    });

    it('Deve retornar 401 se o utilizador não existir na base de dados', async () => {
        req.body = { email: 'naoexiste@escola.pt', password: '123' };
        
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue(null);

        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ mensagem: 'Credenciais inválidas.' });
    });

    it('Deve retornar 403 se a conta do utilizador estiver desativada', async () => {
        req.body = { email: 'inativo@escola.pt', password: '123' };
        
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue({
            id_utilizador: 2,
            email: 'inativo@escola.pt',
            password: 'hashedpassword',
            ativo: 0 
        });

        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ mensagem: 'Conta desativada. Aguarde a aprovação da administração.' });
    });

    it('Deve efetuar login com sucesso e retornar um token JWT (Status 200)', async () => {
        req.body = { email: 'admin@escola.pt', password: 'passwordCorreta', tipo: 'ADMIN' };
        
        utilizadorModel.getUtilizadorByEmail.mockResolvedValue({
            id_utilizador: 1,
            nome: 'Administrador',
            email: 'admin@escola.pt',
            password: 'hashedpassword123',
            ativo: 1
        });

        utilizadorModel.getPerfisDoUtilizador.mockResolvedValue(['Admin']);
        
        // Agora o bcrypt e o jwt já sabem o que é o mockResolvedValue/mockReturnValue!
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('meu-token-jwt-simulado');

        await authController.login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            mensagem: 'Login efetuado',
            token: 'meu-token-jwt-simulado'
        }));
    });
});