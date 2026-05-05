import React, { useState } from 'react';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos';
import EmprestimosPecas from './pages/EmprestimosPecas/EmprestimosPecas';

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
          irParaEmprestimos={() => setPaginaAtual('emprestimos_pecas')} // <- ADICIONADO AQUI
        />
      )}

      {/* EMPRÉSTIMO DE PEÇAS */}
      {paginaAtual === 'emprestimos_pecas' && (
        <EmprestimosPecas 
          irParaLanding={() => setPaginaAtual('landing')} 
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')} // <- ADICIONADO AQUI
        />
      )}

    </div>
  );
}

export default App;