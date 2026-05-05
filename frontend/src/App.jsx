import React, { useState } from 'react';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
<<<<<<< HEAD
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos';
import EmprestimosPecas from './pages/EmprestimosPecas/EmprestimosPecas';
import AgendarCoaching from './pages/AgendarCoaching/AgendarCoaching';
=======
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos'; // Novo Import
import AdminDashboard from './pages/Admin/AdminDashboard';
>>>>>>> Lima

function App() {
  const [paginaAtual, setPaginaAtual] = useState('landing');

  return (
    <div className="App">
      
      {/* LANDING PAGE */}
      {paginaAtual === 'landing' && (
        <Landing 
          irParaLogin={() => setPaginaAtual('login')} 
          irParaRegisto={() => setPaginaAtual('registo')} 
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')} 
          irParaEmprestimos={() => setPaginaAtual('emprestimos_pecas')}
          irParaAgendarCoaching={() => setPaginaAtual('agendar_coaching')}
        />
      )}
      
      {/* LOGIN */}
      {paginaAtual === 'login' && (
        <Login 
          irParaRegisto={() => setPaginaAtual('registo')} 
          irParaLanding={() => setPaginaAtual('landing')} 
          irParaRecuperar={() => setPaginaAtual('recuperar')} 
          irParaAdmin={() => setPaginaAtual('admin')} // <--- ADICIONADO AQUI: Passa a instrução ao Login
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
          irParaAgendarCoaching={() => setPaginaAtual('agendar_coaching')}
        />
      )}

      {/* EMPRÉSTIMO DE PEÇAS */}
      {paginaAtual === 'emprestimos_pecas' && (
        <EmprestimosPecas 
          irParaLanding={() => setPaginaAtual('landing')} 
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')}
          irParaAgendarCoaching={() => setPaginaAtual('agendar_coaching')}
        />
      )}

      {paginaAtual === 'agendar_coaching' && (
        <AgendarCoaching
          irParaLanding={() => setPaginaAtual('landing')}
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')}
          irParaEmprestimos={() => setPaginaAtual('emprestimos_pecas')}
        />
      )}

      {/* ADMIN DASHBOARD */}
      {/* ADICIONADO AQUI: O bloco que mostra a página de Administração */}
      {paginaAtual === 'admin' && (
        <AdminDashboard 
          irParaLanding={() => setPaginaAtual('landing')} 
        />
      )}

    </div>
  );
}

export default App;