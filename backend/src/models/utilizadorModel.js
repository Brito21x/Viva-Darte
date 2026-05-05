// Localização: backend/src/models/utilizadorModel.js
const sql = require('mssql');
const { poolPromise } = require('../config/db');

// --- DADOS DO PERFIL ---
async function getUtilizadorByEmail(email) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('email', sql.VarChar, email)
        .query('SELECT * FROM [dbo].[UTILIZADOR] WHERE email = @email');
        
    return result.recordset[0];
}

async function getPerfisDoUtilizador(idUtilizador) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('id', sql.Int, idUtilizador)
        .query(`
            SELECT P.nome 
            FROM [dbo].[PERFIL] P
            JOIN [dbo].[UTILIZADOR_PERFIL] UP ON P.id_perfil = UP.PERFILid_perfil
            WHERE UP.UTILIZADORid_utilizador = @id
        `);
        
    return result.recordset.map(row => row.nome);
}

// --- AUTENTICAÇÃO (LOGIN / REGISTO) ---
async function getUtilizadorLogin(email, perfilId) {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('email', sql.VarChar, email);
    request.input('perfilId', sql.Int, perfilId);
    
    const result = await request.query(`
        SELECT U.*, U.[password] AS password_hash, P.nome as perfil_nome
        FROM [dbo].[UTILIZADOR] U
        JOIN [dbo].[UTILIZADOR_PERFIL] UP ON U.id_utilizador = UP.UTILIZADORid_utilizador
        JOIN [dbo].[PERFIL] P ON UP.PERFILid_perfil = P.id_perfil
        WHERE U.email = @email
          AND UP.PERFILid_perfil = @perfilId
          AND U.ativo = 1
    `);
    return result.recordset;
}

async function criarUtilizador(dados) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();
    
    try {
        const reqUser = new sql.Request(transaction);
        reqUser.input('nome', sql.VarChar, dados.nome);
        reqUser.input('email', sql.VarChar, dados.email);
        reqUser.input('password', sql.VarChar, dados.passwordHash);
        reqUser.input('telefone', sql.VarChar, dados.telefone);

        // AQUI ESTÁ A CORREÇÃO: Usamos 'data_criacao' e voltamos a meter o GETDATE()
        const resultUser = await reqUser.query(`
            INSERT INTO [dbo].[UTILIZADOR] (nome, email, [password], telefone, ativo, data_criacao)
            OUTPUT INSERTED.id_utilizador
            VALUES (@nome, @email, @password, @telefone, 1, GETDATE())
        `);
        
        const idUtilizador = resultUser.recordset[0].id_utilizador;
        
        const reqPerfil = new sql.Request(transaction);
        reqPerfil.input('perfilNome', sql.VarChar, dados.nomePerfil);
        
        const resultPerfil = await reqPerfil.query(`
            SELECT id_perfil FROM [dbo].[PERFIL] WHERE nome = @perfilNome
        `);
        
        if (resultPerfil.recordset.length === 0) {
            throw new Error(`Perfil '${dados.nomePerfil}' não encontrado na base de dados.`);
        }
        
        const idPerfil = resultPerfil.recordset[0].id_perfil;
        
        const reqAssoc = new sql.Request(transaction);
        reqAssoc.input('idUser', sql.Int, idUtilizador);
        reqAssoc.input('idPerfil', sql.Int, idPerfil);
        
        await reqAssoc.query(`
            INSERT INTO [dbo].[UTILIZADOR_PERFIL] (UTILIZADORid_utilizador, PERFILid_perfil)
            VALUES (@idUser, @idPerfil)
        `);
        
        await transaction.commit();
        
        return {
            id_utilizador: idUtilizador,
            nome: dados.nome,
            email: dados.email,
            telefone: dados.telefone
        };
        
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

// --- RECUPERAÇÃO DE PASSWORD ---
async function verificarTelefoneAtivo(telefone) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('telefone', sql.VarChar, telefone)
        .query('SELECT id_utilizador FROM [dbo].[UTILIZADOR] WHERE telefone = @telefone AND ativo = 1');
    return result.recordset;
}

async function atualizarPassword(telefone, hashedPassword) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('telefone', sql.VarChar, telefone)
        .input('password', sql.VarChar, hashedPassword)
        .query('UPDATE [dbo].[UTILIZADOR] SET [password] = @password WHERE telefone = @telefone AND ativo = 1');
    return result.rowsAffected[0];
}

// Exportar tudo para o Controller usar
module.exports = {
    getUtilizadorByEmail,
    getPerfisDoUtilizador,
    getUtilizadorLogin,
    criarUtilizador,
    verificarTelefoneAtivo,
    atualizarPassword
};