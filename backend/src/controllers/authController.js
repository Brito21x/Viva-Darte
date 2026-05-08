/**
 * Controlador de Autenticação e Gestão de Utilizadores
 * Este ficheiro gere o login, registo, recuperação de passwords e operações de administração.
 */

const bcrypt = require('bcryptjs'); // Biblioteca para encriptação de passwords (hashing)
const jwt = require('jsonwebtoken'); // Biblioteca para gerar e validar JSON Web Tokens (JWT)
const crypto = require('crypto'); // Módulo nativo do Node.js para operações criptográficas (ex: gerar tokens)

const utilizadorModel = require('../models/authModel'); // Modelo de dados do utilizador

// ============================================================================
// AUTENTICAÇÃO E RECUPERAÇÃO DE CONTA
// ============================================================================

async function login(req, res, next) {
    try {
        const { email, password, tipo, perfil } = req.body;
        
        // 1. Validação dos campos obrigatórios
        if (!email || !password) return res.status(400).json({ mensagem: 'Email e palavra-passe são obrigatórios.' });

        const tipoFornecido = tipo || perfil || 'PROF';
        /** Normaliza para comparações (ex.: Postman com `"tipo": "admin"`). */
        const tipoUp = String(tipoFornecido).trim().toUpperCase();
        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        // 2. Verificação de existência do utilizador
        if (!utilizador) return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        
        // 3. Verificação do estado da conta (Aprovação pendente ou conta suspensa)
        if (!utilizador.ativo) return res.status(403).json({ mensagem: 'Conta desativada. Aguarde a aprovação da administração.' });

        // 4. Verificação de segurança da password (comparação de hashes)
        const passwordCorreta = await bcrypt.compare(password, utilizador.password);
        if (!passwordCorreta) return res.status(401).json({ mensagem: 'Credenciais inválidas.' });

        // 5. Validação de Perfis e Autorização
        const perfis = await utilizadorModel.getPerfisDoUtilizador(utilizador.id_utilizador);
        let temPerfil = false;
        
        // Verifica se o perfil fornecido corresponde aos perfis associados ao utilizador na base de dados
        if (tipoUp === 'ADMIN') temPerfil = perfis.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('coord'));
        else if (tipoUp === 'PROF' || tipoUp === 'PROFESSOR') temPerfil = perfis.some(p => p.toLowerCase().includes('prof'));
        else temPerfil = perfis.some(p => p.toLowerCase().includes('encarregado') || p.toLowerCase().includes('educação') || p.toLowerCase().includes('educacao') || p.toLowerCase() === 'ee');

        if (!temPerfil) return res.status(403).json({ mensagem: `Acesso negado.` });

        // Normalização do nome do perfil para envio no token
        let perfilFinal = 'Encarregado de Educação';
        if (tipoUp === 'PROF' || tipoUp === 'PROFESSOR') perfilFinal = 'Professor';
        if (tipoUp === 'ADMIN') perfilFinal = 'Admin';

        // 6. Geração do JSON Web Token (JWT) com os dados de sessão do utilizador
        const token = jwt.sign(
            { id: utilizador.id_utilizador, nome: utilizador.nome, email: utilizador.email, perfis, perfil: perfilFinal, id_perfil: tipoUp === 'ADMIN' ? 1 : null },
            process.env.JWT_SECRET || 'segredo_super_seguro_123',
            { expiresIn: '8h' } // O token expira em 8 horas
        );

        return res.status(200).json({ mensagem: 'Login efetuado', token, utilizador: { id: utilizador.id_utilizador, nome: utilizador.nome, email: utilizador.email, perfis, perfil: perfilFinal } });
    } catch (error) { next(error); }
}

/**
 * Termina a sessão do utilizador.
 * (Numa arquitetura JWT stateless, o logout é maioritariamente tratado no lado do cliente apagando o token).
 */
async function logout(req, res) { 
    return res.status(200).json({ mensagem: 'Sessão terminada com sucesso.' }); 
}

/**
 * Gera um token seguro para iniciar o processo de recuperação de password.
 */
async function solicitarRecuperacaoPassword(req, res, next) {
    try {
        const { email } = req.body;
        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);
        
        // Proteção: Apenas contas ativas e existentes podem recuperar a password
        if (!utilizador || !utilizador.ativo) return res.status(404).json({ mensagem: 'Email não encontrado ou inativo.' });
        
        // Geração de um token hexadecimal aleatório (ex: 8A4F1D)
        const token = crypto.randomBytes(4).toString('hex').toUpperCase();
        await utilizadorModel.guardarTokenRecuperacao(utilizador.id_utilizador, token);
        
        return res.status(200).json({ mensagem: 'Token gerado.', token });
    } catch (error) { next(error); }
}

/**
 * Redefine a password do utilizador mediante um token de recuperação válido.
 */
async function redefinirPassword(req, res, next) {
    try {
        const { token, novaPassword } = req.body;
        if (!token || !novaPassword) return res.status(400).json({ mensagem: 'Token e password obrigatórios.' });
        
        const tokenValido = await utilizadorModel.validarTokenRecuperacao(token);
        if (!tokenValido) return res.status(400).json({ mensagem: 'Token inválido.' });
        
        // Encripta a nova password antes de a guardar na base de dados
        const hash = await bcrypt.hash(novaPassword, 10);
        await utilizadorModel.atualizarPassword(tokenValido.UTILIZADORid_utilizador, hash, tokenValido.id_token_recuperacao);
        
        return res.status(200).json({ mensagem: 'Palavra-passe atualizada.' });
    } catch (error) { next(error); }
}

/**
 * Registo de novos utilizadores
 * Nota: Os utilizadores criados por esta via ficam pendentes de aprovação (ativo: 0).
 */
async function register(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo } = req.body;
        if (!nome || !email || !password || !tipo) return res.status(400).json({ error: 'Campos em falta.' });

        // Encriptação da password
        const passwordHash = await bcrypt.hash(password, 10);
        const nomePerfil = tipo === 'PROF' ? 'Professor' : 'Encarregado';

        // Cria o utilizador com estado inativo por omissão
        await utilizadorModel.criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil, ativo: 0 });
        return res.status(201).json({ mensagem: 'Registo concluído! Aguarde aprovação.' });
    } catch (error) {
        // Tratamento de erro específico para emails já registados
        if (error.message.includes('Já existe')) return res.status(400).json({ error: error.message });
        next(error);
    }
}

// ============================================================================
// FUNÇÕES DE ADMINISTRAÇÃO (Acesso restrito a Admins)
// ============================================================================

/**
 * Lista todos os utilizadores registados na plataforma.
 */
async function listarUtilizadores(req, res, next) {
    try {
        const users = await utilizadorModel.listarTodosUtilizadores();
        return res.status(200).json(users);
    } catch (error) { next(error); }
}

/**
 * Ativa uma conta de utilizador que estava pendente ou suspensa.
 */
async function ativarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.alterarEstadoUtilizador(req.params.id, true);
        if (sucesso) return res.status(200).json({ mensagem: 'Utilizador aceite!' });
        return res.status(400).json({ mensagem: 'Erro ao aceitar.' });
    } catch (error) { next(error); }
}

/**
 * Desativa/Suspende a conta de um utilizador, revogando o seu acesso.
 */
async function desativarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.alterarEstadoUtilizador(req.params.id, false);
        if (sucesso) return res.status(200).json({ mensagem: 'Acesso revogado!' });
        return res.status(400).json({ mensagem: 'Erro ao revogar.' });
    } catch (error) { next(error); }
}

/**
 * Apaga permanentemente o registo de um utilizador do sistema.
 */
async function eliminarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.apagarUtilizador(req.params.id);
        if (sucesso) return res.status(200).json({ mensagem: 'Pedido eliminado com sucesso!' });
        return res.status(400).json({ mensagem: 'Erro ao eliminar utilizador.' });
    } catch (error) { next(error); }
}

/**
 * Permite a um Administrador criar diretamente um novo utilizador.
 * Diferente do registo público, o utilizador fica imediatamente ativo.
 */
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

/**
 * Permite editar todos os dados de um utilizador existente.
 * A password só é alterada se for fornecida uma nova no pedido.
 */
async function editarUtilizadorCompleto(req, res, next) {
    try {
        const { id } = req.params;
        const { nome, email, telefone, password, tipo } = req.body;
        
        if (!nome || !email) return res.status(400).json({ mensagem: 'Nome e email são obrigatórios.' });

        let passwordHash = null;
        // Verifica se uma nova password foi submetida e não está em branco
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

// Exportação dos métodos do controlador para uso nas rotas (Routes)
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