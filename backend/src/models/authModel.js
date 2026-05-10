/**
 * @fileoverview Modelo de Autenticação e Gestão de Utilizadores
 * Este ficheiro centraliza todas as interações com a base de dados SQL Server
 * referentes a utilizadores, perfis e tokens de segurança.
 */

const { poolPromise } = require('../config/db'); // Ligação à base de dados (Connection Pool)
const sql = require('mssql'); // Biblioteca de driver do SQL Server
 
// ============================================================================
// 1. AUTENTICAÇÃO E PERFIS
// ============================================================================

/**
 * Procura e devolve as credenciais de um utilizador através do seu email.
 * @param {string} email - O email do utilizador a pesquisar.
 * @returns {Object|null} Os dados do utilizador ou null se não for encontrado.
 */
async function getUtilizadorByEmail(email) {
    try {
        const pool = await poolPromise;
        const query = `SELECT id_utilizador, nome, email, password, telefone, ativo FROM UTILIZADOR WHERE email = @Email;`;
        
        // Uso de parâmetros (Input) previne ataques de SQL Injection
        const result = await pool.request().input('Email', sql.VarChar(255), email).query(query);
        return result.recordset[0] || null;
    } catch (error) { throw error; }
}
 
/**
 * Obtém a lista de nomes dos perfis associados a um determinado utilizador.
 * @param {number} idUtilizador - O ID do utilizador na base de dados.
 * @returns {Array<string>} Um array com os nomes dos perfis
 */
async function getPerfisDoUtilizador(idUtilizador) {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT p.nome AS perfil FROM UTILIZADOR_PERFIL up
            JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            WHERE up.UTILIZADORid_utilizador = @IdUtilizador;
        `;
        const result = await pool.request().input('IdUtilizador', sql.Int, idUtilizador).query(query);
        return result.recordset.map(row => row.perfil); // Mapeia os objetos da BD para um array simples de strings
    } catch (error) { throw error; }
}
 
// ============================================================================
// 2. GESTÃO DE CONTAS (Administração e Registo)
// ============================================================================

/**
 * Lista todos os utilizadores do sistema, agregando os seus perfis numa única string.
 * Útil para popular tabelas no painel de administração (Cordenação).
 */
async function listarTodosUtilizadores() {
    try {
        const pool = await poolPromise;
        const query = `
            SELECT u.id_utilizador, u.nome, u.email, u.telefone, u.ativo, u.data_criacao, 
            STRING_AGG(p.nome, ', ') AS perfis,
            MAX(a.nome) AS nomeAluno, 
            MAX(a.data_nascimento) AS dataNascimentoAluno
            FROM UTILIZADOR u
            LEFT JOIN UTILIZADOR_PERFIL up ON u.id_utilizador = up.UTILIZADORid_utilizador
            LEFT JOIN PERFIL p ON up.PERFILid_perfil = p.id_perfil
            LEFT JOIN ENCARREGADO_ALUNO ea ON u.id_utilizador = ea.UTILIZADORid_utilizador
            LEFT JOIN ALUNO a ON ea.ALUNOid_aluno = a.id_aluno
            GROUP BY u.id_utilizador, u.nome, u.email, u.telefone, u.ativo, u.data_criacao
            ORDER BY u.id_utilizador ASC;
        `;
        const result = await pool.request().query(query);
        return result.recordset;
    } catch (error) { throw error; }
}
 
/**
 * Regista um novo utilizador e atribui-lhe o respetivo perfil.
 * Utiliza uma transação SQL para garantir que ambos os registos (utilizador e perfil)
 * só são guardados se não ocorrerem erros.
 */

async function criarUtilizador({ nome, email, passwordHash, telefone, nomePerfil, ativo = 0, nomeAluno, dataNascimentoAluno }) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();

    try {
        // ... (Mesma lógica de verificação de email e perfil) ...
        const emailExiste = await transaction.request()
            .input('Email', sql.VarChar(255), email)
            .query('SELECT id_utilizador FROM UTILIZADOR WHERE email = @Email');

        if (emailExiste.recordset.length > 0) throw new Error('Já existe um utilizador com este email.');

        let idPerfil = null;
        if (nomePerfil === 'Professor') {
            const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
            idPerfil = res.recordset[0]?.id_perfil;
        } else if (nomePerfil === 'Admin') {
            const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Admin%' OR nome LIKE '%Coord%'");
            idPerfil = res.recordset[0]?.id_perfil;
        } else {
            const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'");
            idPerfil = res.recordset[0]?.id_perfil;
        }

        if (!idPerfil) throw new Error('Perfil não encontrado.');

        // 3. Inserção do Utilizador
        const insertUserQuery = `
            INSERT INTO UTILIZADOR (nome, email, password, telefone, ativo, data_criacao)
            OUTPUT INSERTED.id_utilizador
            VALUES (@Nome, @Email, @Password, @Telefone, @Ativo, GETDATE());
        `;
        const novoUserResult = await transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Email', sql.VarChar(255), email)
            .input('Password', sql.VarChar(255), passwordHash)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .input('Ativo', sql.Bit, ativo)
            .query(insertUserQuery);

        const novoUtilizador = novoUserResult.recordset[0];

        // 4. Ligação Perfil
        await transaction.request()
            .input('IdUser', sql.Int, novoUtilizador.id_utilizador)
            .input('IdPerfil', sql.Int, idPerfil)
            .query(`INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@IdUser, @IdPerfil);`);

        // 5. Inserção do Aluno (Inativo se o EE for inativo)
        if (nomePerfil !== 'Professor' && nomePerfil !== 'Admin' && nomeAluno) {
            
            const insertAlunoQuery = `
                INSERT INTO ALUNO (nome, data_nascimento, ativo, data_criacao)
                OUTPUT INSERTED.id_aluno
                VALUES (@NomeAluno, @DataNasc, @AtivoAluno, GETDATE());
            `;
            const novoAlunoResult = await transaction.request()
                .input('NomeAluno', sql.VarChar(255), nomeAluno)
                .input('DataNasc', sql.Date, dataNascimentoAluno || null) // Passando a data
                .input('AtivoAluno', sql.Bit, ativo) 
                .query(insertAlunoQuery);

            const novoAlunoId = novoAlunoResult.recordset[0].id_aluno;

            await transaction.request()
                .input('IdUtilizadorEnc', sql.Int, novoUtilizador.id_utilizador)
                .input('IdAlunoNovo', sql.Int, novoAlunoId)
                .query(`
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
 * Atualiza todos os dados submetidos pelo Administrador para um utilizador específico.
 */
async function atualizarUtilizadorCompleto(id, { nome, email, telefone, passwordHash, nomePerfil, idsModalidades, nomeAluno, dataNascimentoAluno}) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
 
    try {
        // Construção dinâmica da query: A password só é atualizada se for fornecido um novo hash
        let queryUpdate = `UPDATE UTILIZADOR SET nome = @Nome, email = @Email, telefone = @Telefone`;
        if (passwordHash) queryUpdate += `, password = @Password`;
        queryUpdate += ` WHERE id_utilizador = @Id`;

        const req = transaction.request()
            .input('Nome', sql.VarChar(255), nome)
            .input('Email', sql.VarChar(255), email)
            .input('Telefone', sql.VarChar(30), telefone || null)
            .input('Id', sql.Int, id);
        
        if (passwordHash) req.input('Password', sql.VarChar(255), passwordHash);
        
        // Executa atualização principal de dados
        await req.query(queryUpdate);

        // Se houver alteração de perfil, remove a antiga e insere a nova ligação
        if (nomePerfil) {
            let idPerfil = null;
            if (nomePerfil === 'Professor') {
                const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Prof%'");
                idPerfil = res.recordset[0]?.id_perfil;
            } else if (nomePerfil === 'Admin') {
                const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Admin%' OR nome LIKE '%Coord%'");
                idPerfil = res.recordset[0]?.id_perfil;
            } else {
                const res = await transaction.request().query("SELECT TOP 1 id_perfil FROM PERFIL WHERE nome LIKE '%Encarregado%' OR nome LIKE '%Educação%' OR nome = 'EE'");
                idPerfil = res.recordset[0]?.id_perfil;
            }

            if (idPerfil) {
                // Remove o perfil atual
                await transaction.request().input('Id', sql.Int, id).query('DELETE FROM UTILIZADOR_PERFIL WHERE UTILIZADORid_utilizador = @Id');
                // Adiciona o novo perfil
                await transaction.request().input('Id', sql.Int, id).input('IdPerfil', sql.Int, idPerfil)
                    .query(`INSERT INTO UTILIZADOR_PERFIL (UTILIZADORid_utilizador, PERFILid_perfil) VALUES (@Id, @IdPerfil);`);
            }
        }

        if (nomeAluno) {
            await transaction.request()
                .input('IdUtilizador', sql.Int, id)
                .input('NomeAluno', sql.VarChar(255), nomeAluno)
                .input('DataNasc', sql.Date, dataNascimentoAluno || null)
                .query(`
                    UPDATE ALUNO 
                    SET nome = @NomeAluno, data_nascimento = @DataNasc 
                    WHERE id_aluno IN (
                        SELECT ALUNOid_aluno FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @IdUtilizador
                    )
                `);
        }
        // ----------------------------------------

        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/**
 * Altera a flag booleana de estado (ativo/inativo) de um utilizador.
 * @param {number} idUtilizador - O ID do utilizador.
 * @param {boolean} estadoAtivo - true para ativar, false para suspender/reprovar.
 */
async function alterarEstadoUtilizador(idUtilizador, estadoAtivo) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();

    try {
        const status = estadoAtivo ? 1 : 0;

        // 1. Atualiza o estado do Utilizador
        await transaction.request()
            .input('EstadoAtivo', sql.Bit, status)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`UPDATE UTILIZADOR SET ativo = @EstadoAtivo WHERE id_utilizador = @IdUtilizador;`);

        // 2. Atualiza o estado de todos os ALUNOS ligados a este Encarregado
        // Esta query procura na tabela intermédia ENCARREGADO_ALUNO e atualiza a tabela ALUNO
        await transaction.request()
            .input('EstadoAtivo', sql.Bit, status)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`
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
 * Executa uma eliminação completa e segura de um utilizador da base de dados.
 * Remove primeiro as restrições de chaves estrangeiras (perfis e tokens).
 */
async function apagarUtilizador(idUtilizador) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
        // 1. Limpar ligações de perfil
        await transaction.request()
            .input('Id', sql.Int, idUtilizador)
            .query('DELETE FROM UTILIZADOR_PERFIL WHERE UTILIZADORid_utilizador = @Id');
            
        // 2. Limpar possíveis tokens de recuperação
        await transaction.request()
            .input('Id', sql.Int, idUtilizador)
            .query('DELETE FROM TOKEN_RECUPERACAO WHERE UTILIZADORid_utilizador = @Id');

        // 3. Buscar os IDs dos alunos associados a este Encarregado (para os apagarmos a seguir)
        const alunosResult = await transaction.request()
            .input('Id', sql.Int, idUtilizador)
            .query('SELECT ALUNOid_aluno FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @Id');

        // 4. Limpar a ligação na tabela intermédia ENCARREGADO_ALUNO
        await transaction.request()
            .input('Id', sql.Int, idUtilizador)
            .query('DELETE FROM ENCARREGADO_ALUNO WHERE UTILIZADORid_utilizador = @Id');

        // 5. Apagar os registos dos alunos órfãos (para não deixar "lixo" na tabela ALUNO)
        for (const row of alunosResult.recordset) {
            await transaction.request()
                .input('IdAluno', sql.Int, row.ALUNOid_aluno)
                .query('DELETE FROM ALUNO WHERE id_aluno = @IdAluno');
        }

        // 6. Finalmente, apagar o registo raiz do utilizador
        const result = await transaction.request()
            .input('Id', sql.Int, idUtilizador)
            .query('DELETE FROM UTILIZADOR WHERE id_utilizador = @Id');

        await transaction.commit();
        return result.rowsAffected[0] > 0;
    } catch (error) {
        // Se der erro, desfaz tudo para não deixar a BD inconsistente
        if (transaction) await transaction.rollback();
        throw error;
    }
}
 
// ============================================================================
// 3. RECUPERAÇÃO DE PALAVRA-PASSE
// ============================================================================

/**
 * Regista o token seguro (Hexadecimal) necessário para recuperar conta.
 * A query define matematicamente que a expiração é de 1 hora.
 */
async function guardarTokenRecuperacao(idUtilizador, token) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('IdUtilizador', sql.Int, idUtilizador)
            .query(`
                INSERT INTO TOKEN_RECUPERACAO (token, data_expiracao, usado, data_criacao, UTILIZADORid_utilizador)
                VALUES (@Token, DATEDIFF(SECOND, '1970-01-01', DATEADD(HOUR, 1, GETUTCDATE())), 0, GETDATE(), @IdUtilizador);
            `);
        return true;
    } catch (error) { throw error; }
}
 
/**
 * Verifica se um token de recuperação submetido ainda é válido na BD.
 * Valida o conteúdo, a expiração de tempo (UNIX timestamp) e se já foi utilizado.
 */
async function validarTokenRecuperacao(token) {
    try {
        const pool = await poolPromise;
        const tempoAtualUnix = Math.floor(Date.now() / 1000); // Tempo atual em segundos Unix
        
        const result = await pool.request()
            .input('Token', sql.VarChar(255), token)
            .input('TempoAtual', sql.Int, tempoAtualUnix)
            .query(`
                SELECT id_token_recuperacao, UTILIZADORid_utilizador 
                FROM TOKEN_RECUPERACAO 
                WHERE token = @Token AND usado = 0 AND data_expiracao > @TempoAtual;
            `);
        
        return result.recordset[0] || null;
    } catch (error) { throw error; }
}
 
/**
 * Altera definitivamente a password esquecida do utilizador.
 * Executado em transação para garantir que o token é inutilizado em simultâneo com o update.
 */
async function atualizarPassword(idUtilizador, novaPasswordHash, idToken) {
    const pool = await poolPromise;
    const transaction = pool.transaction();
    await transaction.begin();
    try {
        // Atualiza a password
        await transaction.request()
            .input('IdUtilizador', sql.Int, idUtilizador)
            .input('NovaPassword', sql.VarChar(255), novaPasswordHash)
            .query('UPDATE UTILIZADOR SET password = @NovaPassword WHERE id_utilizador = @IdUtilizador');
            
        // Inutiliza o token usado para prevenir reutilização abusiva
        await transaction.request()
            .input('IdToken', sql.Int, idToken)
            .query('UPDATE TOKEN_RECUPERACAO SET usado = 1 WHERE id_token_recuperacao = @IdToken');
            
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
 
// Exportação dos métodos da camada Model
module.exports = {
    getUtilizadorByEmail, 
    getPerfisDoUtilizador, 
    listarTodosUtilizadores,
    criarUtilizador, 
    atualizarUtilizadorCompleto, 
    alterarEstadoUtilizador,
    guardarTokenRecuperacao, 
    validarTokenRecuperacao, 
    atualizarPassword,
    apagarUtilizador
};