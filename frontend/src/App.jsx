import React, { useState, useEffect } from 'react';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos';
import EmprestimosPecas from './pages/EmprestimosPecas/EmprestimosPecas';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';

function App() {
  const [paginaAtual, setPaginaAtual] = useState(() => {
    if (window.location.pathname === '/admin') {
      return 'admin';
    }
    return localStorage.getItem('ultimaPagina') || 'landing';
  });

  useEffect(() => {
    if (paginaAtual !== 'admin' && window.location.pathname === '/admin') {
      window.history.pushState({}, '', '/');
    }
    
    localStorage.setItem('ultimaPagina', paginaAtual);
  }, [paginaAtual]);

  return (
    <div className="App">
      
      {/* LANDING PAGE */}
      {paginaAtual === 'landing' && (
        <Landing 
          irParaLogin={() => setPaginaAtual('login')} 
          irParaRegisto={() => setPaginaAtual('registo')} 
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')} 
          irParaEmprestimos={() => setPaginaAtual('emprestimos_pecas')}
        />
      )}
      
      {/* LOGIN */}
      {paginaAtual === 'login' && (
        <Login 
          irParaRegisto={() => setPaginaAtual('registo')} 
          irParaLanding={() => setPaginaAtual('landing')} 
          irParaRecuperar={() => setPaginaAtual('recuperar')} 
        />
      )}
      
      {/* REGISTO */}
      {paginaAtual === 'registo' && (
        <Registo 
          irParaLogin={() => setPaginaAtual('login')} 
          irParaLanding={() => setPaginaAtual('landing')} 
        />
      )}

      {/* RECUPERAR PASSWORD */}
      {paginaAtual === 'recuperar' && (
        <RecoverPassword 
          irParaLogin={() => setPaginaAtual('login')} 
          irParaLanding={() => setPaginaAtual('landing')} 
        />
      )}

      {/* VENDA DE FIGURINOS */}
      {paginaAtual === 'venda_figurinos' && (
        <VendaFigurinos 
          irParaLanding={() => setPaginaAtual('landing')} 
          irParaEmprestimos={() => setPaginaAtual('emprestimos_pecas')}
        />
      )}

      {/* EMPRÉSTIMO DE PEÇAS */}
      {paginaAtual === 'emprestimos_pecas' && (
        <EmprestimosPecas 
          irParaLanding={() => setPaginaAtual('landing')} 
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')}
        />
      )}

      {/* ADMIN DASHBOARD */}
      {paginaAtual === 'admin' && (
        <AdminDashboard 
          irParaLanding={() => setPaginaAtual('landing')}
        />
      )}

    </div>
  );
}

export default App;