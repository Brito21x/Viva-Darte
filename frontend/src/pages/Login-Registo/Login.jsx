/**
 * @file Login.jsx
 * @description Página de início de sessão da Viva D'arte.
 *
 * Fluxo:
 * - O utilizador seleciona o perfil (EE ou Professor)
 * - Introduz email e palavra-passe
 * - Após 3 tentativas falhadas surge o reCAPTCHA
 * - Em caso de sucesso, guarda o utilizador/token no localStorage
 *   e navega para a landing page
 *
 * @param {Function} irParaRegisto              - Navega para a página de registo
 * @param {Function} irParaLanding              - Navega para a landing page
 * @param {Function} irParaRecuperar            - Navega para recuperação de password
 * @param {Function} irParaMinhaAgendaProfessor - Navega para agenda do professor
 * @param {Function} irParaMinhaAgendaEE        - Navega para agenda do EE
 */
import React, { useState, useEffect, useRef } from "react";
import "./LoginRegisto.css";
import ReCAPTCHA from "react-google-recaptcha";

export default function Login({
  irParaRegisto,
  irParaLanding,
  irParaRecuperar,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  const [tipo, setTipo] = useState("EE");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tentativasFalhadas, setTentativasFalhadas] = useState(0);
  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  const [customAlert, setCustomAlert] = useState({ show: false, message: "" });

  useEffect(() => {
    document.title = "Iniciar Sessão | Viva D'arte";
  }, []);

  /** Mostra o alerta personalizado com uma mensagem */
  const mostrarAlerta = (msg) => {
    setCustomAlert({ show: true, message: msg });
  };

  /** Fecha o alerta personalizado */
  const fecharAlerta = () => {
    setCustomAlert({ show: false, message: "" });
  };

  /**
   * Submete o formulário de login.
   * Bloqueia se ≥3 tentativas falhadas e o reCAPTCHA não foi resolvido.
   * Em sucesso guarda utilizador e token no localStorage.
   */
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

  /** Callback do reCAPTCHA — guarda o token gerado */
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
