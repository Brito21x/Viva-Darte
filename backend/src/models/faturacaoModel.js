const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. TABELA DE PREÇOS (US15 / RF17)
// ============================================================================
 
/** Retorna toda a tabela de preços ativa (sem colunas de exceção por modalidade/professor na BD atual). */
async function getTabelaPrecos() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                tp.id_preco,
                tp.formato_aula,
                tp.duracao_minutos,
                tp.dia_semana,
                tp.preco,
                tp.ativo,
                CAST(NULL AS int) AS id_modalidade,
                CAST(NULL AS int) AS id_professor_excecao,
                CAST(NULL AS varchar(255)) AS modalidade_excecao,
                CAST(NULL AS varchar(255)) AS professor_excecao
            FROM TABELA_PRECO tp
            WHERE tp.ativo = 1
            ORDER BY tp.dia_semana ASC, tp.duracao_minutos ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getTabelaPrecos):', error);
        throw error;
    }
}
 
/**
 * Calcula o custo de um coaching com base no formato, duração e dia.
 * idModalidade / idProfessor são ignorados na BD atual (TABELA_PRECO sem essas colunas).
 */
async function calcularCustoAutomatico(formato, duracao, diaSemana, idModalidade, idProfessor) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT TOP 1 preco
            FROM TABELA_PRECO
            WHERE formato_aula = @Formato
              AND duracao_minutos = @Duracao
              AND dia_semana = @DiaSemana
              AND ativo = 1;
        `;

        const result = await pool.request()
            .input('Formato', sql.VarChar(50), formato)
            .input('Duracao', sql.Int, duracao)
            .input('DiaSemana', sql.Int, diaSemana)
            .query(query);
 
        return result.recordset[0]?.preco || null;
    } catch (error) {
        console.error('Erro no Modelo (calcularCustoAutomatico):', error);
        throw error;
    }
}
 
/** Cria linha na tabela de preços (US15 / RF17). */
async function criarRegistoPreco(dados) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('Formato', sql.VarChar(50), dados.formatoAula)
            .input('Duracao', sql.Int, dados.duracaoMinutos)
            .input('DiaSemana', sql.Int, dados.diaSemana)
            .input('Preco', sql.Decimal(10, 2), dados.preco)
            .input('Ativo', sql.Bit, dados.ativo !== false ? 1 : 0)
            .query(`
                INSERT INTO TABELA_PRECO (
                    formato_aula, duracao_minutos, dia_semana, preco, ativo
                )
                OUTPUT INSERTED.id_preco
                VALUES (
                    @Formato, @Duracao, @DiaSemana, @Preco, @Ativo
                );
            `);

        return result.recordset[0].id_preco;
    } catch (error) {
        console.error('Erro no Modelo (criarRegistoPreco):', error);
        throw error;
    }
}

/**
 * Atualiza um registo de preço (US15 / RF17).
 */
async function atualizarRegistoPreco(idPreco, dados) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdPreco', sql.Int, idPreco)
            .input('Formato', sql.VarChar(50), dados.formatoAula)
            .input('Duracao', sql.Int, dados.duracaoMinutos)
            .input('DiaSemana', sql.Int, dados.diaSemana)
            .input('Preco', sql.Decimal(10, 2), dados.preco)
            .input('Ativo', sql.Bit, dados.ativo !== false ? 1 : 0)
            .query(`
                UPDATE TABELA_PRECO
                SET formato_aula = @Formato,
                    duracao_minutos = @Duracao,
                    dia_semana = @DiaSemana,
                    preco = @Preco,
                    ativo = @Ativo
                WHERE id_preco = @IdPreco;
            `);

        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (atualizarRegistoPreco):', error);
        throw error;
    }
}

/** Desativa um preço (mantém histórico; US15 / RF17). */
async function desativarRegistoPreco(idPreco) {
    try {
        const pool = await poolPromise;
        const result = await pool
            .request()
            .input('IdPreco', sql.Int, idPreco)
            .query(`UPDATE TABELA_PRECO SET ativo = 0 WHERE id_preco = @IdPreco;`);

        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (desativarRegistoPreco):', error);
        throw error;
    }
}

// ============================================================================
// 2. GERAÇÃO DE FATURAÇÃO MENSAL (US17 / RF18)
// ============================================================================
 
/**
 * Calcula o total de coachings realizados e empréstimos ativos de um EE num dado mês/ano
 * e cria o registo de faturação. Protegido contra duplicados.
 */
async function gerarFaturacaoMensal(mes, ano, idUtilizador, idAnoLetivo) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Verificar se já existe fatura para este utilizador/mês/ano (evitar duplicados)
        const faturaExiste = await transaction.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('Mes', sql.Int, mes)
            .input('Ano', sql.Int, ano)
            .query(`
                SELECT id_faturacao FROM FATURACAO_MENSAL 
                WHERE UTILIZADORid_utilizador = @IdUtilizador 
                  AND mes = @Mes AND ano = @Ano;
            `);
 
        if (faturaExiste.recordset.length > 0) {
            throw new Error('Já existe uma fatura gerada para este utilizador neste período.');
        }
 
        // Total de coachings realizados em nome do EE naquele mês
        // UTILIZADORid_utilizador no PEDIDO_COACHING é o Encarregado de Educação
        const resultCoachings = await transaction.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('Mes', sql.Int, mes)
            .input('Ano', sql.Int, ano)
            .query(`
                SELECT ISNULL(SUM(c.valor_final), 0) AS total
                FROM COACHING c 
                JOIN PEDIDO_COACHING pc 
                    ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching 
                WHERE pc.UTILIZADORid_utilizador = @IdUtilizador 
                  AND MONTH(c.data_aula) = @Mes 
                  AND YEAR(c.data_aula) = @Ano 
                  AND c.estado = 'Realizado';
            `);
 
        // Total de empréstimos do utilizador naquele mês (pela data do pedido)
        const resultEmprestimos = await transaction.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('Mes', sql.Int, mes)
            .input('Ano', sql.Int, ano)
            .query(`
                SELECT ISNULL(SUM(ISNULL(e.valor, 0)), 0) AS total
                FROM EMPRESTIMO e 
                WHERE e.UTILIZADORid_utilizador = @IdUtilizador 
                  AND MONTH(e.data_pedido) = @Mes 
                  AND YEAR(e.data_pedido) = @Ano
                  AND e.estado NOT IN ('Cancelado', 'Rejeitado');
            `);

        const resultPenalizacoes = await transaction.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('Mes', sql.Int, mes)
            .input('Ano', sql.Int, ano)
            .query(`
                SELECT ISNULL(SUM(pp.valor), 0) AS total
                FROM PENALIZACAO_PECA pp
                INNER JOIN EMPRESTIMO e ON pp.EMPRESTIMOid_emprestimo = e.id_emprestimo
                WHERE e.UTILIZADORid_utilizador = @IdUtilizador
                  AND MONTH(pp.data_registo) = @Mes
                  AND YEAR(pp.data_registo) = @Ano;
            `);
 
        const totalCoachings = resultCoachings.recordset[0].total;
        const totalEmprestimos = resultEmprestimos.recordset[0].total;
        const totalPenalizacoes = resultPenalizacoes.recordset[0].total;
        const totalMes =
            Number(totalCoachings) + Number(totalEmprestimos) + Number(totalPenalizacoes);
 
        if (totalMes === 0) {
            await transaction.commit();
            return null; // Não gera fatura se não houver consumo
        }
 
        // Inserir registo de faturação
        const idFaturacao = await transaction.request()
            .input('Ano', sql.Int, ano)
            .input('Mes', sql.Int, mes)
            .input('Total', sql.Decimal(10, 2), totalMes)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('IdAnoLetivo', sql.Int, idAnoLetivo)
            .query(`
                INSERT INTO FATURACAO_MENSAL 
                    (ano, mes, data_geracao, total, estado_pagamento, UTILIZADORid_utilizador, ANO_LETIVOid_ano_letivo)
                OUTPUT INSERTED.id_faturacao
                VALUES 
                    (@Ano, @Mes, GETDATE(), @Total, 'Pendente', @IdUtilizador, @IdAnoLetivo);
            `)
            .then(r => r.recordset[0].id_faturacao);
 
        await transaction.commit();
        return idFaturacao;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (gerarFaturacaoMensal):', error);
        throw error;
    }
}
 
// ============================================================================
// 3. CONSULTA E GESTÃO DE PAGAMENTOS (US18, US19 / RF19, RF20)
// ============================================================================
 
/**
 * Consulta faturas. Se idUtilizador for fornecido, filtra por esse EE.
 * Caso contrário, retorna todas (para exportação pela Contabilidade).
 * Opcionalmente filtra por mês e ano civil da fatura (mes/ano da tabela FATURACAO_MENSAL).
 */
async function getFaturacao(idUtilizador = null, mes = null, ano = null) {
    try {
        const pool = await poolPromise;
        const conditions = [];
        const request = pool.request();
 
        if (idUtilizador != null && idUtilizador !== '') {
            conditions.push('f.UTILIZADORid_utilizador = @IdUtilizador');
            request.input('IdUtilizador', sql.Int, idUtilizador);
        }

        if (mes != null && mes !== '' && ano != null && ano !== '') {
            conditions.push('f.mes = @FiltroMes AND f.ano = @FiltroAno');
            request.input('FiltroMes', sql.Int, parseInt(mes, 10));
            request.input('FiltroAno', sql.Int, parseInt(ano, 10));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
 
        const query = `
            SELECT 
                f.id_faturacao,
                f.ano,
                f.mes,
                f.data_geracao,
                f.total,
                f.estado_pagamento,
                f.metodo_pagamento,
                f.data_pagamento,
                u.nome AS cliente,
                u.email AS email_cliente,
                a.ano AS ano_letivo_nome
            FROM FATURACAO_MENSAL f
            JOIN UTILIZADOR u ON f.UTILIZADORid_utilizador = u.id_utilizador
            JOIN ANO_LETIVO a ON f.ANO_LETIVOid_ano_letivo = a.id_ano_letivo
            ${whereClause}
            ORDER BY f.ano DESC, f.mes DESC;
        `;
 
        const result = await request.query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getFaturacao):', error);
        throw error;
    }
}
 
/**
 * Regista o pagamento de uma fatura. Só atualiza se a fatura estiver Pendente. (US19 / RF20)
 */
async function registarPagamentoFatura(idFaturacao, metodoPagamento) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Metodo', sql.VarChar(50), metodoPagamento)
            .input('IdFaturacao', sql.Int, idFaturacao)
            .query(`
                UPDATE FATURACAO_MENSAL 
                SET 
                    estado_pagamento = 'Pago', 
                    metodo_pagamento = @Metodo, 
                    data_pagamento = GETDATE()
                WHERE id_faturacao = @IdFaturacao 
                  AND estado_pagamento = 'Pendente';
            `);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (registarPagamentoFatura):', error);
        throw error;
    }
}
 
// ============================================================================
// 4. RELATÓRIOS E HISTÓRICO (US29, US30 / RF27, RF28)
// ============================================================================
 
/**
 * Retorna o histórico de atividades de um utilizador (coachings + empréstimos).
 * Serve EEs (vêem os pedidos que fizeram) e Professores (vêem as aulas que deram).
 * (US29 / RF27)
 */
async function getHistoricoAtividades(idUtilizador) {
    try {
        const pool = await poolPromise;
        const query = `
            -- Coachings onde o utilizador é o EE que requisitou
            SELECT 
                'Coaching (EE)' AS tipo_atividade, 
                c.data_aula AS data_registo, 
                m.nome AS detalhe, 
                c.valor_final AS valor, 
                c.estado,
                c.formato_aula,
                c.duracao_minutos
            FROM COACHING c
            JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
            JOIN PEDIDO_COACHING pc ON c.PEDIDO_COACHINGid_pedido_coaching = pc.id_pedido_coaching
            WHERE pc.UTILIZADORid_utilizador = @IdUtilizador
 
            UNION ALL
 
            -- Coachings onde o utilizador é o Professor que deu a aula
            SELECT 
                'Coaching (Professor)' AS tipo_atividade, 
                c.data_aula AS data_registo, 
                m.nome AS detalhe, 
                c.valor_final AS valor, 
                c.estado,
                c.formato_aula,
                c.duracao_minutos
            FROM COACHING c
            JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
            WHERE c.UTILIZADORid_utilizador = @IdUtilizador
 
            UNION ALL
 
            -- Empréstimos de inventário do utilizador
            SELECT 
                'Empréstimo Inventário' AS tipo_atividade, 
                e.data_inicio AS data_registo, 
                'Levantamento de Peças' AS detalhe, 
                e.valor AS valor, 
                e.estado,
                NULL AS formato_aula,
                NULL AS duracao_minutos
            FROM EMPRESTIMO e
            WHERE e.UTILIZADORid_utilizador = @IdUtilizador
 
            ORDER BY data_registo DESC;
        `;
        const result = await pool.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(query);
 
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getHistoricoAtividades):', error);
        throw error;
    }
}
 
/**
 * Relatório mensal para a Administração: total de aulas e receita por professor/modalidade.
 * (US30 / RF28)
 */
async function getRelatorioAulasProfessor(mes, ano) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                u.nome AS professor,
                m.nome AS modalidade,
                COUNT(c.id_coaching) AS total_aulas,
                SUM(c.duracao_minutos) AS total_minutos,
                SUM(c.valor_final) AS total_receita_gerada
            FROM COACHING c
            JOIN UTILIZADOR u ON c.UTILIZADORid_utilizador = u.id_utilizador
            JOIN MODALIDADE m ON c.MODALIDADEid_modalidade = m.id_modalidade
            WHERE MONTH(c.data_aula) = @Mes 
              AND YEAR(c.data_aula) = @Ano 
              AND c.estado = 'Realizado'
            GROUP BY u.nome, m.nome
            ORDER BY u.nome ASC, m.nome ASC;
        `;
        const result = await pool.request()
            .input('Mes', sql.Int, mes)
            .input('Ano', sql.Int, ano)
            .query(query);
 
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getRelatorioAulasProfessor):', error);
        throw error;
    }
}
 
module.exports = {
    getTabelaPrecos,
    criarRegistoPreco,
    atualizarRegistoPreco,
    desativarRegistoPreco,
    calcularCustoAutomatico,
    gerarFaturacaoMensal,
    getFaturacao,
    registarPagamentoFatura,
    getHistoricoAtividades,
    getRelatorioAulasProfessor
};