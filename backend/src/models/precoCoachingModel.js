/**
 * Preço estimado de coaching a partir de TABELA_PRECO (sem módulo de faturação mensal).
 */
const { poolPromise } = require('../config/db');
const sql = require('mssql');

let colunasTabelaPrecoCache = null;

async function obterColunasTabelaPreco(pool) {
    if (colunasTabelaPrecoCache) return colunasTabelaPrecoCache;
    try {
        const r = await pool.request().query(`
            SELECT c.name
            FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            WHERE t.name = 'TABELA_PRECO' AND SCHEMA_NAME(t.schema_id) = 'dbo'
        `);
        colunasTabelaPrecoCache = new Set((r.recordset || []).map((row) => row.name));
    } catch {
        colunasTabelaPrecoCache = new Set();
    }
    return colunasTabelaPrecoCache;
}

/**
 * @param {string} formatoAula
 * @param {number} duracaoMinutos
 * @param {number} diaSemanaPreco  1 = dias úteis, 2 = fim de semana
 * @param {number|null} idModalidade
 * @param {number|null} idProfessor
 * @returns {Promise<number|null>}
 */
async function calcularCustoAutomatico(formatoAula, duracaoMinutos, diaSemanaPreco, idModalidade, idProfessor) {
    const pool = await poolPromise;
    const cols = await obterColunasTabelaPreco(pool);
    const temModalidade = cols.has('MODALIDADEid_modalidade');
    const temProfessor = cols.has('UTILIZADORid_utilizador');

    const req = pool
        .request()
        .input('Formato', sql.VarChar(50), String(formatoAula))
        .input('Dur', sql.Int, duracaoMinutos)
        .input('Dia', sql.Int, diaSemanaPreco);

    let where =
        'WHERE tp.formato_aula = @Formato AND tp.duracao_minutos = @Dur AND tp.dia_semana = @Dia AND tp.ativo = 1';

    if (temModalidade && idModalidade != null && !Number.isNaN(Number(idModalidade))) {
        req.input('IdMod', sql.Int, Number(idModalidade));
        where += ' AND (tp.MODALIDADEid_modalidade = @IdMod OR tp.MODALIDADEid_modalidade IS NULL)';
    }
    if (temProfessor && idProfessor != null && !Number.isNaN(Number(idProfessor))) {
        req.input('IdProf', sql.Int, Number(idProfessor));
        where += ' AND (tp.UTILIZADORid_utilizador = @IdProf OR tp.UTILIZADORid_utilizador IS NULL)';
    }

    const orderParts = ['tp.preco ASC'];
    if (temModalidade && idModalidade != null && !Number.isNaN(Number(idModalidade))) {
        orderParts.unshift('CASE WHEN tp.MODALIDADEid_modalidade = @IdMod THEN 0 ELSE 1 END');
    }
    if (temProfessor && idProfessor != null && !Number.isNaN(Number(idProfessor))) {
        orderParts.unshift('CASE WHEN tp.UTILIZADORid_utilizador = @IdProf THEN 0 ELSE 1 END');
    }
    const orderBy = orderParts.join(', ');

    const querySql = `
        SELECT TOP 1 tp.preco AS preco
        FROM TABELA_PRECO tp
        ${where}
        ORDER BY ${orderBy}
    `;

    const result = await req.query(querySql);
    const row = result.recordset?.[0];
    if (row?.preco == null) return null;
    return Number(row.preco);
}

module.exports = {
    calcularCustoAutomatico
};
