const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const utilizadorModel = require('../models/utilizadorModel');

// ============================================================================
// US01 / RF01 — LOGIN
// ============================================================================
async function login(req, res, next) {
    try {
        const { email, password, tipo } = req.body;

        if (!email || !password || !tipo) {
            return res.status(400).json({ mensagem: 'Email, password e perfil são obrigatórios.' });
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
        const tipoNorm = String(tipo || '').trim().toUpperCase();

        // VALIDAÇÃO RIGOROSA DE PERFIL PARA EVITAR CROSS-LOGIN
        let temPerfil = false;
        let rotuloEsperado = 'Enc. de Educação';

        if (tipoNorm === 'PROF' || tipoNorm === 'PROFESSOR') {
            rotuloEsperado = 'Professor';
            temPerfil = perfis.some((p) => String(p).toLowerCase().includes('prof'));
        } else if (tipoNorm === 'ADMIN' || tipoNorm === 'ADMINISTRADOR' || tipoNorm === 'COORD' || tipoNorm === 'COORDENACAO') {
            rotuloEsperado = 'Administração ou Coordenação';
            temPerfil = perfis.some((p) => {
                const s = String(p).toLowerCase();
                return (
                    s.includes('admin') ||
                    s.includes('coordenação') ||
                    s.includes('coordenacao') ||
                    s.includes('administração') ||
                    s.includes('administracao')
                );
            });
        } else {
            // EE — login público (Encarregado)
            temPerfil = perfis.some(
                (p) =>
                    String(p).toLowerCase().includes('encarregado') ||
                    String(p).toLowerCase().includes('educação') ||
                    String(p).toLowerCase().includes('educacao') ||
                    String(p).toLowerCase() === 'ee'
            );
        }

        if (!temPerfil) {
            return res.status(403).json({
                mensagem: `Acesso negado: O seu email não está registado como ${rotuloEsperado}.`
            });
        }

        let perfilFinal = 'Encarregado de Educação';
        if (tipoNorm === 'PROF' || tipoNorm === 'PROFESSOR') {
            perfilFinal = 'Professor';
        } else if (tipoNorm === 'ADMIN' || tipoNorm === 'ADMINISTRADOR' || tipoNorm === 'COORD' || tipoNorm === 'COORDENACAO') {
            const match = perfis.find((p) => {
                const s = String(p).toLowerCase();
                return s.includes('admin') || s.includes('coord');
            });
            perfilFinal = match || 'Admin';
        }

        const token = jwt.sign(
            {
                id: utilizador.id_utilizador,
                nome: utilizador.nome,
                email: utilizador.email,
                perfis,
                perfil: perfilFinal
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
                perfis,
                perfil: perfilFinal 
            }
        });
    } catch (error) {
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
// US02 / RF02 — SOLICITAR RECUPERAÇÃO DE PALAVRA-PASSE (SIMULAÇÃO DE EMAIL)
// ============================================================================
async function solicitarRecuperacaoPassword(req, res, next) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ mensagem: 'Email é obrigatório.' });
        }

        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        // AGORA REJEITA SE O EMAIL NÃO EXISTIR NA BD!
        if (!utilizador || !utilizador.ativo) {
            return res.status(404).json({
                mensagem: 'Este email não está registado na nossa base de dados.'
            });
        }

        // GERA UM TOKEN DE 8 CARACTERES ALFANUMÉRICOS (MAIÚSCULOS)
        const token = crypto.randomBytes(4).toString('hex').toUpperCase();
        
        await utilizadorModel.guardarTokenRecuperacao(utilizador.id_utilizador, token);

        console.log(`[DEV] Token de recuperação para ${email}: ${token}`);

        // DEVOLVE O TOKEN AO FRONTEND PARA EFEITOS DE SIMULAÇÃO (ALERTA)
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
            nome,
            email,
            passwordHash,
            telefone,
            nomePerfil
        });

        return res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
    } catch (error) {
        if (error.message === 'Já existe um utilizador com este email.') {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message && error.message.startsWith('PERFIL_NAO_ENCONTRADO')) {
             const perfisNaBd = error.message.split(':')[1];
             return res.status(400).json({ error: `Atenção: A tua Base de Dados não tem o perfil configurado. Atualmente só tens: [${perfisNaBd}]. Tens de adicionar 'Professor' e 'Encarregado de Educação' na tabela PERFIL.` });
        }
        
        next(error);
    }
}

module.exports = {
    login,
    logout,
    solicitarRecuperacaoPassword,
    redefinirPassword,
    register
};