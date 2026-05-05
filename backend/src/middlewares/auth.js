const jwt = require('jsonwebtoken');

// ============================================================================
// MIDDLEWARE DE AUTENTICAÇÃO — Verifica o token JWT em todas as rotas protegidas
// ============================================================================
function autenticar(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ mensagem: 'Acesso negado. Token não fornecido.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.utilizador = payload; // { id, nome, email, perfis }
        next();
    } catch (error) {
        return res.status(401).json({ mensagem: 'Token inválido ou expirado.' });
    }
}

// ============================================================================
// MIDDLEWARE DE AUTORIZAÇÃO — Verifica se o utilizador tem o perfil necessário
// Uso: autorizar('Admin') | autorizar('Professor', 'Admin')
// ============================================================================
function autorizar(...perfisPermitidos) {
    return (req, res, next) => {
        const perfisUtilizador = req.utilizador?.perfis || [];
        const temPermissao = perfisPermitidos.some(p => perfisUtilizador.includes(p));

        if (!temPermissao) {
            return res.status(403).json({
                mensagem: `Acesso negado. Perfil necessário: ${perfisPermitidos.join(' ou ')}.`
            });
        }

        next();
    };
}

module.exports = { autenticar, autorizar };