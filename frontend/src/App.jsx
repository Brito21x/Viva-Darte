import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import Landing from "./pages/LandingPage/Landing";
import Login from "./pages/Login-Registo/Login";
import Registo from "./pages/Login-Registo/Registo";
import RecoverPassword from "./pages/Login-Registo/RecoverPassword";
import Figurinos from "./pages/Figurinos/Figurinos";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard";
import MinhaAgendaProfessor from "./pages/MinhaAgendaProfessor/MinhaAgendaProfessor";
import Agenda from "./pages/AgendaAulas/AgendaAulas";

// ============================================================================
// COMPONENTE DE PROTEÇÃO DE ROTAS
// ============================================================================
function ProtectedRoute({ children }) {
  // Verifica se o utilizador tem sessão iniciada
  const isAuth = localStorage.getItem("viva_user") !== null;

  if (!isAuth) {
    // Se não estiver logado, redireciona para o Login
    return <Navigate to="/login" replace />;
  }

  // Se estiver logado, renderiza a página normalmente
  return children;
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/admin") {
    }
  }, [location]);

  // Objeto de navegação que passas para os teus componentes
  const nav = {
    landing: () => navigate("/"),
    login: () => navigate("/login"),
    registo: () => navigate("/registo"),
    recuperar: () => navigate("/recuperar"),
    figurinos: () => navigate("/figurinos"),
    minha_agenda_professor: () => navigate("/coaching"),
    minha_agenda_ee: () => navigate("/coaching"),
    admin: () => navigate("/admin"),
    agenda: () => navigate("/agenda"),
  };

  return (
    <Routes>
      {/* ========================================== */}
      {/* ROTAS PÚBLICAS (Qualquer pessoa acede) */}
      {/* ========================================== */}
      <Route
        path="/"
        element={
          <Landing
            irParaLogin={nav.login}
            irParaRegisto={nav.registo}
            irParaFigurinos={nav.figurinos}
            irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
            irParaMinhaAgendaEE={nav.minha_agenda_ee}
            irParaAgenda={nav.agenda}
          />
        }
      />

      <Route
        path="/login"
        element={
          <Login
            irParaLanding={nav.landing}
            irParaRegisto={nav.registo}
            irParaRecuperar={nav.recuperar}
          />
        }
      />
      <Route
        path="/registo"
        element={
          <Registo irParaLogin={nav.login} irParaLanding={nav.landing} />
        }
      />
      <Route
        path="/recuperar"
        element={
          <RecoverPassword
            irParaLogin={nav.login}
            irParaLanding={nav.landing}
          />
        }
      />

      {/* ========================================== */}
      {/* ROTAS PROTEGIDAS (Apenas com Login) */}
      {/* ========================================== */}

      <Route
        path="/agenda"
        element={
          <ProtectedRoute>
            <Agenda
              irParaLanding={nav.landing}
              irParaFigurinos={nav.figurinos}
              irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
              irParaMinhaAgendaEE={nav.minha_agenda_ee}
              irParaAgenda={nav.agenda}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/figurinos"
        element={
          <ProtectedRoute>
            <Figurinos
              irParaLanding={nav.landing}
              irParaFigurinos={nav.figurinos}
              irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
              irParaMinhaAgendaEE={nav.minha_agenda_ee}
              irParaAgenda={nav.agenda}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coaching"
        element={
          <ProtectedRoute>
            <MinhaAgendaProfessor
              irParaLanding={nav.landing}
              irParaFigurinos={nav.figurinos}
              irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
              irParaMinhaAgendaEE={nav.minha_agenda_ee}
              irParaAgenda={nav.agenda}
            />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={<AdminDashboard irParaLanding={nav.landing} />}
      />
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
