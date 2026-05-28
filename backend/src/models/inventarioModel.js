/**
 * @fileoverview Modelo de Dados do Inventário
 * @description Este ficheiro centraliza a comunicação com a base de dados SQL Server para gerir
 * peças, fotografias, empréstimos, multas e transações do mercado de segunda mão.
 */

const { poolPromise } = require("../config/db");
const sql = require("mssql");

// ============================================================================
// 1. CATÁLOGO E GESTÃO DE PEÇAS
// ============================================================================

/**
 * @async
 * @function getCatalogoPecas
 * @description Obtém a lista completa do catálogo de peças.
 * Utiliza junções complexas (JOIN e OUTER APPLY) para trazer os dados da peça,
 * a foto principal, e o estado do empréstimo ativo no momento.
 * @returns {Promise<Array<Object>>} Um array com o catálogo atualizado de peças.
 * @throws {Error} Propaga qualquer erro de consulta DB.
 */
async function getCatalogoPecas() {
  try {
    const pool = await poolPromise;
    const query = `
            SELECT p.id_peca, p.nome AS nome_peca, p.descricao, p.tamanho, p.estado AS condicao_peca,
                   p.origem, p.localizacao, p.disponivel_para_emprestimo, p.disponivel_para_venda,
                   p.data_registo, cp.nome AS categoria, u.nome AS registado_por, f.foto AS foto_principal,
                   p.UTILIZADORid_utilizador,

                  (SELECT COUNT(*) 
                  FROM EMPRESTIMO e2 
                  JOIN EMPRESTIMO_ITEM ei2 ON e2.id_emprestimo = ei2.[EMPRESIMO id_emprestimo] 
                  WHERE ei2.PECAid_peca = p.id_peca AND e2.estado = 'Pendente') AS pedidos_pendentes,

                   active_emp.id_emprestimo AS active_id_emprestimo,
                   active_emp.data_inicio AS emprestimo_inicio,
                   active_emp.data_fim AS emprestimo_fim,
                   base_emp.valor AS valor_dia,
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
                       ELSE ISNULL(NULLIF(base_emp.observacoes, ''), 'MBWay')
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
  } catch (error) {
    throw error;
  }
}

/**
 * @async
 * @function getPecaDetalhes
 * @description Devolve as informações detalhadas de uma única peça, incluindo a galeria completa de fotos e estado.
 * @param {number} idPeca - O ID numérico da peça a consultar.
 * @returns {Promise<Object|null>} Os detalhes da peça ou null se não encontrada.
 * @throws {Error} Caso encontre erros de execução.
 */
async function getPecaDetalhes(idPeca) {
  try {
    const pool = await poolPromise;
    const resultPeca = await pool.request().input("IdPeca", sql.Int, idPeca)
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

    const resultFotos = await pool
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query(
        `SELECT id_foto_peca, foto FROM FOTO_PECA WHERE PECAid_peca = @IdPeca ORDER BY id_foto_peca ASC;`,
      );

    return { ...resultPeca.recordset[0], fotos: resultFotos.recordset };
  } catch (error) {
    throw error;
  }
}

/**
 * @async
 * @function registarNovaPeca
 * @description Cria uma nova peça e, se necessário, configura automaticamente o seu perfil de empréstimo.
 * Tudo protegido por uma Transação SQL (Se falhar a configuração do empréstimo, a peça não é guardada).
 * @param {Object} dadosPeca - Dados e especificações do item.
 * @param {string} dadosPeca.nome - O nome do item.
 * @param {string} [dadosPeca.descricao] - Descrição opcional.
 * @param {string} [dadosPeca.tamanho] - O tamanho aplicável.
 * @param {string} [dadosPeca.estado] - Estado ou condição física.
 * @param {number} dadosPeca.idUtilizador - O ID do criador da peça.
 * @param {number} dadosPeca.idCategoria - Categoria classificativa.
 * @param {boolean} dadosPeca.isEmprestimo - Se fica disponível para aluguer.
 * @param {boolean} dadosPeca.isVenda - Se fica disponível no mercado.
 * @param {number} [dadosPeca.valor_dia] - Preço por dia.
 * @param {string} [dadosPeca.metodosStr] - Métodos de pagamento definidos.
 * @returns {Promise<number>} Devolve o novo ID gerado pela base de dados para a peça.
 * @throws {Error} Reverte transação em caso de erro na DB.
 */
async function registarNovaPeca(dadosPeca) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    const resultPeca = await transaction
      .request()
      .input("Nome", sql.VarChar(255), dadosPeca.nome)
      .input("Desc", sql.VarChar(255), dadosPeca.descricao || "")
      .input("Tam", sql.VarChar(50), dadosPeca.tamanho || "")
      .input("Est", sql.VarChar(50), dadosPeca.estado || "Novo")
      .input("IdUtilizador", sql.Int, dadosPeca.idUtilizador)
      .input("DispEmp", sql.Bit, dadosPeca.isEmprestimo ? 1 : 0)
      .input("DispVenda", sql.Bit, dadosPeca.isVenda ? 1 : 0)
      .input("IdCat", sql.Int, dadosPeca.idCategoria || 1).query(`
        INSERT INTO PECA (nome, descricao, tamanho, estado, localizacao, disponivel_para_emprestimo, disponivel_para_venda, data_registo, UTILIZADORid_utilizador, CATEGORIA_PECAid_categoria_peca)
        OUTPUT INSERTED.id_peca
        VALUES (@Nome, @Desc, @Tam, @Est, NULL, @DispEmp, @DispVenda, GETDATE(), @IdUtilizador, @IdCat);
    `);

    const idPeca = resultPeca.recordset[0].id_peca;

    if (dadosPeca.isEmprestimo) {
      const resultEmp = await transaction
        .request()
        .input("Valor", sql.Decimal(10, 2), dadosPeca.valor_dia || 0)
        .input("Metodos", sql.VarChar(255), dadosPeca.metodosStr || "MBWay") // Ajuste conforme necessário
        .input("IdUtilizador", sql.Int, dadosPeca.idUtilizador).query(`
            INSERT INTO EMPRESTIMO (valor, observacoes, estado, data_pedido, UTILIZADORid_utilizador)
            OUTPUT INSERTED.id_emprestimo
            VALUES (@Valor, @Metodos, 'Disponível', GETDATE(), @IdUtilizador);
        `);

      const idEmprestimo = resultEmp.recordset[0].id_emprestimo;

      await transaction
        .request()
        .input("IdPeca", sql.Int, idPeca)
        .input("IdEmp", sql.Int, idEmprestimo)
        .query(
          `INSERT INTO EMPRESTIMO_ITEM (PECAid_peca, [EMPRESIMO id_emprestimo]) VALUES (@IdPeca, @IdEmp)`,
        );
    }

    if (dadosPeca.isVenda && dadosPeca.preco > 0) {
      await transaction
        .request()
        .input("Preco", sql.Decimal(10, 2), dadosPeca.preco)
        .input("IdPecaV", sql.Int, idPeca)
        .input("IdVendedor", sql.Int, dadosPeca.idUtilizador)
        .input("NomeV", sql.VarChar(255), dadosPeca.nome)
        .input("CondV", sql.VarChar(50), dadosPeca.estado || "Novo")
        .input("MetodosV", sql.VarChar(255), dadosPeca.metodosStr || "").query(`
            INSERT INTO VENDA_PECA (preco, data_colocacao, estado, PECAid_peca, UTILIZADORid_utilizador, nome_peca, condicao, metodos_aceites)
            VALUES (@Preco, GETDATE(), 'Disponível', @IdPecaV, @IdVendedor, @NomeV, @CondV, @MetodosV);
        `);
    }

    await transaction.commit();
    return idPeca;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * @async
 * @function atualizarEstadoPeca
 * @description Atualiza sinaléticas de disponibilidade (Venda/Empréstimo), assim como localização.
 * @param {number} idPeca - ID da peça em atualização.
 * @param {Object} opcoes - Conjunto de parâmetros.
 * @param {string} opcoes.estado - Estado de conservação atual da peça.
 * @param {boolean} opcoes.disponivelEmprestimo - Se é ou não emprestável.
 * @param {boolean} opcoes.disponivelVenda - Se a venda está ativa.
 * @param {string|null} [opcoes.localizacao] - Armazém/Gabinete onde se encontra.
 * @returns {Promise<boolean>} True mediante sucesso da query.
 * @throws {Error} Falhas de execução SQL.
 */
async function atualizarEstadoPeca(
  idPeca,
  { estado, disponivelEmprestimo, disponivelVenda, localizacao },
) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .input("Estado", sql.VarChar(50), estado)
      .input("DispEmprestimo", sql.Bit, disponivelEmprestimo ? 1 : 0)
      .input("DispVenda", sql.Bit, disponivelVenda ? 1 : 0)
      .input("Localizacao", sql.VarChar(255), localizacao || null)
      .query(
        `UPDATE PECA SET estado = @Estado, disponivel_para_emprestimo = @DispEmprestimo, disponivel_para_venda = @DispVenda, localizacao = @Localizacao WHERE id_peca = @IdPeca;`,
      );
    return result.rowsAffected[0] > 0;
  } catch (error) {
    throw error;
  }
}

/**
 * @async
 * @function eliminarPecaCompleta
 * @description Eliminação destrutiva e em cascata (Manual) de uma peça do sistema.
 * Feito via transação atómica para evitar que a Foreign Key viole a integridade se falhar a meio.
 * @param {number} idPeca - O ID do objeto a purgar da BD.
 * @returns {Promise<boolean>} True se apagada sem problemas.
 * @throws {Error} Reverte transação e propaga caso aconteça um erro de Foreign Key.
 */
async function eliminarPecaCompleta(idPeca) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  try {
    await transaction.begin();

    const emprestimos = await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query(
        `SELECT [EMPRESIMO id_emprestimo] as id FROM EMPRESTIMO_ITEM WHERE PECAid_peca = @IdPeca`,
      );

    const idsEmp = emprestimos.recordset.map((e) => e.id);

    if (idsEmp.length > 0) {
      const idsStr = idsEmp.join(",");

      await transaction
        .request()
        .query(
          `DELETE FROM PENALIZACAO_PECA WHERE EMPRESTIMOid_emprestimo IN (${idsStr})`,
        );

      await transaction
        .request()
        .input("IdPeca", sql.Int, idPeca)
        .query(`DELETE FROM EMPRESTIMO_ITEM WHERE PECAid_peca = @IdPeca`);

      await transaction
        .request()
        .query(`DELETE FROM EMPRESTIMO WHERE id_emprestimo IN (${idsStr})`);
    }

    await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query("DELETE FROM FOTO_PECA WHERE PECAid_peca = @IdPeca");

    await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query("DELETE FROM VENDA_PECA WHERE PECAid_peca = @IdPeca");

    const result = await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query("DELETE FROM PECA WHERE id_peca = @IdPeca");

    await transaction.commit();
    return result.rowsAffected[0] > 0;
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao eliminar peça:", error);
    throw error;
  }
}

/**
 * @async
 * @function atualizarDadosCompletosPeca
 * @description Permite a edição abrangente dos detalhes informativos e descritivos da peça física.
 * @param {number} idPeca - O ID da peça a ser afetada.
 * @param {Object} dados - Estrutura dos dados submetidos.
 * @param {string} dados.nome - O nome principal da peça.
 * @param {string} dados.descricao - A descrição textual.
 * @param {string} dados.tamanho - A dimensão ou tamanho aplicável.
 * @param {string} dados.estado - A condição de conservação.
 * @returns {Promise<void>} Atualização sem retorno.
 */
async function atualizarDadosCompletosPeca(idPeca, dados) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .input("Nome", sql.VarChar(255), dados.nome)
      .input("Descricao", sql.VarChar(255), dados.descricao)
      .input("Tamanho", sql.VarChar(50), dados.tamanho)
      .input("Estado", sql.VarChar(50), dados.estado)
      .input("DispVenda", sql.Bit, dados.disponivelVenda ? 1 : 0)
      .input("DispEmp", sql.Bit, dados.disponivelEmprestimo ? 1 : 0).query(`
        UPDATE PECA 
        SET nome = @Nome, 
            descricao = @Descricao, 
            tamanho = @Tamanho, 
            estado = @Estado, 
            disponivel_para_venda = @DispVenda, 
            disponivel_para_emprestimo = @DispEmp
        WHERE id_peca = @IdPeca;
      `);

    if (dados.disponivelVenda && dados.preco > 0) {
      const vendaExiste = await transaction
        .request()
        .input("IdPeca", sql.Int, idPeca)
        .query(
          `SELECT id_venda FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel');`,
        );

      if (vendaExiste.recordset.length > 0) {
        await transaction
          .request()
          .input("IdPeca", sql.Int, idPeca)
          .input("Preco", sql.Decimal(10, 2), dados.preco)
          .input("NomePeca", sql.VarChar(255), dados.nome)
          .input("Condicao", sql.VarChar(50), dados.estado)
          .input("Metodos", sql.VarChar(255), dados.metodosStr || "MBWay")
          .query(`
    UPDATE VENDA_PECA 
    SET preco = @Preco, 
        nome_peca = @NomePeca, 
        condicao = @Condicao, 
        metodos_aceites = @Metodos
    WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')
  `);
      } else {
        await transaction
          .request()
          .input("Preco", sql.Decimal(10, 2), dados.preco)
          .input("IdPecaV", sql.Int, idPeca)
          .input("IdVendedor", sql.Int, dados.idUtilizador)
          .input("NomeV", sql.VarChar(255), dados.nome)
          .input("CondV", sql.VarChar(50), dados.estado || "Novo")
          .input("MetodosV", sql.VarChar(255), dados.metodosStr || "").query(`
            INSERT INTO VENDA_PECA (preco, data_colocacao, estado, PECAid_peca, UTILIZADORid_utilizador, nome_peca, condicao, metodos_aceites)
            VALUES (@Preco, GETDATE(), 'Disponível', @IdPecaV, @IdVendedor, @NomeV, @CondV, @MetodosV);
          `);
      }
    } else {
      await transaction.request().input("IdPeca", sql.Int, idPeca).query(`
          UPDATE VENDA_PECA 
          SET estado = 'Cancelado' 
          WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')
        `);
    }

    if (dados.disponivelEmprestimo) {
      const empExiste = await transaction
        .request()
        .input("IdPeca", sql.Int, idPeca)
        .query(
          `SELECT TOP 1 [EMPRESIMO id_emprestimo] as id FROM EMPRESTIMO_ITEM WHERE PECAid_peca = @IdPeca ORDER BY [EMPRESIMO id_emprestimo] ASC;`,
        );

      if (empExiste.recordset.length > 0) {
        const idEmprestimo = empExiste.recordset[0].id;
        await transaction
          .request()
          .input("IdEmp", sql.Int, idEmprestimo)
          .input("NovoValor", sql.Decimal(10, 2), dados.valor_dia || 0) // Garante o novo valor
          .input(
            "MetodosEmp",
            sql.VarChar(255),
            `Métodos: ${dados.metodosStrEmprestimo || "MBWay"}`,
          ).query(`
                UPDATE EMPRESTIMO 
                SET valor = @NovoValor, 
                    observacoes = @MetodosEmp 
                WHERE id_emprestimo = @IdEmp
            `);
      } else {
        const resultEmp = await transaction
          .request()
          .input("Valor", sql.Decimal(10, 2), dados.valor_dia || 0)
          .input(
            "MetodosEmp",
            sql.VarChar(255),
            `Métodos: ${dados.metodosStrEmprestimo || "MBWay"}`,
          )
          .input("IdUtilizador", sql.Int, dados.idUtilizador).query(`
            INSERT INTO EMPRESTIMO (valor, observacoes, estado, data_pedido, UTILIZADORid_utilizador)
            OUTPUT INSERTED.id_emprestimo
            VALUES (@Valor, @MetodosEmp, 'Disponível', GETDATE(), @IdUtilizador);
          `);

        const idEmprestimo = resultEmp.recordset[0].id_emprestimo;

        await transaction
          .request()
          .input("IdPeca", sql.Int, idPeca)
          .input("IdEmp", sql.Int, idEmprestimo)
          .query(
            `INSERT INTO EMPRESTIMO_ITEM (PECAid_peca, [EMPRESIMO id_emprestimo]) VALUES (@IdPeca, @IdEmp)`,
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

// ============================================================================
// ATUALIZAR DADOS DA VENDA
// ============================================================================

/**
 * @async
 * @function atualizarDadosVenda
 * @description Sincroniza as alterações de uma peça com o seu anúncio de venda caso esteja online.
 * @param {number} idPeca - ID da peça em comercialização.
 * @param {number} preco - O preço de mercado revisto.
 * @param {string} nome - O título descritivo para venda.
 * @param {string} condicao - A condição comercial.
 * @param {string} metodosAceites - String formatada de métodos.
 * @returns {Promise<void>}
 */
async function atualizarDadosVenda(
  idPeca,
  preco,
  nome,
  condicao,
  metodosAceites,
) {
  const pool = await poolPromise;
  await pool
    .request()
    .input("IdPeca", sql.Int, idPeca)
    .input("Preco", sql.Decimal(10, 2), preco)
    .input("NomePeca", sql.VarChar(255), nome)
    .input("Condicao", sql.VarChar(50), condicao)
    .input("Metodos", sql.VarChar(255), metodosAceites).query(`
            UPDATE VENDA_PECA 
            SET preco = @Preco, nome_peca = @NomePeca, condicao = @Condicao, metodos_aceites = @Metodos
            WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')
        `);
}

/**
 * @async
 * @function atualizarFotosPeca
 * @description Atualiza a galeria de imagens. Limpa a antiga e insere as novas fotos em Base64.
 * Vincula automaticamente à Venda, se a peça estiver à venda no momento.
 * @param {number} idPeca - O ID da peça cujas fotos vão ser atualizadas.
 * @param {Array<string>} fotosBase64 - Os base64 convertidos das fotos.
 * @returns {Promise<boolean>} True a validar transação de remoção+inserção.
 * @throws {Error} Reversão em caso de quebra transacional DB.
 */
async function atualizarFotosPeca(idPeca, fotosBase64) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const vendaAtiva = await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query(
        `SELECT id_venda FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel')`,
      );

    const idVenda =
      vendaAtiva.recordset.length > 0 ? vendaAtiva.recordset[0].id_venda : null;

    await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query("DELETE FROM FOTO_PECA WHERE PECAid_peca = @IdPeca");

    for (const foto of fotosBase64) {
      await transaction
        .request()
        .input("IdPeca", sql.Int, idPeca)
        .input("IdVenda", sql.Int, idVenda)
        .input("Foto", sql.VarChar(sql.MAX), foto)
        .query(
          `INSERT INTO FOTO_PECA (PECAid_peca, VENDAid_venda, foto) VALUES (@IdPeca, @IdVenda, @Foto)`,
        );
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
 * @async
 * @function requisitarEmprestimo
 * @description Inicializa a requisição de um empréstimo aproveitando o registo de configuração base
 * que foi criado aquando da inserção original da peça (na flag disponivelEmprestimo).
 * @param {Object} dados - O input recebido na requisição.
 * @param {number} dados.idPeca - A peça pretendida.
 * @param {number} dados.idUtilizador - O solicitador.
 * @param {string|Date} dados.dataInicio - Início pretendido.
 * @param {string|Date} dados.dataFim - Fim pretendido.
 * @param {string} [dados.observacoes] - Notas enviadas.
 * @param {string} dados.metodoPagamento - Método de liquidação.
 * @param {string} dados.estadoEntrega - Estado apurado de entrega.
 * @returns {Promise<void>}
 * @throws {Error} Propaga ou reverte com mensagem de configuração inexistente.
 */
async function requisitarEmprestimo(dados) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // 1. Descobrir a configuração base (preço e métodos)
    const configBase = await transaction
      .request()
      .input("IdPeca", sql.Int, dados.idPeca)
      .query(
        "SELECT TOP 1 e.valor, e.observacoes FROM EMPRESTIMO_ITEM ei JOIN EMPRESTIMO e ON ei.[EMPRESIMO id_emprestimo] = e.id_emprestimo WHERE ei.PECAid_peca = @IdPeca ORDER BY e.id_emprestimo ASC",
      );

    if (configBase.recordset.length === 0) {
      throw new Error(
        "Configuração de empréstimo não encontrada para esta peça.",
      );
    }

    const valorDia = configBase.recordset[0].valor || 0;
    let obsAppend = dados.observacoes
      ? ` | Notas Pedido: ${dados.observacoes}`
      : "";

    // 2. Criar um NOVO pedido de empréstimo (INSERT em vez de UPDATE)
    const resultEmp = await transaction
      .request()
      .input("Valor", sql.Decimal(10, 2), valorDia)
      .input("Obs", sql.VarChar(255), obsAppend)
      .input("IdUser", sql.Int, dados.idUtilizador)
      .input("Inicio", sql.Date, dados.dataInicio)
      .input("Fim", sql.Date, dados.dataFim)
      .input("Metodo", sql.VarChar(50), dados.metodoPagamento || "MBWay")
      .query(`
        INSERT INTO EMPRESTIMO (valor, observacoes, estado, data_pedido, data_inicio, data_fim, UTILIZADORid_utilizador, metodo_pagamento)
        OUTPUT INSERTED.id_emprestimo
        VALUES (@Valor, @Obs, 'Pendente', GETDATE(), @Inicio, @Fim, @IdUser, @Metodo);
      `);

    const novoIdEmprestimo = resultEmp.recordset[0].id_emprestimo;

    // 3. Vincular o novo pedido à peça na tabela EMPRESTIMO_ITEM
    await transaction
      .request()
      .input("IdEmp", sql.Int, novoIdEmprestimo)
      .input("IdPeca", sql.Int, dados.idPeca)
      .input("EstadoEntrega", sql.VarChar(50), dados.estadoEntrega).query(`
        INSERT INTO EMPRESTIMO_ITEM (PECAid_peca, [EMPRESIMO id_emprestimo], estado_entrega) 
        VALUES (@IdPeca, @IdEmp, @EstadoEntrega)
      `);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * @async
 * @function registarDevolucaoEmprestimo
 * @description Conclui um empréstimo em curso. Assinala a data e anota o estado terminal com que o material foi entregue de volta.
 * @param {number} idEmprestimo - O identificador do empréstimo.
 * @param {string} estadoFinal - Flag de estado (ex: "Concluído", "Devolvido_com_Danos").
 * @param {string} [observacoes] - Relato do estado ou motivo.
 * @param {Array<Object>} itensDevolvidos - Lista de peças sendo devolvidas e seus respetivos estados finais de devolução.
 * @returns {Promise<boolean>} Retorna true mediante sucesso.
 * @throws {Error} Executa e sinaliza rollback caso contrário.
 */
async function registarDevolucaoEmprestimo(
  idEmprestimo,
  estadoFinal,
  observacoes,
  itensDevolvidos,
) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    let obsAppend = observacoes ? ` | Devolução: ${observacoes}` : "";

    await transaction
      .request()
      .input("EstadoFinal", sql.VarChar(50), estadoFinal)
      .input("ObsAppend", sql.VarChar(255), obsAppend)
      .input("IdEmprestimo", sql.Int, idEmprestimo)
      .query(
        `UPDATE EMPRESTIMO SET data_devolucao = GETDATE(), estado = @EstadoFinal, observacoes = ISNULL(observacoes, '') + @ObsAppend WHERE id_emprestimo = @IdEmprestimo;`,
      );

    for (const item of itensDevolvidos) {
      await transaction
        .request()
        .input("EstadoDevolucao", sql.VarChar(50), item.estadoDevolucao)
        .input("IdPeca", sql.Int, item.idPeca)
        .input("IdEmprestimo", sql.Int, idEmprestimo)
        .query(
          `UPDATE EMPRESTIMO_ITEM SET estado_devolucao = @EstadoDevolucao WHERE PECAid_peca = @IdPeca AND [EMPRESIMO id_emprestimo] = @IdEmprestimo;`,
        );
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
 * @async
 * @function registarPenalizacao
 * @description Cria uma entrada de penalização/multa associada a um empréstimo cuja devolução resultou atrasada, ou peças foram danificadas.
 * @param {Object} dadosPenalizacao - Payload da multa.
 * @param {number} dadosPenalizacao.valor - O montante a penalizar.
 * @param {string} dadosPenalizacao.tipo - Dano/Perda/Atraso.
 * @param {string} [dadosPenalizacao.descricao] - Notas contextuais.
 * @param {number} dadosPenalizacao.idEmprestimo - O empréstimo gerador.
 * @returns {Promise<number>} O id gerado na inserção da penalização.
 * @throws {Error} DB Error.
 */
async function registarPenalizacao(dadosPenalizacao) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("Valor", sql.Decimal(10, 2), dadosPenalizacao.valor)
      .input(
        "Motivo",
        sql.VarChar(255),
        `${dadosPenalizacao.tipo}: ${dadosPenalizacao.descricao || ""}`,
      )
      .input("IdEmprestimo", sql.Int, dadosPenalizacao.idEmprestimo).query(`
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
 * @async
 * @function atualizarPagamentoEmprestimo
 * @description Regista o valor monetário real recebido pelo fecho ou extensão do empréstimo.
 * @param {number} idEmprestimo - O id base do registo de requisição.
 * @param {number} valor - O montante a atualizar nos registos textuais.
 * @param {string} metodoPagamento - Meio usado para tal pagamento.
 * @param {string} estadoPagamento - O novo flag de pagamento.
 * @returns {Promise<boolean>} True mediante conclusão com êxito.
 * @throws {Error} Falhas provenientes da ligação à DB.
 */
async function atualizarPagamentoEmprestimo(
  idEmprestimo,
  valor,
  metodoPagamento,
  estadoPagamento,
) {
  try {
    const pool = await poolPromise;
    let obsAppend = ` | Valor Pago: ${valor}€`;

    const result = await pool
      .request()
      .input("MetodoPagamento", sql.VarChar(50), metodoPagamento)
      .input("EstadoPagamento", sql.VarChar(50), estadoPagamento)
      .input("ObsAppend", sql.VarChar(255), obsAppend)
      .input("IdEmprestimo", sql.Int, idEmprestimo).query(`
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
 * @async
 * @function getPecasAVenda
 * @description Obtém os anúncios ativos e o histórico de vendas. Agrupa fotos num payload string-SQL para poupar chamadas iterativas de rede.
 * @returns {Promise<Array<Object>>} Uma lista mapeada com todas as instâncias comerciais disponíveis ou fechadas.
 * @throws {Error} Se ocorrerem erros na consulta.
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

    return result.recordset.map((row) => ({
      ...row,
      fotos: row.fotos_agrupadas ? row.fotos_agrupadas.split("|||") : [],
    }));
  } catch (error) {
    throw error;
  }
}

/**
 * @async
 * @function colocarPecaAVenda
 * @description Promove uma peça que se encontrava no inventário geral para os classificados de Venda com um PVP fixo.
 * @param {number} idPeca - O ID original do bem material no catálogo PECA.
 * @param {number} preco - O PVP.
 * @param {number} idVendedor - ID do utilizador autor da venda.
 * @param {string|null} [nomePeca=null] - Overrided name a mostrar no anúncio de venda.
 * @param {string|null} [condicaoPeca=null] - Overrided condition a anunciar.
 * @param {string} [metodosAceites=""] - Os canais aceites para receber valor.
 * @returns {Promise<number>} O id do registo em VENDA_PECA.
 * @throws {Error} Rollbacks provenientes da invalidação (ex: se o artigo já está num anúncio a decorrer).
 */
async function colocarPecaAVenda(
  idPeca,
  preco,
  idVendedor,
  nomePeca = null,
  condicaoPeca = null,
  metodosAceites = "",
) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const pecaResult = await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query(`SELECT nome, estado FROM PECA WHERE id_peca = @IdPeca;`);

    if (pecaResult.recordset.length === 0)
      throw new Error("Peça não encontrada.");
    await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query(
        `UPDATE PECA SET disponivel_para_venda = 1, disponivel_para_emprestimo = 0 WHERE id_peca = @IdPeca;`,
      );

    const nomeFinal = nomePeca || pecaResult.recordset[0].nome;
    const condicaoFinal = condicaoPeca || pecaResult.recordset[0].estado;

    const vendaExiste = await transaction
      .request()
      .input("IdPeca", sql.Int, idPeca)
      .query(
        `SELECT 1 FROM VENDA_PECA WHERE PECAid_peca = @IdPeca AND estado IN ('Disponível', 'Disponivel');`,
      );

    if (vendaExiste.recordset.length > 0)
      throw new Error("Esta peça já está anunciada para venda.");

    const idVenda = await transaction
      .request()
      .input("Preco", sql.Decimal(10, 2), preco)
      .input("IdPeca", sql.Int, idPeca)
      .input("IdVendedor", sql.Int, idVendedor)
      .input("NomePeca", sql.VarChar(255), nomeFinal)
      .input("Condicao", sql.VarChar(50), condicaoFinal)
      .input("Metodos", sql.VarChar(255), metodosAceites)
      .query(
        `
                INSERT INTO VENDA_PECA (preco, data_colocacao, estado, PECAid_peca, UTILIZADORid_utilizador, nome_peca, condicao, metodos_aceites)
                OUTPUT INSERTED.id_venda
                VALUES (@Preco, GETDATE(), 'Disponível', @IdPeca, @IdVendedor, @NomePeca, @Condicao, @Metodos);
            `,
      )
      .then((r) => r.recordset[0].id_venda);

    await transaction
      .request()
      .input("IdVenda", sql.Int, idVenda)
      .input("IdPeca", sql.Int, idPeca)
      .query(
        `UPDATE FOTO_PECA SET VENDAid_venda = @IdVenda WHERE PECAid_peca = @IdPeca AND VENDAid_venda IS NULL;`,
      );

    await transaction.commit();
    return idVenda;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * @async
 * @function registarConclusaoVenda
 * @description Fecha a oportunidade no sistema e regista que a transação ocorreu para o comprador final indicado.
 * @param {number} idVenda - ID da listagem comercial de venda.
 * @param {number} idComprador - ID do utilizador adquirente.
 * @param {string} metodoPagamento - O meio utilizado.
 * @returns {Promise<boolean>} True na perfeição da validação SQL.
 * @throws {Error} Devolve erro a indicar inconsistência se a peça já não se encontrar comitente (concluída por outro, etc).
 */
async function registarConclusaoVenda(idVenda, idComprador, metodoPagamento) {
  const pool = await poolPromise;
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const vendaResult = await transaction
      .request()
      .input("IdVenda", sql.Int, idVenda).query(`
                SELECT v.PECAid_peca, v.estado, p.nome, p.estado AS condicao 
                FROM VENDA_PECA v JOIN PECA p ON v.PECAid_peca = p.id_peca WHERE v.id_venda = @IdVenda;
            `);

    if (vendaResult.recordset.length === 0)
      throw new Error("Venda não encontrada.");
    if (!["Disponível", "Disponivel"].includes(vendaResult.recordset[0].estado))
      throw new Error("Esta venda já não está disponível.");

    const { nome, condicao } = vendaResult.recordset[0];

    await transaction
      .request()
      .input("IdComprador", sql.Int, idComprador)
      .input("MetodoPagamento", sql.VarChar(50), metodoPagamento)
      .input("IdVenda", sql.Int, idVenda)
      .input("NomePeca", sql.VarChar(255), nome)
      .input("Condicao", sql.VarChar(50), condicao).query(`
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
 * @async
 * @function registarFotosPeca
 * @description Utilitário complementar e isolado para registar as imagens (Base64) de uma peça sem iniciar transações complexas.
 * @param {number} idPeca - ID da peça destino do binário.
 * @param {Array<string>} fotosBase64 - Strings em codificação pura Base64 das fotos.
 * @returns {Promise<boolean>} True se finalizou a iteração das inserções com sucesso.
 * @throws {Error} DB Error.
 */
async function registarFotosPeca(idPeca, fotosBase64) {
  const pool = await poolPromise;
  try {
    for (const foto of fotosBase64) {
      await pool
        .request()
        .input("IdPeca", sql.Int, idPeca)
        .input("Foto", sql.VarChar(sql.MAX), foto)
        .query(
          `INSERT INTO FOTO_PECA (PECAid_peca, foto) VALUES (@IdPeca, @Foto)`,
        );
    }
    return true;
  } catch (error) {
    throw error;
  }
}

async function getPedidosEmprestimoPeca(idPeca) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("IdPeca", sql.Int, idPeca).query(`
        SELECT 
          e.id_emprestimo as id, 
          e.data_inicio, 
          e.data_fim, 
          e.estado, 
          u.nome as requisitante,
          e.valor,             -- <--- Adicionado
          e.metodo_pagamento   -- <--- Adicionado
        FROM EMPRESTIMO e
        JOIN EMPRESTIMO_ITEM ei ON e.id_emprestimo = ei.[EMPRESIMO id_emprestimo]
        JOIN UTILIZADOR u ON e.UTILIZADORid_utilizador = u.id_utilizador
        WHERE ei.PECAid_peca = @IdPeca AND e.estado != 'Disponível' AND e.estado != 'Config Inicial'
        ORDER BY e.data_inicio ASC
      `);
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

async function atualizarEstadoReserva(idEmprestimo, novoEstado) {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("IdEmp", sql.Int, idEmprestimo)
      .input("Estado", sql.VarChar(50), novoEstado)
      .query(
        "UPDATE EMPRESTIMO SET estado = @Estado WHERE id_emprestimo = @IdEmp",
      );

    return result.rowsAffected[0] > 0;
  } catch (error) {
    throw error;
  }
}

async function getMeusPedidosEmprestimo(idUtilizador) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().input("IdUser", sql.Int, idUtilizador)
      .query(`
        SELECT 
          e.id_emprestimo, e.data_inicio, e.data_fim, e.estado, 
          e.valor, e.metodo_pagamento, 
          
          e.estado_pagamento, 
          e.data_pagamento, 
          
          e.data_devolucao, e.observacoes,
          p.nome as peca_nome, p.id_peca,
          u.nome as dono_peca,
          (SELECT ISNULL(SUM(valor_penalizacao), 0) FROM PENALIZACAO_PECA WHERE EMPRESTIMOid_emprestimo = e.id_emprestimo) as total_multas
        FROM EMPRESTIMO e
        JOIN EMPRESTIMO_ITEM ei ON e.id_emprestimo = ei.[EMPRESIMO id_emprestimo]
        JOIN PECA p ON ei.PECAid_peca = p.id_peca
        JOIN UTILIZADOR u ON p.UTILIZADORid_utilizador = u.id_utilizador
        WHERE e.UTILIZADORid_utilizador = @IdUser AND e.estado NOT IN ('Config Inicial', 'Disponível')
        ORDER BY e.id_emprestimo DESC
      `);
    return result.recordset;
  } catch (error) {
    console.error("ERRO SQL NOS MEUS PEDIDOS:", error.message);
    throw error;
  }
}

/**
 * @module inventarioModel
 */
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
  registarConclusaoVenda,
  getPedidosEmprestimoPeca,
  atualizarEstadoReserva,
  getMeusPedidosEmprestimo,
};
