/**
 * @fileoverview Modelo de Dados para a Gestão de Coaching.
 * Responsável por todas as interações com a base de dados SQL Server relativas 
 * a disponibilidades de professores, gestão de pedidos de coaching, validação de conflitos
 * (salas e horários) e validação de aulas. Utiliza transações para garantir integridade.
 */

const { poolPromise } = require('../config/db');
const sql = require('mssql');

// ============================================================================
// FUNÇÕES AUXILIARES E DE NORMALIZAÇÃO
// ============================================================================

/**
 * Normaliza uma string de hora para o formato seguro do SQL (HH:mm:ss).
 * @param {string} valor - A hora fornecida (ex: "14:30" ou "14:30:00").
 * @returns {string|null} - A hora formatada ou null se for inválida.
 */
function normalizarHoraSql(valor) {
    const s = String(valor ?? '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = Number(m[3] ?? '0');
    
    // Validação estrita dos limites de tempo
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Converte uma hora (HH:mm) no total de minutos desde a meia-noite.
 * Útil para comparações matemáticas rápidas de intervalos (ex: horaInicio < horaFim).
 */
function minutosDaHora(valor) {
    const h = normalizarHoraSql(valor);
    if (!h) return null;
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
}

/**
 * Extrai o dia da semana a partir de uma data real.
 * Garante que a escala usada coincide com a tabela HORARIO (1=Segunda, ..., 7=Domingo).
 */
function diaSemanaHorarioDeData(dataAula, fallback = null) {
    if (Number.isFinite(Number(fallback)) && Number(fallback) >= 1 && Number(fallback) <= 7) {
        return Number(fallback);
    }

    if (dataAula == null || dataAula === '') return null;
    const partes = String(dataAula).split(/[-T]/);
    const ano = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10);
    const dia = parseInt(partes[2], 10);
    
    if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null;
    const day = new Date(ano, mes - 1, dia).getDay();
    
    // O JavaScript retorna 0 para Domingo. Convertemos para 7 para alinhar com o SQL.
    return day === 0 ? 7 : day;
}

/**
 * Converte um dia da semana da escala de agendamento (1 a 7) 
 * para a escala de disponibilidade base (1 = Dias Úteis, 2 = Fim de semana).
 */
function diaSemanaDisponibilidadeDeDiaReal(diaSemanaReal) {
    const dia = Number(diaSemanaReal);
    if (!Number.isFinite(dia) || dia < 1 || dia > 7) return null;
    return dia >= 1 && dia <= 5 ? 1 : 2;
}

/**
 * Instancia um novo request ao pool do SQL Server.
 */
function criarRequest(db) {
    return db.request();
}

// ============================================================================
// FUNÇÕES DE VALIDAÇÃO DE CONFLITOS
// ============================================================================

/**
 * Verifica se o professor já tem um coaching agendado ou confirmado que se sobreponha ao horário pretendido.
 * @returns {Promise<boolean>} True se existir conflito.
 */
async function existeConflitoCoachingProfessor(db, { idProfessor, dataAula, horaInicio, duracaoMinutos }) {
    const result = await criarRequest(db)
        .input('IdProfessor', sql.Int, idProfessor)
        .input('DataAula', sql.Date, dataAula)
        .input('HoraInicio', sql.VarChar(8), normalizarHoraSql(horaInicio))
        .input('Duracao', sql.Int, duracaoMinutos)
        .query(`
            SELECT 1
            FROM COACHING c
            LEFT JOIN PEDIDO_COACHING pc
                ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
            WHERE (c.UTILIZADORid_utilizador = @IdProfessor OR pc.UTILIZADORid_utilizador2 = @IdProfessor)
              AND c.data_aula = @DataAula
              AND c.estado IN ('Agendado', 'Confirmado')
              /* Validação matemática de interceção de tempos no SQL */
              AND c.hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time)
              AND CAST(DATEADD(MINUTE, c.duracao_minutos, CAST(c.hora_inicio AS datetime)) AS time) > TRY_CONVERT(time, @HoraInicio);
        `);

    return result.recordset.length > 0;
}

/**
 * Verifica se a sala já tem um coaching agendado ou confirmado no horário pretendido.
 * @returns {Promise<boolean>} True se existir conflito.
 */
async function existeConflitoCoachingSala(db, { idSala, dataAula, horaInicio, duracaoMinutos }) {
    const result = await criarRequest(db)
        .input('IdSala', sql.Int, idSala)
        .input('DataAula', sql.Date, dataAula)
        .input('HoraInicio', sql.VarChar(8), normalizarHoraSql(horaInicio))
        .input('Duracao', sql.Int, duracaoMinutos)
        .query(`
            SELECT 1
            FROM COACHING
            WHERE SALAid_sala = @IdSala
              AND data_aula = @DataAula
              AND estado IN ('Agendado', 'Confirmado')
              AND hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time)
              AND CAST(DATEADD(MINUTE, duracao_minutos, CAST(hora_inicio AS datetime)) AS time) > TRY_CONVERT(time, @HoraInicio);
        `);

    return result.recordset.length > 0;
}

/**
 * Verifica se o professor está ocupado com turmas normais (tabela HORARIO).
 * @returns {Promise<boolean>} True se existir conflito.
 */
async function existeConflitoHorarioProfessor(db, { idProfessor, diaSemana, horaInicio, duracaoMinutos }) {
    const result = await criarRequest(db)
        .input('IdProfessor', sql.Int, idProfessor)
        .input('DiaSemana', sql.Int, diaSemana)
        .input('HoraInicio', sql.VarChar(8), normalizarHoraSql(horaInicio))
        .input('Duracao', sql.Int, duracaoMinutos)
        .query(`
            SELECT 1
            FROM HORARIO
            WHERE UTILIZADORid_utilizador = @IdProfessor
              AND dia_semana = @DiaSemana
              AND ativo = 1
              AND hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time)
              AND hora_fim > TRY_CONVERT(time, @HoraInicio);
        `);

    return result.recordset.length > 0;
}

/**
 * Verifica se a sala está ocupada com turmas normais (tabela HORARIO).
 * @returns {Promise<boolean>} True se existir conflito.
 */
async function existeConflitoHorarioSala(db, { idSala, diaSemana, horaInicio, duracaoMinutos }) {
    const result = await criarRequest(db)
        .input('IdSala', sql.Int, idSala)
        .input('DiaSemana', sql.Int, diaSemana)
        .input('HoraInicio', sql.VarChar(8), normalizarHoraSql(horaInicio))
        .input('Duracao', sql.Int, duracaoMinutos)
        .query(`
            SELECT 1
            FROM HORARIO
            WHERE SALAid_sala = @IdSala
              AND dia_semana = @DiaSemana
              AND ativo = 1
              AND hora_inicio < CAST(DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime)) AS time)
              AND hora_fim > TRY_CONVERT(time, @HoraInicio);
        `);

    return result.recordset.length > 0;
}
 
// ============================================================================
// 1. GESTÃO DE DISPONIBILIDADES DOS PROFESSORES (US09 / RF11)
// ============================================================================
 
/**
 * Regista um novo bloco de disponibilidade na agenda do professor.
 */
async function adicionarDisponibilidadeProfessor({ diaSemana, horaInicio, horaFim, idProfessor }) {
    try {
        const pool = await poolPromise;

        const horaInicioNorm = normalizarHoraSql(horaInicio);
        const horaFimNorm = normalizarHoraSql(horaFim);
        if (!horaInicioNorm || !horaFimNorm) {
            throw new Error('Formato de hora inválido. Use HH:mm.');
        }

        // Garante que a lógica temporal faz sentido
        if (minutosDaHora(horaFimNorm) <= minutosDaHora(horaInicioNorm)) {
            throw new Error('A hora de fim deve ser posterior à hora de início.');
        }

        // Impede que o professor adicione blocos sobrepostos no mesmo dia
        const conflito = await pool.request()
            .input('IdProfessor', sql.Int, idProfessor)
            .input('DiaSemana', sql.Int, diaSemana)
            .input('HoraInicio', sql.VarChar(8), horaInicioNorm)
            .input('HoraFim', sql.VarChar(8), horaFimNorm)
            .query(`
                SELECT 1 FROM DISPONIBILIDADE_PROFESSOR
                WHERE UTILIZADORid_utilizador = @IdProfessor
                  AND dia_semana = @DiaSemana
                  AND hora_inicio < TRY_CONVERT(time, @HoraFim)
                  AND hora_fim > TRY_CONVERT(time, @HoraInicio);
            `);

        if (conflito.recordset.length > 0) {
            throw new Error('Já existe uma disponibilidade que se sobrepõe a este horário.');
        }

        const result = await pool.request()
            .input('DiaSemana', sql.Int, diaSemana)
            .input('HoraInicio', sql.VarChar(8), horaInicioNorm)
            .input('HoraFim', sql.VarChar(8), horaFimNorm)
            .input('IdProfessor', sql.Int, idProfessor)
            .query(`
                INSERT INTO DISPONIBILIDADE_PROFESSOR 
                    (dia_semana, hora_inicio, hora_fim, UTILIZADORid_utilizador)
                VALUES 
                    (@DiaSemana, TRY_CONVERT(time, @HoraInicio), TRY_CONVERT(time, @HoraFim), @IdProfessor);
            `);

        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (adicionarDisponibilidadeProfessor):', error);
        throw error;
    }
}
 
/**
 * Lista as disponibilidades configuradas por um professor.
 */
async function getDisponibilidadesProfessor(idProfessor) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('IdProfessor', sql.Int, idProfessor)
            .query(`
                SELECT 
                    id_disponibilidade,
                    dia_semana,
                    hora_inicio,
                    hora_fim
                FROM DISPONIBILIDADE_PROFESSOR
                WHERE UTILIZADORid_utilizador = @IdProfessor
                ORDER BY dia_semana ASC, hora_inicio ASC;
            `);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getDisponibilidadesProfessor):', error);
        throw error;
    }
}
 
/**
 * Apaga um bloco de disponibilidade do professor da base de dados.
 */
async function removerDisponibilidadeProfessor(idDisponibilidade, idProfessor) {
    try {
        const pool = await poolPromise;
        
        // A cláusula do idProfessor funciona como um filtro de segurança nativo na query
        const result = await pool.request()
            .input('IdDisponibilidade', sql.Int, idDisponibilidade)
            .input('IdProfessor', sql.Int, idProfessor)
            .query(`
                DELETE FROM DISPONIBILIDADE_PROFESSOR
                WHERE id_disponibilidade = @IdDisponibilidade
                  AND UTILIZADORid_utilizador = @IdProfessor;
            `);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (removerDisponibilidadeProfessor):', error);
        throw error;
    }
}
 
/**
 * Retorna as disponibilidades teóricas cruzadas com as ocupações reais para encontrar vagas.
 * O resultado contém arrays separadas para o frontend calcular as janelas livres precisas.
 */
async function getDisponibilidadeEfetiva(
    idModalidade,
    diaSemana,
    dataEspecifica,
    idProfessorFiltro = null,
    idAnoLetivo = null
) {
    try {
        const pool = await poolPromise;

        // Determinação inteligente do ano letivo (usar submetido ou procurar o mais recente ativo)
        let idAnoFiltro = idAnoLetivo != null && idAnoLetivo !== '' ? parseInt(idAnoLetivo, 10) : null;
        if (Number.isNaN(idAnoFiltro)) idAnoFiltro = null;
        
        if (idAnoFiltro == null) {
            const anoR = await pool.request().query(`
                SELECT TOP 1 id_ano_letivo AS id FROM ANO_LETIVO ORDER BY id_ano_letivo DESC;
            `);
            idAnoFiltro = anoR.recordset[0]?.id ?? null;
        }

        const diaSemanaHorario = diaSemanaHorarioDeData(dataEspecifica, diaSemana);
 
        // 1. Vai buscar a grelha genérica de "estou disponível" do professor
        const resultDisponibilidade = await pool.request()
            .input('IdModalidade', sql.Int, idModalidade)
            .input('DiaSemana', sql.Int, diaSemana)
            .input('IdProfessorFiltro', sql.Int, idProfessorFiltro == null ? null : idProfessorFiltro)
            .query(`
                SELECT 
                    dp.id_disponibilidade,
                    u.id_utilizador AS id_professor,
                    u.nome AS nome_professor,
                    dp.hora_inicio,
                    dp.hora_fim
                FROM DISPONIBILIDADE_PROFESSOR dp
                JOIN UTILIZADOR u ON dp.UTILIZADORid_utilizador = u.id_utilizador
                JOIN UTILIZADOR_PERFIL up ON up.UTILIZADORid_utilizador = u.id_utilizador
                JOIN PERFIL p ON p.id_perfil = up.PERFILid_perfil
                WHERE dp.dia_semana = @DiaSemana
                  AND p.nome LIKE '%Prof%'
                  AND u.ativo = 1
                  AND EXISTS (
                      SELECT 1
                      FROM PROFESSOR_MODALIDADE pm
                      WHERE pm.UTILIZADORid_utilizador = u.id_utilizador
                        AND pm.MODALIDADEid_modalidade = @IdModalidade
                  )
                  AND (@IdProfessorFiltro IS NULL OR u.id_utilizador = @IdProfessorFiltro);
            `);
 
        // 2. Extrai marcações de Coaching (Extra-Curriculares)
        const reqOcup = pool.request().input('DataEspecifica', sql.Date, dataEspecifica);
        if (idAnoFiltro != null) reqOcup.input('IdAnoLetivo', sql.Int, idAnoFiltro);
        const resultOcupacao = await reqOcup.query(`
                SELECT 
                    c.UTILIZADORid_utilizador AS id_professor,
                    c.hora_inicio,
                    c.duracao_minutos,
                    c.SALAid_sala
                FROM COACHING c
                WHERE c.data_aula = @DataEspecifica
                  AND c.estado IN ('Agendado', 'Confirmado')
                  ${idAnoFiltro != null ? 'AND c.ANO_LETIVOid_ano_letivo = @IdAnoLetivo' : ''}
                UNION ALL
                SELECT
                    pc.UTILIZADORid_utilizador2 AS id_professor,
                    c.hora_inicio,
                    c.duracao_minutos,
                    c.SALAid_sala
                FROM COACHING c
                JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
                WHERE c.data_aula = @DataEspecifica
                  AND c.estado IN ('Agendado', 'Confirmado')
                  AND pc.UTILIZADORid_utilizador2 IS NOT NULL
                  ${idAnoFiltro != null ? 'AND c.ANO_LETIVOid_ano_letivo = @IdAnoLetivo' : ''};
            `);

        // 3. Extrai Ocupações Regulares (Turmas Fixas) para aquele dia da semana
        const queryOcupacaoHorario = `
            SELECT 
                h.UTILIZADORid_utilizador AS id_professor,
                h.hora_inicio,
                DATEDIFF(MINUTE, h.hora_inicio, h.hora_fim) AS duracao_minutos,
                h.SALAid_sala
            FROM HORARIO h
            WHERE h.dia_semana = @DiaSemana
              AND h.ativo = 1
              ${idAnoFiltro != null ? 'AND h.ANO_LETIVOid_ano_letivo = @IdAnoLetivo' : ''};
        `;
        
        const reqHor = pool.request().input('DiaSemana', sql.Int, diaSemanaHorario);
        if (idAnoFiltro != null) reqHor.input('IdAnoLetivo', sql.Int, idAnoFiltro);
        const resultOcupacaoHorario = await reqHor.query(queryOcupacaoHorario);
 
        // Agrupa as disponibilidades amplas com os "buracos/ocupações" concretos para o controller
        return {
            disponibilidades: resultDisponibilidade.recordset,
            ocupacoes: [
                ...resultOcupacao.recordset,
                ...resultOcupacaoHorario.recordset 
            ]
        };
    } catch (error) {
        console.error('Erro no Modelo (getDisponibilidadeEfetiva):', error);
        throw error;
    }
}
 
// ============================================================================
// 2. AGENDA DOS PROFESSORES (US10 / RF12)
// ============================================================================
 
/**
 * Extrai a lista de aulas agendadas para a agenda do professor.
 */
async function getAgendaProfessor(idProfessor, dataInicio = null, dataFim = null) {
    try {
        const pool = await poolPromise;
 
        let filtroData = '';
        if (dataInicio && dataFim) {
            filtroData = 'AND c.data_aula BETWEEN @DataInicio AND @DataFim';
        }
 
        const query = `
            SELECT 
                c.id_coaching,
                c.data_aula,
                c.hora_inicio,
                c.duracao_minutos,
                c.formato_aula,
                c.numero_participantes,
                c.estado,
                c.valor_final,
                m.nome AS modalidade,
                s.nome AS sala,
                ee.nome AS encarregado
            FROM COACHING c
            JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
            JOIN SALA s ON c.SALAid_sala = s.id_sala
            JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
            JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador
            WHERE c.UTILIZADORid_utilizador = @IdProfessor
              AND c.estado NOT IN ('Cancelado')
              ${filtroData}
            ORDER BY c.data_aula ASC, c.hora_inicio ASC;
        `;
 
        const request = pool.request()
            .input('IdProfessor', sql.Int, idProfessor);
 
        if (dataInicio && dataFim) {
            request.input('DataInicio', sql.Date, dataInicio);
            request.input('DataFim', sql.Date, dataFim);
        }
 
        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getAgendaProfessor):', error);
        throw error;
    }
}
 
// ============================================================================
// 3. PEDIDOS DE COACHING — CRIAÇÃO E LEITURA (US05, US06 / RF05, RF07)
// ============================================================================
 
/**
 * Garante por segurança que os alunos submetidos num pedido estão efetivamente 
 * registados e vinculados ao Encarregado de Educação.
 */
async function assertAlunosPertencemAoEncarregado(transaction, idEncarregado, idsAlunos) {
    for (const idAluno of idsAlunos) {
        const check = await transaction
            .request()
            .input('IdEnc', sql.Int, idEncarregado)
            .input('IdAluno', sql.Int, idAluno)
            .query(`
                SELECT 1 AS ok
                FROM ENCARREGADO_ALUNO ea
                INNER JOIN ALUNO a ON a.id_aluno = ea.ALUNOid_aluno
                WHERE ea.UTILIZADORid_utilizador = @IdEnc
                  AND ea.ALUNOid_aluno = @IdAluno
                  AND a.ativo = 1
            `);
            
        if (!check.recordset.length) {
            const e = new Error(
                `O aluno (ID ${idAluno}) não está associado à tua conta na escola ou encontra-se inativo.`
            );
            e.isOperational = true;
            e.statusCode = 403;
            throw e;
        }
    }
}

/**
 * Cria um pedido de coaching na base de dados. 
 * É uma transação atómica: Se a criação do pedido ou a inserção dos alunos falhar, toda a operação é abortada (Rollback).
 */
async function criarPedidoCoaching(dadosPedido, alunosIds, opts = {}) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin(); // Inicia transação
 
    try {
        const skipAlunoValidation = !!opts.skipAlunoValidation;
        const numeroParticipantesOverride =
            opts.numeroParticipantesOverride != null ? Number(opts.numeroParticipantesOverride) : null;

        // Limpa possíveis duplicações nos IDs submetidos
        const idsUnicos = [
            ...new Set(alunosIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))
        ];
        
        if (!skipAlunoValidation && idsUnicos.length === 0) {
            const e = new Error('Indica pelo menos um aluno com identificador válido.');
            e.isOperational = true;
            throw e;
        }

        if (!skipAlunoValidation) {
            await assertAlunosPertencemAoEncarregado(transaction, dadosPedido.idEncarregado, idsUnicos);
        }

        const numeroParticipantes = skipAlunoValidation
            ? (Number.isFinite(numeroParticipantesOverride) && numeroParticipantesOverride > 0 ? numeroParticipantesOverride : 1)
            : idsUnicos.length;

        // 1. Insere o Cabeçalho do Pedido
        const idPedido = await transaction.request()
            .input('Formato', sql.VarChar(50), dadosPedido.formatoAula)
            .input('Duracao', sql.Int, dadosPedido.duracaoMinutos)
            .input('NumParticipantes', sql.Int, numeroParticipantes)
            .input('DataAula', sql.Date, dadosPedido.dataAula)
            .input('HoraInicio', sql.VarChar(8), String(dadosPedido.horaInicio))
            .input('CustoEstimado', sql.Decimal(10, 2), dadosPedido.custoEstimado)
            .input('IdEncarregado', sql.Int, dadosPedido.idEncarregado)
            .input('IdAnoLetivo', sql.Int, dadosPedido.idAnoLetivo)
            .input('IdModalidade', sql.Int, dadosPedido.idModalidade)
            .input('IdProfessor', sql.Int, dadosPedido.idProfessor || null)
            .query(`
                INSERT INTO PEDIDO_COACHING (
                    formato_aula, duracao_minutos, numero_participantes, 
                    data_pedido, data_aula_pretendida, hora_inicio_pretendida, 
                    estado, custo_estimado, UTILIZADORid_utilizador, 
                    ANO_LETIVOid_ano_letivo, MODALIDADEid_modalidade, UTILIZADORid_utilizador2
                )
                OUTPUT INSERTED.id_pedido_coaching
                VALUES (
                    @Formato, @Duracao, @NumParticipantes, 
                    GETDATE(), @DataAula, TRY_CONVERT(time, @HoraInicio), 
                    'Pendente', @CustoEstimado, @IdEncarregado, 
                    @IdAnoLetivo, @IdModalidade, @IdProfessor
                );
            `)
            .then(r => r.recordset[0].id_pedido_coaching);
 
        // 2. Insere os Alunos Relacionados
        if (idsUnicos.length > 0) {
            for (const idAluno of idsUnicos) {
                await transaction.request()
                    .input('IdAluno', sql.Int, idAluno)
                    .input('IdPedido', sql.Int, idPedido)
                    .input('HoraInicio', sql.VarChar(8), String(dadosPedido.horaInicio))
                    .query(`
                        INSERT INTO PEDIDO_COACHING_PARTICIPANTE 
                            (ALUNOid_aluno, PEDIDO_COACHINGid_pedido_coaching, PEDIDO_COACHINGhora_inicio_pretendida)
                        VALUES (@IdAluno, @IdPedido, TRY_CONVERT(time, @HoraInicio));
                    `);
            }
        }
 
        await transaction.commit(); // Fecha transação com sucesso
        return idPedido;
    } catch (error) {
        await transaction.rollback(); // Cancela escritas em caso de erro
        console.error('Erro no Modelo Transacional (criarPedidoCoaching):', error);
        throw error;
    }
}

/**
 * Obtém a lista de pedidos feitos por um Encarregado de Educação específico.
 */
async function getPedidosPorEncarregado(idEncarregado) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdEE', sql.Int, idEncarregado)
            .query(`
                SELECT 
                    pc.id_pedido_coaching,
                    pc.formato_aula,
                    pc.duracao_minutos,
                    pc.data_aula_pretendida,
                    pc.hora_inicio_pretendida,
                    pc.estado,
                    pc.custo_estimado,
                    m.nome AS modalidade,
                    prof.nome AS professor,
                    cab.id_coaching,
                    cab.estado AS estado_coaching,
                    cab.data_aula AS data_aula_coaching,
                    cab.hora_inicio AS hora_inicio_coaching,
                    s.nome AS nome_sala,
                    profAula.nome AS nome_professor_agendado
                FROM PEDIDO_COACHING pc
                JOIN MODALIDADE m ON pc.MODALIDADEid_modalidade = m.id_modalidade
                LEFT JOIN UTILIZADOR prof ON pc.UTILIZADORid_utilizador2 = prof.id_utilizador
                OUTER APPLY (
                    SELECT TOP 1
                        c.id_coaching,
                        c.estado,
                        c.data_aula,
                        c.hora_inicio,
                        c.SALAid_sala,
                        c.UTILIZADORid_utilizador
                    FROM COACHING c
                    WHERE c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
                      AND c.estado <> 'Cancelado'
                    ORDER BY c.id_coaching DESC
                ) AS cab
                LEFT JOIN SALA s ON cab.SALAid_sala = s.id_sala
                LEFT JOIN UTILIZADOR profAula ON cab.UTILIZADORid_utilizador = profAula.id_utilizador
                WHERE pc.UTILIZADORid_utilizador = @IdEE
                ORDER BY pc.data_pedido DESC, pc.id_pedido_coaching DESC;
            `);

        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getPedidosPorEncarregado):', error);
        throw error;
    }
}

/**
 * Permite ao EE cancelar um pedido que ainda esteja Pendente (não processado pela Coordenação).
 * @returns {'cancelado'|'nao_encontrado'|'nao_pendente'} String de estado para guiar a resposta da API.
 */
async function cancelarPedidoPendenteEncarregado(idPedido, idEncarregado) {
    try {
        const pool = await poolPromise;

        const upd = await pool
            .request()
            .input('IdPedido', sql.Int, idPedido)
            .input('IdEE', sql.Int, idEncarregado)
            .query(`
                UPDATE PEDIDO_COACHING
                SET estado = 'Cancelado'
                WHERE id_pedido_coaching = @IdPedido
                  AND UTILIZADORid_utilizador = @IdEE
                  AND estado = 'Pendente';
            `);

        if (upd.rowsAffected[0] > 0) return 'cancelado';

        const check = await pool
            .request()
            .input('IdPedido', sql.Int, idPedido)
            .input('IdEE', sql.Int, idEncarregado)
            .query(`
                SELECT estado FROM PEDIDO_COACHING
                WHERE id_pedido_coaching = @IdPedido AND UTILIZADORid_utilizador = @IdEE;
            `);

        if (check.recordset.length === 0) return 'nao_encontrado';
        return 'nao_pendente'; // Significa que encontrou mas o estado já é "Aprovado" ou "Rejeitado"
    } catch (error) {
        console.error('Erro no Modelo (cancelarPedidoPendenteEncarregado):', error);
        throw error;
    }
}

/**
 * Lista todos os pedidos pendentes submetidos direcionados a um Professor.
 */
async function getPedidosAtribuidosAoProfessor(idProfessor) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdProf', sql.Int, idProfessor)
            .query(`
                SELECT 
                    pc.id_pedido_coaching,
                    pc.data_aula_pretendida,
                    pc.hora_inicio_pretendida,
                    pc.formato_aula,
                    pc.duracao_minutos,
                    pc.estado,
                    pc.custo_estimado,
                    m.nome AS modalidade,
                    ee.nome AS encarregado,
                    ee.email AS email_encarregado
                FROM PEDIDO_COACHING pc
                JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador
                JOIN MODALIDADE m ON pc.MODALIDADEid_modalidade = m.id_modalidade
                WHERE pc.UTILIZADORid_utilizador2 = @IdProf
                ORDER BY pc.data_aula_pretendida ASC;
            `);

        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getPedidosAtribuidosAoProfessor):', error);
        throw error;
    }
}

/**
 * Filtro de pedidos atribuídos ao professor para um intervalo específico.
 */
async function getPedidosAtribuidosAoProfessorNoPeriodo(idProfessor, dataInicio, dataFim) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdProf', sql.Int, idProfessor)
            .input('DataInicio', sql.Date, dataInicio)
            .input('DataFim', sql.Date, dataFim)
            .query(`
                SELECT 
                    pc.id_pedido_coaching,
                    pc.data_aula_pretendida,
                    pc.hora_inicio_pretendida,
                    pc.formato_aula,
                    pc.duracao_minutos,
                    pc.estado,
                    pc.custo_estimado,
                    m.nome AS modalidade,
                    ee.nome AS encarregado,
                    ee.email AS email_encarregado
                FROM PEDIDO_COACHING pc
                JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador
                JOIN MODALIDADE m ON pc.MODALIDADEid_modalidade = m.id_modalidade
                WHERE pc.UTILIZADORid_utilizador2 = @IdProf
                  AND pc.estado = N'Pendente'
                  AND pc.data_aula_pretendida BETWEEN @DataInicio AND @DataFim
                ORDER BY pc.data_aula_pretendida ASC, pc.hora_inicio_pretendida ASC;
            `);

        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getPedidosAtribuidosAoProfessorNoPeriodo):', error);
        throw error;
    }
}

/**
 * Segurança: Confirma se o Coaching pertence verdadeiramente aos alunos de um EE específico.
 */
async function coachingPertenceAEncarregado(idCoaching, idEncarregado) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdCoaching', sql.Int, idCoaching)
            .input('IdEE', sql.Int, idEncarregado)
            .query(`
                SELECT 1 AS ok
                FROM COACHING c
                JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
                WHERE c.id_coaching = @IdCoaching
                  AND pc.UTILIZADORid_utilizador = @IdEE
                  AND c.estado <> 'Cancelado';
            `);

        return result.recordset.length > 0;
    } catch (error) {
        console.error('Erro no Modelo (coachingPertenceAEncarregado):', error);
        throw error;
    }
}

/**
 * Segurança: Confirma se o Professor autenticado é o titular daquele Coaching.
 */
async function coachingPertenceAProfessorAtivo(idCoaching, idProfessor) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdCoaching', sql.Int, idCoaching)
            .input('IdProf', sql.Int, idProfessor)
            .query(`
                SELECT 1 AS ok FROM COACHING
                WHERE id_coaching = @IdCoaching
                  AND UTILIZADORid_utilizador = @IdProf
                  AND estado NOT IN ('Cancelado');
            `);

        return result.recordset.length > 0;
    } catch (error) {
        console.error('Erro no Modelo (coachingPertenceAProfessorAtivo):', error);
        throw error;
    }
}
 
/**
 * Puxa todos os pedidos na plataforma que esperam aprovação e agendamento da Coordenação.
 */
async function getPedidosPendentes() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
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
                ee.nome AS requisitante,
                ee.email AS email_requisitante,
                prof.nome AS professor_desejado,
                COUNT(pcp.ALUNOid_aluno) AS total_alunos
            FROM PEDIDO_COACHING pc
            JOIN UTILIZADOR ee 
                ON pc.UTILIZADORid_utilizador = ee.id_utilizador
            LEFT JOIN UTILIZADOR prof 
                ON pc.UTILIZADORid_utilizador2 = prof.id_utilizador
            JOIN MODALIDADE m 
                ON pc.MODALIDADEid_modalidade = m.id_modalidade
            LEFT JOIN PEDIDO_COACHING_PARTICIPANTE pcp 
                ON pc.id_pedido_coaching = pcp.PEDIDO_COACHINGid_pedido_coaching
            WHERE pc.estado = 'Pendente'
            GROUP BY 
                pc.id_pedido_coaching,
                pc.MODALIDADEid_modalidade,
                pc.UTILIZADORid_utilizador2,
                pc.data_aula_pretendida,
                pc.hora_inicio_pretendida,
                pc.formato_aula,
                pc.duracao_minutos,
                pc.estado,
                pc.custo_estimado,
                m.nome,
                ee.nome,
                ee.email,
                prof.nome
            ORDER BY pc.data_aula_pretendida ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getPedidosPendentes):', error);
        throw error;
    }
}
 
// ============================================================================
// 4. APROVAÇÃO, REJEIÇÃO E AGENDAMENTO (US07, US08 / RF08, RF09, RF10)
// ============================================================================
 
/**
 * Aprova um pedido, cria a entidade Coaching e bloqueia os recursos (Professor/Sala).
 * É uma transação complexa com múltiplas restrições. Qualquer falha nas validações reverte os dados.
 */
async function aprovarEAgendarCoaching(dadosAgendamento) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        const mHora = String(dadosAgendamento.horaInicio || '').match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
        const horaInicioNorm = mHora ? `${mHora[1]}:${mHora[2]}:${mHora[3] || '00'}` : null;
        if (!horaInicioNorm) {
            throw new Error('Hora de início inválida no pedido.');
        }

        // Validação 1: O Professor designado sabe dar a modalidade do pedido?
        const compatProfModal = await transaction
            .request()
            .input('IdProfessor', sql.Int, dadosAgendamento.idProfessor)
            .input('IdModalidade', sql.Int, dadosAgendamento.idModalidade)
            .query(`
                SELECT 1 AS ok
                WHERE EXISTS (
                    SELECT 1
                    FROM UTILIZADOR u
                    JOIN UTILIZADOR_PERFIL up ON up.UTILIZADORid_utilizador = u.id_utilizador
                    JOIN PERFIL p ON p.id_perfil = up.PERFILid_perfil
                    WHERE u.id_utilizador = @IdProfessor
                      AND u.ativo = 1
                      AND p.nome LIKE '%Prof%'
                      AND EXISTS (
                          SELECT 1
                          FROM PROFESSOR_MODALIDADE pm
                          WHERE pm.UTILIZADORid_utilizador = u.id_utilizador
                            AND pm.MODALIDADEid_modalidade = @IdModalidade
                      )
                );
            `);

        if (compatProfModal.recordset.length === 0) {
            throw new Error('Compatibilidade inválida: professor não leciona esta modalidade.');
        }

        // Validação 2: A Sala escolhida possui o material para a modalidade pretendida?
        const compatSalaModal = await transaction
            .request()
            .input('IdSala', sql.Int, dadosAgendamento.idSala)
            .input('IdModalidade', sql.Int, dadosAgendamento.idModalidade)
            .query(`
                SELECT 1 AS ok
                FROM SALA_MODALIDADE
                WHERE SALAid_sala = @IdSala
                  AND MODALIDADEid_modalidade = @IdModalidade;
            `);

        if (compatSalaModal.recordset.length === 0) {
            throw new Error('Compatibilidade inválida: sala não compatível com a modalidade escolhida.');
        }

        // Validação 3: A sala comporta fisicamente o número de alunos?
        const capacidadeSala = await transaction
            .request()
            .input('IdSala', sql.Int, dadosAgendamento.idSala)
            .query(`
                SELECT capacidade_maxima
                FROM SALA
                WHERE id_sala = @IdSala;
            `);
        const capacidadeMax = Number(capacidadeSala.recordset[0]?.capacidade_maxima);
        if (!Number.isFinite(capacidadeMax)) {
            throw new Error('Sala inválida: capacidade máxima não definida.');
        }
        if (Number(dadosAgendamento.numeroParticipantes) > capacidadeMax) {
            throw new Error('Capacidade inválida: número de participantes excede a lotação da sala.');
        }

        // Validações Temporais de Colisão (Professor e Sala)
        const conflitoProf = await existeConflitoCoachingProfessor(transaction, {
            idProfessor: dadosAgendamento.idProfessor,
            dataAula: dadosAgendamento.dataAula,
            horaInicio: horaInicioNorm,
            duracaoMinutos: dadosAgendamento.duracaoMinutos
        });
        if (conflitoProf) throw new Error('Conflito de horário: o professor já tem um coaching agendado neste horário.');
 
        const conflitoSala = await existeConflitoCoachingSala(transaction, {
            idSala: dadosAgendamento.idSala,
            dataAula: dadosAgendamento.dataAula,
            horaInicio: horaInicioNorm,
            duracaoMinutos: dadosAgendamento.duracaoMinutos
        });
        if (conflitoSala) throw new Error('Conflito de sala: a sala já está ocupada neste horário com outro coaching.');

        const conflitoHorarioProf = await existeConflitoHorarioProfessor(transaction, {
            idProfessor: dadosAgendamento.idProfessor,
            diaSemana: dadosAgendamento.diaSemanaCoaching,
            horaInicio: horaInicioNorm,
            duracaoMinutos: dadosAgendamento.duracaoMinutos
        });
        if (conflitoHorarioProf) throw new Error('Conflito com aula regular: o professor já tem uma aula marcada neste horário.');

        const conflitoHorarioSala = await existeConflitoHorarioSala(transaction, {
            idSala: dadosAgendamento.idSala,
            diaSemana: dadosAgendamento.diaSemanaCoaching,
            horaInicio: horaInicioNorm,
            duracaoMinutos: dadosAgendamento.duracaoMinutos
        });
        if (conflitoHorarioSala) throw new Error('Conflito com aula regular: a sala já está ocupada neste horário.');
 
        // PASSO FINAL 1: Atualizar o estado do Pedido Original
        await transaction.request()
            .input('IdPedido', sql.Int, dadosAgendamento.idPedido)
            .query(`UPDATE PEDIDO_COACHING SET estado = 'Aprovado' WHERE id_pedido_coaching = @IdPedido;`);
 
        // PASSO FINAL 2: Inserir a Aula formal (Coaching)
        const idCoachingFinal = await transaction.request()
            .input('Formato', sql.VarChar(50), dadosAgendamento.formatoAula)
            .input('Duracao', sql.Int, dadosAgendamento.duracaoMinutos)
            .input('NumParticipantes', sql.Int, dadosAgendamento.numeroParticipantes)
            .input('DataAula', sql.Date, dadosAgendamento.dataAula)
            .input('HoraInicio', sql.VarChar(8), horaInicioNorm)
            .input('IdProfessor', sql.Int, dadosAgendamento.idProfessor)
            .input('IdAnoLetivo', sql.Int, dadosAgendamento.idAnoLetivo)
            .input('IdModalidade', sql.Int, dadosAgendamento.idModalidade)
            .input('IdSala', sql.Int, dadosAgendamento.idSala)
            .input('IdPedido', sql.Int, dadosAgendamento.idPedido)
            .input('ValorFinal', sql.Decimal(10, 2), dadosAgendamento.valorFinal)
            .query(`
                INSERT INTO COACHING (
                    formato_aula, duracao_minutos, numero_participantes, data_aula, 
                    hora_inicio, estado, UTILIZADORid_utilizador, ANO_LETIVOid_ano_letivo, 
                    MODALIDADEid_modalidade, SALAid_sala, PEDIDO_COACHINGid_pedido_coaching, valor_final
                )
                OUTPUT INSERTED.id_coaching
                VALUES (
                    @Formato, @Duracao, @NumParticipantes, @DataAula, 
                    TRY_CONVERT(time, @HoraInicio), 'Agendado', @IdProfessor, @IdAnoLetivo, 
                    @IdModalidade, @IdSala, @IdPedido, @ValorFinal
                );
            `)
            .then(r => r.recordset[0].id_coaching);
 
        // PASSO FINAL 3: Preparar o histórico de validação para quando a aula terminar
        await transaction.request()
            .input('IdValidador', sql.Int, dadosAgendamento.idValidador)
            .input('IdCoaching', sql.Int, idCoachingFinal)
            .query(`
                INSERT INTO VALIDACAO_COACHING (
                    tipo_validador, estado_validacao, data_validacao, 
                    UTILIZADORid_utilizador, COACHINGid_coaching
                )
                VALUES ('Coordenacao', 'Aguarda_Confirmacao', GETDATE(), @IdValidador, @IdCoaching);
            `);
 
        await transaction.commit(); // Tudo válido, guardamos na BD.
        return idCoachingFinal;
    } catch (error) {
        await transaction.rollback(); // Qualquer conflito aciona a reversão
        console.error('Erro no Modelo Transacional (aprovarEAgendarCoaching):', error);
        throw error;
    }
}

// ============================================================================
// 4.x. UTILITÁRIOS — VALIDAR SLOT LIVRE (Professor) (US08 / RF10)
// ============================================================================

/**
 * Validação simples se o professor configurou que trabalha àquela hora.
 */
async function professorTemDisponibilidadeNoSlot({ idProfessor, dataAula, horaInicio, duracaoMinutos, diaSemanaCoaching }) {
    try {
        const pool = await poolPromise;

        const mHora = String(horaInicio || '').match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
        const horaInicioNorm = mHora ? `${mHora[1]}:${mHora[2]}:${mHora[3] || '00'}` : null;
        if (!horaInicioNorm) return false;

        const diaSemanaReal = diaSemanaHorarioDeData(dataAula, diaSemanaCoaching);
        const diaSemanaDisponibilidade = diaSemanaDisponibilidadeDeDiaReal(diaSemanaReal);
        if (!diaSemanaDisponibilidade) return false;

        const r = await pool.request()
            .input('IdProfessor', sql.Int, idProfessor)
            .input('DiaSemana', sql.Int, diaSemanaDisponibilidade)
            .input('HoraInicio', sql.VarChar(8), horaInicioNorm)
            .input('Duracao', sql.Int, Number(duracaoMinutos))
            .query(`
                SELECT TOP 1 1 AS ok
                FROM DISPONIBILIDADE_PROFESSOR
                WHERE UTILIZADORid_utilizador = @IdProfessor
                  AND dia_semana = @DiaSemana
                  AND hora_inicio <= TRY_CONVERT(time, @HoraInicio)
                  AND hora_fim >= CAST(
                        DATEADD(MINUTE, @Duracao, CAST(TRY_CONVERT(time, @HoraInicio) AS datetime))
                      AS time
                  );
            `);

        return r.recordset.length > 0;
    } catch (error) {
        console.error('Erro no Modelo (professorTemDisponibilidadeNoSlot):', error);
        throw error;
    }
}

/**
 * Verifica não só a disponibilidade, mas atesta efetivamente a inexistência de sobreposição.
 */
async function verificarSlotLivreProfessor({ idProfessor, dataAula, horaInicio, duracaoMinutos, diaSemanaCoaching }) {
    try {
        const pool = await poolPromise;

        const horaInicioNorm = normalizarHoraSql(horaInicio);
        if (!horaInicioNorm) {
            return { livre: false, motivo: 'Hora de início inválida.' };
        }

        const conflitoProf = await existeConflitoCoachingProfessor(pool, {
            idProfessor,
            dataAula,
            horaInicio: horaInicioNorm,
            duracaoMinutos
        });
        if (conflitoProf) {
            return { livre: false, motivo: 'Conflito de horário: o professor já tem um coaching agendado neste horário.' };
        }

        const conflitoHorarioProf = await existeConflitoHorarioProfessor(pool, {
            idProfessor,
            diaSemana: diaSemanaCoaching,
            horaInicio: horaInicioNorm,
            duracaoMinutos
        });
        if (conflitoHorarioProf) {
            return { livre: false, motivo: 'Conflito com aula regular: o professor já tem uma aula marcada neste horário.' };
        }

        return { livre: true, motivo: null };
    } catch (error) {
        console.error('Erro no Modelo (verificarSlotLivreProfessor):', error);
        throw error;
    }
}
 
/**
 * Extrai dados puros de um Pedido Pendente pelo seu ID (útil para popular o ecrã de aprovação).
 */
async function getPedidoCoachingPorId(idPedido) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdPedido', sql.Int, idPedido)
            .query(`
                SELECT 
                    id_pedido_coaching,
                    formato_aula,
                    duracao_minutos,
                    numero_participantes,
                    data_aula_pretendida,
                    hora_inicio_pretendida,
                    estado,
                    custo_estimado,
                    UTILIZADORid_utilizador,
                    ANO_LETIVOid_ano_letivo,
                    MODALIDADEid_modalidade,
                    UTILIZADORid_utilizador2
                FROM PEDIDO_COACHING
                WHERE id_pedido_coaching = @IdPedido;
            `);

        return result.recordset[0] || null;
    } catch (error) {
        console.error('Erro no Modelo (getPedidoCoachingPorId):', error);
        throw error;
    }
}

/**
 * Rejeita explicitamente um pedido.
 */
async function rejeitarPedidoCoaching(idPedido) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('IdPedido', sql.Int, idPedido)
            .query(`
                UPDATE PEDIDO_COACHING 
                SET estado = 'Rejeitado'
                WHERE id_pedido_coaching = @IdPedido 
                  AND estado = 'Pendente';
            `);

        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (rejeitarPedidoCoaching):', error);
        throw error;
    }
}
 
// ============================================================================
// 5. CANCELAMENTOS (US12 / RF14)
// ============================================================================

/**
 * Obtém rapidamente os dados críticos de um coaching (para verificar se é válido para cancelar temporalmente).
 */
async function getCoachingCabecalhoCancelamento(idCoaching) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`
                SELECT data_aula, hora_inicio, duracao_minutos, estado
                FROM COACHING
                WHERE id_coaching = @IdCoaching;
            `);

        return result.recordset[0] || null;
    } catch (error) {
        console.error('Erro no Modelo (getCoachingCabecalhoCancelamento):', error);
        throw error;
    }
}
 
/**
 * Cancela um Agendamento formal (Coaching) e reverte também o seu Pedido associado (Transação).
 */
async function cancelarCoaching(idCoaching) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        const pedidoResult = await transaction.request()
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`
                SELECT PEDIDO_COACHINGid_pedido_coaching AS id_pedido, estado 
                FROM COACHING 
                WHERE id_coaching = @IdCoaching;
            `);
 
        if (pedidoResult.recordset.length === 0) {
            throw new Error('Coaching não encontrado.');
        }
 
        const { estado, id_pedido } = pedidoResult.recordset[0];
 
        if (estado === 'Cancelado') {
            throw new Error('Este coaching já está cancelado.');
        }
 
        await transaction.request()
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`UPDATE COACHING SET estado = 'Cancelado' WHERE id_coaching = @IdCoaching;`);
 
        await transaction.request()
            .input('IdPedido', sql.Int, id_pedido)
            .query(`UPDATE PEDIDO_COACHING SET estado = 'Cancelado' WHERE id_pedido_coaching = @IdPedido;`);
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (cancelarCoaching):', error);
        throw error;
    }
}
 
// ============================================================================
// 6. VALIDAÇÃO PÓS-AULA (US13, US14 / RF15, RF16)
// ============================================================================
 
/**
 * Regista no histórico a declaração de um Professor ou EE sobre a realização ou não da aula.
 */
async function registarValidacaoAula(idCoaching, idUtilizador, tipoValidador, estadoValidacao, observacoes = null) {
    try {
        const pool = await poolPromise;
        const dup = await pool
            .request()
            .input('IdCoaching', sql.Int, idCoaching)
            .input('TipoValidador', sql.VarChar(50), tipoValidador)
            .query(`
                SELECT 1 AS ok FROM VALIDACAO_COACHING
                WHERE COACHINGid_coaching = @IdCoaching
                  AND tipo_validador = @TipoValidador
                  AND estado_validacao IN ('Confirmado', 'Nao_Realizado');
            `);

        if (dup.recordset.length > 0) {
            throw new Error('Já existe validação deste tipo para este coaching.');
        }

        const result = await pool.request()
            .input('TipoValidador', sql.VarChar(50), tipoValidador)
            .input('EstadoValidacao', sql.VarChar(50), estadoValidacao)
            .input('Observacoes', sql.VarChar(255), observacoes)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`
                INSERT INTO VALIDACAO_COACHING (
                    tipo_validador, estado_validacao, data_validacao, 
                    observacoes, UTILIZADORid_utilizador, COACHINGid_coaching
                )
                VALUES (
                    @TipoValidador, @EstadoValidacao, GETDATE(), 
                    @Observacoes, @IdUtilizador, @IdCoaching
                );
            `);

        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (registarValidacaoAula):', error);
        throw error;
    }
}
 
/**
 * Ponto Final: A Coordenação analisa as validações e decreta na Base de Dados se a Aula foi Realizada (Faturável)
 * ou se falhou (Nao_Realizado). Transação atómica.
 */
async function concluirCoachingPelaCoordenacao(idCoaching, idCoordenador, estadoFinal, observacoes) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        const existe = await transaction.request()
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`SELECT id_coaching FROM COACHING WHERE id_coaching = @IdCoaching;`);

        if (existe.recordset.length === 0) {
            throw new Error('Coaching não encontrado.');
        }

        // Registo da ação de fecho na tabela de log (VALIDACAO_COACHING)
        await transaction.request()
            .input('Observacoes', sql.VarChar(255), observacoes || 'Validado pela coordenação.')
            .input('IdCoordenador', sql.Int, idCoordenador)
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`
                INSERT INTO VALIDACAO_COACHING (
                    tipo_validador, estado_validacao, data_validacao, observacoes, 
                    UTILIZADORid_utilizador, COACHINGid_coaching
                )
                VALUES (
                    'Coordenacao', 'Aprovacao_Final', GETDATE(), @Observacoes, 
                    @IdCoordenador, @IdCoaching
                );
            `);
 
        // Alteração definitiva do estado no cabeçalho
        const upd = await transaction.request()
            .input('EstadoFinal', sql.VarChar(50), estadoFinal)
            .input('IdCoaching', sql.Int, idCoaching)
            .query(`UPDATE COACHING SET estado = @EstadoFinal WHERE id_coaching = @IdCoaching;`);

        if (!upd.rowsAffected[0]) {
            throw new Error('Coaching não encontrado.');
        }
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (concluirCoachingPelaCoordenacao):', error);
        throw error;
    }
}

/**
 * Filtra aulas agendadas (no passado) que aguardam a decisão e validação final.
 */
async function listarCoachingsAbertosParaCoordenacao() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT
                c.id_coaching,
                c.data_aula,
                c.hora_inicio,
                c.duracao_minutos,
                c.estado,
                c.formato_aula,
                m.nome AS modalidade,
                prof.nome AS nome_professor,
                ee.nome AS nome_encarregado,
                ee.email AS email_encarregado
            FROM COACHING c
            JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
            JOIN UTILIZADOR prof ON c.UTILIZADORid_utilizador = prof.id_utilizador
            JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
            JOIN UTILIZADOR ee ON pc.UTILIZADORid_utilizador = ee.id_utilizador
            WHERE c.estado IN (N'Agendado', N'Confirmado')
            ORDER BY c.data_aula ASC, c.hora_inicio ASC;
        `);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (listarCoachingsAbertosParaCoordenacao):', error);
        throw error;
    }
}

// Exportação Geral
module.exports = {
    adicionarDisponibilidadeProfessor,
    getDisponibilidadesProfessor,
    removerDisponibilidadeProfessor,
    getDisponibilidadeEfetiva,
    getAgendaProfessor,
    criarPedidoCoaching,
    getPedidosPorEncarregado,
    cancelarPedidoPendenteEncarregado,
    getPedidosAtribuidosAoProfessor,
    getPedidosAtribuidosAoProfessorNoPeriodo,
    coachingPertenceAProfessorAtivo,
    coachingPertenceAEncarregado,
    getCoachingCabecalhoCancelamento,
    getPedidosPendentes,
    getPedidoCoachingPorId,
    aprovarEAgendarCoaching,
    professorTemDisponibilidadeNoSlot,
    verificarSlotLivreProfessor,
    rejeitarPedidoCoaching,
    cancelarCoaching,
    registarValidacaoAula,
    concluirCoachingPelaCoordenacao,
    listarCoachingsAbertosParaCoordenacao
};