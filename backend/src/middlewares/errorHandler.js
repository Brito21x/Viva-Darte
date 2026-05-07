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

    // Erros comuns de conversão/validação do SQL Server (ex.: TIME inválido)
    // 245 = Conversion failed, 8114 = Error converting data type
    if (err.number === 245 || err.number === 8114) {
        return res.status(400).json({
            mensagem: 'Dados inválidos. Verifique o formato das horas (HH:mm) e tente novamente.'
        });
    }

    // Erros de negócio lançados pelos modelos (ex.: alunos que não pertencem ao EE)
    if (err.isOperational) {
        const status = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
            ? err.statusCode
            : 400;
        return res.status(status).json({ mensagem: err.message });
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