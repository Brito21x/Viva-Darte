/**
 * @fileoverview Modelo de Autenticação e Gestão de Utilizadores
 * @description Este ficheiro centraliza todas as interações com a base de dados SQL Server
 * referentes a utilizadores, perfis e tokens de segurança.
 */

const { poolPromise } = require("../config/db"); // Ligação à base de dados (Connection Pool)
const sql = require("mssql"); // Biblioteca de driver do SQL Server

// ============================================================================
// 1. AUTENTICAÇÃO E PERFIS
// ============================================================================

/**
 * @async
 * @function getUtilizadorByEmail
 * @description Procura e devolve as credenciais de um utilizador através do seu email.
 * Uso de parâmetros (Input) previne ataques de SQL Injection.
 * @param {string} email - O email do utilizador a pesquisar.
 * @returns {Promise<Object|null>} Os dados do utilizador ou null se não for encontrado.
 * @throws {Error} Propaga eventuais erros de base de dados.
 */
async function getUtilizadorByEmail(email) {
  try {
    const pool = await poolPromise;
    const query = `SELECT id_utilizador, nome, email, password, telefone, ativo FROM UTILIZADOR WHERE email = @Email;`;

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
 * @async
 * @function getPerfisDoUtilizador
 * @description Obtém a lista de nomes dos perfis associados a um determinado utilizador.
 * @param {number} idUtilizador - O ID do utilizador na base de dados.
 * @returns {Promise<Array<string>>} Um array com os nomes dos perfis.
 * @throws {Error} Propaga eventuais erros de base de dados.
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
    return result.recordset.map((row) => row.perfil);
  } catch (error) {
    throw error;
  }
}

// ============================================================================
// 2. GESTÃO DE CONTAS (Administração e Registo)
// ============================================================================

/**
 * @async
 * @function listarTodosUtilizadores
 * @description Lista todos os utilizadores do sistema, agregando os seus perfis e modalidades numa única string.
 * Útil para preencher tabelas no painel de administração (Coordenação).
 * @returns {Promise<Array<Object>>} Um array com a informação tabular de todos os utilizadores.
 * @throws {Error} Propaga eventuais erros de base de dados.
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
 * @async
 * @function criarUtilizador
 * @description Regista um novo utilizador e atribui-lhe o respetivo perfil.
 * Utiliza uma transação SQL para garantir que ambos os registos (utilizador e perfil)
 * só são guardados se não ocorrerem erros.
 * @param {Object} dados - O objeto com os dados de registo do utilizador.
 * @param {string} dados.nome - O nome completo do utilizador.
 * @param {string} dados.email - O e-mail do utilizador (único no sistema).
 * @param {string} dados.passwordHash - A palavra-passe já cifrada (hashed).
 * @param {string} [dados.telefone] - O contacto telefónico do utilizador.
 * @param {string} dados.nomePerfil - O perfil pretendido (Professor, Admin, Encarregado).
 * @param {number|boolean} [dados.ativo=0] - Estado de aprovação inicial da conta.
 * @param {string} [dados.nomeAluno] - O nome do educando associado (apenas aplicável se for EE).
 * @param {string} [dados.dataNascimentoAluno] - A data de nascimento do educando.
 * @returns {Promise<Object>} Devolve o objeto com os dados do novo utilizador criado.
 * @throws {Error} Lança erro caso o e-mail já exista, se o perfil não for encontrado, ou por falha na BD.
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

    await transaction
      .request()
      .input("IdUser", sql.Int, novoUtilizador.id_utilizador)
      .input("IdPerfil", sql.Int, idPerfil)
      .query(
        `INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@IdUser, @IdPerfil);`,
      );

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
 * @async
 * @function atualizarUtilizadorCompleto
 * @description Atualiza todos os dados submetidos pelo Administrador para um utilizador específico.
 * Lida com mudança de perfil e atualização ou criação de registos de aluno associado.
 * @param {number} id - O ID numérico do utilizador.
 * @param {Object} dados - Os campos a atualizar.
 * @param {string} dados.nome - O novo nome do utilizador.
 * @param {string} dados.email - O novo e-mail do utilizador.
 * @param {string} [dados.telefone] - O novo telefone do utilizador.
 * @param {string} [dados.passwordHash] - A nova palavra-passe cifrada (se alterada).
 * @param {string} [dados.nomePerfil] - O novo nome do perfil (se alterado).
 * @param {Array<number>} [dados.idsModalidades] - Modalidades a atualizar (atualmente tratado noutra função ou injetado conforme contexto).
 * @param {string} [dados.nomeAluno] - O novo nome do educando.
 * @param {string} [dados.dataNascimentoAluno] - A nova data de nascimento do educando.
 * @returns {Promise<boolean>} Devolve true caso a atualização da transação decorra com sucesso.
 * @throws {Error} Reverte e propaga a exceção em caso de falha de base de dados.
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

    await req.query(queryUpdate);

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
      const dataNascTratada =
        dataNascimentoAluno && dataNascimentoAluno.trim() !== ""
          ? dataNascimentoAluno
          : null;

      const checkAluno = await transaction
        .request()
        .input("IdUtilizador", sql.Int, id)
        .query(
          "SELECT ALUNOid_aluno FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @IdUtilizador",
        );

      if (checkAluno.recordset.length > 0) {
        await transaction
          .request()
          .input("IdUtilizador", sql.Int, id)
          .input("NomeAluno", sql.VarChar(255), nomeAluno)
          .input("DataNasc", sql.Date, dataNascTratada).query(`
            UPDATE ALUNO 
            SET nome = @NomeAluno, data_nascimento = @DataNasc 
            WHERE id_aluno IN (
                SELECT ALUNOid_aluno FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @IdUtilizador
            )
          `);
      } else {
        const insertResult = await transaction
          .request()
          .input("NomeAluno", sql.VarChar(255), nomeAluno)
          .input("DataNasc", sql.Date, dataNascTratada).query(`
            INSERT INTO ALUNO (nome, data_nascimento, ativo, data_criacao)
            OUTPUT INSERTED.id_aluno
            VALUES (@NomeAluno, @DataNasc, 1, GETDATE());
          `);

        const novoAlunoId = insertResult.recordset[0].id_aluno;

        await transaction
          .request()
          .input("IdUtilizador", sql.Int, id)
          .input("IdAlunoNovo", sql.Int, novoAlunoId).query(`
            INSERT INTO ENCARREGADO_ALUNO (UTILIZADORid_utilizador, ALUNOid_aluno)
            VALUES (@IdUtilizador, @IdAlunoNovo);
          `);
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
 * @async
 * @function atualizarModalidadesProfessor
 * @description Apaga e recria os vínculos de modalidades associadas a um professor através de transação.
 * @param {number} idUtilizador - O ID do professor.
 * @param {Array<number>} idsModalidades - Array com os IDs das novas modalidades que leciona.
 * @returns {Promise<boolean>} Devolve true mediante o sucesso da atualização.
 * @throws {Error} Reverte transação e propaga caso haja problemas.
 */
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
 * @async
 * @function alterarEstadoUtilizador
 * @description Altera a flag booleana de estado (ativo/inativo) de um utilizador.
 * Garante em cascata a ativação/inativação dos respetivos alunos caso se trate de um Encarregado de Educação.
 * @param {number} idUtilizador - O ID do utilizador alvo.
 * @param {boolean} estadoAtivo - O novo estado desejado (true para ativo, false para inativo).
 * @returns {Promise<boolean>} Devolve true assim que a transação for bem-sucedida.
 * @throws {Error} Reverte a operação se der erro.
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
 * @async
 * @function apagarUtilizador
 * @description Executa uma eliminação completa e segura de um utilizador da base de dados, limpando
 * dependências como tokens, vínculos de perfis e alunos associados de forma atómica.
 * @param {number} idUtilizador - O ID do utilizador a apagar.
 * @returns {Promise<boolean>} Devolve true se linhas foram afetadas e false caso contrário.
 * @throws {Error} Propaga e reverte qualquer erro de DB.
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

/**
 * @async
 * @function guardarTokenRecuperacao
 * @description Regista na base de dados um novo token temporário seguro para a recuperação da password.
 * @param {number} idUtilizador - O ID numérico do utilizador requerente.
 * @param {string} token - A hash ou string alfanumérica gerada.
 * @returns {Promise<boolean>} Devolve true após inserir com sucesso.
 * @throws {Error} Erro da base de dados.
 */
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

/**
 * @async
 * @function validarTokenRecuperacao
 * @description Verifica se um token providenciado existe, se não foi já usado e se ainda não expirou temporalmente.
 * @param {string} token - A chave do token a conferir.
 * @returns {Promise<Object|null>} Retorna os detalhes do registo do token ou null se inválido.
 * @throws {Error} Erro da base de dados.
 */
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

/**
 * @async
 * @function atualizarPassword
 * @description Atualiza de facto a password na tabela UTILIZADOR e marca o respetivo token como usado (para evitar reutilização).
 * @param {number} idUtilizador - O ID do utilizador dono da conta.
 * @param {string} novaPasswordHash - A nova password criptografada.
 * @param {number} idToken - O identificador do registo do token utilizado.
 * @returns {Promise<boolean>} Devolve true se finalizado corretamente.
 * @throws {Error} Aciona rollback em caso de anomalia.
 */
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
 * @async
 * @function getAlunosPorEncarregado
 * @description Vai buscar à base de dados todos os alunos ativos que estão associados à conta de um Encarregado de Educação.
 * @param {number} idEncarregado - O ID do encarregado de educação (utilizador).
 * @returns {Promise<Array<Object>>} O conjunto dos educandos registados.
 * @throws {Error} Falha de base de dados.
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
 * @async
 * @function criarAlunoParaEncarregado
 * @description Cria um novo aluno na tabela ALUNO e associa-o imediatamente à conta do Encarregado de Educação.
 * Usa transação atómica para garantir que nada fica órfão em caso de erro.
 * @param {number} idEncarregado - O ID numérico do Encarregado de Educação.
 * @param {Object} aluno - Objeto com os dados do aluno.
 * @param {string} aluno.nome - O nome completo do aluno.
 * @param {string} [aluno.dataNascimento] - A data de nascimento do educando.
 * @returns {Promise<Object>} Um objeto contendo os detalhes gerados para o novo aluno.
 * @throws {Error} Propaga e reverte se houver falha de escrita.
 */
async function criarAlunoParaEncarregado(
  idEncarregado,
  { nome, dataNascimento },
) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const dataNascStr =
      dataNascimento && dataNascimento.trim() !== ""
        ? dataNascimento.trim()
        : null;

    const resultAluno = await transaction
      .request()
      .input("Nome", sql.VarChar(255), nome)
      .input("DataNasc", sql.VarChar(10), dataNascStr).query(`
        INSERT INTO ALUNO (nome, data_nascimento, ativo, data_criacao)
        OUTPUT INSERTED.id_aluno, INSERTED.nome AS nome_aluno
        VALUES (@Nome, TRY_CONVERT(date, @DataNasc), 1, GETDATE());
      `);

    const novoAluno = resultAluno.recordset[0];

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

/**
 * @module authModel
 */
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
