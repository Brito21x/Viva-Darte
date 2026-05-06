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
    return 'landing';
  });

  useEffect(() => {
    if (paginaAtual !== 'admin' && window.location.pathname === '/admin') {
      window.history.pushState({}, '', '/');
    }
    
    localStorage.setItem('ultimaPagina', paginaAtual);
  }, [paginaAtual]);

  const nav = {
    landing: () => setPaginaAtual('landing'),
    login: () => setPaginaAtual('login'),
    registo: () => setPaginaAtual('registo'),
    recuperar: () => setPaginaAtual('recuperar'),
    venda_figurinos: () => setPaginaAtual('venda_figurinos'),
    emprestimos_pecas: () => setPaginaAtual('emprestimos_pecas'),
  };

  return (
    <div className="App">
      
      {/* LANDING PAGE */}
      {paginaAtual === 'landing' && (
        <Landing 
          irParaLogin={nav.login} 
          irParaRegisto={nav.registo} 
          irParaVendaFigurinos={nav.venda_figurinos} 
          irParaEmprestimos={nav.emprestimos_pecas}
        />
      )}
      
      {/* LOGIN */}
      {paginaAtual === 'login' && (
        <Login 
          irParaRegisto={nav.registo} 
          irParaLanding={nav.landing} 
          irParaRecuperar={nav.recuperar} 
        />
      )}
      
      {/* REGISTO */}
      {paginaAtual === 'registo' && (
        <Registo 
          irParaLogin={nav.login} 
          irParaLanding={nav.landing} 
        />
      )}

      {/* RECUPERAR PASSWORD */}
      {paginaAtual === 'recuperar' && (
        <RecoverPassword 
          irParaLogin={nav.login} 
          irParaLanding={nav.landing} 
        />
      )}

      {/* VENDA DE FIGURINOS */}
      {paginaAtual === 'venda_figurinos' && (
        <VendaFigurinos 
          irParaLanding={nav.landing} 
          irParaEmprestimos={nav.emprestimos_pecas}
        />
      )}

      {/* EMPRÉSTIMO DE PEÇAS */}
      {paginaAtual === 'emprestimos_pecas' && (
        <EmprestimosPecas 
          irParaLanding={nav.landing} 
          irParaVendaFigurinos={nav.venda_figurinos}
        />
      )}

      {/* ADMIN DASHBOARD */}
      {paginaAtual === 'admin' && (
        <AdminDashboard 
          irParaLanding={nav.landing}
        />
      )}

    </div>
  );
}

export default App;
