import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Landing from "./pages/LandingPage/Landing";
import Login from "./pages/Login-Registo/Login";
import Registo from "./pages/Login-Registo/Registo";
import RecoverPassword from "./pages/Login-Registo/RecoverPassword";
import Figurinos from "./pages/Figurinos/Figurinos";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard";
import MinhaAgendaProfessor from "./pages/MinhaAgendaProfessor/MinhaAgendaProfessor";

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
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Landing
            irParaLogin={nav.login}
            irParaRegisto={nav.registo}
            irParaFigurinos={nav.figurinos}
            irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
            irParaMinhaAgendaEE={nav.minha_agenda_ee}
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

      <Route
        path="/figurinos"
        element={
          <Figurinos
            irParaLanding={nav.landing}
            irParaFigurinos={nav.figurinos}
            irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
            irParaMinhaAgendaEE={nav.minha_agenda_ee}
          />
        }
      />

      <Route
        path="/coaching"
        element={
          <MinhaAgendaProfessor
            irParaLanding={nav.landing}
            irParaFigurinos={nav.figurinos}
            irParaMinhaAgendaProfessor={nav.minha_agenda_professor}
            irParaMinhaAgendaEE={nav.minha_agenda_ee}
          />
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
