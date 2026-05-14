/**
 * @fileoverview Modelo de Dados para o Cálculo de Preços de Coaching.
 * @description Responsável por consultar a TABELA_PRECO e calcular dinamicamente o custo
 * estimado de uma aula com base em múltiplos fatores (formato, duração, dia da semana,
 * modalidade e professor). Suporta um sistema de "fallback" (preço específico vs. preço genérico).
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

/** * Cache em memória para armazenar a lista de colunas da TABELA_PRECO.
 * Evita consultas redundantes ao esquema da base de dados em cada pedido de cálculo de preço.
 * @type {Set<string>|null}
 */
let colunasTabelaPrecoCache = null;

/**
 * @async
 * @function obterColunasTabelaPreco
 * @description Inspeciona o esquema da base de dados (sys.columns) para detetar que colunas
 * existem atualmente na TABELA_PRECO. Isto permite que o código seja retrocompatível
 * caso a base de dados ainda não tenha as colunas de 'Modalidade' ou 'Professor'.
 * @param {sql.ConnectionPool} pool - O pool de ligações ativo do SQL Server.
 * @returns {Promise<Set<string>>} Um Set contendo os nomes de todas as colunas existentes na tabela.
 */
async function obterColunasTabelaPreco(pool) {
  if (colunasTabelaPrecoCache) return colunasTabelaPrecoCache;

  try {
    const r = await pool.request().query(`
            SELECT c.name
            FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            WHERE t.name = 'TABELA_PRECO' AND SCHEMA_NAME(t.schema_id) = 'dbo'
        `);
    colunasTabelaPrecoCache = new Set(
      (r.recordset || []).map((row) => row.name),
    );
  } catch {
    colunasTabelaPrecoCache = new Set();
  }
  return colunasTabelaPrecoCache;
}

/**
 * @async
 * @function calcularCustoAutomatico
 * @description Calcula o custo estimado de uma sessão de coaching.
 * Constrói uma query dinâmica que procura o preço mais exato. Se não encontrar
 * um preço específico para o Professor/Modalidade, tenta encontrar o preço genérico (NULL na BD) seguindo uma ordem de desgraduação por prioridade.
 * @param {string} formatoAula - O formato da aula (ex: 'Solo', 'Dueto').
 * @param {number} duracaoMinutos - Duração da aula pretendida.
 * @param {number} diaSemanaPreco - ID do dia para tabela de preços (1 = Dias Úteis, 2 = Fim de semana).
 * @param {number|null} idModalidade - ID da modalidade pretendida (opcional).
 * @param {number|null} idProfessor - ID do professor pretendido (opcional).
 * @returns {Promise<number|null>} Retorna o valor numérico (double) do preço, ou null se não existir nenhum tarifário aplicável que contemple a combinação.
 */
async function calcularCustoAutomatico(
  formatoAula,
  duracaoMinutos,
  diaSemanaPreco,
  idModalidade,
  idProfessor,
) {
  const pool = await poolPromise;
  const cols = await obterColunasTabelaPreco(pool);

  const temModalidade = cols.has("MODALIDADEid_modalidade");
  const temProfessor = cols.has("UTILIZADORid_utilizador");

  const req = pool
    .request()
    .input("Formato", sql.VarChar(50), String(formatoAula))
    .input("Dur", sql.Int, duracaoMinutos)
    .input("Dia", sql.Int, diaSemanaPreco);

  let where =
    "WHERE tp.formato_aula = @Formato AND tp.duracao_minutos = @Dur AND tp.dia_semana = @Dia AND tp.ativo = 1";

  if (
    temModalidade &&
    idModalidade != null &&
    !Number.isNaN(Number(idModalidade))
  ) {
    req.input("IdMod", sql.Int, Number(idModalidade));
    where +=
      " AND (tp.MODALIDADEid_modalidade = @IdMod OR tp.MODALIDADEid_modalidade IS NULL)";
  }

  if (
    temProfessor &&
    idProfessor != null &&
    !Number.isNaN(Number(idProfessor))
  ) {
    req.input("IdProf", sql.Int, Number(idProfessor));
    where +=
      " AND (tp.UTILIZADORid_utilizador = @IdProf OR tp.UTILIZADORid_utilizador IS NULL)";
  }

  const orderParts = ["tp.preco ASC"];

  if (
    temModalidade &&
    idModalidade != null &&
    !Number.isNaN(Number(idModalidade))
  ) {
    orderParts.unshift(
      "CASE WHEN tp.MODALIDADEid_modalidade = @IdMod THEN 0 ELSE 1 END",
    );
  }

  if (
    temProfessor &&
    idProfessor != null &&
    !Number.isNaN(Number(idProfessor))
  ) {
    orderParts.unshift(
      "CASE WHEN tp.UTILIZADORid_utilizador = @IdProf THEN 0 ELSE 1 END",
    );
  }

  const orderBy = orderParts.join(", ");

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

/**
 * @module precoCoachingModel
 */
module.exports = {
  calcularCustoAutomatico,
};
