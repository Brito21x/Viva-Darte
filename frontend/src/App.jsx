import { useCallback, useEffect, useState } from 'react';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos';
import EmprestimosPecas from './pages/EmprestimosPecas/EmprestimosPecas';
import AgendarCoaching from './pages/AgendarCoaching/AgendarCoaching';
import ProfessorAgendamento from './pages/ProfessorAgendamento/ProfessorAgendamento';
import AdminDashboard from './pages/Admin/AdminDashboard';

const PATH_TO_PAGE = {
  '/': 'landing',
  '/login': 'login',
  '/registo': 'registo',
  '/recuperar': 'recuperar',
  '/venda-figurinos': 'venda_figurinos',
  '/emprestimos-pecas': 'emprestimos_pecas',
  '/agendar-coaching': 'agendar_coaching',
  '/professor-agendamento': 'professor_agendamento',
  '/admin': 'admin'
};

const PAGE_TO_PATH = {
  landing: '/',
  login: '/login',
  registo: '/registo',
  recuperar: '/recuperar',
  venda_figurinos: '/venda-figurinos',
  emprestimos_pecas: '/emprestimos-pecas',
  agendar_coaching: '/agendar-coaching',
  professor_agendamento: '/professor-agendamento',
  admin: '/admin'
};

function paginaDoPath(pathname) {
  return PATH_TO_PAGE[pathname] || 'landing';
}

function App() {
  const [paginaAtual, setPaginaAtual] = useState(() => paginaDoPath(window.location.pathname));

  const navegarPara = useCallback((pagina) => {
    setPaginaAtual(pagina);
    const path = PAGE_TO_PATH[pagina] || '/';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setPaginaAtual(paginaDoPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <div className="App">
      
      {/* LANDING PAGE */}
      {paginaAtual === 'landing' && (
        <Landing 
          irParaLogin={() => navegarPara('login')} 
          irParaRegisto={() => navegarPara('registo')} 
          irParaVendaFigurinos={() => navegarPara('venda_figurinos')} 
          irParaEmprestimos={() => navegarPara('emprestimos_pecas')}
          irParaAgendarCoaching={() => navegarPara('agendar_coaching')}
          irParaProfessorAgendamento={() => navegarPara('professor_agendamento')}
        />
      )}
      
      {/* LOGIN */}
      {paginaAtual === 'login' && (
        <Login 
          irParaRegisto={() => navegarPara('registo')} 
          irParaLanding={() => navegarPara('landing')} 
          irParaRecuperar={() => navegarPara('recuperar')} 
          irParaAdmin={() => navegarPara('admin')}
          irParaProfessorAgendamento={() => navegarPara('professor_agendamento')}
        />
      )}
      
      {/* REGISTO */}
      {paginaAtual === 'registo' && (
        <Registo 
          irParaLogin={() => navegarPara('login')} 
          irParaLanding={() => navegarPara('landing')} 
        />
      )}

      {/* RECUPERAR PASSWORD */}
      {paginaAtual === 'recuperar' && (
        <RecoverPassword 
          irParaLogin={() => navegarPara('login')} 
          irParaLanding={() => navegarPara('landing')} 
        />
      )}

      {/* VENDA DE FIGURINOS */}
      {paginaAtual === 'venda_figurinos' && (
        <VendaFigurinos 
          irParaLanding={() => navegarPara('landing')} 
          irParaEmprestimos={() => navegarPara('emprestimos_pecas')}
          irParaAgendarCoaching={() => navegarPara('agendar_coaching')}
          irParaProfessorAgendamento={() => navegarPara('professor_agendamento')}
        />
      )}

      {/* EMPRÉSTIMO DE PEÇAS */}
      {paginaAtual === 'emprestimos_pecas' && (
        <EmprestimosPecas 
          irParaLanding={() => navegarPara('landing')} 
          irParaVendaFigurinos={() => navegarPara('venda_figurinos')}
          irParaAgendarCoaching={() => navegarPara('agendar_coaching')}
          irParaProfessorAgendamento={() => navegarPara('professor_agendamento')}
        />
      )}

      {paginaAtual === 'agendar_coaching' && (
        <AgendarCoaching
          irParaLanding={() => navegarPara('landing')}
          irParaVendaFigurinos={() => navegarPara('venda_figurinos')}
          irParaEmprestimos={() => navegarPara('emprestimos_pecas')}
        />
      )}

      {paginaAtual === 'professor_agendamento' && (
        <ProfessorAgendamento
          irParaLanding={() => navegarPara('landing')}
          irParaVendaFigurinos={() => navegarPara('venda_figurinos')}
          irParaEmprestimos={() => navegarPara('emprestimos_pecas')}
        />
      )}

      {/* ADMIN DASHBOARD */}
      {/* ADICIONADO AQUI: O bloco que mostra a página de Administração */}
      {paginaAtual === 'admin' && (
        <AdminDashboard 
          irParaLanding={() => navegarPara('landing')} 
        />
      )}

    </div>
  );
}

export default App;