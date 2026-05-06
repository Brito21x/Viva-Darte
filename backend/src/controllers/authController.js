const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const utilizadorModel = require('../models/authModel');

// LOGIN E RECUPERAÇÕES MANTÊM-SE IGUAIS
async function login(req, res, next) {
    try {
        const { email, password, tipo, perfil } = req.body;
        if (!email || !password) return res.status(400).json({ mensagem: 'Email e palavra-passe são obrigatórios.' });

        const tipoFornecido = tipo || perfil || 'PROF';
        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        if (!utilizador) return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        if (!utilizador.ativo) return res.status(403).json({ mensagem: 'Conta desativada. Aguarde a aprovação da administração.' });

        const passwordCorreta = await bcrypt.compare(password, utilizador.password);
        if (!passwordCorreta) return res.status(401).json({ mensagem: 'Credenciais inválidas.' });

        const perfis = await utilizadorModel.getPerfisDoUtilizador(utilizador.id_utilizador);
        let temPerfil = false;
        
        if (tipoFornecido === 'ADMIN' || tipoFornecido === 'Admin') temPerfil = perfis.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('coord'));
        else if (tipoFornecido === 'PROF') temPerfil = perfis.some(p => p.toLowerCase().includes('prof'));
        else temPerfil = perfis.some(p => p.toLowerCase().includes('encarregado') || p.toLowerCase().includes('educação') || p.toLowerCase() === 'ee');

        if (!temPerfil) return res.status(403).json({ mensagem: `Acesso negado.` });

        let perfilFinal = 'Encarregado de Educação';
        if (tipoFornecido === 'PROF') perfilFinal = 'Professor';
        if (tipoFornecido === 'ADMIN' || tipoFornecido === 'Admin') perfilFinal = 'Admin';

        const token = jwt.sign(
            { id: utilizador.id_utilizador, nome: utilizador.nome, email: utilizador.email, perfis, perfil: perfilFinal, id_perfil: tipoFornecido === 'ADMIN' ? 1 : null },
            process.env.JWT_SECRET || 'segredo_super_seguro_123',
            { expiresIn: '8h' }
        );

        return res.status(200).json({ mensagem: 'Login efetuado', token, utilizador: { id: utilizador.id_utilizador, nome: utilizador.nome, email: utilizador.email, perfis, perfil: perfilFinal } });
    } catch (error) { next(error); }
}

async function logout(req, res) { return res.status(200).json({ mensagem: 'Sessão terminada com sucesso.' }); }

async function solicitarRecuperacaoPassword(req, res, next) {
    try {
        const { email } = req.body;
        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);
        if (!utilizador || !utilizador.ativo) return res.status(404).json({ mensagem: 'Email não encontrado ou inativo.' });
        const token = crypto.randomBytes(4).toString('hex').toUpperCase();
        await utilizadorModel.guardarTokenRecuperacao(utilizador.id_utilizador, token);
        return res.status(200).json({ mensagem: 'Token gerado.', token });
    } catch (error) { next(error); }
}

async function redefinirPassword(req, res, next) {
    try {
        const { token, novaPassword } = req.body;
        if (!token || !novaPassword) return res.status(400).json({ mensagem: 'Token e password obrigatórios.' });
        const tokenValido = await utilizadorModel.validarTokenRecuperacao(token);
        if (!tokenValido) return res.status(400).json({ mensagem: 'Token inválido.' });
        const hash = await bcrypt.hash(novaPassword, 10);
        await utilizadorModel.atualizarPassword(tokenValido.UTILIZADORid_utilizador, hash, tokenValido.id_token_recuperacao);
        return res.status(200).json({ mensagem: 'Palavra-passe atualizada.' });
    } catch (error) { next(error); }
}

// REGISTO PÚBLICO (Fica pendente)
async function register(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo } = req.body;
        if (!nome || !email || !password || !tipo) return res.status(400).json({ error: 'Campos em falta.' });

        const passwordHash = await bcrypt.hash(password, 10);
        const nomePerfil = tipo === 'PROF' ? 'Professor' : 'Encarregado';

        await utilizadorModel.criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil, ativo: 0 });
        return res.status(201).json({ mensagem: 'Registo concluído! Aguarde aprovação.' });
    } catch (error) {
        if (error.message.includes('Já existe')) return res.status(400).json({ error: error.message });
        next(error);
    }
}

// ============================================================================
// FUNÇÕES DE ADMINISTRAÇÃO
// ============================================================================
async function listarUtilizadores(req, res, next) {
    try {
        const users = await utilizadorModel.listarTodosUtilizadores();
        return res.status(200).json(users);
    } catch (error) { next(error); }
}

async function ativarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.alterarEstadoUtilizador(req.params.id, true);
        if (sucesso) return res.status(200).json({ mensagem: 'Utilizador aceite!' });
        return res.status(400).json({ mensagem: 'Erro ao aceitar.' });
    } catch (error) { next(error); }
}

async function desativarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.alterarEstadoUtilizador(req.params.id, false);
        if (sucesso) return res.status(200).json({ mensagem: 'Acesso revogado!' });
        return res.status(400).json({ mensagem: 'Erro ao revogar.' });
    } catch (error) { next(error); }
}
// NOVA FUNÇÃO: ELIMINAR UTILIZADOR PENDENTE/SUSPENSO
async function eliminarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.apagarUtilizador(req.params.id);
        if (sucesso) return res.status(200).json({ mensagem: 'Pedido eliminado com sucesso!' });
        return res.status(400).json({ mensagem: 'Erro ao eliminar utilizador.' });
    } catch (error) { next(error); }
}

// NOVA FUNÇÃO: Criar Utilizador diretamente pelo Admin (Fica Ativo logo)
async function adminCriarUtilizador(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo } = req.body;
        if (!nome || !email || !password || !tipo) return res.status(400).json({ mensagem: 'Campos obrigatórios em falta.' });

        const passwordHash = await bcrypt.hash(password, 10);
        let nomePerfil = 'Encarregado';
        if (tipo === 'PROF') nomePerfil = 'Professor';
        if (tipo === 'ADMIN') nomePerfil = 'Admin';

        // O Admin cria utilizadores já ativos (ativo: 1)
        await utilizadorModel.criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil, ativo: 1 });
        return res.status(201).json({ mensagem: 'Utilizador criado e ativado com sucesso!' });
    } catch (error) {
        if (error.message.includes('Já existe')) return res.status(400).json({ mensagem: error.message });
        next(error);
    }
}

// NOVA FUNÇÃO: Editar Todos os Dados
async function editarUtilizadorCompleto(req, res, next) {
    try {
        const { id } = req.params;
        const { nome, email, telefone, password, tipo } = req.body;
        
        if (!nome || !email) return res.status(400).json({ mensagem: 'Nome e email são obrigatórios.' });

        let passwordHash = null;
        if (password && password.trim() !== '') {
            passwordHash = await bcrypt.hash(password, 10);
        }

        let nomePerfil = 'Encarregado';
        if (tipo === 'PROF') nomePerfil = 'Professor';
        if (tipo === 'ADMIN') nomePerfil = 'Admin';

        await utilizadorModel.atualizarUtilizadorCompleto(id, { nome, email, telefone, passwordHash, nomePerfil });
        return res.status(200).json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (error) { next(error); }
}

module.exports = {
    login, 
    logout, 
    solicitarRecuperacaoPassword, 
    redefinirPassword, 
    register,
    listarUtilizadores, 
    ativarUtilizador, 
    desativarUtilizador, 
    adminCriarUtilizador, 
    editarUtilizadorCompleto,
    eliminarUtilizador
};