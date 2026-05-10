/**
 * @fileoverview Controlador de Autenticação e Gestão de Utilizadores.
 * Lida com o login, registo, recuperação de palavra-passe e gestão CRUD de utilizadores e alunos associados.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const utilizadorModel = require('../models/authModel');

/**
 * Autentica um utilizador no sistema e gera um token JWT.
 * @param {Object} req - Objeto de requisição do Express.
 * @param {Object} res - Objeto de resposta do Express.
 * @param {Function} next - Middleware seguinte para tratamento de erros.
 */
async function login(req, res, next) {
    try {
        const { email, password, tipo, perfil, captchaToken } = req.body;

        if (!email || !password) {
            return res.status(400).json({ mensagem: 'Email e palavra-passe são obrigatórios.' });
        }

        if (captchaToken) {
            const chaveSecreta = process.env.RECAPTCHA_SECRET_KEY;
            const googleVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${chaveSecreta}&response=${captchaToken}`;
            const recaptchaResponse = await fetch(googleVerifyUrl, { method: 'POST' });
            const recaptchaData = await recaptchaResponse.json();

            if (!recaptchaData.success) {
                return res.status(400).json({ mensagem: 'A validação do reCAPTCHA falhou. Tenta novamente.' });
            }
        }

        const tipoFornecido = tipo || perfil || 'PROF';
        const tipoUp = String(tipoFornecido).trim().toUpperCase();
        
        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        if (!utilizador) return res.status(401).json({ mensagem: 'Credenciais inválidas.' });
        
        if (!utilizador.ativo) {
            return res.status(403).json({ mensagem: 'Conta desativada. Aguarde a aprovação da administração.' });
        }

        const passwordCorreta = await bcrypt.compare(password, utilizador.password);
        if (!passwordCorreta) return res.status(401).json({ mensagem: 'Credenciais inválidas.' });

        const perfis = await utilizadorModel.getPerfisDoUtilizador(utilizador.id_utilizador);
        let temPerfil = false;
        
        if (tipoUp === 'ADMIN') {
            temPerfil = perfis.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('coord'));
        } else if (tipoUp === 'PROF' || tipoUp === 'PROFESSOR') {
            temPerfil = perfis.some(p => p.toLowerCase().includes('prof'));
        } else {
            temPerfil = perfis.some(p => p.toLowerCase().includes('encarregado') || p.toLowerCase().includes('educação') || p.toLowerCase().includes('educacao') || p.toLowerCase() === 'ee');
        }

        if (perfis.length === 0) return res.status(403).json({ mensagem: 'Acesso negado. Nenhum perfil associado.' });

        let perfilFinal = 'Encarregado de Educação';
        if (perfis.some(p => p.toLowerCase().includes('prof'))) perfilFinal = 'Professor';
        if (perfis.some(p => p.toLowerCase().includes('admin') || p.toLowerCase().includes('coord'))) perfilFinal = 'Admin';

        const token = jwt.sign(
            { 
                id: utilizador.id_utilizador, 
                nome: utilizador.nome, 
                email: utilizador.email, 
                perfis, 
                perfil: perfilFinal, 
                id_perfil: perfilFinal === 'Admin' ? 1 : null 
            },
            process.env.JWT_SECRET || 'segredo_super_seguro_123',
            { expiresIn: '8h' }
        );

        return res.status(200).json({
            mensagem: 'Login efetuado',
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

/**
 * Termina a sessão do utilizador (no lado do cliente, normalmente o token é descartado).
 */
async function logout(req, res) {
    return res.status(200).json({ mensagem: 'Sessão terminada com sucesso.' });
}

/**
 * Solicita a recuperação da palavra-passe, gerando um token seguro enviado (ou para envio) ao utilizador.
 */
async function solicitarRecuperacaoPassword(req, res, next) {
    try {
        const { email } = req.body;
        const utilizador = await utilizadorModel.getUtilizadorByEmail(email);

        // Apenas utilizadores existentes e ativos podem recuperar a palavra-passe
        if (!utilizador || !utilizador.ativo) {
            return res.status(404).json({ mensagem: 'Email não encontrado ou inativo.' });
        }

        // Gera um token hexadecimal de 8 caracteres
        const token = crypto.randomBytes(4).toString('hex').toUpperCase();
        await utilizadorModel.guardarTokenRecuperacao(utilizador.id_utilizador, token);

        return res.status(200).json({ mensagem: 'Token gerado.', token });
    } catch (error) {
        next(error);
    }
}

/**
 * Redefine a palavra-passe utilizando o token de recuperação previamente gerado.
 */
async function redefinirPassword(req, res, next) {
    try {
        const { token, novaPassword } = req.body;
        if (!token || !novaPassword) {
            return res.status(400).json({ mensagem: 'Token e password obrigatórios.' });
        }

        // Valida se o token existe e ainda é válido
        const tokenValido = await utilizadorModel.validarTokenRecuperacao(token);
        if (!tokenValido) return res.status(400).json({ mensagem: 'Token inválido.' });

        // Aplica hash à nova palavra-passe antes de guardar
        const hash = await bcrypt.hash(novaPassword, 10);
        await utilizadorModel.atualizarPassword(tokenValido.UTILIZADORid_utilizador, hash, tokenValido.id_token_recuperacao);

        return res.status(200).json({ mensagem: 'Palavra-passe atualizada.' });
    } catch (error) {
        next(error);
    }
}

/**
 * Regista um novo utilizador no sistema. O utilizador fica inativo até aprovação da administração.
 */
async function register(req, res, next) {
    try {
        // 1. Desestruturar o captchaToken
        const { nome, email, telefone, password, tipo, nomeAluno, dataNascimentoAluno, captchaToken } = req.body;
        
        if (!nome || !email || !password || !tipo) return res.status(400).json({ error: 'Campos em falta.' });

        if (tipo === 'EE' && (!nomeAluno || !dataNascimentoAluno)) {
            return res.status(400).json({ error: 'Nome e data de nascimento do aluno são obrigatórios.' });
        }

        if (!captchaToken) {
            return res.status(400).json({ error: 'Validação reCAPTCHA em falta.' });
        }

        const chaveSecreta = process.env.RECAPTCHA_SECRET_KEY;
        
        const googleVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${chaveSecreta}&response=${captchaToken}`;
        const recaptchaResponse = await fetch(googleVerifyUrl, { method: 'POST' });
        const recaptchaData = await recaptchaResponse.json();

        if (!recaptchaData.success) {
            return res.status(400).json({ error: 'A validação do reCAPTCHA falhou. Tenta novamente.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const nomePerfil = tipo === 'PROF' ? 'Professor' : 'Encarregado';

        await utilizadorModel.criarUtilizador({ 
            nome, email, passwordHash, telefone, nomePerfil, ativo: 0, 
            nomeAluno, dataNascimentoAluno 
        });
        
        return res.status(201).json({ mensagem: 'Registo concluído! Aguarde aprovação.' });
    } catch (error) {
        if (error.message.includes('Já existe')) return res.status(400).json({ error: error.message });
        next(error);
    }
}

/**
 * Lista todos os utilizadores registados no sistema.
 */
async function listarUtilizadores(req, res, next) {
    try {
        const lista = await utilizadorModel.listarTodosUtilizadores();
        return res.status(200).json(lista);
    } catch (error) {
        next(error);
    }
}

/**
 * Permite a um Administrador criar um utilizador, definindo imediatamente o seu estado como ativo e associando modalidades.
 */
async function criarUtilizadorAdmin(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo, idsModalidades } = req.body;

        if (!nome || !email || !password || !tipo) {
            return res.status(400).json({ mensagem: 'Nome, email, password e tipo (PROF ou EE) são obrigatórios.' });
        }

        let nomePerfil = 'Encarregado';
        if (tipo === 'PROF') nomePerfil = 'Professor';
        if (tipo === 'ADMIN') nomePerfil = 'Admin';
        
        let idsModalidadesProf;
        // Validação estrita: Professores devem ter obrigatoriamente modalidades associadas
        if (tipo === 'PROF') {
            idsModalidadesProf = Array.isArray(idsModalidades) ? idsModalidades : [];
            if (idsModalidadesProf.length === 0) {
                return res.status(400).json({
                    mensagem: 'Para professor, indica pelo menos uma modalidade (idsModalidades).'
                });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Cria o utilizador já com estado ativo = 1
        const novo = await utilizadorModel.criarUtilizador({
            nome,
            email,
            passwordHash,
            telefone,
            nomePerfil,
            ativo: 1,
            idsModalidades: idsModalidadesProf
        });

        return res.status(201).json({ mensagem: 'Utilizador criado.', utilizador: novo });
    } catch (error) {
        // Tratamento de erros específicos vindos do model
        if (error.message === 'Já existe um utilizador com este email.') {
            return res.status(400).json({ mensagem: error.message });
        }
        if (error.message && error.message.startsWith('PERFIL_NAO_ENCONTRADO')) {
            const perfisNaBd = error.message.split(':')[1];
            return res.status(400).json({
                mensagem: `Perfil não encontrado na BD. Perfis existentes: ${perfisNaBd}`
            });
        }
        next(error);
    }
}

/**
 * Edita os dados de um utilizador existente.
 */
async function editarUtilizador(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ mensagem: 'ID inválido.' });
        }

        const { nome, email, telefone, password, nomePerfil, tipo, idsModalidades } = req.body;
        if (!nome) {
            return res.status(400).json({ mensagem: 'Nome é obrigatório.' });
        }

        // Determinação do perfil final com base nos inputs recebidos
        let perfilFinal = nomePerfil;
        if (!perfilFinal && tipo === 'PROF') perfilFinal = 'Professor';
        if (!perfilFinal && tipo === 'ADMIN') perfilFinal = 'Admin';
        if (!perfilFinal && tipo === 'EE') perfilFinal = 'Encarregado';
        
        let passwordHash = null;
        // Apenas aplica hash e atualiza a password se uma nova for fornecida
        if (password && password.trim() !== '') {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const ok = await utilizadorModel.atualizarUtilizadorCompleto(id, {
            nome,
            email,
            telefone,
            passwordHash,
            nomePerfil: perfilFinal,
            idsModalidades
        });
        
        if (!ok) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }
        return res.status(200).json({ mensagem: 'Utilizador atualizado.' });
    } catch (error) {
        next(error);
    }
}

/**
 * Altera o estado (ativo/inativo) de um utilizador.
 */
async function alterarEstado(req, res, next) {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ mensagem: 'ID inválido.' });
        }

        const { ativo } = req.body;
        if (typeof ativo !== 'boolean') {
            return res.status(400).json({ mensagem: 'Campo "ativo" (boolean) é obrigatório.' });
        }

        const ok = await utilizadorModel.alterarEstadoUtilizador(id, ativo, req.body.idsModalidades);
        if (!ok) {
            return res.status(404).json({ mensagem: 'Utilizador não encontrado.' });
        }
        return res.status(200).json({ mensagem: ativo ? 'Conta ativada.' : 'Conta desativada.' });
    } catch (error) {
        next(error);
    }
}

/**
 * Ativa a conta de um utilizador (útil para aprovação de registos pendentes).
 */
async function ativarUtilizador(req, res, next) {
    try {
        const perfis = await utilizadorModel.getPerfisDoUtilizador(req.params.id);
        const isProfessor = perfis.some((p) => String(p).toLowerCase().includes('prof'));
        const idsModalidades = Array.isArray(req.body?.idsModalidades) ? req.body.idsModalidades : null;

        // Se for professor, é obrigatório atribuir modalidades no momento da ativação
        if (isProfessor && (!idsModalidades || idsModalidades.length === 0)) {
            return res.status(400).json({ mensagem: 'Seleciona pelo menos uma modalidade para aceitar este professor.' });
        }

        const sucesso = await utilizadorModel.alterarEstadoUtilizador(req.params.id, true, idsModalidades);
        if (sucesso) return res.status(200).json({ mensagem: 'Utilizador aceite!' });
        return res.status(400).json({ mensagem: 'Erro ao aceitar.' });
    } catch (error) {
        next(error);
    }
}

/**
 * Desativa a conta de um utilizador, revogando o seu acesso ao sistema.
 */
async function desativarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.alterarEstadoUtilizador(req.params.id, false);
        if (sucesso) return res.status(200).json({ mensagem: 'Acesso revogado!' });
        return res.status(400).json({ mensagem: 'Erro ao revogar.' });
    } catch (error) {
        next(error);
    }
}

/**
 * Apaga permanentemente um utilizador do sistema.
 */
async function eliminarUtilizador(req, res, next) {
    try {
        const sucesso = await utilizadorModel.apagarUtilizador(req.params.id);
        if (sucesso) return res.status(200).json({ mensagem: 'Pedido eliminado com sucesso!' });
        return res.status(400).json({ mensagem: 'Erro ao eliminar utilizador.' });
    } catch (error) {
        next(error);
    }
}

/**
 *  Criação de utilizador por um administrador.
 */
async function adminCriarUtilizador(req, res, next) {
    try {
        const { nome, email, telefone, password, tipo, idsModalidades } = req.body;
        if (!nome || !email || !password || !tipo) {
            return res.status(400).json({ mensagem: 'Campos obrigatórios em falta.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        let nomePerfil = 'Encarregado';
        if (tipo === 'PROF') nomePerfil = 'Professor';
        if (tipo === 'ADMIN') nomePerfil = 'Admin';
        
        if (tipo === 'PROF' && (!Array.isArray(idsModalidades) || idsModalidades.length === 0)) {
            return res.status(400).json({ mensagem: 'Seleciona pelo menos uma modalidade para este professor.' });
        }

        await utilizadorModel.criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil, ativo: 1, idsModalidades });
        return res.status(201).json({ mensagem: 'Utilizador criado e ativado com sucesso!' });
    } catch (error) {
        if (error.message.includes('Já existe')) return res.status(400).json({ mensagem: error.message });
        next(error);
    }
}

/**
 * Edição Completa do Utilizador
 */
async function editarUtilizadorCompleto(req, res, next) {
    try {
        const { id } = req.params;
        // Adicionado: nomeAluno e dataNascimentoAluno no destructuring
        const { nome, email, telefone, password, tipo, idsModalidades, nomeAluno, dataNascimentoAluno } = req.body;

        if (!nome || !email) {
            return res.status(400).json({ mensagem: 'Nome e email são obrigatórios.' });
        }

        let passwordHash = null;
        if (password && password.trim() !== '') {
            passwordHash = await bcrypt.hash(password, 10);
        }

        let nomePerfil = 'Encarregado';
        if (tipo === 'PROF') nomePerfil = 'Professor';
        if (tipo === 'ADMIN') nomePerfil = 'Admin';
        
        if (tipo === 'PROF' && (!Array.isArray(idsModalidades) || idsModalidades.length === 0)) {
            return res.status(400).json({ mensagem: 'Seleciona pelo menos uma modalidade para este professor.' });
        }

        // Passando agora os dados do aluno para o model
        await utilizadorModel.atualizarUtilizadorCompleto(id, { 
            nome, 
            email, 
            telefone, 
            passwordHash, 
            nomePerfil, 
            idsModalidades,
            nomeAluno,
            dataNascimentoAluno
        });

        return res.status(200).json({ mensagem: 'Dados atualizados com sucesso!' });
    } catch (error) {
        next(error);
    }
}

/**
 * Obtém a lista de alunos associados ao Encarregado de Educação autenticado.
 * Depende da injeção do utilizador via middleware de autenticação (JWT).
 */
async function getMeusAlunos(req, res, next) {
    try {
        const idEncarregado = req.utilizador?.id;
        if (idEncarregado == null) {
            return res.status(401).json({ mensagem: 'Sessão inválida.' });
        }
        
        const alunos = await utilizadorModel.getAlunosPorEncarregado(idEncarregado);
        return res.status(200).json(alunos);
    } catch (error) {
        next(error);
    }
}

/**
 * Cria e associa um novo aluno ao Encarregado de Educação autenticado.
 */
async function criarMeuAluno(req, res, next) {
    try {
        const idEncarregado = req.utilizador?.id;
        const { nome, dataNascimento } = req.body;

        if (idEncarregado == null) {
            return res.status(401).json({ mensagem: 'Sessão inválida.' });
        }
        if (!nome || !String(nome).trim()) {
            return res.status(400).json({ mensagem: 'Nome do aluno é obrigatório.' });
        }

        const aluno = await utilizadorModel.criarAlunoParaEncarregado(idEncarregado, {
            nome: String(nome).trim(),
            dataNascimento: dataNascimento || null
        });

        return res.status(201).json(aluno);
    } catch (error) {
        next(error);
    }
}

// Exportação de todas as funções do controlador
module.exports = {
    login,
    logout,
    solicitarRecuperacaoPassword,
    redefinirPassword,
    register,
    listarUtilizadores,
    criarUtilizadorAdmin,
    editarUtilizador,
    alterarEstado,
    ativarUtilizador,
    desativarUtilizador,
    adminCriarUtilizador,
    editarUtilizadorCompleto,
    eliminarUtilizador,
    getMeusAlunos,
    criarMeuAluno
};