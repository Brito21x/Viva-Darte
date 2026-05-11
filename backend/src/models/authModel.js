/**
 * @fileoverview Modelo de Autenticação e Gestão de Utilizadores
 * Este ficheiro centraliza todas as interações com a base de dados SQL Server
 * referentes a utilizadores, perfis e tokens de segurança.
 */

const { poolPromise } = require("../config/db"); // Ligação à base de dados (Connection Pool)
const sql = require("mssql"); // Biblioteca de driver do SQL Server

// ============================================================================
// 1. AUTENTICAÇÃO E PERFIS
// ============================================================================

/**
 * Procura e devolve as credenciais de um utilizador através do seu email.
 * @param {string} email - O email do utilizador a pesquisar.
 * @returns {Object|null} Os dados do utilizador ou null se não for encontrado.
 */
async function getUtilizadorByEmail(email) {
  try {
    const pool = await poolPromise;
    const query = `SELECT id_utilizador, nome, email, password, telefone, ativo FROM UTILIZADOR WHERE email = @Email;`;

    // Uso de parâmetros (Input) previne ataques de SQL Injection
    const result = await pool
      .request()
      .input("Email", sql.VarChar(255), email)
      .query(query);
    return result.recordset[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Obtém a lista de nomes dos perfis associados a um determinado utilizador.
 * @param {number} idUtilizador - O ID do utilizador na base de dados.
 * @returns {Array<string>} Um array com os nomes dos perfis
 */
async function getPerfisDoUtilizador(idUtilizador) {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT p.nome AS perfil FROM UTILIZADOR_PERFIL up
            JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            WHERE up.UTILIZADORid_utilizador = @IdUtilizador;
        `;
    const result = await pool
      .request()
      .input("IdUtilizador", sql.Int, idUtilizador)
      .query(query);
    return result.recordset.map((row) => row.perfil); // Mapeia os objetos da BD para um array simples de strings
  } catch (error) {
    throw error;
  }
}

// ============================================================================
// 2. GESTÃO DE CONTAS (Administração e Registo)
// ============================================================================

/**
 * Lista todos os utilizadores do sistema, agregando os seus perfis numa única string.
 * Útil para popular tabelas no painel de administração (Coordenação).
 */
async function listarTodosUtilizadores() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT 
                u.id_utilizador, u.nome, u.email, u.telefone, u.ativo, u.data_criacao,
                (
                    SELECT STRING_AGG(p.nome, ', ')
                    FROM UTILIZADOR_PERFIL up
                    JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
                    WHERE up.UTILIZADORid_utilizador = u.id_utilizador
                ) AS perfis,
                (
                    SELECT STRING_AGG(m.nome, ', ')
                    FROM PROFESSOR_MODALIDADE pm
                    JOIN MODALIDADE m ON pm.MODALIDADEid_modalidade = m.id_modalidade
                    WHERE pm.UTILIZADORid_utilizador = u.id_utilizador
                ) AS modalidades,
                (
                    SELECT TOP 1 a.nome
                    FROM ENCARREGADO_ALUNO ea
                    JOIN ALUNO a ON ea.ALUNOid_aluno = a.id_aluno
                    WHERE ea.UTILIZADORid_utilizador = u.id_utilizador
                    ORDER BY a.id_aluno DESC
                ) AS nomeAluno,
                (
                    SELECT TOP 1 a.data_nascimento
                    FROM ENCARREGADO_ALUNO ea
                    JOIN ALUNO a ON ea.ALUNOid_aluno = a.id_aluno
                    WHERE ea.UTILIZADORid_utilizador = u.id_utilizador
                    ORDER BY a.id_aluno DESC
                ) AS dataNascimentoAluno
            FROM UTILIZADOR u
            ORDER BY u.id_utilizador ASC;
        `;
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

/**
 * Regista um novo utilizador e atribui-lhe o respetivo perfil.
 * Utiliza uma transação SQL para garantir que ambos os registos (utilizador e perfil)
 * só são guardados se não ocorrerem erros.
 */
async function criarUtilizador({
  nome,
  email,
  passwordHash,
  telefone,
  nomePerfil,
  ativo = 0,
  nomeAluno,
  dataNascimentoAluno,
}) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const emailExiste = await transaction
      .request()
      .input("Email", sql.VarChar(255), email)
      .query("SELECT id_utilizador FROM UTILIZADOR WHERE email = @Email");

    if (emailExiste.recordset.length > 0)
      throw new Error("Já existe um utilizador com este email.");

    let idPerfil = null;
    if (nomePerfil === "Professor") {
      const res = await transaction
        .request()
        .query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
      idPerfil = res.recordset[0]?.id_perfil;
    } else if (nomePerfil === "Admin") {
      const res = await transaction
        .request()
        .query(
          "SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Admin%' OR nome LIKE '%Coord%'",
        );
      idPerfil = res.recordset[0]?.id_perfil;
    } else {
      const res = await transaction
        .request()
        .query(
          "SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'",
        );
      idPerfil = res.recordset[0]?.id_perfil;
    }

    if (!idPerfil) throw new Error("Perfil não encontrado.");

    // Inserção do Utilizador
    const insertUserQuery = `
            INSERT INTO UTILIZADOR (nome, email, password, telefone, ativo, data_criacao)
            OUTPUT INSERTED.id_utilizador
            VALUES (@Nome, @Email, @Password, @Telefone, @Ativo, GETDATE());
        `;
    const novoUserResult = await transaction
      .request()
      .input("Nome", sql.VarChar(255), nome)
      .input("Email", sql.VarChar(255), email)
      .input("Password", sql.VarChar(255), passwordHash)
      .input("Telefone", sql.VarChar(30), telefone || null)
      .input("Ativo", sql.Bit, ativo)
      .query(insertUserQuery);

    const novoUtilizador = novoUserResult.recordset[0];

    // Ligação Perfil
    await transaction
      .request()
      .input("IdUser", sql.Int, novoUtilizador.id_utilizador)
      .input("IdPerfil", sql.Int, idPerfil)
      .query(
        `INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@IdUser, @IdPerfil);`,
      );

    // Inserção do Aluno (Inativo se o EE for inativo)
    if (nomePerfil !== "Professor" && nomePerfil !== "Admin" && nomeAluno) {
      const insertAlunoQuery = `
                INSERT INTO ALUNO (nome, data_nascimento, ativo, data_criacao)
                OUTPUT INSERTED.id_aluno
                VALUES (@NomeAluno, @DataNasc, @AtivoAluno, GETDATE());
            `;
      const novoAlunoResult = await transaction
        .request()
        .input("NomeAluno", sql.VarChar(255), nomeAluno)
        .input("DataNasc", sql.Date, dataNascimentoAluno || null) // Passando a data
        .input("AtivoAluno", sql.Bit, ativo)
        .query(insertAlunoQuery);

      const novoAlunoId = novoAlunoResult.recordset[0].id_aluno;

      await transaction
        .request()
        .input("IdUtilizadorEnc", sql.Int, novoUtilizador.id_utilizador)
        .input("IdAlunoNovo", sql.Int, novoAlunoId).query(`
                    INSERT INTO ENCARREGADO_ALUNO (UTILIZADORid_utilizador, ALUNOid_aluno)
                    VALUES (@IdUtilizadorEnc, @IdAlunoNovo);
                `);
    }

    await transaction.commit();
    return novoUtilizador;
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

/**
 * Atualiza todos os dados submetidos pelo Administrador para um utilizador específico.
 */
async function atualizarUtilizadorCompleto(
  id,
  {
    nome,
    email,
    telefone,
    passwordHash,
    nomePerfil,
    idsModalidades,
    nomeAluno,
    dataNascimentoAluno,
  },
) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    let queryUpdate = `UPDATE UTILIZADOR SET nome = @Nome, email = @Email, telefone = @Telefone`;
    if (passwordHash) queryUpdate += `, password = @Password`;
    queryUpdate += ` WHERE id_utilizador = @Id`;

    const req = transaction
      .request()
      .input("Nome", sql.VarChar(255), nome)
      .input("Email", sql.VarChar(255), email)
      .input("Telefone", sql.VarChar(30), telefone || null)
      .input("Id", sql.Int, id);

    if (passwordHash) req.input("Password", sql.VarChar(255), passwordHash);

    // Executa atualização principal de dados
    await req.query(queryUpdate);

    // Se houver alteração de perfil, remove a antiga e insere a nova ligação
    if (nomePerfil) {
      let idPerfil = null;
      if (nomePerfil === "Professor") {
        const res = await transaction
          .request()
          .query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
        idPerfil = res.recordset[0]?.id_perfil;
      } else if (nomePerfil === "Admin") {
        const res = await transaction
          .request()
          .query(
            "SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Admin%' OR nome LIKE '%Coord%'",
          );
        idPerfil = res.recordset[0]?.id_perfil;
      } else {
        const res = await transaction
          .request()
          .query(
            "SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'",
          );
        idPerfil = res.recordset[0]?.id_perfil;
      }

      if (idPerfil) {
        await transaction
          .request()
          .input("Id", sql.Int, id)
          .query(
            "DELETE FROM UTILIZADOR_PERFIL WHERE UTILIZADORid_utilizador = @Id",
          );
        await transaction
          .request()
          .input("Id", sql.Int, id)
          .input("IdPerfil", sql.Int, idPerfil)
          .query(
            `INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@Id, @IdPerfil);`,
          );
      }
    }

    if (nomeAluno) {
      await transaction
        .request()
        .input("IdUtilizador", sql.Int, id)
        .input("NomeAluno", sql.VarChar(255), nomeAluno)
        .input("DataNasc", sql.Date, dataNascimentoAluno || null).query(`
                    UPDATE ALUNO 
                    SET nome = @NomeAluno, data_nascimento = @DataNasc 
                    WHERE id_aluno IN (
                        SELECT ALUNOid_aluno FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @IdUtilizador
                    )
                `);
    }

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function atualizarModalidadesProfessor(idUtilizador, idsModalidades) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction
      .request()
      .input("Id", sql.Int, idUtilizador)
      .query(
        "DELETE FROM PROFESSOR_MODALIDADE WHERE UTILIZADORid_utilizador = @Id",
      );

    if (Array.isArray(idsModalidades) && idsModalidades.length > 0) {
      for (const idMod of idsModalidades) {
        await transaction
          .request()
          .input("IdU", sql.Int, idUtilizador)
          .input("IdM", sql.Int, idMod)
          .query(
            "INSERT INTO PROFESSOR_MODALIDADE (UTILIZADORid_utilizador, MODALIDADEid_modalidade) VALUES (@IdU, @IdM)",
          );
      }
    }
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Altera a flag booleana de estado (ativo/inativo) de um utilizador.
 */
async function alterarEstadoUtilizador(idUtilizador, estadoAtivo) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const status = estadoAtivo ? 1 : 0;

    await transaction
      .request()
      .input("EstadoAtivo", sql.Bit, status)
      .input("IdUtilizador", sql.Int, idUtilizador)
      .query(
        `UPDATE UTILIZADOR SET ativo = @EstadoAtivo WHERE id_utilizador = @IdUtilizador;`,
      );

    await transaction
      .request()
      .input("EstadoAtivo", sql.Bit, status)
      .input("IdUtilizador", sql.Int, idUtilizador).query(`
                UPDATE ALUNO 
                SET ativo = @EstadoAtivo 
                WHERE id_aluno IN (
                    SELECT ALUNOid_aluno 
                    FROM ENCARREGADO_ALUNO 
                    WHERE UTILIZADORid_utilizador = @IdUtilizador
                );
            `);

    await transaction.commit();
    return true;
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

/**
 * Executa uma eliminação completa e segura de um utilizador da base de dados.
 */
async function apagarUtilizador(idUtilizador) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    await transaction
      .request()
      .input("Id", sql.Int, idUtilizador)
      .query(
        "DELETE FROM UTILIZADOR_PERFIL WHERE UTILIZADORid_utilizador = @Id",
      );

    await transaction
      .request()
      .input("Id", sql.Int, idUtilizador)
      .query(
        "DELETE FROM TOKEN_RECUPERACAO WHERE UTILIZADORid_utilizador = @Id",
      );

    const alunosResult = await transaction
      .request()
      .input("Id", sql.Int, idUtilizador)
      .query(
        "SELECT ALUNOid_aluno FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @Id",
      );

    await transaction
      .request()
      .input("Id", sql.Int, idUtilizador)
      .query(
        "DELETE FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @Id",
      );

    for (const row of alunosResult.recordset) {
      await transaction
        .request()
        .input("IdAluno", sql.Int, row.ALUNOid_aluno)
        .query("DELETE FROM ALUNO WHERE id_aluno = @IdAluno");
    }

    const result = await transaction
      .request()
      .input("Id", sql.Int, idUtilizador)
      .query("DELETE FROM UTILIZADOR WHERE id_utilizador = @Id");

    await transaction.commit();
    return result.rowsAffected[0] > 0;
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

// ============================================================================
// 3. RECUPERAÇÃO DE PALAVRA-PASSE
// ============================================================================

async function guardarTokenRecuperacao(idUtilizador, token) {
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("Token", sql.VarChar(255), token)
      .input("IdUtilizador", sql.Int, idUtilizador).query(`
                INSERT INTO TOKEN_RECUPERACAO (token, data_expiracao, usado, data_criacao, UTILIZADORid_utilizador)
                VALUES (@Token, DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, 1, GETUTCDATE())), 0, GETDATE(), @IdUtilizador);
            `);
    return true;
  } catch (error) {
    throw error;
  }
}

async function validarTokenRecuperacao(token) {
  try {
    const pool = await poolPromise;
    const tempoAtualUnix = Math.floor(Date.now() / 1000);

    const result = await pool
      .request()
      .input("Token", sql.VarChar(255), token)
      .input("TempoAtual", sql.Int, tempoAtualUnix).query(`
                SELECT id_token_recuperacao, UTILIZADORid_utilizador 
                FROM TOKEN_RECUPERACAO 
                WHERE token = @Token AND usado = 0 AND data_expiracao > @TempoAtual;
            `);

    return result.recordset[0] || null;
  } catch (error) {
    throw error;
  }
}

async function atualizarPassword(idUtilizador, novaPasswordHash, idToken) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction
      .request()
      .input("IdUtilizador", sql.Int, idUtilizador)
      .input("NovaPassword", sql.VarChar(255), novaPasswordHash)
      .query(
        "UPDATE UTILIZADOR SET password = @NovaPassword WHERE id_utilizador = @IdUtilizador",
      );

    await transaction
      .request()
      .input("IdToken", sql.Int, idToken)
      .query(
        "UPDATE TOKEN_RECUPERACAO SET usado = 1 WHERE id_token_recuperacao = @IdToken",
      );

    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// ============================================================================
// 4. GESTÃO DOS ALUNOS DO ENCARREGADO DE EDUCAÇÃO (EE)
// ============================================================================

/**
 * Vai buscar à base de dados todos os alunos ativos que estão associados à conta de um Encarregado de Educação.
 */
async function getAlunosPorEncarregado(idEncarregado) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("IdEE", sql.Int, idEncarregado)
      .query(`
        SELECT 
          a.id_aluno, 
          a.nome AS nome_aluno, 
          a.data_nascimento
        FROM ALUNO a
        JOIN ENCARREGADO_ALUNO ea ON a.id_aluno = ea.ALUNOid_aluno
        WHERE ea.UTILIZADORid_utilizador = @IdEE 
          AND a.ativo = 1
        ORDER BY a.nome ASC;
      `);
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

/**
 * Cria um novo aluno na tabela ALUNO e associa-o imediatamente à conta do Encarregado de Educação.
 * Usa transação atómica para garantir que nada fica órfão em caso de erro.
 */
async function criarAlunoParaEncarregado(
  idEncarregado,
  { nome, dataNascimento },
) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Trata a string da data para prevenir erros de parsing do SQL Server se vier vazia
    const dataNascStr =
      dataNascimento && dataNascimento.trim() !== ""
        ? dataNascimento.trim()
        : null;

    // 1. Inserir na Tabela ALUNO
    const resultAluno = await transaction
      .request()
      .input("Nome", sql.VarChar(255), nome)
      .input("DataNasc", sql.VarChar(10), dataNascStr).query(`
        INSERT INTO ALUNO (nome, data_nascimento, ativo, data_criacao)
        OUTPUT INSERTED.id_aluno, INSERTED.nome AS nome_aluno
        VALUES (@Nome, TRY_CONVERT(date, @DataNasc), 1, GETDATE());
      `);

    const novoAluno = resultAluno.recordset[0];

    // 2. Inserir na Tabela de Vínculo ENCARREGADO_ALUNO
    await transaction
      .request()
      .input("IdEE", sql.Int, idEncarregado)
      .input("IdAluno", sql.Int, novoAluno.id_aluno).query(`
        INSERT INTO ENCARREGADO_ALUNO (UTILIZADORid_utilizador, ALUNOid_aluno)
        VALUES (@IdEE, @IdAluno);
      `);

    await transaction.commit();
    return novoAluno;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Exportação dos métodos da camada Model
module.exports = {
  getUtilizadorByEmail,
  getPerfisDoUtilizador,
  listarTodosUtilizadores,
  criarUtilizador,
  atualizarUtilizadorCompleto,
  atualizarModalidadesProfessor,
  alterarEstadoUtilizador,
  guardarTokenRecuperacao,
  validarTokenRecuperacao,
  atualizarPassword,
  apagarUtilizador,
  getAlunosPorEncarregado,
  criarAlunoParaEncarregado,
};
