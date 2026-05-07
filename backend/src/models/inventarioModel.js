/**
 * Modelo de Dados do Inventário
 * Este ficheiro centraliza a comunicação com a base de dados SQL Server para gerir
 * peças, fotografias, empréstimos, multas e transações do mercado de segunda mão.
 */

const { poolPromise } = require('../config/db'); // Pool de ligações SQL Server
const sql = require('mssql'); // Driver nativo para executar queries SQL
 
// ============================================================================
// 1. CATÁLOGO E GESTÃO DE PEÇAS
// ============================================================================
 
/**
 * Obtém a lista completa do catálogo de peças.
 * Utiliza junções complexas (JOIN e OUTER APPLY) para trazer os dados da peça, 
 * a foto principal, e o estado do empréstimo ativo no momento.
 */
async function getCatalogoPecas() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT p.id_peca, p.nome AS nome_peca, p.descricao, p.tamanho, p.estado AS condicao_peca,
                   p.origem, p.localizacao, p.disponivel_para_emprestimo, p.disponivel_para_venda,
                   p.data_registo, cp.nome AS categoria, u.nome AS registado_por, f.foto AS foto_principal,
                   p.UTILIZADORid_utilizador,
                   active_emp.id_emprestimo AS active_id_emprestimo,
                   active_emp.data_inicio AS emprestimo_inicio,
                   active_emp.data_fim AS emprestimo_fim,
                   base_emp.valor AS valor_dia,
                   -- Extração blindada dos métodos de pagamento usando manipulação de strings no SQL
                   CASE 
                       WHEN base_emp.observacoes LIKE '%Métodos: %' THEN
                           SUBSTRING(
                               base_emp.observacoes, 
                               CHARINDEX('Métodos: ', base_emp.observacoes) + 9, 
                               CASE 
                                   WHEN CHARINDEX(' | ', base_emp.observacoes) > 0 
                                   THEN CHARINDEX(' | ', base_emp.observacoes) - (CHARINDEX('Métodos: ', base_emp.observacoes) + 9)
                                   ELSE LEN(base_emp.observacoes) 
                               END
                           )
                       ELSE 'MBWay'
                   END AS metodos_pagamento
            FROM PECA p
            JOIN CATEGORIA_PECA cp ON p.CATEGORIA_PECAid_categoria_peca = cp.id_categoria_peca
            JOIN UTILIZADOR u ON p.UTILIZADORid_utilizador = u.id_utilizador
            -- Subquery para capturar apenas a primeira foto de cada peça
            LEFT JOIN (
                SELECT PECAid_peca, MIN(CAST(foto AS NVARCHAR(MAX))) AS foto 
                FROM FOTO_PECA GROUP BY PECAid_peca
            ) f ON p.id_peca = f.PECAid_peca
            -- OUTER APPLY para obter a configuração base do empréstimo (preço)
            OUTER APPLY (
                SELECT TOP 1 e.valor, e.observacoes
                FROM EMPRESTIMO_ITEM ei
                JOIN EMPRESTIMO e ON ei.[EMPRESIMO id_emprestimo] = e.id_emprestimo
                WHERE ei.PECAid_peca = p.id_peca 
                ORDER BY e.id_emprestimo ASC
            ) base_emp
            -- OUTER APPLY para detetar se existe um empréstimo atualmente a decorrer
            OUTER APPLY (
                SELECT TOP 1 e.id_emprestimo, e.data_inicio, e.data_fim
                FROM EMPRESTIMO_ITEM ei
                JOIN EMPRESTIMO e ON ei.[EMPRESIMO id_emprestimo] = e.id_emprestimo
                WHERE ei.PECAid_peca = p.id_peca 
                  AND e.data_devolucao IS NULL
                  AND e.estado != 'Config Inicial'
                  AND e.estado != 'Disponível'
                ORDER BY e.id_emprestimo DESC
            ) active_emp
            ORDER BY p.nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) { throw error; }
}
 
/**
 * Devolve os detalhes detalhados de uma única peça, incluindo a galeria completa de fotos.
 */
async function getPecaDetalhes(idPeca) {
    try {
        const pool = await poolPromise;
        const resultPeca = await pool.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`
                SELECT p.id_peca, p.nome AS nome_peca, p.descricao, p.tamanho, p.estado AS condicao_peca,
                       p.origem, p.localizacao, p.disponivel_para_emprestimo, p.disponivel_para_venda,
                       p.data_registo, cp.nome AS categoria, u.nome AS registado_por
                FROM PECA p
                JOIN CATEGORIA_PECA cp ON p.CATEGORIA_PECAid_categoria_peca = cp.id_categoria_peca
                JOIN UTILIZADOR u ON p.UTILIZADORid_utilizador = u.id_utilizador
                WHERE p.id_peca = @IdPeca;
            `);
        
        if (resultPeca.recordset.length === 0) return null;
 
        // Pedido secundário para ir buscar a galeria de fotos associada
        const resultFotos = await pool.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT id_foto_peca, foto FROM FOTO_PECA WHERE PECAid_peca = @IdPeca ORDER BY id_foto_peca ASC;`);
 
        return { ...resultPeca.recordset[0], fotos: resultFotos.recordset };
    } catch (error) { throw error; }
}
 
/**
 * Cria uma nova peça e, se necessário, configura automaticamente o seu perfil de empréstimo.
 * Tudo protegido por uma Transação SQL (Se falhar a configuração do empréstimo, a peça não é guardada).
 */
async function registarNovaPeca(dadosPeca) {
    const pool = await poolPromise;
    const transaction = pool.transaction(); // Início do bloco transacional
    await transaction.begin();

    try {
        // 1. Inserção do registo base da Peça (utiliza OUTPUT para capturar o ID gerado)
        const resultPeca = await transaction.request()
            .input('Nome', sql.VarChar(255), dadosPeca.nome)
            .input('Desc', sql.VarChar(255), dadosPeca.descricao || '')
            .input('Tam', sql.VarChar(50), dadosPeca.tamanho || '')
            .input('Est', sql.VarChar(50), dadosPeca.estado || 'Novo')
            .input('IdUtilizador', sql.Int, dadosPeca.idUtilizador)
            .input('DispEmp', sql.Bit, dadosPeca.isEmprestimo ? 1 : 0)
            .input('DispVenda', sql.Bit, dadosPeca.isVenda ? 1 : 0)
            .input('IdCat', sql.Int, dadosPeca.idCategoria || 1)
            .query(`
                INSERT INTO PECA (nome, descricao, tamanho, estado, localizacao, disponivel_para_emprestimo, disponivel_para_venda, data_registo, UTILIZADORid_utilizador, CATEGORIA_PECAid_categoria_peca)
                OUTPUT INSERTED.id_peca
                VALUES (@Nome, @Desc, @Tam, @Est, NULL, @DispEmp, @DispVenda, GETDATE(), @IdUtilizador, @IdCat);
            `);

        const idPeca = resultPeca.recordset[0].id_peca;

        // 2. Se for para empréstimo, cria a estrutura inicial de empréstimo)
        if (dadosPeca.isEmprestimo) {
            const resultEmp = await transaction.request()
                .input('Valor', sql.Decimal(10, 2), dadosPeca.valor_dia)
                .input('Metodos', sql.VarChar(255), `Métodos: ${dadosPeca.metodosStr}`)
                .input('IdUtilizador', sql.Int, dadosPeca.idUtilizador)
                .query(`
                    INSERT INTO EMPRESTIMO (valor, observacoes, estado, data_pedido, UTILIZADORid_utilizador)
                    OUTPUT INSERTED.id_emprestimo
                    VALUES (@Valor, @Metodos, 'Disponível', GETDATE(), @IdUtilizador);
                `);
            
            const idEmprestimo = resultEmp.recordset[0].id_emprestimo;

            // Liga a peça ao registo de empréstimo gerado
            await transaction.request()
                .input('IdPeca', sql.Int, idPeca)
                .input('IdEmp', sql.Int, idEmprestimo)
                .query(`INSERT INTO EMPRESTIMO_ITEM (PECAid_peca, [EMPRESIMO id_emprestimo]) VALUES (@IdPeca, @IdEmp)`);
        }

        await transaction.commit(); // Consagra as alterações
        return idPeca;
    } catch (error) {
        await transaction.rollback(); // Reverte tudo em caso de falha
        throw error;
    }
}
 
/**
 * Atualiza sinaléticas de disponibilidade (Venda/Empréstimo).
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
            .query(`UPDATE PECA SET estado = @Estado, disponivel_para_emprestimo = @DispEmprestimo, disponivel_para_venda = @DispVenda, localizacao = @Localizacao WHERE id_peca = @IdPeca;`);
        return result.rowsAffected[0] > 0;
    } catch (error) { throw error; }
}

/**
 * Eliminação destrutiva e em cascata (Manual) de uma peça do sistema.
 * Feito via transação para evitar que a Foreign Key viole a integridade se falhar a meio.
 */
async function eliminarPecaCompleta(idPeca) {
    const pool = await poolPromise; 
    const transaction = pool.transaction();
    try {
        await transaction.begin();

        // 1. Identificar todos os empréstimos onde a peça está envolvida
        const emprestimos = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT [EMPRESIMO id_emprestimo] as id FROM EMPRESTIMO_ITEM WHERE PECAid_peca = @IdPeca`);
            
        const idsEmp = emprestimos.recordset.map(e => e.id);

        if (idsEmp.length > 0) {
            const idsStr = idsEmp.join(',');
            
            // 2. Apagar penalizações penduradas nestes empréstimos
            await transaction.request().query(`DELETE FROM PENALIZACAO_PECA WHERE EMPRESTIMOid_emprestimo IN (${idsStr})`);
            
            // 3. Apagar o histórico da peça nas linhas de empréstimo
            await transaction.request()
                .input('IdPeca', sql.Int, idPeca)
                .query(`DELETE FROM EMPRESTIMO_ITEM WHERE PECAid_peca = @IdPeca`);
                
            // 4. Apagar os cabecalhos do empréstimo
            await transaction.request().query(`DELETE FROM EMPRESTIMO WHERE id_emprestimo IN (${idsStr})`);
        }

        // 5. Limpar dependências de ficheiros (Fotos) e do Mercado de Vendas
        await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query('DELETE FROM FOTO_PECA WHERE PECAid_peca = @IdPeca');
            
        await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query('DELETE FROM VENDA_PECA WHERE PECAid_peca = @IdPeca');

        // 6. Por fim, sem amarras, apagar o registo primário da Peça
        const result = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query('DELETE FROM PECA WHERE id_peca = @IdPeca');

        await transaction.commit();
        return result.rowsAffected[0] > 0;
    } catch (error) {
        await transaction.rollback();
        console.error("Erro ao eliminar peça:", error);
        throw error;
    }
}

/**
 * Permite a edição dos detalhes informativos e físicos da peça.
 */
async function atualizarDadosCompletosPeca(idPeca, dados) {
    const pool = await poolPromise;
    await pool.request()
        .input('IdPeca', sql.Int, idPeca)
        .input('Nome', sql.VarChar(255), dados.nome)
        .input('Desc', sql.VarChar(255), dados.descricao)
        .input('Tam', sql.VarChar(50), dados.tamanho)
        .input('Est', sql.VarChar(50), dados.estado)
        .query(`UPDATE PECA SET nome = @Nome, descricao = @Desc, tamanho = @Tam, estado = @Est WHERE id_peca = @IdPeca`);
}

// ============================================================================
// ATUALIZAR DADOS DA VENDA
// ============================================================================

/**
 * Sincroniza as alterações de uma peça com o seu anúncio de venda caso esteja online.
 */
async function atualizarDadosVenda(idPeca, preco, nome, condicao, metodosAceites) {
    const pool = await poolPromise;
    await pool.request()
        .input('IdPeca', sql.Int, idPeca)
        .input('Preco', sql.Decimal(10, 2), preco)
        .input('NomePeca', sql.VarChar(255), nome)
        .input('Condicao', sql.VarChar(50), condicao)
        .input('Metodos', sql.VarChar(255), metodosAceites)
        .query(`
            UPDATE VENDA_PECA 
            SET preco = @Preco, nome_peca = @NomePeca, condicao = @Condicao, metodos_aceites = @Metodos
            WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')
        `);
}

/**
 * Atualiza a galeria de imagens. Limpa a antiga e insere as novas fotos em Base64.
 * Vincula automaticamente à Venda, se a peça estiver à venda no momento.
 */
async function atualizarFotosPeca(idPeca, fotosBase64) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        // Verifica se há venda ativa
        const vendaAtiva = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT id_venda FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')`);
        
        const idVenda = vendaAtiva.recordset.length > 0 ? vendaAtiva.recordset[0].id_venda : null;

        // Limpeza de fotos antigas
        await transaction.request().input('IdPeca', sql.Int, idPeca).query('DELETE FROM FOTO_PECA WHERE PECAid_peca = @IdPeca');
        
        // Inserção iterativa
        for (const foto of fotosBase64) {
            await transaction.request()
                .input('IdPeca', sql.Int, idPeca)
                .input('IdVenda', sql.Int, idVenda) 
                .input('Foto', sql.VarChar(sql.MAX), foto)
                .query(`INSERT INTO FOTO_PECA (PECAid_peca, VENDAid_venda, foto) VALUES (@IdPeca, @IdVenda, @Foto)`);
        }
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

// ============================================================================
// 2. CICLO DE EMPRÉSTIMOS
// ============================================================================
 
/**
 * Inicializa a requisição de um empréstimo aproveitando o registo de configuração base
 * que foi criado na inserção da peça.
 */
async function requisitarEmprestimo(dados) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
        const result = await transaction.request()
            .input('IdPeca', sql.Int, dados.idPeca)
            .query("SELECT TOP 1 [EMPRESIMO id_emprestimo] as id FROM EMPRESTIMO_ITEM WHERE PECAid_peca = @IdPeca");

        if (result.recordset.length === 0) {
            throw new Error('Configuração de empréstimo não encontrada para esta peça.');
        }

        const idEmprestimo = result.recordset[0].id;

        let obsAppend = dados.observacoes ? ` | Notas Pedido: ${dados.observacoes}` : '';

        await transaction.request()
            .input('IdEmp', sql.Int, idEmprestimo)
            .input('IdUser', sql.Int, dados.idUtilizador)
            .input('Inicio', sql.Date, dados.dataInicio)
            .input('Fim', sql.Date, dados.dataFim)
            .input('Obs', sql.VarChar(255), obsAppend)
            .input('Metodo', sql.VarChar(50), dados.metodoPagamento || 'MBWay')
            .query(`
                UPDATE EMPRESTIMO 
                SET UTILIZADORid_utilizador = @IdUser, 
                    data_inicio = @Inicio, 
                    data_fim = @Fim, 
                    estado = 'Pendente',
                    metodo_pagamento = @Metodo,
                    observacoes = ISNULL(observacoes, '') + @Obs
                WHERE id_emprestimo = @IdEmp
            `);

        await transaction.request()
            .input('IdEmp', sql.Int, idEmprestimo)
            .input('IdPeca', sql.Int, dados.idPeca)
            .input('EstadoEntrega', sql.VarChar(50), dados.estadoEntrega)
            .query(`
                UPDATE EMPRESTIMO_ITEM 
                SET estado_entrega = @EstadoEntrega 
                WHERE [EMPRESIMO id_emprestimo] = @IdEmp AND PECAid_peca = @IdPeca
            `);
            
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
/**
 * Conclui um empréstimo. Assinala a data e anota o estado em que o material foi entregue.
 */
async function registarDevolucaoEmprestimo(idEmprestimo, estadoFinal, observacoes, itensDevolvidos) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        let obsAppend = observacoes ? ` | Devolução: ${observacoes}` : '';

        await transaction.request()
            .input('EstadoFinal', sql.VarChar(50), estadoFinal)
            .input('ObsAppend', sql.VarChar(255), obsAppend)
            .input('IdEmprestimo', sql.Int, idEmprestimo)
            .query(`UPDATE EMPRESTIMO SET data_devolucao = GETDATE(), estado = @EstadoFinal, observacoes = ISNULL(observacoes, '') + @ObsAppend WHERE id_emprestimo = @IdEmprestimo;`);
 
        // Atualiza a linha do item específico devolvido
        for (const item of itensDevolvidos) {
            await transaction.request()
                .input('EstadoDevolucao', sql.VarChar(50), item.estadoDevolucao)
                .input('IdPeca', sql.Int, item.idPeca)
                .input('IdEmprestimo', sql.Int, idEmprestimo)
                .query(`UPDATE EMPRESTIMO_ITEM SET estado_devolucao = @EstadoDevolucao WHERE PECAid_peca = @IdPeca AND [EMPRESIMO id_emprestimo] = @IdEmprestimo;`);
        }
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
// ============================================================================
// 3. FATURAÇÃO E PENALIZAÇÕES
// ============================================================================

/**
 * Cria uma entrada de penalização/multa associada a um empréstimo atrasado/danificado.
 */
async function registarPenalizacao(dadosPenalizacao) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Valor', sql.Decimal(10, 2), dadosPenalizacao.valor)
            // Junta o tipo da multa e descrição formatada
            .input('Motivo', sql.VarChar(255), `${dadosPenalizacao.tipo}: ${dadosPenalizacao.descricao || ''}`)
            .input('IdEmprestimo', sql.Int, dadosPenalizacao.idEmprestimo)
            .query(`
                INSERT INTO PENALIZACAO_PECA (valor_penalizacao, motivo, data_penalizacao, estado_pagamento, EMPRESTIMOid_emprestimo)
                OUTPUT INSERTED.id_penalizacao
                VALUES (@Valor, @Motivo, GETDATE(), 'Pendente', @IdEmprestimo);
            `);
        return result.recordset[0].id_penalizacao;
    } catch (error) {
        throw error;
    }
}
 
/**
 * Regista o valor monetário real recebido pelo empréstimo.
 */
async function atualizarPagamentoEmprestimo(idEmprestimo, valor, metodoPagamento, estadoPagamento) {
    try {
        const pool = await poolPromise;
        // Proteger o valor_dia original. O pagamento feito regista-se no histórico de texto
        let obsAppend = ` | Valor Pago: ${valor}€`;

        const result = await pool.request()
            .input('MetodoPagamento', sql.VarChar(50), metodoPagamento)
            .input('EstadoPagamento', sql.VarChar(50), estadoPagamento)
            .input('ObsAppend', sql.VarChar(255), obsAppend)
            .input('IdEmprestimo', sql.Int, idEmprestimo)
            .query(`
                UPDATE EMPRESTIMO 
                SET metodo_pagamento = @MetodoPagamento, 
                    estado_pagamento = @EstadoPagamento, 
                    data_pagamento = GETDATE(),
                    observacoes = ISNULL(observacoes, '') + @ObsAppend
                WHERE id_emprestimo = @IdEmprestimo;
            `);
        return result.rowsAffected[0] > 0;
    } catch (error) {
        throw error;
    }
}
 
// ============================================================================
// 4. VENDAS
// ============================================================================

/**
 * Obtém os anúncios ativos e o histórico de vendas. Agrupa fotos no SQL para poupar chamadas.
 */
async function getPecasAVenda() {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                vp.id_venda, vp.preco, vp.estado AS estado_venda, vp.data_venda, vp.metodos_aceites,
                p.id_peca, 
                COALESCE(vp.nome_peca, p.nome) AS nome_peca, 
                p.descricao, p.tamanho, 
                COALESCE(vp.condicao, p.estado) AS condicao_peca,
                u.nome AS vendedor,
                c.nome AS comprador,
                (SELECT STRING_AGG(CAST(foto AS NVARCHAR(MAX)), '|||') 
                 FROM FOTO_PECA 
                 WHERE PECAid_peca = p.id_peca) AS fotos_agrupadas
            FROM VENDA_PECA vp
            JOIN PECA p ON vp.PECAid_peca = p.id_peca
            JOIN UTILIZADOR u ON vp.UTILIZADORid_utilizador = u.id_utilizador
            LEFT JOIN UTILIZADOR c ON vp.UTILIZADORid_utilizador2 = c.id_utilizador
            WHERE vp.estado IN ('Disponível', 'Disponivel', 'Concluída', 'Concluida')
            ORDER BY vp.data_colocacao DESC;
        `);

        // Descompacta as strings de foto criadas pelo STRING_AGG
        return result.recordset.map(row => ({
            ...row,
            fotos: row.fotos_agrupadas ? row.fotos_agrupadas.split('|||') : []
        }));
    } catch (error) { throw error; }
}
 
/**
 * Promove uma peça que estava no inventário geral para os classificados de Venda.
 */
async function colocarPecaAVenda(idPeca, preco, idVendedor, nomePeca = null, condicaoPeca = null, metodosAceites = '') {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        // Verifica a pré-existência da peça
        const pecaResult = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT nome, estado FROM PECA WHERE id_peca = @IdPeca;`);
            
        if (pecaResult.recordset.length === 0) throw new Error('Peça não encontrada.');
        
        // Regra de Negócio: Uma peça à venda é suspensa dos empréstimos imediatamente.
        await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`UPDATE PECA SET disponivel_para_venda = 1, disponivel_para_emprestimo = 0 WHERE id_peca = @IdPeca;`);
 
        const nomeFinal = nomePeca || pecaResult.recordset[0].nome;
        const condicaoFinal = condicaoPeca || pecaResult.recordset[0].estado;

        // Impede duplicação de vendas ativas para a mesma peça
        const vendaExiste = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT 1 FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel');`);
            
        if (vendaExiste.recordset.length > 0) throw new Error('Esta peça já está anunciada para venda.');
 
        const idVenda = await transaction.request()
            .input('Preco', sql.Decimal(10, 2), preco)
            .input('IdPeca', sql.Int, idPeca)
            .input('IdVendedor', sql.Int, idVendedor)
            .input('NomePeca', sql.VarChar(255), nomeFinal)
            .input('Condicao', sql.VarChar(50), condicaoFinal)
            .input('Metodos', sql.VarChar(255), metodosAceites)
            .query(`
                INSERT INTO VENDA_PECA (preco, data_colocacao, estado, PECAid_peca, UTILIZADORid_utilizador, nome_peca, condicao, metodos_aceites)
                OUTPUT INSERTED.id_venda
                VALUES (@Preco, GETDATE(), 'Disponível', @IdPeca, @IdVendedor, @NomePeca, @Condicao, @Metodos);
            `).then(r => r.recordset[0].id_venda);
 
        // Atualiza a galeria da peça ligando-a ao anúncio de Venda
        await transaction.request()
            .input('IdVenda', sql.Int, idVenda)
            .input('IdPeca', sql.Int, idPeca)
            .query(`UPDATE FOTO_PECA SET VENDAid_venda = @IdVenda WHERE PECAid_peca = @IdPeca AND VENDAid_venda IS NULL;`);

        await transaction.commit();
        return idVenda;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
/**
 * Fecha e regista na Base de dados que a transação ocorreu para o comprador indicado.
 */
async function registarConclusaoVenda(idVenda, idComprador, metodoPagamento) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        const vendaResult = await transaction.request()
            .input('IdVenda', sql.Int, idVenda)
            .query(`
                SELECT v.PECAid_peca, v.estado, p.nome, p.estado AS condicao 
                FROM VENDA_PECA v JOIN PECA p ON v.PECAid_peca = p.id_peca WHERE v.id_venda = @IdVenda;
            `);
 
        if (vendaResult.recordset.length === 0) throw new Error('Venda não encontrada.');
        if (!['Disponível', 'Disponivel'].includes(vendaResult.recordset[0].estado)) throw new Error('Esta venda já não está disponível.');
 
        const { nome, condicao } = vendaResult.recordset[0];
 
        await transaction.request()
            .input('IdComprador', sql.Int, idComprador)
            .input('MetodoPagamento', sql.VarChar(50), metodoPagamento)
            .input('IdVenda', sql.Int, idVenda)
            .input('NomePeca', sql.VarChar(255), nome)
            .input('Condicao', sql.VarChar(50), condicao)
            .query(`
                UPDATE VENDA_PECA 
                SET data_venda = GETDATE(), estado = 'Concluída', UTILIZADORid_utilizador2 = @IdComprador, 
                    metodo_pagamento = @MetodoPagamento, nome_peca = @NomePeca, condicao = @Condicao
                WHERE id_venda = @IdVenda;
            `);
 
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Utilitário isolado para registar as imagens (Base64) de uma peça.
 */
async function registarFotosPeca(idPeca, fotosBase64) {
    const pool = await poolPromise; 
    try {
        for (const foto of fotosBase64) { 
            await pool.request()
                .input('IdPeca', sql.Int, idPeca)
                .input('Foto', sql.VarChar(sql.MAX), foto) 
                .query(`INSERT INTO FOTO_PECA (PECAid_peca, foto) VALUES (@IdPeca, @Foto)`);
        }
        return true;
    } catch (error) { throw error; }
}
 
// Exportação modular do objeto Model completo
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
    eliminarPecaCompleta, 
    atualizarDadosCompletosPeca, 
    atualizarDadosVenda,
    atualizarFotosPeca, 
    registarFotosPeca, 
    registarConclusaoVenda
};