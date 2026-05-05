const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const utilizadorModel = require('../models/utilizadorModel');

// ============================================================================
// US01 / RF01 — LOGIN
// POST /api/auth/login
// Body: { email, password }
// ============================================================================
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ mensagem: 'Email e password são obrigatórios.' });
        }

        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        if (!utilizador) {
            return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        }

        if (!utilizador.ativo) {
            return res.status(403).json({ mensagem: 'Conta desativada. Contacte o administrador.' });
        }

        const passwordCorreta = await bcrypt.compare(password, utilizador.password);
        if (!passwordCorreta) {
            return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        }

        const perfis = await utilizadorModel.getPerfisDoUtilizador(utilizador.id_utilizador);

        const token = jwt.sign(
            {
                id: utilizador.id_utilizador,
                nome: utilizador.nome,
                email: utilizador.email,
                perfis
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        return res.status(200).json({
            mensagem: 'Login efetuado com sucesso.',
            token,
            utilizador: {
                id: utilizador.id_utilizador,
                nome: utilizador.nome,
                email: utilizador.email,
                perfis
            }
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US01 / RF01 — LOGOUT (stateless: invalidação do lado do cliente)
// POST /api/auth/logout
// ============================================================================
async function logout(req, res) {
    // Com JWT stateless, o logout é gerido pelo cliente (eliminar o token).
    // Aqui apenas confirmamos a operação.
    return res.status(200).json({ mensagem: 'Sessão terminada com sucesso.' });
}

// ============================================================================
// US02 / RF02 — SOLICITAR RECUPERAÇÃO DE PALAVRA-PASSE
// POST /api/auth/recuperar-password
// Body: { email }
// ============================================================================
async function solicitarRecuperacaoPassword(req, res, next) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ mensagem: 'Email é obrigatório.' });
        }

        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        // Resposta genérica por segurança (não revelar se o email existe ou não)
        if (!utilizador || !utilizador.ativo) {
            return res.status(200).json({
                mensagem: 'Se o email existir no sistema, receberá instruções para recuperar a palavra-passe.'
            });
        }

        const token = crypto.randomBytes(32).toString('hex');
        await utilizadorModel.guardarTokenRecuperacao(utilizador.id_utilizador, token);

        // TODO: Integrar envio de email (ex: nodemailer) com o link:
        // `${process.env.FRONTEND_URL}/redefinir-password?token=${token}`
        console.log(`[DEV] Token de recuperação para ${email}: ${token}`);

        return res.status(200).json({
            mensagem: 'Se o email existir no sistema, receberá instruções para recuperar a palavra-passe.'
        });
    } catch (error) {
        next(error);
    }
}

// ============================================================================
// US02 / RF02 — REDEFINIR PALAVRA-PASSE COM TOKEN
// POST /api/auth/redefinir-password
// Body: { token, novaPassword }
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

module.exports = {
    login,
    logout,
    solicitarRecuperacaoPassword,
    redefinirPassword
};