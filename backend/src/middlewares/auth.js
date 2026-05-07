const jwt = require('jsonwebtoken');

/**
 * Verifica se a lista de perfis (nomes na BD) satisfaz o perfil requerido nas rotas.
 * 'EE' aceita "Encarregado de Educação", "EE", etc.
 */
function utilizadorTemPerfil(perfisUtilizador, perfilRequerido) {
    const lista = perfisUtilizador || [];
    const r = String(perfilRequerido);

    if (r === 'EE') {
        return lista.some(p => {
            const s = String(p).toLowerCase();
            return s.includes('encarregado') || s === 'ee' || s.includes('educação') || s.includes('educacao');
        });
    }

    if (r === 'Professor') {
        return lista.some(p => String(p).toLowerCase().includes('prof'));
    }

    if (r === 'Admin') {
        return lista.some((p) => {
            const s = String(p).toLowerCase();
            return (
                s === 'admin' ||
                s.includes('admin') ||
                s.includes('coordenação') ||
                s.includes('coordenacao') ||
                s.includes('administração') ||
                s.includes('administracao')
            );
        });
    }

    return lista.some(p => String(p) === r);
}

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
        const temPermissao = perfisPermitidos.some(p => utilizadorTemPerfil(perfisUtilizador, p));

        if (!temPermissao) {
            return res.status(403).json({
                mensagem: `Acesso negado. Perfil necessário: ${perfisPermitidos.join(' ou ')}.`
            });
        }

        next();
    };
}

module.exports = { autenticar, autorizar, utilizadorTemPerfil };