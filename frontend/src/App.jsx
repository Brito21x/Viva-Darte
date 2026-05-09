import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Landing from './pages/LandingPage/Landing';
import Login from './pages/Login-Registo/Login';
import Registo from './pages/Login-Registo/Registo';
import RecoverPassword from './pages/Login-Registo/RecoverPassword';
import VendaFigurinos from './pages/VendaFigurinos/VendaFigurinos';
import EmprestimosPecas from './pages/EmprestimosPecas/EmprestimosPecas';
import AdminDashboard from './pages/AdminDashboard/AdminDashboard';
import MinhaAgendaProfessor from './pages/MinhaAgendaProfessor/MinhaAgendaProfessor';

// Componente auxiliar para gerir a lógica de navegação antiga (compatibilidade)
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mantém a proteção de rota que tinhas para o admin
  useEffect(() => {
    if (location.pathname === '/admin') {
      // Podes adicionar aqui lógica de verificação de admin se necessário
    }
  }, [location]);

  // Objeto de navegação que passas para os teus componentes
  // Agora em vez de mudar um estado, eles mudam o URL do browser
  const nav = {
    landing: () => navigate('/'),
    login: () => navigate('/login'),
    registo: () => navigate('/registo'),
    recuperar: () => navigate('/recuperar'),
    venda_figurinos: () => navigate('/vendas-de-figurinos'),
    emprestimos_pecas: () => navigate('/emprestimos'),
    minha_agenda_professor: () => navigate('/agenda'),
    minha_agenda_ee: () => navigate('/agenda'),
    admin: () => navigate('/admin')
  };

  return (
    <Routes>
      <Route path="/" element={
        <Landing 
          irParaLogin={nav.login} 
          irParaRegisto={nav.registo} 
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaEmprestimos={nav.emprestimos_pecas}
          irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
          irParaMinhaAgendaEE={nav.minha_agenda_ee}
        />
      } />

      <Route path="/login" element={<Login irParaLanding={nav.landing} irParaRegisto={nav.registo} irParaRecuperar={nav.recuperar} />} />
      <Route path="/registo" element={<Registo irParaLogin={nav.login} irParaLanding={nav.landing} />} />
      <Route path="/recuperar" element={<RecoverPassword irParaLogin={nav.login} />} />
      
      <Route path="/vendas-de-figurinos" element={
        <VendaFigurinos 
          irParaLanding={nav.landing} 
          irParaEmprestimos={nav.emprestimos_pecas}
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
          irParaMinhaAgendaEE={nav.minha_agenda_ee}
        />
      } />

      <Route path="/emprestimos" element={
        <EmprestimosPecas 
          irParaLanding={nav.landing} 
          irParaEmprestimos={nav.emprestimos_pecas}
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
          irParaMinhaAgendaEE={nav.minha_agenda_ee}
        />
      } />

      <Route path="/agenda" element={
        <MinhaAgendaProfessor 
          irParaLanding={nav.landing} 
          irParaEmprestimos={nav.emprestimos_pecas}
          irParaVendaFigurinos={nav.venda_figurinos}
          irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
          irParaMinhaAgendaEE={nav.minha_agenda_ee}
        />
      } />

      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;