/**
 * @fileoverview Modelo de Dados para a Gestão de Coaching.
 * Interações com a BD SQL Server (Disponibilidades, Pedidos, Conflitos, Validação).
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

function normalizarHoraSql(valor) {
  const s = String(valor ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const hh = Number(m[1]),
    mm = Number(m[2]),
    ss = Number(m[3] ?? "0");
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function minutosDaHora(valor) {
  const h = normalizarHoraSql(valor);
  if (!h) return null;
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

function criarRequest(db) {
  return db.request();
}

async function existeConflitoCoachingProfessor(
  db,
  { idProfessor, dataAula, horaInicio, duracaoMinutos },
) {
  const result = await criarRequest(db)
    .input("IdProfessor", sql.Int, idProfessor)
    .input("DataAula", sql.Date, dataAula)
    .input("HoraInicio", sql.VarChar(8), normalizarHoraSql(horaInicio))
    .input("Duracao", sql.Int, duracaoMinutos)
    .query(
      `SELECT 1 FROM COACHING c LEFT JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching WHERE (c.UTILIZADORid_utilizador = @IdProfessor OR pc.UTILIZADORid_utilizador2 = @IdProfessor) AND c.data_aula = @DataAula AND c.estado IN ('Agendado', 'Confirmado') AND c.hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time) AND CAST(DATEADD(MINUTE, c.duracao_minutos, CAST(c.hora_inicio AS datetime)) AS time) > TRY_CONVERT(time, @HoraInicio);`,
    );
  return result.recordset.length > 0;
}

async function existeConflitoCoachingSala(
  db,
  { idSala, dataAula, horaInicio, duracaoMinutos },
) {
  const result = await criarRequest(db)
    .input("IdSala", sql.Int, idSala)
    .input("DataAula", sql.Date, dataAula)
    .input("HoraInicio", sql.VarChar(8), normalizarHoraSql(horaInicio))
    .input("Duracao", sql.Int, duracaoMinutos)
    .query(
      `SELECT 1 FROM COACHING WHERE SALAid_sala = @IdSala AND data_aula = @DataAula AND estado IN ('Agendado', 'Confirmado') AND hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time) AND CAST(DATEADD(MINUTE, duracao_minutos, CAST(hora_inicio AS datetime)) AS time) > TRY_CONVERT(time, @HoraInicio);`,
    );
  return result.recordset.length > 0;
}

async function existeConflitoHorarioProfessor(
  db,
  { idProfessor, diaSemana, horaInicio, duracaoMinutos },
) {
  const result = await criarRequest(db)
    .input("IdProfessor", sql.Int, idProfessor)
    .input("DiaSemana", sql.Int, diaSemana)
    .input("HoraInicio", sql.VarChar(8), normalizarHoraSql(horaInicio))
    .input("Duracao", sql.Int, duracaoMinutos)
    .query(
      `SELECT 1 FROM HORARIO WHERE UTILIZADORid_utilizador = @IdProfessor AND dia_semana = @DiaSemana AND ativo = 1 AND hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time) AND hora_fim > TRY_CONVERT(time, @HoraInicio);`,
    );
  return result.recordset.length > 0;
}

async function existeConflitoHorarioSala(
  db,
  { idSala, diaSemana, horaInicio, duracaoMinutos },
) {
  const result = await criarRequest(db)
    .input("IdSala", sql.Int, idSala)
    .input("DiaSemana", sql.Int, diaSemana)
    .input("HoraInicio", sql.VarChar(8), normalizarHoraSql(horaInicio))
    .input("Duracao", sql.Int, duracaoMinutos)
    .query(
      `SELECT 1 FROM HORARIO WHERE SALAid_sala = @IdSala AND dia_semana = @DiaSemana AND ativo = 1 AND hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time) AND hora_fim > TRY_CONVERT(time, @HoraInicio);`,
    );
  return result.recordset.length > 0;
}

async function adicionarDisponibilidadeProfessor({
  diaSemana,
  horaInicio,
  horaFim,
  idProfessor,
}) {
  const pool = await poolPromise;
  const hI = normalizarHoraSql(horaInicio),
    hF = normalizarHoraSql(horaFim);
  const conflito = await pool
    .request()
    .input("IdProfessor", sql.Int, idProfessor)
    .input("DiaSemana", sql.Int, diaSemana)
    .input("HoraInicio", sql.VarChar(8), hI)
    .input("HoraFim", sql.VarChar(8), hF)
    .query(
      `SELECT 1 FROM DISPONIBILIDADE_PROFESSOR WHERE UTILIZADORid_utilizador = @IdProfessor AND dia_semana = @DiaSemana AND hora_inicio < TRY_CONVERT(time, @HoraFim) AND hora_fim > TRY_CONVERT(time, @HoraInicio);`,
    );
  if (conflito.recordset.length > 0)
    throw new Error(
      "Já existe uma disponibilidade que se sobrepõe a este horário.",
    );

  const result = await pool
    .request()
    .input("DiaSemana", sql.Int, diaSemana)
    .input("HoraInicio", sql.VarChar(8), hI)
    .input("HoraFim", sql.VarChar(8), hF)
    .input("IdProfessor", sql.Int, idProfessor)
    .query(
      `INSERT INTO DISPONIBILIDADE_PROFESSOR (dia_semana, hora_inicio, hora_fim, UTILIZADORid_utilizador) VALUES (@DiaSemana, TRY_CONVERT(time, @HoraInicio), TRY_CONVERT(time, @HoraFim), @IdProfessor);`,
    );
  return result.rowsAffected[0] > 0;
}

async function getDisponibilidadesProfessor(idProfessor) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdProfessor", sql.Int, idProfessor)
    .query(
      `SELECT dp.id_disponibilidade, dp.dia_semana, dp.hora_inicio, dp.hora_fim, (SELECT TOP 1 m.nome FROM PROFESSOR_MODALIDADE pm JOIN MODALIDADE m ON pm.MODALIDADEid_modalidade = m.id_modalidade WHERE pm.UTILIZADORid_utilizador = @IdProfessor) AS modalidade FROM DISPONIBILIDADE_PROFESSOR dp WHERE UTILIZADORid_utilizador = @IdProfessor ORDER BY dia_semana ASC, hora_inicio ASC;`,
    );
  return result.recordset;
}

async function removerDisponibilidadeProfessor(idDisponibilidade, idProfessor) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdDisponibilidade", sql.Int, idDisponibilidade)
    .input("IdProfessor", sql.Int, idProfessor)
    .query(
      `DELETE FROM DISPONIBILIDADE_PROFESSOR WHERE id_disponibilidade = @IdDisponibilidade AND UTILIZADORid_utilizador = @IdProfessor;`,
    );
  return result.rowsAffected[0] > 0;
}

async function getDisponibilidadeEfetiva(
  idModalidade,
  diaSemanaExato,
  dataEspecifica,
  idProfessorFiltro = null,
  idAnoLetivo = null,
) {
  const pool = await poolPromise;
  const resultDisponibilidade = await pool
    .request()
    .input("IdModalidade", sql.Int, idModalidade)
    .input("DiaSemana", sql.Int, diaSemanaExato)
    .input("IdProfessorFiltro", sql.Int, idProfessorFiltro)
    .query(
      `SELECT dp.id_disponibilidade, u.id_utilizador AS id_professor, u.nome AS nome_professor, dp.hora_inicio, dp.hora_fim FROM DISPONIBILIDADE_PROFESSOR dp JOIN UTILIZADOR u ON dp.UTILIZADORid_utilizador = u.id_utilizador JOIN UTILIZADOR_PERFIL up ON up.UTILIZADORid_utilizador = u.id_utilizador JOIN PERFIL p ON p.id_perfil = up.PERFILid_perfil WHERE dp.dia_semana = @DiaSemana AND p.nome LIKE '%Prof%' AND u.ativo = 1 AND EXISTS (SELECT 1 FROM PROFESSOR_MODALIDADE pm WHERE pm.UTILIZADORid_utilizador = u.id_utilizador AND pm.MODALIDADEid_modalidade = @IdModalidade) AND (@IdProfessorFiltro IS NULL OR u.id_utilizador = @IdProfessorFiltro);`,
    );

  const reqOcup = pool
    .request()
    .input("DataEspecifica", sql.Date, dataEspecifica);
  const resultOcupacao = await reqOcup.query(
    `SELECT c.UTILIZADORid_utilizador AS id_professor, c.hora_inicio, c.duracao_minutos, c.SALAid_sala FROM COACHING c WHERE c.data_aula = @DataEspecifica AND c.estado IN ('Agendado', 'Confirmado') UNION ALL SELECT pc.UTILIZADORid_utilizador2 AS id_professor, c.hora_inicio, c.duracao_minutos, c.SALAid_sala FROM COACHING c JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching WHERE c.data_aula = @DataEspecifica AND c.estado IN ('Agendado', 'Confirmado') AND pc.UTILIZADORid_utilizador2 IS NOT NULL;`,
  );

  const reqHor = pool.request().input("DiaSemana", sql.Int, diaSemanaExato);
  const resultOcupacaoHorario = await reqHor.query(
    `SELECT h.UTILIZADORid_utilizador AS id_professor, h.hora_inicio, DATEDIFF(MINUTE, h.hora_inicio, h.hora_fim) AS duracao_minutos, h.SALAid_sala FROM HORARIO h WHERE h.dia_semana = @DiaSemana AND h.ativo = 1;`,
  );

  return {
    disponibilidades: resultDisponibilidade.recordset,
    ocupacoes: [
      ...resultOcupacao.recordset,
      ...resultOcupacaoHorario.recordset,
    ],
  };
}

async function getAgendaProfessor(
  idProfessor,
  dataInicio = null,
  dataFim = null,
) {
  const pool = await poolPromise;
  let filtroData =
    dataInicio && dataFim
      ? "AND c.data_aula BETWEEN @DataInicio AND @DataFim"
      : "";
  const request = pool.request().input("IdProfessor", sql.Int, idProfessor);
  if (dataInicio && dataFim) {
    request.input("DataInicio", sql.Date, dataInicio);
    request.input("DataFim", sql.Date, dataFim);
  }

  const result = await request.query(
    `SELECT c.id_coaching, c.data_aula, c.hora_inicio, c.duracao_minutos, c.formato_aula, c.numero_participantes, c.estado, c.valor_final, m.nome AS modalidade, s.nome AS sala, ee.nome AS encarregado FROM COACHING c JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade JOIN SALA s ON c.SALAid_sala = s.id_sala JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador WHERE c.UTILIZADORid_utilizador = @IdProfessor AND c.estado NOT IN ('Cancelado') ${filtroData} ORDER BY c.data_aula ASC, c.hora_inicio ASC;`,
  );
  return result.recordset;
}

async function criarPedidoCoaching(dadosPedido, alunosIds, opts = {}) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const idPedido = await transaction
      .request()
      .input("Formato", sql.VarChar(50), dadosPedido.formatoAula)
      .input("Duracao", sql.Int, dadosPedido.duracaoMinutos)
      .input("NumParticipantes", sql.Int, alunosIds.length)
      .input("DataAula", sql.Date, dadosPedido.dataAula)
      .input("HoraInicio", sql.VarChar(8), String(dadosPedido.horaInicio))
      .input("CustoEstimado", sql.Decimal(10, 2), dadosPedido.custoEstimado)
      .input("IdEncarregado", sql.Int, dadosPedido.idEncarregado)
      .input("IdAnoLetivo", sql.Int, dadosPedido.idAnoLetivo)
      .input("IdModalidade", sql.Int, dadosPedido.idModalidade)
      .input("IdProfessor", sql.Int, dadosPedido.idProfessor || null)
      .query(
        `INSERT INTO PEDIDO_COACHING (formato_aula, duracao_minutos, numero_participantes, data_pedido, data_aula_pretendida, hora_inicio_pretendida, estado, custo_estimado, UTILIZADORid_utilizador, ANO_LETIVOid_ano_letivo, MODALIDADEid_modalidade, UTILIZADORid_utilizador2) OUTPUT INSERTED.id_pedido_coaching VALUES (@Formato, @Duracao, @NumParticipantes, GETDATE(), @DataAula, TRY_CONVERT(time, @HoraInicio), 'Pendente', @CustoEstimado, @IdEncarregado, @IdAnoLetivo, @IdModalidade, @IdProfessor);`,
      )
      .then((r) => r.recordset[0].id_pedido_coaching);

    for (const idAluno of alunosIds) {
      await transaction
        .request()
        .input("IdAluno", sql.Int, idAluno)
        .input("IdPedido", sql.Int, idPedido)
        .input("HoraInicio", sql.VarChar(8), String(dadosPedido.horaInicio))
        .query(
          `INSERT INTO PEDIDO_COACHING_PARTICIPANTE (ALUNOid_aluno, PEDIDO_COACHINGid_pedido_coaching, PEDIDO_COACHINGhora_inicio_pretendida) VALUES (@IdAluno, @IdPedido, TRY_CONVERT(time, @HoraInicio));`,
        );
    }
    await transaction.commit();
    return idPedido;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getPedidosPorEncarregado(idEncarregado) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdEE", sql.Int, idEncarregado)
    .query(
      `SELECT pc.id_pedido_coaching, pc.formato_aula, pc.duracao_minutos, pc.data_aula_pretendida, pc.hora_inicio_pretendida, pc.estado, pc.custo_estimado, m.nome AS modalidade, prof.nome AS professor, cab.id_coaching, cab.estado AS estado_coaching, cab.data_aula AS data_aula_coaching, cab.hora_inicio AS hora_inicio_coaching, s.nome AS nome_sala, profAula.nome AS nome_professor_agendado FROM PEDIDO_COACHING pc JOIN MODALIDADE m ON pc.MODALIDADEid_modalidade = m.id_modalidade LEFT JOIN UTILIZADOR prof ON pc.UTILIZADORid_utilizador2 = prof.id_utilizador OUTER APPLY (SELECT TOP 1 c.id_coaching, c.estado, c.data_aula, c.hora_inicio, c.SALAid_sala, c.UTILIZADORid_utilizador FROM COACHING c WHERE c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching AND c.estado <> 'Cancelado' ORDER BY c.id_coaching DESC) AS cab LEFT JOIN SALA s ON cab.SALAid_sala = s.id_sala LEFT JOIN UTILIZADOR profAula ON cab.UTILIZADORid_utilizador = profAula.id_utilizador WHERE pc.UTILIZADORid_utilizador = @IdEE ORDER BY pc.data_pedido DESC, pc.id_pedido_coaching DESC;`,
    );
  return result.recordset;
}

async function cancelarPedidoPendenteEncarregado(idPedido, idEncarregado) {
  const pool = await poolPromise;
  const upd = await pool
    .request()
    .input("IdPedido", sql.Int, idPedido)
    .input("IdEE", sql.Int, idEncarregado)
    .query(
      `UPDATE PEDIDO_COACHING SET estado = 'Cancelado' WHERE id_pedido_coaching = @IdPedido AND UTILIZADORid_utilizador = @IdEE AND estado = 'Pendente';`,
    );
  if (upd.rowsAffected[0] > 0) return "cancelado";
  return "nao_pendente";
}

async function getPedidosAtribuidosAoProfessorNoPeriodo(
  idProfessor,
  dataInicio,
  dataFim,
) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdProf", sql.Int, idProfessor)
    .input("DataInicio", sql.Date, dataInicio)
    .input("DataFim", sql.Date, dataFim)
    .query(
      `SELECT pc.id_pedido_coaching, pc.data_aula_pretendida, pc.hora_inicio_pretendida, pc.formato_aula, pc.duracao_minutos, pc.estado, pc.custo_estimado, m.nome AS modalidade, ee.nome AS encarregado, ee.email AS email_encarregado FROM PEDIDO_COACHING pc JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador JOIN MODALIDADE m ON pc.MODALIDADEid_modalidade = m.id_modalidade WHERE pc.UTILIZADORid_utilizador2 = @IdProf AND pc.estado = N'Pendente' AND pc.data_aula_pretendida BETWEEN @DataInicio AND @DataFim ORDER BY pc.data_aula_pretendida ASC, pc.hora_inicio_pretendida ASC;`,
    );
  return result.recordset;
}

async function getPedidosPendentes() {
  const pool = await poolPromise;
  const result = await pool.request().query(
    `SELECT 
          pc.id_pedido_coaching, 
          pc.MODALIDADEid_modalidade AS id_modalidade, 
          pc.UTILIZADORid_utilizador2 AS id_professor_desejado, 
          pc.data_aula_pretendida, 
          pc.hora_inicio_pretendida, 
          pc.formato_aula, 
          pc.duracao_minutos, 
          pc.estado, 
          pc.custo_estimado, 
          m.nome AS modalidade, 
          ee.nome AS encarregado, 
          ee.email AS email_requisitante, 
          prof.nome AS professor,
          (
            SELECT STRING_AGG(a.nome, ', ') 
            FROM PEDIDO_COACHING_PARTICIPANTE pcp 
            JOIN ALUNO a ON pcp.ALUNOid_aluno = a.id_aluno 
            WHERE pcp.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
          ) AS alunos
      FROM PEDIDO_COACHING pc 
      JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador 
      LEFT JOIN UTILIZADOR prof ON pc.UTILIZADORid_utilizador2 = prof.id_utilizador 
      JOIN MODALIDADE m ON pc.MODALIDADEid_modalidade = m.id_modalidade 
      WHERE pc.estado = 'Pendente' 
      ORDER BY pc.data_aula_pretendida ASC;`,
  );
  return result.recordset;
}

async function aprovarEAgendarCoaching(dadosAgendamento) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const conflitoProf = await existeConflitoCoachingProfessor(transaction, {
      idProfessor: dadosAgendamento.idProfessor,
      dataAula: dadosAgendamento.dataAula,
      horaInicio: dadosAgendamento.horaInicio,
      duracaoMinutos: dadosAgendamento.duracaoMinutos,
    });
    if (conflitoProf) throw new Error("Conflito de horário no professor.");

    const conflitoSala = await existeConflitoCoachingSala(transaction, {
      idSala: dadosAgendamento.idSala,
      dataAula: dadosAgendamento.dataAula,
      horaInicio: dadosAgendamento.horaInicio,
      duracaoMinutos: dadosAgendamento.duracaoMinutos,
    });
    if (conflitoSala) throw new Error("Conflito de sala.");

    await transaction
      .request()
      .input("IdPedido", sql.Int, dadosAgendamento.idPedido)
      .query(
        `UPDATE PEDIDO_COACHING SET estado = 'Aprovado' WHERE id_pedido_coaching = @IdPedido;`,
      );
    const idCoachingFinal = await transaction
      .request()
      .input("Formato", sql.VarChar(50), dadosAgendamento.formatoAula)
      .input("Duracao", sql.Int, dadosAgendamento.duracaoMinutos)
      .input("NumParticipantes", sql.Int, dadosAgendamento.numeroParticipantes)
      .input("DataAula", sql.Date, dadosAgendamento.dataAula)
      .input("HoraInicio", sql.VarChar(8), dadosAgendamento.horaInicio)
      .input("IdProfessor", sql.Int, dadosAgendamento.idProfessor)
      .input("IdAnoLetivo", sql.Int, dadosAgendamento.idAnoLetivo)
      .input("IdModalidade", sql.Int, dadosAgendamento.idModalidade)
      .input("IdSala", sql.Int, dadosAgendamento.idSala)
      .input("IdPedido", sql.Int, dadosAgendamento.idPedido)
      .input("ValorFinal", sql.Decimal(10, 2), dadosAgendamento.valorFinal)
      .query(
        `INSERT INTO COACHING (formato_aula, duracao_minutos, numero_participantes, data_aula, hora_inicio, estado, UTILIZADORid_utilizador, ANO_LETIVOid_ano_letivo, MODALIDADEid_modalidade, SALAid_sala, PEDIDO_COACHINGid_pedido_coaching, valor_final) OUTPUT INSERTED.id_coaching VALUES (@Formato, @Duracao, @NumParticipantes, @DataAula, TRY_CONVERT(time, @HoraInicio), 'Agendado', @IdProfessor, @IdAnoLetivo, @IdModalidade, @IdSala, @IdPedido, @ValorFinal);`,
      )
      .then((r) => r.recordset[0].id_coaching);

    await transaction.commit();
    return idCoachingFinal;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function professorTemDisponibilidadeNoSlot({
  idProfessor,
  dataAula,
  horaInicio,
  duracaoMinutos,
  diaSemanaCoaching,
}) {
  const pool = await poolPromise;
  const r = await pool
    .request()
    .input("IdProfessor", sql.Int, idProfessor)
    .input("DiaSemana", sql.Int, diaSemanaCoaching)
    .input("HoraInicio", sql.VarChar(8), normalizarHoraSql(horaInicio))
    .input("Duracao", sql.Int, Number(duracaoMinutos))
    .query(
      `SELECT TOP 1 1 AS ok FROM DISPONIBILIDADE_PROFESSOR WHERE UTILIZADORid_utilizador = @IdProfessor AND dia_semana = @DiaSemana AND hora_inicio <= TRY_CONVERT(time, @HoraInicio) AND hora_fim >= CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time);`,
    );
  return r.recordset.length > 0;
}

async function verificarSlotLivreProfessor({
  idProfessor,
  dataAula,
  horaInicio,
  duracaoMinutos,
  diaSemanaCoaching,
}) {
  const pool = await poolPromise;
  const conflitoProf = await existeConflitoCoachingProfessor(pool, {
    idProfessor,
    dataAula,
    horaInicio: normalizarHoraSql(horaInicio),
    duracaoMinutos,
  });
  if (conflitoProf) return { livre: false, motivo: "Conflito." };
  return { livre: true, motivo: null };
}

async function getPedidoCoachingPorId(idPedido) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdPedido", sql.Int, idPedido)
    .query(
      `SELECT * FROM PEDIDO_COACHING WHERE id_pedido_coaching = @IdPedido;`,
    );
  return result.recordset[0] || null;
}

async function rejeitarPedidoCoaching(idPedido) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdPedido", sql.Int, idPedido)
    .query(
      `UPDATE PEDIDO_COACHING SET estado = 'Rejeitado' WHERE id_pedido_coaching = @IdPedido AND estado = 'Pendente';`,
    );
  return result.rowsAffected[0] > 0;
}

async function getCoachingCabecalhoCancelamento(idCoaching) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdCoaching", sql.Int, idCoaching)
    .query(
      `SELECT data_aula, hora_inicio, duracao_minutos, estado FROM COACHING WHERE id_coaching = @IdCoaching;`,
    );
  return result.recordset[0] || null;
}

async function cancelarCoaching(idCoaching) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const pedidoResult = await transaction
      .request()
      .input("IdCoaching", sql.Int, idCoaching)
      .query(
        `SELECT PEDIDO_COACHINGid_pedido_coaching AS id_pedido, estado FROM COACHING WHERE id_coaching = @IdCoaching;`,
      );
    if (pedidoResult.recordset.length === 0) throw new Error("Não encontrado.");
    await transaction
      .request()
      .input("IdCoaching", sql.Int, idCoaching)
      .query(
        `UPDATE COACHING SET estado = 'Cancelado' WHERE id_coaching = @IdCoaching;`,
      );
    await transaction
      .request()
      .input("IdPedido", sql.Int, pedidoResult.recordset[0].id_pedido)
      .query(
        `UPDATE PEDIDO_COACHING SET estado = 'Cancelado' WHERE id_pedido_coaching = @IdPedido;`,
      );
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function registarValidacaoAula(
  idCoaching,
  idUtilizador,
  tipoValidador,
  estadoValidacao,
  observacoes = null,
) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("TipoValidador", sql.VarChar(50), tipoValidador)
    .input("EstadoValidacao", sql.VarChar(50), estadoValidacao)
    .input("Observacoes", sql.VarChar(255), observacoes)
    .input("IdUtilizador", sql.Int, idUtilizador)
    .input("IdCoaching", sql.Int, idCoaching)
    .query(
      `INSERT INTO VALIDACAO_COACHING (tipo_validador, estado_validacao, data_validacao, observacoes, UTILIZADORid_utilizador, COACHINGid_coaching) VALUES (@TipoValidador, @EstadoValidacao, GETDATE(), @Observacoes, @IdUtilizador, @IdCoaching);`,
    );
  return result.rowsAffected[0] > 0;
}

async function concluirCoachingPelaCoordenacao(
  idCoaching,
  idCoordenador,
  estadoFinal,
  observacoes,
) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    await transaction
      .request()
      .input(
        "Observacoes",
        sql.VarChar(255),
        observacoes || "Validado pela coordenação.",
      )
      .input("IdCoordenador", sql.Int, idCoordenador)
      .input("IdCoaching", sql.Int, idCoaching)
      .query(
        `INSERT INTO VALIDACAO_COACHING (tipo_validador, estado_validacao, data_validacao, observacoes, UTILIZADORid_utilizador, COACHINGid_coaching) VALUES ('Coordenacao', 'Aprovacao_Final', GETDATE(), @Observacoes, @IdCoordenador, @IdCoaching);`,
      );
    await transaction
      .request()
      .input("EstadoFinal", sql.VarChar(50), estadoFinal)
      .input("IdCoaching", sql.Int, idCoaching)
      .query(
        `UPDATE COACHING SET estado = @EstadoFinal WHERE id_coaching = @IdCoaching;`,
      );
    await transaction.commit();
    return true;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function listarCoachingsAbertosParaCoordenacao() {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .query(
      `SELECT c.id_coaching, c.data_aula, c.hora_inicio, c.duracao_minutos, c.estado FROM COACHING c WHERE c.estado IN (N'Agendado', N'Confirmado') ORDER BY c.data_aula ASC, c.hora_inicio ASC;`,
    );
  return result.recordset;
}

async function coachingPertenceAEncarregado(idCoaching, idEncarregado) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdCoaching", sql.Int, idCoaching)
    .input("IdEE", sql.Int, idEncarregado)
    .query(
      `SELECT 1 AS ok FROM COACHING c JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching WHERE c.id_coaching = @IdCoaching AND pc.UTILIZADORid_utilizador = @IdEE AND c.estado <> 'Cancelado';`,
    );
  return result.recordset.length > 0;
}

async function coachingPertenceAProfessorAtivo(idCoaching, idProfessor) {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("IdCoaching", sql.Int, idCoaching)
    .input("IdProf", sql.Int, idProfessor)
    .query(
      `SELECT 1 AS ok FROM COACHING WHERE id_coaching = @IdCoaching AND UTILIZADORid_utilizador = @IdProf AND estado NOT IN ('Cancelado');`,
    );
  return result.recordset.length > 0;
}

async function getHistoricoGeralCoachings() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      c.id_coaching, c.data_aula, c.hora_inicio, c.duracao_minutos, c.estado, c.valor_final,
      m.nome AS modalidade, s.nome AS sala, prof.nome AS nome_professor, ee.nome AS encarregado,
      (SELECT STRING_AGG(a.nome, ', ') FROM PEDIDO_COACHING_PARTICIPANTE pcp JOIN ALUNO a ON pcp.ALUNOid_aluno = a.id_aluno WHERE pcp.PEDIDO_COACHINGid_pedido_coaching = c.PEDIDO_COACHINGid_pedido_coaching) AS alunos
    FROM COACHING c
    JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
    JOIN SALA s ON c.SALAid_sala = s.id_sala
    JOIN UTILIZADOR prof ON c.UTILIZADORid_utilizador = prof.id_utilizador
    JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
    JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador
    ORDER BY c.data_aula DESC, c.hora_inicio DESC;
  `);
  return result.recordset;
}

module.exports = {
  adicionarDisponibilidadeProfessor,
  getDisponibilidadesProfessor,
  removerDisponibilidadeProfessor,
  getDisponibilidadeEfetiva,
  getAgendaProfessor,
  criarPedidoCoaching,
  getPedidosPorEncarregado,
  cancelarPedidoPendenteEncarregado,
  getPedidosAtribuidosAoProfessorNoPeriodo,
  getPedidosPendentes,
  aprovarEAgendarCoaching,
  professorTemDisponibilidadeNoSlot,
  verificarSlotLivreProfessor,
  getPedidoCoachingPorId,
  rejeitarPedidoCoaching,
  getCoachingCabecalhoCancelamento,
  cancelarCoaching,
  registarValidacaoAula,
  concluirCoachingPelaCoordenacao,
  listarCoachingsAbertosParaCoordenacao,
  coachingPertenceAEncarregado,
  coachingPertenceAProfessorAtivo,
  getHistoricoGeralCoachings,
};
