const { poolPromise } = require('../config/db');
const sql = require('mssql');
 
// ============================================================================
// 1. CATÁLOGO E GESTÃO DE PEÇAS
// ============================================================================
 
async function getCatalogoPecas() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT p.id_peca, p.nome AS nome_peca, p.descricao, p.tamanho, p.estado AS condicao_peca,
                   p.origem, p.localizacao, p.disponivel_para_emprestimo, p.disponivel_para_venda,
                   p.data_registo, cp.nome AS categoria, u.nome AS registado_por, f.foto AS foto_principal
            FROM PECA p
            JOIN CATEGORIA_PECA cp ON p.CATEGORIA_PECAid_categoria_peca = cp.id_categoria_peca
            JOIN UTILIZADOR u ON p.UTILIZADORid_utilizador = u.id_utilizador
            LEFT JOIN (
                SELECT PECAid_peca, MIN(CAST(foto AS NVARCHAR(MAX))) AS foto 
                FROM FOTO_PECA GROUP BY PECAid_peca
            ) f ON p.id_peca = f.PECAid_peca
            ORDER BY p.nome ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) { throw error; }
}
 
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
 
        const resultFotos = await pool.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT id_foto_peca, foto FROM FOTO_PECA WHERE PECAid_peca = @IdPeca ORDER BY id_foto_peca ASC;`);
 
        return { ...resultPeca.recordset[0], fotos: resultFotos.recordset };
    } catch (error) { throw error; }
}
 
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
                INSERT INTO PECA (nome, descricao, tamanho, estado, origem, localizacao, disponivel_para_emprestimo, disponivel_para_venda, data_registo, UTILIZADORid_utilizador, CATEGORIA_PECAid_categoria_peca)
                OUTPUT INSERTED.id_peca
                VALUES (@Nome, @Descricao, @Tamanho, @Estado, @Origem, @Localizacao, @DispEmprestimo, @DispVenda, GETDATE(), @IdUtilizador, @IdCategoria);
            `);
        return result.recordset[0].id_peca;
    } catch (error) { throw error; }
}
 
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

async function eliminarPecaCompleta(idPeca) {
    const pool = await poolPromise; 
    const transaction = pool.transaction();
    try {
        await transaction.begin();
        await transaction.request().input('IdPeca', sql.Int, idPeca).query('DELETE FROM FOTO_PECA WHERE PECAid_peca = @IdPeca');
        await transaction.request().input('IdPeca', sql.Int, idPeca).query('DELETE FROM VENDA_PECA WHERE PECAid_peca = @IdPeca');
        const result = await transaction.request().input('IdPeca', sql.Int, idPeca).query('DELETE FROM PECA WHERE id_peca = @IdPeca');
        await transaction.commit();
        return result.rowsAffected[0] > 0;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

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
// ATUALIZAR DADOS DA VENDA (Preço, Nome e Condição)
// ============================================================================
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

async function atualizarFotosPeca(idPeca, fotosBase64) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        const vendaAtiva = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT id_venda FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')`);
        
        const idVenda = vendaAtiva.recordset.length > 0 ? vendaAtiva.recordset[0].id_venda : null;

        await transaction.request().input('IdPeca', sql.Int, idPeca).query('DELETE FROM FOTO_PECA WHERE PECAid_peca = @IdPeca');
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
 
async function requisitarEmprestimo(dadosEmprestimo, itensEmprestimo) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        for (const item of itensEmprestimo) {
            const disponivel = await transaction.request()
                .input('IdPeca', sql.Int, item.idPeca)
                .query(`SELECT disponivel_para_emprestimo FROM PECA WHERE id_peca = @IdPeca AND disponivel_para_emprestimo = 1;`);
            if (disponivel.recordset.length === 0) throw new Error(`A peça com id ${item.idPeca} não está disponível.`);
        }
 
        const idEmprestimo = await transaction.request()
            .input('DataInicio', sql.Date, dadosEmprestimo.dataInicio)
            .input('DataFim', sql.Date, dadosEmprestimo.dataFim)
            .input('Observacoes', sql.VarChar(255), dadosEmprestimo.observacoes || null)
            .input('IdUtilizador', sql.Int, dadosEmprestimo.idUtilizador)
            .query(`
                INSERT INTO EMPRESTIMO (data_pedido, data_inicio, data_fim, estado, observacoes, UTILIZADORid_utilizador)
                OUTPUT INSERTED.id_emprestimo
                VALUES (GETDATE(), @DataInicio, @DataFim, 'Pendente', @Observacoes, @IdUtilizador);
            `).then(r => r.recordset[0].id_emprestimo);
 
        for (const item of itensEmprestimo) {
            await transaction.request()
                .input('EstadoEntrega', sql.VarChar(50), item.estadoEntrega)
                .input('IdPeca', sql.Int, item.idPeca)
                .input('IdEmprestimo', sql.Int, idEmprestimo)
                .query(`INSERT INTO EMPRESTIMO_ITEM (estado_entrega, PECAid_peca, [EMPRESIMO id_emprestimo]) VALUES (@EstadoEntrega, @IdPeca, @IdEmprestimo);`);
 
            await transaction.request().input('IdPeca', sql.Int, item.idPeca).query(`UPDATE PECA SET disponivel_para_emprestimo = 0 WHERE id_peca = @IdPeca;`);
        }
        await transaction.commit();
        return idEmprestimo;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
async function registarDevolucaoEmprestimo(idEmprestimo, estadoFinal, observacoes, itensDevolvidos) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        await transaction.request()
            .input('EstadoFinal', sql.VarChar(50), estadoFinal)
            .input('Observacoes', sql.VarChar(255), observacoes || null)
            .input('IdEmprestimo', sql.Int, idEmprestimo)
            .query(`UPDATE EMPRESTIMO SET data_devolucao = GETDATE(), estado = @EstadoFinal, observacoes = @Observacoes WHERE id_emprestimo = @IdEmprestimo;`);
 
        for (const item of itensDevolvidos) {
            await transaction.request()
                .input('EstadoDevolucao', sql.VarChar(50), item.estadoDevolucao)
                .input('IdPeca', sql.Int, item.idPeca)
                .input('IdEmprestimo', sql.Int, idEmprestimo)
                .query(`UPDATE EMPRESTIMO_ITEM SET estado_devolucao = @EstadoDevolucao WHERE PECAid_peca = @IdPeca AND [EMPRESIMO id_emprestimo] = @IdEmprestimo;`);
 
            if (item.estadoDevolucao !== 'Danificado' && item.estadoDevolucao !== 'Perdido') {
                await transaction.request()
                    .input('IdPeca', sql.Int, item.idPeca)
                    .query(`UPDATE PECA SET disponivel_para_emprestimo = 1, estado = @EstadoDevolucao WHERE id_peca = @IdPeca;`).catch(() => {}); 
            }
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
                INSERT INTO PENALIZACAO_PECA (tipo, valor, descricao, data_registo, PECAid_peca, EMPRESTIMOid_emprestimo)
                OUTPUT INSERTED.id_penalizacao
                VALUES (@Tipo, @Valor, @Descricao, GETDATE(), @IdPeca, @IdEmprestimo);
            `);
        return result.recordset[0].id_penalizacao;
    } catch (error) {
        throw error;
    }
}
 
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
                SET valor = @Valor, metodo_pagamento = @MetodoPagamento, estado_pagamento = @EstadoPagamento, data_pagamento = GETDATE()
                WHERE id_emprestimo = @IdEmprestimo;
            `);
        return result.rowsAffected[0] > 0;
    } catch (error) {
        throw error;
    }
}
 
// ============================================================================
// 4. VENDA E FOTOS
// ============================================================================
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

        return result.recordset.map(row => ({
            ...row,
            fotos: row.fotos_agrupadas ? row.fotos_agrupadas.split('|||') : []
        }));
    } catch (error) { throw error; }
}
 
async function colocarPecaAVenda(idPeca, preco, idVendedor, nomePeca = null, condicaoPeca = null, metodosAceites = '') {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        const pecaResult = await transaction.request()
            .input('IdPeca', sql.Int, idPeca)
            .query(`SELECT disponivel_para_venda, nome, estado FROM PECA WHERE id_peca = @IdPeca;`);
            
        if (pecaResult.recordset.length === 0) throw new Error('Peça não encontrada.');
        if (!pecaResult.recordset[0].disponivel_para_venda) throw new Error('Esta peça não está disponível para venda.');
 
        const nomeFinal = nomePeca || pecaResult.recordset[0].nome;
        const condicaoFinal = condicaoPeca || pecaResult.recordset[0].estado;

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