// Dependências: React com hooks, estilos partilhados e componente reCAPTCHA
import React, { useState, useEffect, useRef } from "react";
import "./LoginRegisto.css";
import ReCAPTCHA from "react-google-recaptcha";

// Credenciais de teste para pré-preenchimento rápido do formulário em ambiente de desenvolvimento
const CREDENCIAIS = [
  { tipo: "EE", email: "ee@gmail.com", password: "###AASDDAD123" },
  { tipo: "EE", email: "eematos@gmail.com", password: "eematos123#" },
  { tipo: "PROF", email: "professor@gmail.com", password: "#BRITO123" },
  { tipo: "PROF", email: "profmatos@gmail.com", password: "profmatos123#" },
  { tipo: "ADMIN", email: "admin@gmail.com", password: "vivadarte123!" },
];

// Página de login: seleção de perfil, autenticação com reCAPTCHA após 3 falhas e tabela de credenciais de teste
export default function Login({
  irParaRegisto,
  irParaLanding,
  irParaRecuperar,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  // Estado do formulário: perfil selecionado, email e password
  const [tipo, setTipo] = useState("EE");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Controlo do reCAPTCHA: contador de tentativas falhadas, token e referência ao widget
  const [tentativasFalhadas, setTentativasFalhadas] = useState(0);
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  // Estado do modal de alerta personalizado
  const [customAlert, setCustomAlert] = useState({ show: false, message: "" });

  // Define o título da página ao montar o componente
  useEffect(() => {
    document.title = "Iniciar Sessão | Viva D'arte";
  }, []);

  // Mostra o alerta personalizado com a mensagem indicada
  const mostrarAlerta = (msg) => {
    setCustomAlert({ show: true, message: msg });
  };

  // Fecha o alerta personalizado
  const fecharAlerta = () => {
    setCustomAlert({ show: false, message: "" });
  };

  // Preenche email, password e perfil ao clicar numa linha da tabela de credenciais de teste
  const preencherCredenciais = (cred) => {
    if (cred.tipo === "EE" || cred.tipo === "PROF") {
      setTipo(cred.tipo);
    }
    setEmail(cred.email);
    setPassword(cred.password);
  };

  // Submete o login: bloqueia se reCAPTCHA pendente, guarda sessão no localStorage em caso de sucesso
  const lidarComLogin = async (e) => {
    e.preventDefault();

    if (tentativasFalhadas >= 3 && !captchaToken) {
      mostrarAlerta(
        "Demasiadas tentativas falhadas. Por favor, confirma que não és um robô.",
      );
      return;
    }

    try {
      const response = await fetch(
        "https://api-vivadarte.onrender.com/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, tipo, captchaToken }),
        },
      );

      const resultado = await response.json();

      if (response.ok) {
        setTentativasFalhadas(0);
        localStorage.setItem("viva_user", JSON.stringify(resultado.utilizador));
        localStorage.setItem("viva_token", resultado.token);

        irParaLanding?.();
      } else {
        setTentativasFalhadas((prev) => prev + 1);
        mostrarAlerta(resultado.mensagem || "Credenciais incorretas.");

        if (recaptchaRef.current) recaptchaRef.current.reset();
        setCaptchaToken(null);
      }
    } catch (error) {
      mostrarAlerta("Erro ao ligar ao servidor! Verifica a tua ligação.");
      if (recaptchaRef.current) recaptchaRef.current.reset();
      setCaptchaToken(null);
    }
  };

  // Callback do reCAPTCHA: guarda o token gerado
  const onCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  return (
    <div className="login-container">
      <button
        className="voltar-landing"
        onClick={irParaLanding}
        aria-label="Voltar"
      >
        <span className="seta-voltar">&#8592;</span>
      </button>

      <div className="left-side">
        <div className="overlay-content">
          <div className="logo-viva">VIVA D'ARTE</div>
          <h1>Bem-vindo de volta.</h1>
          <p>Entra na tua conta para acompanhar o percurso na dança.</p>
        </div>

        {/* Painel de credenciais de teste: clique numa linha para pré-preencher o formulário */}
        <div className="dev-credentials-panel">
          <div className="dev-credentials-header">
            <span className="dev-credentials-title">Credenciais de Teste</span>
          </div>
          <table className="dev-credentials-table">
            <thead>
              <tr>
                <th>Perfil</th>
                <th>Email</th>
                <th>Palavra-passe</th>
              </tr>
            </thead>
            <tbody>
              {CREDENCIAIS.map((cred, i) => (
                <tr
                  key={i}
                  className={`dev-credentials-row${cred.tipo === "ADMIN" ? " dev-credentials-admin-row" : ""}`}
                  onClick={() => preencherCredenciais(cred)}
                  title="Clique para preencher o formulário"
                >
                  <td>{cred.tipo}</td>
                  <td>{cred.email}</td>
                  <td>{cred.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dev-credentials-admin-link">
            <span>Painel Coordenação:</span>
            <a
              href="https://vivadarte-production.up.railway.app/admin"
              target="_blank"
              rel="noopener noreferrer"
            >
              vivadarte-production.up.railway.app/admin ↗
            </a>
          </div>
        </div>
      </div>

      <div className="right-side">
        <div className="form-box">
          <header className="form-header">
            <h2>Iniciar Sessão </h2>
            <p>Selecione o seu perfil</p>
          </header>

          <div className="user-toggle">
            <button
              type="button"
              className={tipo === "EE" ? "active" : ""}
              onClick={() => setTipo("EE")}
            >
              Enc. Educação
            </button>
            <button
              type="button"
              className={tipo === "PROF" ? "active" : ""}
              onClick={() => setTipo("PROF")}
            >
              Professor
            </button>
          </div>

          <form onSubmit={lidarComLogin}>
            <div className="input-container">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@email.com"
                required
              />
            </div>

            <div className="input-container input-container--tight">
              <label>Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="A sua senha"
                required
              />
            </div>

            <div className="forgot-password-link">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  irParaRecuperar();
                }}
              >
                Esqueceu-se da palavra-passe?
              </a>
            </div>

            {tentativasFalhadas >= 3 && (
              <div className="captcha-wrapper">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey="6LesTOIsAAAAACw0jFqhrje-SuCVR_HNRo3WhD2e"
                  onChange={onCaptchaChange}
                />
              </div>
            )}

            <button type="submit" className="btn-login">
              Entrar
            </button>
          </form>

          <footer className="form-footer">
            <span>Ainda não tens conta?</span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                irParaRegisto();
              }}
            >
              Criar Conta
            </a>
          </footer>
        </div>
      </div>

      {customAlert.show && (
        <div className="modal-overlay modal-overlay--alert">
          <div className="modal-content alert-box alert-box--sm">
            <p className="alert-message alert-message--spaced">
              {customAlert.message}
            </p>
            <div className="alert-actions">
              <button className="btn-dark" onClick={fecharAlerta}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
