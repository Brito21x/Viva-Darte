const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. CATÁLOGO E GESTÃO DE PEÇAS (US20, US21, US22 / RF21, RF22)
// ============================================================================
 
/**
 * Retorna o catálogo completo de peças com foto principal e categoria.
 */
async function getCatalogoPecas() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT 
                p.id_peca,
                p.nome AS nome_peca,
                p.descricao,
                p.tamanho,
                p.estado AS condicao_peca,
                p.origem,
                p.localizacao,
                p.disponivel_para_emprestimo,
                p.disponivel_para_venda,
                p.data_registo,
                cp.nome AS categoria,
                u.nome AS registado_por,
                f.foto AS foto_principal
            FROM PECA p
            JOIN CATEGORIA_PECA cp 
                ON p.CATEGORIA_PECAid_categoria_peca = cp.id_categoria_peca
            JOIN UTILIZADOR u 
                ON p.UTILIZADORid_utilizador = u.id_utilizador
            LEFT JOIN (
                SELECT PECAid_peca, MIN(foto) AS foto 
                FROM FOTO_PECA 
                GROUP BY PECAid_peca
            ) f ON p.id_peca = f.PECAid_peca
            ORDER BY p.nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getCatalogoPecas):', error);
        throw error;
    }
}
 
/**
 * Retorna o detalhe completo de uma peça, incluindo todas as fotos. (US21 / RF21)
 */
async function getPecaDetalhes(idPeca) {
    try {
        const pool = await poolPromise;
 
        // Dados da peça
        const resultPeca = await pool.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`
                SELECT 
                    p.id_peca,
                    p.nome AS nome_peca,
                    p.descricao,
                    p.tamanho,
                    p.estado AS condicao_peca,
                    p.origem,
                    p.localizacao,
                    p.disponivel_para_emprestimo,
                    p.disponivel_para_venda,
                    p.data_registo,
                    cp.nome AS categoria,
                    u.nome AS registado_por
                FROM PECA p
                JOIN CATEGORIA_PECA cp ON p.CATEGORIA_PECAid_categoria_peca = cp.id_categoria_peca
                JOIN UTILIZADOR u ON p.UTILIZADORid_utilizador = u.id_utilizador
                WHERE p.id_peca = @IdPeca;
            `);
 
        if (resultPeca.recordset.length === 0) return null;
 
        // Todas as fotos da peça
        const resultFotos = await pool.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`
                SELECT id_foto_peca, foto
                FROM FOTO_PECA
                WHERE PECAid_peca = @IdPeca
                ORDER BY id_foto_peca ASC;
            `);
 
        return {
            ...resultPeca.recordset[0],
            fotos: resultFotos.recordset
        };
    } catch (error) {
        console.error('Erro no Modelo (getPecaDetalhes):', error);
        throw error;
    }
}
 
/**
 * Regista uma nova peça no inventário. (US22 / RF22)
 */
async function registarNovaPeca(dadosPeca) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Nome', sql.VarChar(255), dadosPeca.nome)
            .input('Descricao', sql.VarChar(255), dadosPeca.descricao || null)
            .input('Tamanho', sql.VarChar(50), dadosPeca.tamanho || null)
            .input('Estado', sql.VarChar(50), dadosPeca.estado)
            .input('Origem', sql.VarChar(50), dadosPeca.origem || null)
            .input('Localizacao', sql.VarChar(255), dadosPeca.localizacao || null)
            .input('DispEmprestimo', sql.Bit, dadosPeca.disponivelEmprestimo ? 1 : 0)
            .input('DispVenda', sql.Bit, dadosPeca.disponivelVenda ? 1 : 0)
            .input('IdUtilizador', sql.Int, dadosPeca.idUtilizador)
            .input('IdCategoria', sql.Int, dadosPeca.idCategoria)
            .query(`
                INSERT INTO PECA (
                    nome, descricao, tamanho, estado, origem, localizacao, 
                    disponivel_para_emprestimo, disponivel_para_venda, data_registo, 
                    UTILIZADORid_utilizador, CATEGORIA_PECAid_categoria_peca
                )
                OUTPUT INSERTED.id_peca
                VALUES (
                    @Nome, @Descricao, @Tamanho, @Estado, @Origem, @Localizacao, 
                    @DispEmprestimo, @DispVenda, GETDATE(), 
                    @IdUtilizador, @IdCategoria
                );
            `);
 
        return result.recordset[0].id_peca;
    } catch (error) {
        console.error('Erro no Modelo (registarNovaPeca):', error);
        throw error;
    }
}
 
/**
 * Atualiza o estado e/ou disponibilidade de uma peça. (US22 / RF22)
 */
async function atualizarEstadoPeca(idPeca, { estado, disponivelEmprestimo, disponivelVenda, localizacao }) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('IdPeca', sql.Int, idPeca)
            .input('Estado', sql.VarChar(50), estado)
            .input('DispEmprestimo', sql.Bit, disponivelEmprestimo ? 1 : 0)
            .input('DispVenda', sql.Bit, disponivelVenda ? 1 : 0)
            .input('Localizacao', sql.VarChar(255), localizacao || null)
            .query(`
                UPDATE PECA
                SET 
                    estado = @Estado,
                    disponivel_para_emprestimo = @DispEmprestimo,
                    disponivel_para_venda = @DispVenda,
                    localizacao = @Localizacao
                WHERE id_peca = @IdPeca;
            `);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (atualizarEstadoPeca):', error);
        throw error;
    }
}
 
// ============================================================================
// 2. CICLO DE EMPRÉSTIMOS (US23, US24 / RF23, RF24)
// ============================================================================
 
/**
 * Cria um pedido de empréstimo e os seus itens (peças) numa transação. (US23)
 */
async function requisitarEmprestimo(dadosEmprestimo, itensEmprestimo) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Verificar se todas as peças estão disponíveis para empréstimo
        for (const item of itensEmprestimo) {
            const disponivel = await transaction.request()
                .input('IdPeca', sql.Int, item.idPeca)
                .query(`
                    SELECT disponivel_para_emprestimo 
                    FROM PECA 
                    WHERE id_peca = @IdPeca AND disponivel_para_emprestimo = 1;
                `);
 
            if (disponivel.recordset.length === 0) {
                throw new Error(`A peça com id ${item.idPeca} não está disponível para empréstimo.`);
            }

            const emprestimoAtivo = await transaction.request()
                .input('IdPeca', sql.Int, item.idPeca)
                .query(`
                    SELECT TOP 1 1 AS ok
                    FROM EMPRESTIMO_ITEM ei
                    INNER JOIN EMPRESTIMO e ON ei.[EMPRESIMO id_emprestimo] = e.id_emprestimo
                    WHERE ei.PECAid_peca = @IdPeca
                      AND e.estado NOT IN ('Concluído', 'Cancelado', 'Rejeitado')
                      AND ei.estado_devolucao IS NULL;
                `);

            if (emprestimoAtivo.recordset.length > 0) {
                throw new Error(
                    `A peça com id ${item.idPeca} já se encontra num empréstimo ativo (devolução pendente).`
                );
            }
        }
 
        // Inserir cabeçalho do empréstimo
        const idEmprestimo = await transaction.request()
            .input('DataInicio', sql.Date, dadosEmprestimo.dataInicio)
            .input('DataFim', sql.Date, dadosEmprestimo.dataFim)
            .input('Observacoes', sql.VarChar(255), dadosEmprestimo.observacoes || null)
            .input('IdUtilizador', sql.Int, dadosEmprestimo.idUtilizador)
            .query(`
                INSERT INTO EMPRESTIMO (
                    data_pedido, data_inicio, data_fim, estado, observacoes, UTILIZADORid_utilizador
                )
                OUTPUT INSERTED.id_emprestimo
                VALUES (GETDATE(), @DataInicio, @DataFim, 'Pendente', @Observacoes, @IdUtilizador);
            `)
            .then(r => r.recordset[0].id_emprestimo);
 
        // Inserir as peças e marcar como não disponíveis
        for (const item of itensEmprestimo) {
            await transaction.request()
                .input('EstadoEntrega', sql.VarChar(50), item.estadoEntrega)
                .input('IdPeca', sql.Int, item.idPeca)
                .input('IdEmprestimo', sql.Int, idEmprestimo)
                .query(`
                    INSERT INTO EMPRESTIMO_ITEM (
                        estado_entrega, PECAid_peca, [EMPRESIMO id_emprestimo]
                    )
                    VALUES (@EstadoEntrega, @IdPeca, @IdEmprestimo);
                `);
 
            // Marcar peça como indisponível enquanto está emprestada
            await transaction.request()
                .input('IdPeca', sql.Int, item.idPeca)
                .query(`
                    UPDATE PECA 
                    SET disponivel_para_emprestimo = 0 
                    WHERE id_peca = @IdPeca;
                `);
        }
 
        await transaction.commit();
        return idEmprestimo;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (requisitarEmprestimo):', error);
        throw error;
    }
}
 
/**
 * Regista a devolução de um empréstimo e atualiza o estado de cada peça. (US24 / RF24)
 */
async function registarDevolucaoEmprestimo(idEmprestimo, estadoFinal, observacoes, itensDevolvidos) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Atualizar cabeçalho do empréstimo
        await transaction.request()
            .input('EstadoFinal', sql.VarChar(50), estadoFinal)
            .input('Observacoes', sql.VarChar(255), observacoes || null)
            .input('IdEmprestimo', sql.Int, idEmprestimo)
            .query(`
                UPDATE EMPRESTIMO 
                SET data_devolucao = GETDATE(), estado = @EstadoFinal, observacoes = @Observacoes 
                WHERE id_emprestimo = @IdEmprestimo;
            `);
 
        // Atualizar estado de devolução de cada peça e voltar a disponibilizá-la
        for (const item of itensDevolvidos) {
            await transaction.request()
                .input('EstadoDevolucao', sql.VarChar(50), item.estadoDevolucao)
                .input('IdPeca', sql.Int, item.idPeca)
                .input('IdEmprestimo', sql.Int, idEmprestimo)
                .query(`
                    UPDATE EMPRESTIMO_ITEM 
                    SET estado_devolucao = @EstadoDevolucao 
                    WHERE PECAid_peca = @IdPeca AND [EMPRESIMO id_emprestimo] = @IdEmprestimo;
                `);
 
            // Voltar a disponibilizar a peça para empréstimo (se devolvida sem dano grave)
            if (item.estadoDevolucao !== 'Danificado' && item.estadoDevolucao !== 'Perdido') {
                await transaction.request()
                    .input('IdPeca', sql.Int, item.idPeca)
                    .query(`
                        UPDATE PECA 
                        SET disponivel_para_emprestimo = 1
                        WHERE id_peca = @IdPeca;
                    `);

                const estadosPecaValidos = new Set(['Novo', 'Bom', 'Usado', 'Danificado']);
                if (estadosPecaValidos.has(item.estadoDevolucao)) {
                    await transaction.request()
                        .input('EstadoDevolucao', sql.VarChar(50), item.estadoDevolucao)
                        .input('IdPeca', sql.Int, item.idPeca)
                        .query(`
                            UPDATE PECA 
                            SET estado = @EstadoDevolucao
                            WHERE id_peca = @IdPeca;
                        `);
                }
            } else {
                await transaction.request()
                    .input('IdPeca', sql.Int, item.idPeca)
                    .query(`
                        UPDATE PECA 
                        SET disponivel_para_emprestimo = 0
                        WHERE id_peca = @IdPeca;
                    `);

                await transaction.request()
                    .input('Estado', sql.VarChar(50), 'Danificado')
                    .input('IdPeca', sql.Int, item.idPeca)
                    .query(`
                        UPDATE PECA 
                        SET estado = @Estado
                        WHERE id_peca = @IdPeca;
                    `);
            }
        }
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (registarDevolucaoEmprestimo):', error);
        throw error;
    }
}
 
// ============================================================================
// 3. FATURAÇÃO E PENALIZAÇÕES DE EMPRÉSTIMOS (US25, US26 / RF24, RF25)
// ============================================================================
 
/**
 * Regista uma penalização por atraso ou dano numa peça de um empréstimo. (US25)
 */
async function registarPenalizacao(dadosPenalizacao) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Tipo', sql.VarChar(50), dadosPenalizacao.tipo)
            .input('Valor', sql.Decimal(10, 2), dadosPenalizacao.valor)
            .input('Descricao', sql.VarChar(255), dadosPenalizacao.descricao || null)
            .input('IdPeca', sql.Int, dadosPenalizacao.idPeca)
            .input('IdEmprestimo', sql.Int, dadosPenalizacao.idEmprestimo)
            .query(`
                INSERT INTO PENALIZACAO_PECA (
                    tipo, valor, descricao, data_registo, PECAid_peca, EMPRESTIMOid_emprestimo
                )
                OUTPUT INSERTED.id_penalizacao
                VALUES (
                    @Tipo, @Valor, @Descricao, GETDATE(), @IdPeca, @IdEmprestimo
                );
            `);
 
        return result.recordset[0].id_penalizacao;
    } catch (error) {
        console.error('Erro no Modelo (registarPenalizacao):', error);
        throw error;
    }
}
 
/**
 * Regista ou atualiza o pagamento de um empréstimo. (US26 / RF25)
 */
async function atualizarPagamentoEmprestimo(idEmprestimo, valor, metodoPagamento, estadoPagamento) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Valor', sql.Decimal(10, 2), valor)
            .input('MetodoPagamento', sql.VarChar(50), metodoPagamento)
            .input('EstadoPagamento', sql.VarChar(50), estadoPagamento)
            .input('IdEmprestimo', sql.Int, idEmprestimo)
            .query(`
                UPDATE EMPRESTIMO 
                SET 
                    valor = @Valor,
                    metodo_pagamento = @MetodoPagamento,
                    estado_pagamento = @EstadoPagamento,
                    data_pagamento = GETDATE()
                WHERE id_emprestimo = @IdEmprestimo;
            `);
 
        return result.rowsAffected[0] > 0;
    } catch (error) {
        console.error('Erro no Modelo (atualizarPagamentoEmprestimo):', error);
        throw error;
    }
}
 
// ============================================================================
// 4. VENDA DE PEÇAS (US27, US28 / RF26)
// ============================================================================
 
/**
 * Lista as peças disponíveis para venda. (US27)
 */
async function getPecasAVenda(incluirConcluidas = false) {
    try {
        const pool = await poolPromise;
        const filtroEstado = incluirConcluidas
            ? `vp.estado IN ('Disponível', 'Concluída')`
            : `vp.estado = 'Disponível'`;
        const result = await pool.request().query(`
            SELECT 
                vp.id_venda,
                vp.preco,
                vp.data_colocacao,
                vp.estado AS estado_venda,
                p.id_peca,
                p.nome AS nome_peca,
                p.descricao,
                p.tamanho,
                p.estado AS condicao_peca,
                cp.nome AS categoria,
                u.id_utilizador AS id_utilizador,
                u.nome AS vendedor,
                u2.nome AS comprador_nome,
                f.foto AS foto_principal
            FROM VENDA_PECA vp
            JOIN PECA p ON vp.PECAid_peca = p.id_peca
            JOIN CATEGORIA_PECA cp ON p.CATEGORIA_PECAid_categoria_peca = cp.id_categoria_peca
            JOIN UTILIZADOR u ON vp.UTILIZADORid_utilizador = u.id_utilizador
            LEFT JOIN UTILIZADOR u2 ON vp.UTILIZADORid_utilizador2 = u2.id_utilizador
            LEFT JOIN (
                SELECT PECAid_peca, MIN(foto) AS foto 
                FROM FOTO_PECA 
                GROUP BY PECAid_peca
            ) f ON p.id_peca = f.PECAid_peca
            WHERE ${filtroEstado}
            ORDER BY vp.data_colocacao DESC;
        `);
        return result.recordset;
    } catch (error) {
        console.error('Erro no Modelo (getPecasAVenda):', error);
        throw error;
    }
}
 
/**
 * Coloca uma peça à venda. (US27 / RF26)
 */
async function colocarPecaAVenda(idPeca, preco, idVendedor) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Verificar se a peça existe e está disponível para venda
        const pecaResult = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`
                SELECT disponivel_para_venda FROM PECA WHERE id_peca = @IdPeca;
            `);
 
        if (pecaResult.recordset.length === 0) {
            throw new Error('Peça não encontrada.');
        }
        if (!pecaResult.recordset[0].disponivel_para_venda) {
            throw new Error('Esta peça não está disponível para venda.');
        }
 
        // Verificar se já existe um anúncio de venda ativo para esta peça
        const vendaExiste = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`
                SELECT 1 FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado = 'Disponível';
            `);
 
        if (vendaExiste.recordset.length > 0) {
            throw new Error('Esta peça já está anunciada para venda.');
        }
 
        // UTILIZADORid_utilizador2: se a BD exige NOT NULL antes da conclusão, usar o vendedor
        // como marcador até `registarConclusaoVenda` gravar o comprador real. Preferível: coluna NULL (ver sql/patches).
        const idVenda = await transaction.request()
            .input('Preco', sql.Decimal(10, 2), preco)
            .input('IdPeca', sql.Int, idPeca)
            .input('IdVendedor', sql.Int, idVendedor)
            .input('IdCompradorPlaceholder', sql.Int, idVendedor)
            .query(`
                INSERT INTO VENDA_PECA (
                    preco, data_colocacao, estado, PECAid_peca, UTILIZADORid_utilizador, UTILIZADORid_utilizador2
                )
                OUTPUT INSERTED.id_venda
                VALUES (
                    @Preco, GETDATE(), 'Disponível', @IdPeca, @IdVendedor, @IdCompradorPlaceholder
                );
            `)
            .then(r => r.recordset[0].id_venda);
 
        await transaction.commit();
        return idVenda;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (colocarPecaAVenda):', error);
        throw error;
    }
}
 
/**
 * Regista a conclusão de uma venda com comprador e método de pagamento. (US28 / RF26)
 */
async function registarConclusaoVenda(idVenda, idComprador, metodoPagamento) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Verificar que a venda existe e está disponível
        const vendaResult = await transaction.request()
            .input('IdVenda', sql.Int, idVenda)
            .query(`
                SELECT PECAid_peca, estado FROM VENDA_PECA WHERE id_venda = @IdVenda;
            `);
 
        if (vendaResult.recordset.length === 0) {
            throw new Error('Venda não encontrada.');
        }
        if (vendaResult.recordset[0].estado !== 'Disponível') {
            throw new Error('Esta venda já não está disponível.');
        }
 
        const idPeca = vendaResult.recordset[0].PECAid_peca;
 
        // Registar comprador, data de venda e método de pagamento
        await transaction.request()
            .input('IdComprador', sql.Int, idComprador)
            .input('MetodoPagamento', sql.VarChar(50), metodoPagamento)
            .input('IdVenda', sql.Int, idVenda)
            .query(`
                UPDATE VENDA_PECA 
                SET 
                    data_venda = GETDATE(), 
                    estado = 'Concluída', 
                    UTILIZADORid_utilizador2 = @IdComprador, 
                    metodo_pagamento = @MetodoPagamento 
                WHERE id_venda = @IdVenda;
            `);
 
        // Marcar a peça como indisponível para venda e empréstimo
        await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`
                UPDATE PECA 
                SET disponivel_para_venda = 0, disponivel_para_emprestimo = 0 
                WHERE id_peca = @IdPeca;
            `);
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        console.error('Erro no Modelo Transacional (registarConclusaoVenda):', error);
        throw error;
    }
}
 
module.exports = {
    getCatalogoPecas,
    getPecaDetalhes,
    registarNovaPeca,
    atualizarEstadoPeca,
    requisitarEmprestimo,
    registarDevolucaoEmprestimo,
    registarPenalizacao,
    atualizarPagamentoEmprestimo,
    getPecasAVenda,
    colocarPecaAVenda,
    registarConclusaoVenda
};