const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. AUTENTICAÇÃO E PERFIS (US01 / RF01)
// ============================================================================
 
/**
 * Procura um utilizador pelo email para validar login ou existência.
 */
async function getUtilizadorByEmail(email) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                id_utilizador, 
                nome, 
                email, 
                password, 
                telefone, 
                ativo 
            FROM UTILIZADOR 
            WHERE email = @Email;
        `;
        const result = await pool.request()
            .input('Email', sql.VarChar(255), email)
            .query(query);
 
        return result.recordset[0] || null;
    } catch (error) {
        console.error('Erro no Modelo (getUtilizadorByEmail):', error);
        throw error;
    }
}
 
/**
 * Obtém os nomes dos perfis associados a um utilizador (Admin, Professor, EE).
 */
async function getPerfisDoUtilizador(idUtilizador) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT p.nome AS perfil
            FROM UTILIZADOR_PERFIL up
            JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            WHERE up.UTILIZADORid_utilizador = @IdUtilizador;
        `;
        const result = await pool.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(query);
 
        return result.recordset.map(row => row.perfil);
    } catch (error) {
        console.error('Erro no Modelo (getPerfisDoUtilizador):', error);
        throw error;
    }
}

/**
 * Utilizador ativo com o perfil indicado (login com email + tipo EE/PROF).
 * Devolve a password para comparação com bcrypt no controlador.
 */
async function getUtilizadorParaLogin(email, idPerfil) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('Email', sql.VarChar(255), email)
            .input('IdPerfil', sql.Int, idPerfil)
            .query(`
                SELECT 
                    u.id_utilizador,
                    u.nome,
                    u.email,
                    u.telefone,
                    u.password
                FROM UTILIZADOR u
                INNER JOIN UTILIZADOR_PERFIL up ON u.id_utilizador = up.UTILIZADORid_utilizador
                WHERE u.email = @Email
                  AND up.PERFILid_perfil = @IdPerfil
                  AND u.ativo = 1;
            `);

        return result.recordset[0] || null;
    } catch (error) {
        console.error('Erro no Modelo (getUtilizadorParaLogin):', error);
        throw error;
    }
}

/**
 * Verifica se existe utilizador ativo com este telefone (recuperação de password).
 */
async function existeUtilizadorTelefoneAtivo(telefone) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('Telefone', sql.VarChar(30), telefone)
            .query(`
                SELECT 1 AS ok
                FROM UTILIZADOR
                WHERE telefone = @Telefone AND ativo = 1;
            `);

        return result.recordset.length > 0;
    } catch (error) {
        console.error('Erro no Modelo (existeUtilizadorTelefoneAtivo):', error);
        throw error;
    }
}

/**
 * Atualiza a password pelo número de telefone (utilizador ativo).
 */
async function atualizarPasswordPorTelefone(telefone, passwordHash) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('Telefone', sql.VarChar(30), telefone)
            .input('Password', sql.VarChar(255), passwordHash)
            .query(`
                UPDATE UTILIZADOR
                SET password = @Password
                WHERE telefone = @Telefone AND ativo = 1;
            `);

        return result.rowsAffected[0] || 0;
    } catch (error) {
        console.error('Erro no Modelo (atualizarPasswordPorTelefone):', error);
        throw error;
    }
}
 
// ============================================================================
// 2. GESTÃO DE CONTAS PELO ADMIN (US03 / RF03)
// ============================================================================
 
/**
 * Lista todos os utilizadores com os seus perfis para gestão pelo Admin.
 */
async function listarTodosUtilizadores() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                u.id_utilizador,
                u.nome,
                u.email,
                u.telefone,
                u.ativo,
                u.data_criacao,
                STRING_AGG(p.nome, ', ') AS perfis
            FROM UTILIZADOR u
            LEFT JOIN UTILIZADOR_PERFIL up ON u.id_utilizador = up.UTILIZADORid_utilizador
            LEFT JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            GROUP BY u.id_utilizador, u.nome, u.email, u.telefone, u.ativo, u.data_criacao
            ORDER BY u.nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (listarTodosUtilizadores):', error);
        throw error;
    }
}
 
/**
 * Cria um novo utilizador e associa-o a um perfil dentro de uma transação.
 */
async function criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Verificar se o email já existe
        const emailExiste = await transaction.request()
            .input('Email', sql.VarChar(255), email)
            .query('SELECT id_utilizador FROM UTILIZADOR WHERE email = @Email');
 
        if (emailExiste.recordset.length > 0) {
            throw new Error('Já existe um utilizador com este email.');
        }
 
        // Obter ID do Perfil
        const perfilResult = await transaction.request()
            .input('NomePerfil', sql.VarChar(100), nomePerfil)
            .query('SELECT id_perfil FROM PERFIL WHERE nome = @NomePerfil');
 
        const idPerfil = perfilResult.recordset[0]?.id_perfil;
        if (!idPerfil) throw new Error('Perfil especificado não existe.');
 
        // Inserir Utilizador
        const insertUserQuery = `
            INSERT INTO UTILIZADOR (nome, email, password, telefone, ativo, data_criacao)
            OUTPUT INSERTED.id_utilizador, INSERTED.nome, INSERTED.email, INSERTED.ativo
            VALUES (@Nome, @Email, @Password, @Telefone, 1, GETDATE());
        `;
        const novoUserResult = await transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Email', sql.VarChar(255), email)
            .input('Password', sql.VarChar(255), passwordHash)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .query(insertUserQuery);
 
        const novoUtilizador = novoUserResult.recordset[0];
 
        // Mapear o Utilizador ao Perfil
        await transaction.request()
            .input('IdUser', sql.Int, novoUtilizador.id_utilizador)
            .input('IdPerfil', sql.Int, idPerfil)
            .query(`
                INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil)
                VALUES (@IdUser, @IdPerfil);
            `);
 
        await transaction.commit();
        return novoUtilizador;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (criarUtilizador):', error);
        throw error;
    }
}
 
/**
 * Edita os dados de um utilizador existente (nome, telefone, perfil).
 */
async function editarUtilizador(idUtilizador, { nome, telefone, nomePerfil }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Atualizar dados base
        await transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`
                UPDATE UTILIZADOR 
                SET nome = @Nome, telefone = @Telefone 
                WHERE id_utilizador = @IdUtilizador;
            `);
 
        // Atualizar perfil se fornecido
        if (nomePerfil) {
            const perfilResult = await transaction.request()
                .input('NomePerfil', sql.VarChar(100), nomePerfil)
                .query('SELECT id_perfil FROM PERFIL WHERE nome = @NomePerfil');
 
            const idPerfil = perfilResult.recordset[0]?.id_perfil;
            if (!idPerfil) throw new Error('Perfil especificado não existe.');
 
            // Remove perfis existentes e associa o novo
            await transaction.request()
                .input('IdUtilizador', sql.Int, idUtilizador)
                .query('DELETE FROM UTILIZADOR_PERFIL WHERE UTILIZADORid_utilizador = @IdUtilizador');
 
            await transaction.request()
                .input('IdUtilizador', sql.Int, idUtilizador)
                .input('IdPerfil', sql.Int, idPerfil)
                .query(`
                    INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil)
                    VALUES (@IdUtilizador, @IdPerfil);
                `);
        }
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (editarUtilizador):', error);
        throw error;
    }
}
 
/**
 * Ativa ou desativa uma conta de utilizador.
 */
async function alterarEstadoUtilizador(idUtilizador, estadoAtivo) {
    try {
        const pool = await poolPromise;
        const query = `
            UPDATE UTILIZADOR 
            SET ativo = @EstadoAtivo 
            WHERE id_utilizador = @IdUtilizador;
        `;
        const result = await pool.request()
            .input('EstadoAtivo', sql.Bit, estadoAtivo ? 1 : 0)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(query);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (alterarEstadoUtilizador):', error);
        throw error;
    }
}
 
// ============================================================================
// 3. RECUPERAÇÃO DE PALAVRA-PASSE (US02 / RF02)
// ============================================================================
 
/**
 * Regista um token de recuperação com expiração de 1 hora.
 */
async function guardarTokenRecuperacao(idUtilizador, token) {
    try {
        const pool = await poolPromise;
        const dataExpiracaoUnix = Math.floor(Date.now() / 1000) + 3600;
        const query = `
            INSERT INTO TOKEN_RECUPERACAO (token, data_expiracao, usado, data_criacao, UTILIZADORid_utilizador)
            VALUES (
                @Token, 
                @DataExpiracao,
                0, 
                GETDATE(), 
                @IdUtilizador
            );
        `;
        await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('DataExpiracao', sql.Int, dataExpiracaoUnix)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(query);
 
        return true;
    } catch (error) {
        console.error('Erro no Modelo (guardarTokenRecuperacao):', error);
        throw error;
    }
}
 
/**
 * Verifica se um token é válido, não foi usado e não expirou.
 */
async function validarTokenRecuperacao(token) {
    try {
        const pool = await poolPromise;
        const tempoAtualUnix = Math.floor(Date.now() / 1000);
        const query = `
            SELECT id_token_recuperacao, UTILIZADORid_utilizador 
            FROM TOKEN_RECUPERACAO 
            WHERE token = @Token AND usado = 0 AND data_expiracao > @TempoAtual;
        `;
        const result = await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('TempoAtual', sql.Int, tempoAtualUnix)
            .query(query);
 
        return result.recordset[0] || null;
    } catch (error) {
        console.error('Erro no Modelo (validarTokenRecuperacao):', error);
        throw error;
    }
}
 
/**
 * Atualiza a password e invalida o token utilizado numa transação atómica.
 */
async function atualizarPassword(idUtilizador, novaPasswordHash, idToken) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        await transaction.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('NovaPassword', sql.VarChar(255), novaPasswordHash)
            .query('UPDATE UTILIZADOR SET password = @NovaPassword WHERE id_utilizador = @IdUtilizador');
 
        await transaction.request()
            .input('IdToken', sql.Int, idToken)
            .query('UPDATE TOKEN_RECUPERACAO SET usado = 1 WHERE id_token_recuperacao = @IdToken');
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (atualizarPassword):', error);
        throw error;
    }
}
 
// ============================================================================
// 4. MAPEAMENTO DE ENCARREGADOS E ALUNOS (US05 / RF05)
// ============================================================================
 
/**
 * Lista os alunos ativos associados a um encarregado para o formulário de marcação.
 */
async function getAlunosPorEncarregado(idEncarregado) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                a.id_aluno,
                a.nome AS nome_aluno,
                a.data_nascimento
            FROM ENCARREGADO_ALUNO ea
            JOIN ALUNO a ON ea.ALUNOid_aluno = a.id_aluno
            WHERE ea.UTILIZADORid_utilizador = @IdEncarregado 
              AND a.ativo = 1
            ORDER BY a.nome ASC;
        `;
        const result = await pool.request()
            .input('IdEncarregado', sql.Int, idEncarregado)
            .query(query);
 
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getAlunosPorEncarregado):', error);
        throw error;
    }
}

/**
 * Lista todos os alunos (Admin — associações EE–aluno).
 */
async function listarTodosAlunos() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT id_aluno, nome, data_nascimento, ativo, data_criacao
            FROM ALUNO
            ORDER BY nome ASC;
        `);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (listarTodosAlunos):', error);
        throw error;
    }
}

/**
 * Cria um aluno (Admin). Não associa automaticamente a um EE.
 */
async function criarAluno({ nome, dataNascimento }) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('Nome', sql.VarChar(255), nome)
            .input('DataNasc', sql.Date, dataNascimento || null)
            .query(`
                INSERT INTO ALUNO (nome, data_nascimento, ativo, data_criacao)
                OUTPUT INSERTED.id_aluno, INSERTED.nome, INSERTED.data_nascimento, INSERTED.ativo
                VALUES (@Nome, @DataNasc, 1, CAST(GETDATE() AS DATE));
            `);

        return result.recordset[0];
    } catch (error) {
        console.error('Erro no Modelo (criarAluno):', error);
        throw error;
    }
}

/**
 * Associa um aluno a um encarregado de educação (Admin).
 */
async function associarEncarregadoAluno(idEncarregado, idAluno) {
    try {
        const pool = await poolPromise;

        const duplicado = await pool
            .request()
            .input('IdEnc', sql.Int, idEncarregado)
            .input('IdAluno', sql.Int, idAluno)
            .query(`
                SELECT 1 AS ok FROM ENCARREGADO_ALUNO
                WHERE UTILIZADORid_utilizador = @IdEnc AND ALUNOid_aluno = @IdAluno;
            `);

        if (duplicado.recordset.length > 0) {
            throw new Error('Este aluno já está associado a este encarregado.');
        }

        await pool
            .request()
            .input('IdEnc', sql.Int, idEncarregado)
            .input('IdAluno', sql.Int, idAluno)
            .query(`
                INSERT INTO ENCARREGADO_ALUNO (UTILIZADORid_utilizador, ALUNOid_aluno)
                VALUES (@IdEnc, @IdAluno);
            `);

        return true;
    } catch (error) {
        console.error('Erro no Modelo (associarEncarregadoAluno):', error);
        throw error;
    }
}

/** IDs de utilizadores com perfil EE ativo (faturação em lote). */
async function listarIdsEncarregadosEducacao() {
    try {
        const pool = await poolPromise;
        const r = await pool.request().query(`
            SELECT DISTINCT u.id_utilizador
            FROM UTILIZADOR u
            JOIN UTILIZADOR_PERFIL up ON u.id_utilizador = up.UTILIZADORid_utilizador
            JOIN PERFIL p ON p.id_perfil = up.PERFILid_perfil AND p.nome = 'EE'
            WHERE u.ativo = 1;
        `);
        return r.recordset.map(row => row.id_utilizador);
    } catch (error) {
        console.error('Erro no Modelo (listarIdsEncarregadosEducacao):', error);
        throw error;
    }
}

// getUtilizadorParaLogin / existeUtilizadorTelefoneAtivo / atualizarPasswordPorTelefone: reservados p.ex. recuperação via telefone ou login por perfil.
module.exports = {
    getUtilizadorByEmail,
    getPerfisDoUtilizador,
    getUtilizadorParaLogin,
    existeUtilizadorTelefoneAtivo,
    atualizarPasswordPorTelefone,
    listarTodosUtilizadores,
    listarTodosAlunos,
    criarUtilizador,
    editarUtilizador,
    alterarEstadoUtilizador,
    guardarTokenRecuperacao,
    validarTokenRecuperacao,
    atualizarPassword,
    getAlunosPorEncarregado,
    criarAluno,
    associarEncarregadoAluno,
    listarIdsEncarregadosEducacao
};