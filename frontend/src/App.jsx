import React, { useState } from 'react';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos'; // Novo Import
import AdminDashboard from './pages/Admin/AdminDashboard';

function App() {
  const [paginaAtual, setPaginaAtual] = useState('landing');

  return (
    <div className="App">
      
      {/* LANDING PAGE */}
      {paginaAtual === 'landing' && (
        <Landing 
          irParaLogin={() => setPaginaAtual('login')} 
          irParaRegisto={() => setPaginaAtual('registo')} 
          irParaVendaFigurinos={() => setPaginaAtual('venda_figurinos')} // Nova prop para navegar!
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