const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. AUTENTICAÇÃO E PERFIS (US01 / RF01)
// ============================================================================
 
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
 
// ============================================================================
// 2. GESTÃO DE CONTAS PELO ADMIN (US03 / RF03)
// ============================================================================
 
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
 
async function criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        const emailExiste = await transaction.request()
            .input('Email', sql.VarChar(255), email)
            .query('SELECT id_utilizador FROM UTILIZADOR WHERE email = @Email');
 
        if (emailExiste.recordset.length > 0) {
            throw new Error('Já existe um utilizador com este email.');
        }
 
        let idPerfil = null;
        if (nomePerfil === 'Professor') {
            const result = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
            idPerfil = result.recordset[0]?.id_perfil;
        } else {
            const result = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'");
            idPerfil = result.recordset[0]?.id_perfil;
        }
 
        if (!idPerfil) {
            const perfisDisponiveis = await transaction.request().query('SELECT nome FROM PERFIL');
            const lista = perfisDisponiveis.recordset.map(p => p.nome).join(' | ');
            throw new Error(`PERFIL_NAO_ENCONTRADO:${lista}`);
        }
 
        // AQUI ESTÁ A MUDANÇA: 'ativo' passa a 0 por defeito em vez de 1
        const insertUserQuery = `
            INSERT INTO UTILIZADOR (nome, email, password, telefone, ativo, data_criacao)
            OUTPUT INSERTED.id_utilizador, INSERTED.nome, INSERTED.email, INSERTED.ativo
            VALUES (@Nome, @Email, @Password, @Telefone, 0, GETDATE());
        `;
        const novoUserResult = await transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Email', sql.VarChar(255), email)
            .input('Password', sql.VarChar(255), passwordHash)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .query(insertUserQuery);
 
        const novoUtilizador = novoUserResult.recordset[0];
 
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
        console.error('Erro no Modelo Transacional (criarUtilizador):', error.message);
        throw error;
    }
}
 
async function editarUtilizador(idUtilizador, { nome, telefone, nomePerfil }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        await transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`
                UPDATE UTILIZADOR 
                SET nome = @Nome, telefone = @Telefone 
                WHERE id_utilizador = @IdUtilizador;
            `);
 
        if (nomePerfil) {
            let idPerfil = null;
            if (nomePerfil === 'Professor') {
                const result = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
                idPerfil = result.recordset[0]?.id_perfil;
            } else {
                const result = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'");
                idPerfil = result.recordset[0]?.id_perfil;
            }
 
            if (!idPerfil) throw new Error('Perfil especificado não existe na base de dados.');
 
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
 
async function guardarTokenRecuperacao(idUtilizador, token) {
    try {
        const pool = await poolPromise;
        const query = `
            INSERT INTO TOKEN_RECUPERACAO (token, data_expiracao, usado, data_criacao, UTILIZADORid_utilizador)
            VALUES (
                @Token, 
                DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, 1, GETUTCDATE())), 
                0, 
                GETDATE(), 
                @IdUtilizador
            );
        `;
        await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(query);
 
        return true;
    } catch (error) {
        console.error('Erro no Modelo (guardarTokenRecuperacao):', error);
        throw error;
    }
}
 
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
 
module.exports = {
    getUtilizadorByEmail,
    getPerfisDoUtilizador,
    listarTodosUtilizadores,
    criarUtilizador,
    editarUtilizador,
    alterarEstadoUtilizador,
    guardarTokenRecuperacao,
    validarTokenRecuperacao,
    atualizarPassword,
    getAlunosPorEncarregado
};