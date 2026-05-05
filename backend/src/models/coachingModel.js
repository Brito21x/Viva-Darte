const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. GESTÃO DE DISPONIBILIDADES DOS PROFESSORES (US09 / RF11)
// ============================================================================
 
/**
 * Adiciona um bloco de disponibilidade para um professor.
 */
async function adicionarDisponibilidadeProfessor({ diaSemana, horaInicio, horaFim, idProfessor }) {
    try {
        const pool = await poolPromise;
 
        // Validar que hora_fim é posterior a hora_inicio
        if (horaFim <= horaInicio) {
            throw new Error('A hora de fim deve ser posterior à hora de início.');
        }
 
        // Verificar sobreposição de disponibilidades do mesmo professor no mesmo dia
        const conflito = await pool.request()
            .input('IdProfessor', sql.Int, idProfessor)
            .input('DiaSemana', sql.Int, diaSemana)
            .input('HoraInicio', sql.Time, horaInicio)
            .input('HoraFim', sql.Time, horaFim)
            .query(`
                SELECT 1 FROM DISPONIBILIDADE_PROFESSOR
                WHERE UTILIZADORid_utilizador = @IdProfessor
                  AND dia_semana = @DiaSemana
                  AND hora_inicio < @HoraFim
                  AND hora_fim > @HoraInicio;
            `);
 
        if (conflito.recordset.length > 0) {
            throw new Error('Já existe uma disponibilidade que se sobrepõe a este horário.');
        }
 
        const result = await pool.request()
            .input('DiaSemana', sql.Int, diaSemana)
            .input('HoraInicio', sql.Time, horaInicio)
            .input('HoraFim', sql.Time, horaFim)
            .input('IdProfessor', sql.Int, idProfessor)
            .query(`
                INSERT INTO DISPONIBILIDADE_PROFESSOR 
                    (dia_semana, hora_inicio, hora_fim, UTILIZADORid_utilizador)
                VALUES 
                    (@DiaSemana, @HoraInicio, @HoraFim, @IdProfessor);
            `);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (adicionarDisponibilidadeProfessor):', error);
        throw error;
    }
}
 
/**
 * Lista todas as disponibilidades de um professor para que ele as possa consultar e editar.
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
 * Remove um bloco de disponibilidade de um professor.
 */
async function removerDisponibilidadeProfessor(idDisponibilidade, idProfessor) {
    try {
        const pool = await poolPromise;
        // O idProfessor garante que um professor só pode remover as suas próprias disponibilidades
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
 * Retorna as disponibilidades teóricas dos professores para uma modalidade/dia,
 * cruzando com as ocupações reais (coachings já agendados e aulas regulares) nessa data.
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

        let idAnoFiltro =
            idAnoLetivo != null && idAnoLetivo !== '' ? parseInt(idAnoLetivo, 10) : null;
        if (Number.isNaN(idAnoFiltro)) idAnoFiltro = null;
        if (idAnoFiltro == null) {
            const anoR = await pool.request().query(`
                SELECT TOP 1 id_ano_letivo AS id FROM ANO_LETIVO ORDER BY id_ano_letivo DESC;
            `);
            idAnoFiltro = anoR.recordset[0]?.id ?? null;
        }

        // HORARIO.dia_semana usa escala 1=Seg … 7=Dom; DISPONIBILIDADE_PROFESSOR usa 1=Seg–Qui, 2=Sáb–Dom.
        let diaSemanaHorario = diaSemana;
        if (dataEspecifica != null && dataEspecifica !== '') {
            const s = String(dataEspecifica).split(/[-T]/);
            const y = parseInt(s[0], 10);
            const mo = parseInt(s[1], 10);
            const da = parseInt(s[2], 10);
            if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(da)) {
                const d = new Date(y, mo - 1, da);
                const day = d.getDay();
                diaSemanaHorario = day === 0 ? 7 : day;
            }
        }
 
        // 1. Disponibilidades teóricas dos professores (RF04: filtro opcional por professor)
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
                JOIN UTILIZADOR u 
                    ON dp.UTILIZADORid_utilizador = u.id_utilizador
                JOIN UTILIZADOR_PERFIL up 
                    ON up.UTILIZADORid_utilizador = u.id_utilizador
                JOIN PERFIL p 
                    ON p.id_perfil = up.PERFILid_perfil
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
 
        // 2. Ocupações reais (coachings agendados/confirmados)
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
                  ${idAnoFiltro != null ? 'AND c.ANO_LETIVOid_ano_letivo = @IdAnoLetivo' : ''};
            `);

        // 3. Ocupações regulares (aulas normais do HORARIO) para o dia da semana
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
 
        return {
            disponibilidades: resultDisponibilidade.recordset,
            ocupacoes: [
                ...resultOcupacao.recordset,
                ...resultOcupacaoHorario.recordset // Junta as duas tabelas de ocupação
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
 * Retorna a agenda de coachings de um professor, com filtro opcional por data.
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
 * RF05 — Garante que cada aluno está ligado ao encarregado em ENCARREGADO_ALUNO e activo em ALUNO.
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
 * Cria um pedido de coaching e os seus participantes numa transação.
 */
async function criarPedidoCoaching(dadosPedido, alunosIds) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        const idsUnicos = [
            ...new Set(alunosIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))
        ];
        if (idsUnicos.length === 0) {
            const e = new Error('Indica pelo menos um aluno com identificador válido.');
            e.isOperational = true;
            throw e;
        }

        await assertAlunosPertencemAoEncarregado(transaction, dadosPedido.idEncarregado, idsUnicos);

        const idPedido = await transaction.request()
            .input('Formato', sql.VarChar(50), dadosPedido.formatoAula)
            .input('Duracao', sql.Int, dadosPedido.duracaoMinutos)
            .input('NumParticipantes', sql.Int, idsUnicos.length)
            .input('DataAula', sql.Date, dadosPedido.dataAula)
            .input('HoraInicio', sql.Time, dadosPedido.horaInicio)
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
                    GETDATE(), @DataAula, @HoraInicio, 
                    'Pendente', @CustoEstimado, @IdEncarregado, 
                    @IdAnoLetivo, @IdModalidade, @IdProfessor
                );
            `)
            .then(r => r.recordset[0].id_pedido_coaching);
 
        for (const idAluno of idsUnicos) {
            await transaction.request()
                .input('IdAluno', sql.Int, idAluno)
                .input('IdPedido', sql.Int, idPedido)
                .input('HoraInicio', sql.Time, dadosPedido.horaInicio)
                .query(`
                    INSERT INTO PEDIDO_COACHING_PARTICIPANTE 
                        (ALUNOid_aluno, PEDIDO_COACHINGid_pedido_coaching, PEDIDO_COACHINGhora_inicio_pretendida)
                    VALUES (@IdAluno, @IdPedido, @HoraInicio);
                `);
        }
 
        await transaction.commit();
        return idPedido;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (criarPedidoCoaching):', error);
        throw error;
    }
}

/**
 * Pedidos de coaching criados por um encarregado.
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
 * Cancela um pedido pendente do próprio encarregado.
 * @returns {'cancelado'|'nao_encontrado'|'nao_pendente'}
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
        return 'nao_pendente';
    } catch (error) {
        console.error('Erro no Modelo (cancelarPedidoPendenteEncarregado):', error);
        throw error;
    }
}

/**
 * Pedidos em que o utilizador é o professor indicado.
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
 * True se o coaching existe, o professor é o titular e não está cancelado.
 */
/**
 * True se o coaching está associado a um pedido do encarregado indicado (não cancelado).
 * US12 / RF14 — EE só cancela as suas marcações.
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
 * Lista todos os pedidos pendentes para a Coordenação tratar.
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
 * Aprova um pedido, cria o coaching e bloqueia o horário/sala numa transação.
 * Inclui validação de conflitos (COACHING e HORARIO) antes de inserir.
 */
async function aprovarEAgendarCoaching(dadosAgendamento) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // RF10: Compatibilidade Professor ↔ Modalidade
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

        // RF10: Compatibilidade Sala ↔ Modalidade
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

        // RF10: Capacidade da sala vs participantes
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

        // RF10: Verificar conflito de horário no COACHING — professor
        const conflitoProf = await transaction.request()
            .input('IdProfessor', sql.Int, dadosAgendamento.idProfessor)
            .input('DataAula', sql.Date, dadosAgendamento.dataAula)
            .input('HoraInicio', sql.Time, dadosAgendamento.horaInicio)
            .input('Duracao', sql.Int, dadosAgendamento.duracaoMinutos)
            .query(`
                SELECT 1 FROM COACHING
                WHERE UTILIZADORid_utilizador = @IdProfessor
                  AND data_aula = @DataAula
                  AND estado IN ('Agendado', 'Confirmado')
                  AND hora_inicio < DATEADD(MINUTE, @Duracao, CAST(@HoraInicio AS DATETIME))
                  AND DATEADD(MINUTE, duracao_minutos, CAST(hora_inicio AS DATETIME)) > CAST(@HoraInicio AS DATETIME);
            `);
 
        if (conflitoProf.recordset.length > 0) {
            throw new Error('Conflito de horário: o professor já tem um coaching agendado neste horário.');
        }
 
        // RF10: Verificar conflito de sala no COACHING
        const conflitoSala = await transaction.request()
            .input('IdSala', sql.Int, dadosAgendamento.idSala)
            .input('DataAula', sql.Date, dadosAgendamento.dataAula)
            .input('HoraInicio', sql.Time, dadosAgendamento.horaInicio)
            .input('Duracao', sql.Int, dadosAgendamento.duracaoMinutos)
            .query(`
                SELECT 1 FROM COACHING
                WHERE SALAid_sala = @IdSala
                  AND data_aula = @DataAula
                  AND estado IN ('Agendado', 'Confirmado')
                  AND hora_inicio < DATEADD(MINUTE, @Duracao, CAST(@HoraInicio AS DATETIME))
                  AND DATEADD(MINUTE, duracao_minutos, CAST(hora_inicio AS DATETIME)) > CAST(@HoraInicio AS DATETIME);
            `);
 
        if (conflitoSala.recordset.length > 0) {
            throw new Error('Conflito de sala: a sala já está ocupada neste horário com outro coaching.');
        }

        // RF10: Verificar conflito com HORARIO regular — Professor
        const conflitoHorarioProf = await transaction.request()
            .input('IdProfessor', sql.Int, dadosAgendamento.idProfessor)
            .input('DiaSemana', sql.Int, dadosAgendamento.diaSemanaCoaching) // Requer cálculo prévio no Controller
            .input('HoraInicio', sql.Time, dadosAgendamento.horaInicio)
            .input('Duracao', sql.Int, dadosAgendamento.duracaoMinutos)
            .query(`
                SELECT 1 FROM HORARIO
                WHERE UTILIZADORid_utilizador = @IdProfessor
                  AND dia_semana = @DiaSemana
                  AND ativo = 1
                  AND hora_inicio < DATEADD(MINUTE, @Duracao, CAST(@HoraInicio AS DATETIME))
                  AND hora_fim > CAST(@HoraInicio AS DATETIME);
            `);

        if (conflitoHorarioProf.recordset.length > 0) {
            throw new Error('Conflito com aula regular: o professor já tem uma aula marcada neste horário.');
        }

        // RF10: Verificar conflito com HORARIO regular — Sala
        const conflitoHorarioSala = await transaction.request()
            .input('IdSala', sql.Int, dadosAgendamento.idSala)
            .input('DiaSemana', sql.Int, dadosAgendamento.diaSemanaCoaching) // Requer cálculo prévio no Controller
            .input('HoraInicio', sql.Time, dadosAgendamento.horaInicio)
            .input('Duracao', sql.Int, dadosAgendamento.duracaoMinutos)
            .query(`
                SELECT 1 FROM HORARIO
                WHERE SALAid_sala = @IdSala
                  AND dia_semana = @DiaSemana
                  AND ativo = 1
                  AND hora_inicio < DATEADD(MINUTE, @Duracao, CAST(@HoraInicio AS DATETIME))
                  AND hora_fim > CAST(@HoraInicio AS DATETIME);
            `);

        if (conflitoHorarioSala.recordset.length > 0) {
            throw new Error('Conflito com aula regular: a sala já está ocupada neste horário.');
        }
 
        // Atualizar o pedido para Aprovado
        await transaction.request()
            .input('IdPedido', sql.Int, dadosAgendamento.idPedido)
            .query(`UPDATE PEDIDO_COACHING SET estado = 'Aprovado' WHERE id_pedido_coaching = @IdPedido;`);
 
        // Criar o coaching
        const idCoachingFinal = await transaction.request()
            .input('Formato', sql.VarChar(50), dadosAgendamento.formatoAula)
            .input('Duracao', sql.Int, dadosAgendamento.duracaoMinutos)
            .input('NumParticipantes', sql.Int, dadosAgendamento.numeroParticipantes)
            .input('DataAula', sql.Date, dadosAgendamento.dataAula)
            .input('HoraInicio', sql.Time, dadosAgendamento.horaInicio)
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
                    @HoraInicio, 'Agendado', @IdProfessor, @IdAnoLetivo, 
                    @IdModalidade, @IdSala, @IdPedido, @ValorFinal
                );
            `)
            .then(r => r.recordset[0].id_coaching);
 
        // Inicia o registo de validação pós-aula
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
 
        await transaction.commit();
        return idCoachingFinal;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (aprovarEAgendarCoaching):', error);
        throw error;
    }
}
 
/**
 * Carrega um pedido de coaching por id (dados para aprovação / consulta).
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
 * Rejeita um pedido de coaching (estado → Rejeitado).
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
 * Dados mínimos do coaching para validação de cancelamento (data/hora, estado).
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
 * Cancela um coaching e atualiza o pedido associado.
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
 * Regista a confirmação de realização pelo Professor ou pelo EE.
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
 * A Coordenação valida a conclusão final do coaching e resolve divergências.
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
    coachingPertenceAProfessorAtivo,
    coachingPertenceAEncarregado,
    getCoachingCabecalhoCancelamento,
    getPedidosPendentes,
    getPedidoCoachingPorId,
    aprovarEAgendarCoaching,
    rejeitarPedidoCoaching,
    cancelarCoaching,
    registarValidacaoAula,
    concluirCoachingPelaCoordenacao
};