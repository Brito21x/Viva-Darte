/**
 * @fileoverview Modelo de Dados para o Cálculo de Preços de Coaching.
 * Responsável por consultar a TABELA_PRECO e calcular dinamicamente o custo
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
 * Inspeciona o esquema da base de dados (sys.columns) para detetar que colunas
 * existem atualmente na TABELA_PRECO. Isto permite que o código seja retrocompatível
 * caso a base de dados ainda não tenha as colunas de 'Modalidade' ou 'Professor'.
 * * @param {sql.ConnectionPool} pool - O pool de ligações ativo do SQL Server.
 * @returns {Promise<Set<string>>} Um Set contendo os nomes de todas as colunas da tabela.
 */
async function obterColunasTabelaPreco(pool) {
  // Se a cache já foi populada, retorna de imediato poupando processamento
  if (colunasTabelaPrecoCache) return colunasTabelaPrecoCache;

  try {
    const r = await pool.request().query(`
            SELECT c.name
            FROM sys.columns c
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            WHERE t.name = 'TABELA_PRECO' AND SCHEMA_NAME(t.schema_id) = 'dbo'
        `);
    // Converte o recordset num Set (lista de valores únicos) para buscas rápidas (O(1))
    colunasTabelaPrecoCache = new Set(
      (r.recordset || []).map((row) => row.name),
    );
  } catch {
    // Em caso de erro (ex: falta de permissões no sys.columns), assume um Set vazio
    // para não quebrar o fluxo principal da aplicação.
    colunasTabelaPrecoCache = new Set();
  }
  return colunasTabelaPrecoCache;
}

/**
 * Calcula o custo estimado de uma sessão de coaching.
 * Constrói uma query dinâmica que procura o preço mais exato. Se não encontrar
 * um preço específico para o Professor/Modalidade, tenta encontrar o preço genérico (NULL na BD).
 * * @param {string} formatoAula - O formato da aula (ex: 'Solo', 'Dueto').
 * @param {number} duracaoMinutos - Duração da aula pretendida.
 * @param {number} diaSemanaPreco - ID do dia para tabela de preços (1 = Dias Úteis, 2 = Fim de semana).
 * @param {number|null} idModalidade - ID da modalidade pretendida (opcional).
 * @param {number|null} idProfessor - ID do professor pretendido (opcional).
 * @returns {Promise<number|null>} Retorna o valor numérico do preço ou null se não existir tarifário aplicável.
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

  // Verifica de forma segura se a base de dados suporta estes filtros avançados
  const temModalidade = cols.has("MODALIDADEid_modalidade");
  const temProfessor = cols.has("UTILIZADORid_utilizador");

  const req = pool
    .request()
    .input("Formato", sql.VarChar(50), String(formatoAula))
    .input("Dur", sql.Int, duracaoMinutos)
    .input("Dia", sql.Int, diaSemanaPreco);

  // Condições Base: Formato, Duração e Dia são sempre obrigatórios para encontrar um preço
  let where =
    "WHERE tp.formato_aula = @Formato AND tp.duracao_minutos = @Dur AND tp.dia_semana = @Dia AND tp.ativo = 1";

  // Construção dinâmica da cláusula WHERE com lógica de Fallback (OR IS NULL)
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

  // Lógica de Priorização (ORDER BY inteligente)
  // O objetivo é devolver o preço mais específico. O 'CASE WHEN ... THEN 0 ELSE 1' garante que:
  // 1º: Preço exato para o Professor + Modalidade.
  // 2º: Preço para o Professor (Modalidade Genérica).
  // 3º: Preço para a Modalidade (Professor Genérico).
  // 4º: Preço totalmente Genérico (Ambos NULL).
  const orderParts = ["tp.preco ASC"]; // Se houver empates de especificidade, retorna o mais barato.

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

  if (row?.preco == null) return null; // Não encontrou qualquer regra de preço compatível

  return Number(row.preco);
}

module.exports = {
  calcularCustoAutomatico,
};
