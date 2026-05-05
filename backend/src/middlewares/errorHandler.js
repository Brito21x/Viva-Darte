// ============================================================================
// MIDDLEWARE DE TRATAMENTO GLOBAL DE ERROS
// Deve ser registado no app.js APÓS todas as rotas.
// ============================================================================
function errorHandler(err, req, res, next) {
    console.error(`[ERRO] ${new Date().toISOString()} — ${req.method} ${req.path}`);
    console.error(err);

    // Erros de unicidade do SQL Server (ex: email duplicado)
    if (err.number === 2627 || err.number === 2601) {
        return res.status(409).json({
            mensagem: 'Já existe um registo com estes dados. Verifique os campos únicos.'
        });
    }

    // Erros de chave estrangeira do SQL Server
    if (err.number === 547) {
        return res.status(400).json({
            mensagem: 'Operação inválida: referência a um registo inexistente.'
        });
    }

    // Erros de negócio lançados pelos modelos
    if (err.isOperational) {
        return res.status(400).json({ mensagem: err.message });
    }

    // Erro genérico (não expõe detalhes em produção)
    const statusCode = err.statusCode || 500;
    const mensagem =
        process.env.NODE_ENV === 'development'
            ? err.message
            : 'Ocorreu um erro interno no servidor.';

    return res.status(statusCode).json({ mensagem });
}

module.exports = errorHandler;