// Localização: backend/src/models/vendaModel.js
const sql = require('mssql');
const { poolPromise } = require('../config/db');

// 1. Obter todas as Vendas
exports.obterTodasVendas = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT 
            v.id_venda, v.preco, v.estado, v.nome_peca as PECA_nome, 
            v.condicao, v.metodo_pagamento as metodos_pagamento,
            p.tamanho, p.descricao,
            u.nome as UTILIZADOR_nome, u.id_utilizador,
            u2.nome as COMPRADOR_nome,
            (
                SELECT foto_base64 
                FROM [vivadarte].[dbo].[FOTO_PECA] f 
                WHERE f.VENDAid_venda = v.id_venda 
                FOR JSON PATH
            ) as fotos_json
        FROM [vivadarte].[dbo].[VENDA_PECA] v
        INNER JOIN [vivadarte].[dbo].[UTILIZADOR] u ON v.UTILIZADORid_utilizador = u.id_utilizador
        LEFT JOIN [vivadarte].[dbo].[UTILIZADOR] u2 ON v.UTILIZADORid_utilizador2 = u2.id_utilizador
        LEFT JOIN [vivadarte].[dbo].[PECA] p ON v.PECAid_peca = p.id_peca
        ORDER BY v.data_colocacao DESC
    `);

    return result.recordset.map(v => {
        const fotos = v.fotos_json ? JSON.parse(v.fotos_json).map(f => f.foto_base64) : [];
        return {
            ...v,
            metodos_pagamento: v.metodos_pagamento ? v.metodos_pagamento.split(',') : [],
            fotos: fotos.length > 0 ? fotos : []
        };
    });
};

// 2. Criar Venda Completa (com transação)
exports.criarVendaCompleta = async (dados) => {
    const { PECA_nome, preco, condicao, metodos_pagamento, fotos, id_utilizador, tamanho, descricao } = dados;
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
        const requestPeca = new sql.Request(transaction);
        requestPeca.input('nome', sql.VarChar, PECA_nome);
        requestPeca.input('tamanho', sql.VarChar, tamanho || null);
        requestPeca.input('descricao', sql.VarChar, descricao || null);
        requestPeca.input('id_utilizador', sql.Int, id_utilizador);
        requestPeca.input('categoria', sql.Int, 1); 

        // AQUI ESTÁ A CORREÇÃO: Adicionado disponivel_para_emprestimo e o valor 0
        const resultPeca = await requestPeca.query(`
            INSERT INTO [vivadarte].[dbo].[PECA] 
            (nome, tamanho, descricao, estado, disponivel_para_venda, disponivel_para_emprestimo, UTILIZADORid_utilizador, CATEGORIA_PECAid_categoria_peca, data_registo)
            OUTPUT INSERTED.id_peca
            VALUES (@nome, @tamanho, @descricao, 'Novo', 1, 0, @id_utilizador, @categoria, GETDATE())
        `);
        const id_peca = resultPeca.recordset[0].id_peca;

        const requestVenda = new sql.Request(transaction);
        requestVenda.input('preco', sql.Decimal(10,2), preco);
        requestVenda.input('condicao', sql.VarChar, condicao);
        requestVenda.input('metodo_pagamento', sql.VarChar, metodos_pagamento.join(','));
        requestVenda.input('nome_peca', sql.VarChar, PECA_nome);
        requestVenda.input('id_peca', sql.Int, id_peca);
        requestVenda.input('id_utilizador', sql.Int, id_utilizador);

        const resultVenda = await requestVenda.query(`
            INSERT INTO [vivadarte].[dbo].[VENDA_PECA] 
            (preco, condicao, estado, metodo_pagamento, nome_peca, data_colocacao, PECAid_peca, UTILIZADORid_utilizador)
            OUTPUT INSERTED.id_venda
            VALUES (@preco, @condicao, 'Disponível', @metodo_pagamento, @nome_peca, GETDATE(), @id_peca, @id_utilizador)
        `);
        const id_venda = resultVenda.recordset[0].id_venda;

        if (fotos && fotos.length > 0) {
            for (const fotoBase64 of fotos) {
                const requestFoto = new sql.Request(transaction);
                requestFoto.input('foto_base64', sql.VarChar(sql.MAX), fotoBase64);
                requestFoto.input('id_peca', sql.Int, id_peca);
                requestFoto.input('id_venda', sql.Int, id_venda);
                await requestFoto.query(`
                    INSERT INTO [vivadarte].[dbo].[FOTO_PECA] (foto_base64, PECAid_peca, VENDAid_venda)
                    VALUES (@foto_base64, @id_peca, @id_venda)
                `);
            }
        }
        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};

// 3. Atualizar Venda
exports.atualizarVendaCompleta = async (id, dados) => {
    const { PECA_nome, preco, estado, UTILIZADORid_utilizador2, tamanho, descricao } = dados; 
    const pool = await poolPromise;
    const request = pool.request();
    
    request.input('id_venda', sql.Int, id);
    request.input('preco', sql.Decimal(10, 2), preco);
    request.input('estado', sql.VarChar, estado);
    request.input('nome_peca', sql.VarChar, PECA_nome);

    let queryVenda = `
        UPDATE [vivadarte].[dbo].[VENDA_PECA] 
        SET preco = @preco, estado = @estado, nome_peca = @nome_peca
    `;

    if (UTILIZADORid_utilizador2) {
        request.input('id_comprador', sql.Int, UTILIZADORid_utilizador2);
        queryVenda += `, UTILIZADORid_utilizador2 = @id_comprador, data_venda = GETDATE()`;
    }

    queryVenda += ` WHERE id_venda = @id_venda`;
    await request.query(queryVenda);

    if (tamanho !== undefined || descricao !== undefined) {
        const requestPeca = pool.request();
        requestPeca.input('id_venda', sql.Int, id);
        requestPeca.input('tamanho', sql.VarChar, tamanho || null);
        requestPeca.input('descricao', sql.VarChar, descricao || null);
        
        await requestPeca.query(`
            UPDATE [vivadarte].[dbo].[PECA]
            SET tamanho = @tamanho, descricao = @descricao
            WHERE id_peca = (SELECT PECAid_peca FROM [vivadarte].[dbo].[VENDA_PECA] WHERE id_venda = @id_venda)
        `);
    }
};

// 4. Apagar Venda
exports.apagarVendaCompleta = async (id) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const request = new sql.Request(transaction);
        request.input('id_venda', sql.Int, id);

        const resultVenda = await request.query(`SELECT PECAid_peca FROM [vivadarte].[dbo].[VENDA_PECA] WHERE id_venda = @id_venda`);
        const id_peca = resultVenda.recordset.length > 0 ? resultVenda.recordset[0].PECAid_peca : null;

        await request.query(`DELETE FROM [vivadarte].[dbo].[FOTO_PECA] WHERE VENDAid_venda = @id_venda`);
        await request.query(`DELETE FROM [vivadarte].[dbo].[VENDA_PECA] WHERE id_venda = @id_venda`);

        if (id_peca) {
            request.input('id_peca', sql.Int, id_peca);
            await request.query(`DELETE FROM [vivadarte].[dbo].[PECA] WHERE id_peca = @id_peca`);
        }

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};