import React, { useState, useEffect, useRef } from "react";
import "./LoginRegisto.css";
import ReCAPTCHA from "react-google-recaptcha";

export default function RecoverPassword({ irParaLogin, irParaLanding }) {
  const [etapa, setEtapa] = useState(1);
  const [email, setEmail] = useState("");

  const [token, setToken] = useState("");

  const [tokenGerado, setTokenGerado] = useState("");

  const [novaPassword, setNovaPassword] = useState("");

  const [captchaToken, setCaptchaToken] = useState(null);
  const recaptchaRef = useRef(null);

  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: "",
    redirectOnClose: false,
  });

  useEffect(() => {
    document.title = "Recuperar Password | Viva D'arte";
  }, []);

  const mostrarAlerta = (msg, redirect = false) => {
    setCustomAlert({ show: true, message: msg, redirectOnClose: redirect });
  };

  const fecharAlerta = () => {
    if (customAlert.redirectOnClose) {
      irParaLogin();
    }
    setCustomAlert({ show: false, message: "", redirectOnClose: false });
  };

  const onCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  const lidarComEmail = async (e) => {
    e.preventDefault();

    if (!captchaToken) {
      mostrarAlerta("Por favor, confirma que não és um robô.");
      return;
    }

    try {
      const response = await fetch(
        "https://salvaging-clumsily-skinhead.ngrok-free.dev/api/auth/recuperar-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, captchaToken }),
        },
      );

      const resultado = await response.json();

      if (response.ok) {
        setTokenGerado(resultado.token);
        setEtapa(2);
        mostrarAlerta(
          `📧 SIMULAÇÃO DE EMAIL: O teu código de segurança é: ${resultado.token}`,
        );
      } else {
        mostrarAlerta(resultado.mensagem || "Erro ao solicitar recuperação.");
        if (recaptchaRef.current) recaptchaRef.current.reset();
        setCaptchaToken(null);
      }
    } catch (error) {
      mostrarAlerta("Erro ao ligar ao servidor. Verifica a tua ligação.");
      if (recaptchaRef.current) recaptchaRef.current.reset();
      setCaptchaToken(null);
    }
  };

  const lidarComToken = (e) => {
    e.preventDefault();

    if (token.trim().toUpperCase() === tokenGerado.trim().toUpperCase()) {
      setEtapa(3);
    } else {
      mostrarAlerta(
        "❌ O código inserido está incorreto. Verifica o token que recebeste no teu email.",
      );
    }
  };

  const confirmarAlteracao = async (e) => {
    e.preventDefault();

    const regexEspecial = /[!@#$%^&*(),.?":{}|<>]/;
    if (novaPassword.length < 8 || !regexEspecial.test(novaPassword)) {
      mostrarAlerta(
        "A password deve ter pelo menos 8 caracteres e um símbolo especial.",
      );
      return;
    }

    try {
      const response = await fetch(
        "https://salvaging-clumsily-skinhead.ngrok-free.dev/api/auth/redefinir-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: token.trim().toUpperCase(),
            novaPassword: novaPassword,
          }),
        },
      );

      if (response.ok) {
        mostrarAlerta(
          "Password alterada com sucesso! Podes agora iniciar sessão.",
          true,
        );
      } else {
        const erro = await response.json();
        mostrarAlerta(erro.mensagem || "Token inválido ou expirado.");
      }
    } catch (error) {
      mostrarAlerta("Erro de rede ao tentar ligar ao servidor.");
    }
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
          <h1>Recuperar Acesso.</h1>
          <p>Valida o teu email e voltas logo à dança.</p>
        </div>
      </div>

      <div className="right-side">
        <div className="form-box">
          <header className="form-header">
            <h2>
              {etapa === 1 && "Recuperar Password "}
              {etapa === 2 && "Verificação de Segurança "}
              {etapa === 3 && "Nova Password "}
            </h2>
          </header>

          {etapa === 1 && (
            <form onSubmit={lidarComEmail}>
              <div className="input-container">
                <label>O teu Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  required
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "15px",
                  marginTop: "15px",
                  transform: "scale(0.90)",
                  transformOrigin: "center",
                }}
              >
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey="6LesTOIsAAAAACw0jFqhrje-SuCVR_HNRo3WhD2e"
                  onChange={onCaptchaChange}
                />
              </div>

              <button type="submit" className="btn-login">
                Enviar Código
              </button>
            </form>
          )}

          {etapa === 2 && (
            <form onSubmit={lidarComToken}>
              <div className="input-container">
                <label>Token recebido no email</label>
                <input
                  type="text"
                  placeholder="Cole o código de 8 caracteres"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-login">
                Validar Token
              </button>
            </form>
          )}

          {etapa === 3 && (
            <form onSubmit={confirmarAlteracao}>
              <div className="input-container">
                <label>Nova Palavra-passe</label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres + símbolo"
                  value={novaPassword}
                  onChange={(e) => setNovaPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-login">
                Alterar Password
              </button>
            </form>
          )}

          <footer className="form-footer">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                irParaLogin();
              }}
            >
              Voltar ao Login
            </a>
          </footer>
        </div>
      </div>

      {customAlert.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div
            className="modal-content alert-box"
            style={{ maxWidth: "400px" }}
          >
            <p className="alert-message" style={{ marginBottom: "30px" }}>
              {customAlert.message}
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
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
