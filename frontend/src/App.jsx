import React, { useState, useEffect } from 'react';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos';
import EmprestimosPecas from './pages/EmprestimosPecas/EmprestimosPecas';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import AgendarCoaching from './pages/AgendarCoaching/AgendarCoaching';
import ProfessorAgendamento from './pages/ProfessorAgendamento/ProfessorAgendamento';

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

  const nav = {
    landing: () => setPaginaAtual('landing'),
    login: () => setPaginaAtual('login'),
    registo: () => setPaginaAtual('registo'),
    recuperar: () => setPaginaAtual('recuperar'),
    venda_figurinos: () => setPaginaAtual('venda_figurinos'),
    emprestimos_pecas: () => setPaginaAtual('emprestimos_pecas'),
    agendar_coaching: () => setPaginaAtual('agendar_coaching'),
    professor_agendamento: () => setPaginaAtual('professor_agendamento'),
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
          irParaAgendarCoaching={nav.agendar_coaching}
          irParaProfessorAgendamento={nav.professor_agendamento}
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
          irParaAgendarCoaching={nav.agendar_coaching}
          irParaProfessorAgendamento={nav.professor_agendamento}
        />
      )}

      {/* EMPRÉSTIMO DE PEÇAS */}
      {paginaAtual === 'emprestimos_pecas' && (
        <EmprestimosPecas 
          irParaLanding={nav.landing} 
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaAgendarCoaching={nav.agendar_coaching}
          irParaProfessorAgendamento={nav.professor_agendamento}
        />
      )}

      {/* AGENDAR COACHING (EE / alunos) */}
      {paginaAtual === 'agendar_coaching' && (
        <AgendarCoaching
          irParaLanding={nav.landing}
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaEmprestimos={nav.emprestimos_pecas}
        />
      )}

      {/* PROFESSOR — disponibilidade e agenda */}
      {paginaAtual === 'professor_agendamento' && (
        <ProfessorAgendamento
          irParaLanding={nav.landing}
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaEmprestimos={nav.emprestimos_pecas}
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
