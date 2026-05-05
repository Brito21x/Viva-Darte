const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. AUTENTICAÇÃO E PERFIS
// ============================================================================
async function getUtilizadorByEmail(email) {
    try {
        const pool = await poolPromise;
        const query = `SELECT id_utilizador, nome, email, password, telefone, ativo FROM UTILIZADOR WHERE email = @Email;`;
        const result = await pool.request().input('Email', sql.VarChar(255), email).query(query);
        return result.recordset[0] || null;
    } catch (error) { throw error; }
}
 
async function getPerfisDoUtilizador(idUtilizador) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT p.nome AS perfil FROM UTILIZADOR_PERFIL up
            JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            WHERE up.UTILIZADORid_utilizador = @IdUtilizador;
        `;
        const result = await pool.request().input('IdUtilizador', sql.Int, idUtilizador).query(query);
        return result.recordset.map(row => row.perfil);
    } catch (error) { throw error; }
}
 
// ============================================================================
// 2. GESTÃO DE CONTAS
// ============================================================================
async function listarTodosUtilizadores() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT u.id_utilizador, u.nome, u.email, u.telefone, u.ativo, u.data_criacao, STRING_AGG(p.nome, ', ') AS perfis
            FROM UTILIZADOR u
            LEFT JOIN UTILIZADOR_PERFIL up ON u.id_utilizador = up.UTILIZADORid_utilizador
            LEFT JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            GROUP BY u.id_utilizador, u.nome, u.email, u.telefone, u.ativo, u.data_criacao
            ORDER BY u.id_utilizador ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) { throw error; }
}
 
async function criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil, ativo = 0 }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        const emailExiste = await transaction.request()
            .input('Email', sql.VarChar(255), email)
            .query('SELECT id_utilizador FROM UTILIZADOR WHERE email = @Email');
 
        if (emailExiste.recordset.length > 0) throw new Error('Já existe um utilizador com este email.');
 
        let idPerfil = null;
        if (nomePerfil === 'Professor') {
            const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
            idPerfil = res.recordset[0]?.id_perfil;
        } else if (nomePerfil === 'Admin') {
            const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Admin%' OR nome LIKE '%Coord%'");
            idPerfil = res.recordset[0]?.id_perfil;
        } else {
            const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'");
            idPerfil = res.recordset[0]?.id_perfil;
        }
 
        if (!idPerfil) throw new Error('Perfil não encontrado na BD.');
 
        const insertUserQuery = `
            INSERT INTO UTILIZADOR (nome, email, password, telefone, ativo, data_criacao)
            OUTPUT INSERTED.id_utilizador, INSERTED.nome, INSERTED.email, INSERTED.ativo
            VALUES (@Nome, @Email, @Password, @Telefone, @Ativo, GETDATE());
        `;
        const novoUserResult = await transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Email', sql.VarChar(255), email)
            .input('Password', sql.VarChar(255), passwordHash)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .input('Ativo', sql.Bit, ativo)
            .query(insertUserQuery);
 
        const novoUtilizador = novoUserResult.recordset[0];
 
        await transaction.request()
            .input('IdUser', sql.Int, novoUtilizador.id_utilizador)
            .input('IdPerfil', sql.Int, idPerfil)
            .query(`INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@IdUser, @IdPerfil);`);
 
        await transaction.commit();
        return novoUtilizador;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
async function atualizarUtilizadorCompleto(id, { nome, email, telefone, passwordHash, nomePerfil }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        let queryUpdate = `UPDATE UTILIZADOR SET nome = @Nome, email = @Email, telefone = @Telefone`;
        if (passwordHash) queryUpdate += `, password = @Password`;
        queryUpdate += ` WHERE id_utilizador = @Id`;

        const req = transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Email', sql.VarChar(255), email)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .input('Id', sql.Int, id);
        
        if (passwordHash) req.input('Password', sql.VarChar(255), passwordHash);
        await req.query(queryUpdate);

        if (nomePerfil) {
            let idPerfil = null;
            if (nomePerfil === 'Professor') {
                const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
                idPerfil = res.recordset[0]?.id_perfil;
            } else if (nomePerfil === 'Admin') {
                const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Admin%' OR nome LIKE '%Coord%'");
                idPerfil = res.recordset[0]?.id_perfil;
            } else {
                const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'");
                idPerfil = res.recordset[0]?.id_perfil;
            }

            if (idPerfil) {
                await transaction.request().input('Id', sql.Int, id).query('DELETE FROM UTILIZADOR_PERFIL WHERE UTILIZADORid_utilizador = @Id');
                await transaction.request().input('Id', sql.Int, id).input('IdPerfil', sql.Int, idPerfil)
                    .query(`INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@Id, @IdPerfil);`);
            }
        }
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function alterarEstadoUtilizador(idUtilizador, estadoAtivo) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('EstadoAtivo', sql.Bit, estadoAtivo ? 1 : 0)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`UPDATE UTILIZADOR SET ativo = @EstadoAtivo WHERE id_utilizador = @IdUtilizador;`);
        return result.rowsAffected[0] > 0;
    } catch (error) { throw error; }
}
 
// ============================================================================
// 3. RECUPERAÇÃO DE PALAVRA-PASSE
// ============================================================================
async function guardarTokenRecuperacao(idUtilizador, token) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`INSERT INTO TOKEN_RECUPERACAO (token, data_expiracao, usado, data_criacao, UTILIZADORid_utilizador)
                    VALUES (@Token, DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, 1, GETUTCDATE())), 0, GETDATE(), @IdUtilizador);`);
        return true;
    } catch (error) { throw error; }
}
 
async function validarTokenRecuperacao(token) {
    try {
        const pool = await poolPromise;
        const tempoAtualUnix = Math.floor(Date.now() / 1000);
        const result = await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('TempoAtual', sql.Int, tempoAtualUnix)
            .query(`SELECT id_token_recuperacao, UTILIZADORid_utilizador FROM TOKEN_RECUPERACAO WHERE token = @Token AND usado = 0 AND data_expiracao > @TempoAtual;`);
        return result.recordset[0] || null;
    } catch (error) { throw error; }
}
 
async function atualizarPassword(idUtilizador, novaPasswordHash, idToken) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        await transaction.request().input('IdUtilizador', sql.Int, idUtilizador).input('NovaPassword', sql.VarChar(255), novaPasswordHash)
            .query('UPDATE UTILIZADOR SET password = @NovaPassword WHERE id_utilizador = @IdUtilizador');
        await transaction.request().input('IdToken', sql.Int, idToken)
            .query('UPDATE TOKEN_RECUPERACAO SET usado = 1 WHERE id_token_recuperacao = @IdToken');
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
module.exports = {
    getUtilizadorByEmail, 
    getPerfisDoUtilizador, 
    listarTodosUtilizadores,
    criarUtilizador, 
    atualizarUtilizadorCompleto, 
    alterarEstadoUtilizador,
    guardarTokenRecuperacao, 
    validarTokenRecuperacao, 
    atualizarPassword
};