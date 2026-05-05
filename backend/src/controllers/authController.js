const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const utilizadorModel = require('../models/authModel');

// ============================================================================
// US01 / RF01 — LOGIN
// ============================================================================
async function login(req, res, next) {
    try {
        const { email, password, tipo, perfil } = req.body;

        if (!email || !password) {
            return res.status(400).json({ mensagem: 'Email e palavra-passe são obrigatórios.' });
        }

        const tipoFornecido = tipo || perfil || 'PROF';

        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        if (!utilizador) {
            return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        }

        if (!utilizador.ativo) {
            return res.status(403).json({ mensagem: 'Conta desativada. Aguarde a aprovação da administração.' });
        }

        const passwordCorreta = await bcrypt.compare(password, utilizador.password);
        if (!passwordCorreta) {
            return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        }

        const perfis = await utilizadorModel.getPerfisDoUtilizador(utilizador.id_utilizador);

        let temPerfil = false;
        
        if (tipoFornecido === 'ADMIN' || tipoFornecido === 'Admin') {
            temPerfil = perfis.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('coord'));
        } else if (tipoFornecido === 'PROF') {
            temPerfil = perfis.some(p => p.toLowerCase().includes('prof'));
        } else {
            temPerfil = perfis.some(p => p.toLowerCase().includes('encarregado') || p.toLowerCase().includes('educação') || p.toLowerCase() === 'ee');
        }

        if (!temPerfil) {
            return res.status(403).json({ mensagem: `Acesso negado: O seu email não tem permissões para este painel.` });
        }

        let perfilFinal = 'Encarregado de Educação';
        if (tipoFornecido === 'PROF') perfilFinal = 'Professor';
        if (tipoFornecido === 'ADMIN' || tipoFornecido === 'Admin') perfilFinal = 'Admin';

        const token = jwt.sign(
            {
                id: utilizador.id_utilizador,
                nome: utilizador.nome,
                email: utilizador.email,
                perfis,
                perfil: perfilFinal,
                id_perfil: tipoFornecido === 'ADMIN' ? 1 : null
            },
            process.env.JWT_SECRET || 'segredo_super_seguro_123',
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        return res.status(200).json({
            mensagem: 'Login efetuado com sucesso.',
            token,
            utilizador: {
                id: utilizador.id_utilizador,
                nome: utilizador.nome,
                email: utilizador.email,
                perfis,
                perfil: perfilFinal,
                id_perfil: tipoFornecido === 'ADMIN' ? 1 : null
            }
        });
    } catch (error) {
        console.error("Erro no login:", error);
        next(error);
    }
}

// ============================================================================
// US01 / RF01 — LOGOUT 
// ============================================================================
async function logout(req, res) {
    return res.status(200).json({ mensagem: 'Sessão terminada com sucesso.' });
}

// ============================================================================
// US02 / RF02 — SOLICITAR RECUPERAÇÃO DE PALAVRA-PASSE
// ============================================================================
async function solicitarRecuperacaoPassword(req, res, next) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ mensagem: 'Email é obrigatório.' });
        }

        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        if (!utilizador || !utilizador.ativo) {
            return res.status(404).json({
                mensagem: 'Este email não está registado na nossa base de dados ou não está ativo.'
            });
        }

        const token = crypto.randomBytes(4).toString('hex').toUpperCase();
        await utilizadorModel.guardarTokenRecuperacao(utilizador.id_utilizador, token);

        return res.status(200).json({
            mensagem: 'Token gerado com sucesso.',
            token: token
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US02 / RF02 — REDEFINIR PALAVRA-PASSE COM TOKEN
// ============================================================================
async function redefinirPassword(req, res, next) {
    try {
        const { token, novaPassword } = req.body;

        if (!token || !novaPassword) {
            return res.status(400).json({ mensagem: 'Token e nova password são obrigatórios.' });
        }

        if (novaPassword.length < 8) {
            return res.status(400).json({ mensagem: 'A password deve ter pelo menos 8 caracteres.' });
        }

        const tokenValido = await utilizadorModel.validarTokenRecuperacao(token);

        if (!tokenValido) {
            return res.status(400).json({ mensagem: 'Token inválido ou expirado.' });
        }

        const novaPasswordHash = await bcrypt.hash(novaPassword, 10);

        await utilizadorModel.atualizarPassword(
            tokenValido.UTILIZADORid_utilizador,
            novaPasswordHash,
            tokenValido.id_token_recuperacao
        );

        return res.status(200).json({ mensagem: 'Palavra-passe atualizada com sucesso.' });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US03 / REGISTO PÚBLICO
// ============================================================================
async function register(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo } = req.body;

        if (!nome || !email || !password || !tipo) {
            return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const nomePerfil = tipo === 'PROF' ? 'Professor' : 'Encarregado';

        await utilizadorModel.criarUtilizador({
            nome, email, passwordHash, telefone, nomePerfil
        });

        // AQUI ESTÁ A MUDANÇA DA MENSAGEM:
        return res.status(201).json({ mensagem: 'Registo concluído! A sua conta foi enviada para aprovação da Coordenação.' });
    } catch (error) {
        if (error.message === 'Já existe um utilizador com este email.') {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
}

// ============================================================================
// LISTAR TODOS OS UTILIZADORES (PARA O ADMIN)
// ============================================================================
async function listarUtilizadores(req, res, next) {
    try {
        const utilizadores = await utilizadorModel.listarTodosUtilizadores();
        return res.status(200).json(utilizadores);
    } catch (error) {
        console.error("Erro a listar utilizadores:", error);
        next(error);
    }
}

// ============================================================================
// ATIVAR UTILIZADOR (ACEITAR NA COMUNIDADE)
// ============================================================================
async function ativarUtilizador(req, res, next) {
    try {
        const { id } = req.params;
        
        const sucesso = await utilizadorModel.alterarEstadoUtilizador(id, true);
        
        if (sucesso) {
            return res.status(200).json({ mensagem: 'Utilizador aceite com sucesso!' });
        } else {
            return res.status(400).json({ mensagem: 'Não foi possível aceitar o utilizador.' });
        }
    } catch (error) {
        console.error("Erro a ativar utilizador:", error);
        next(error);
    }
}

module.exports = {
    login,
    logout,
    solicitarRecuperacaoPassword,
    redefinirPassword,
    register,
    listarUtilizadores,
    ativarUtilizador
};