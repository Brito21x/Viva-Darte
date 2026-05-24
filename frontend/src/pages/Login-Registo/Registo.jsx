import React, { useState, useEffect, useRef } from "react";
import "./LoginRegisto.css";
import ReCAPTCHA from "react-google-recaptcha";

export default function Registo({ irParaLogin, irParaLanding }) {
  const [tipo, setTipo] = useState("EE");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [nomeAluno, setNomeAluno] = useState("");
  const [dataNascimentoAluno, setDataNascimentoAluno] = useState("");

  const [captchaToken, setCaptchaToken] = useState(null); // <-- 2. Estado para o token do CAPTCHA
  const recaptchaRef = useRef(null);

  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: "",
    redirectOnClose: false,
  });

  useEffect(() => {
    document.title = "Criar Conta | Viva D'arte";
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

  const handleTelefoneChange = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 6) {
      valor = `${valor.substring(0, 3)} ${valor.substring(3, 6)} ${valor.substring(6, 9)}`;
    } else if (valor.length > 3) {
      valor = `${valor.substring(0, 3)} ${valor.substring(3, 6)}`;
    }
    setTelefone(valor.substring(0, 11));
  };

  const lidarComRegisto = async (e) => {
    e.preventDefault();

    if (!captchaToken) {
      mostrarAlerta(
        "Por favor, confirma que não és um robô marcando a caixa do reCAPTCHA.",
      );
      return;
    }

    const regexEspecial = /[!@#$%^&*(),.?":{}|<>]/;

    if (password.length < 8) {
      mostrarAlerta("A password é demasiado curta (mínimo 8 caracteres).");
      return;
    }

    if (!regexEspecial.test(password)) {
      mostrarAlerta(
        "A password deve incluir pelo menos um caractere especial (ex: !, @, #, $).",
      );
      return;
    }

    const telefoneLimpo = telefone.replace(/\s/g, "");

    try {
      const response = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          telefone: telefoneLimpo,
          password,
          tipo,
          nomeAluno,
          dataNascimentoAluno,
          captchaToken,
        }),
      });

      const resultado = await response.json();

      if (response.ok) {
        mostrarAlerta(
          resultado.mensagem ||
            "A sua conta foi enviada para aprovação. Aguarde a confirmação da coordenação.",
          true,
        );
      } else {
        mostrarAlerta(resultado.error || "Erro ao criar conta.");
        if (recaptchaRef.current) recaptchaRef.current.reset();
        setCaptchaToken(null);
      }
    } catch (error) {
      mostrarAlerta("Erro ao ligar ao servidor! Verifica a tua ligação.");
      if (recaptchaRef.current) recaptchaRef.current.reset();
      setCaptchaToken(null);
    }
  };

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
          <h1>Junta-te à nossa comunidade.</h1>
          <p>
            Dá o primeiro passo e cria a tua conta para gerir todo o teu
            percurso.
          </p>
        </div>
      </div>

      <div className="right-side">
        <div className="form-box">
          <header className="form-header">
            <h2>Criar Conta </h2>
            <p>Preenche os teus dados abaixo</p>
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

          <form onSubmit={lidarComRegisto}>
            <div className="input-container">
              <label>Seu Nome Completo (Encarregado)</label>
              <input
                type="text"
                placeholder="Insira o seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            {tipo === "EE" && (
              <div
                className="input-row"
                style={{ display: "flex", gap: "15px", marginBottom: "15px" }}
              >
                <div
                  className="input-container"
                  style={{ flex: 2, marginBottom: 0 }}
                >
                  <label>Nome do Educando </label>
                  <input
                    type="text"
                    placeholder="Nome completo do aluno"
                    value={nomeAluno}
                    onChange={(e) => setNomeAluno(e.target.value)}
                    required={tipo === "EE"}
                  />
                </div>
                <div
                  className="input-container"
                  style={{ flex: 1, marginBottom: 0 }}
                >
                  <label>Data Nascimento </label>
                  <input
                    type="date"
                    value={dataNascimentoAluno}
                    onChange={(e) => setDataNascimentoAluno(e.target.value)}
                    required={tipo === "EE"}
                  />
                </div>
              </div>
            )}

            <div className="input-container">
              <label>Email</label>
              <input
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-container">
              <label>Nº de Telefone</label>
              <div
                className="input-tel-wrapper"
                style={{ display: "flex", alignItems: "center" }}
              >
                <span
                  className="tel-prefix"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginRight: "12px",
                  }}
                >
                  <img
                    src="https://flagcdn.com/w20/pt.png"
                    alt="PT"
                    className="tel-flag"
                  />
                  <span>+351</span>
                </span>
                <input
                  type="tel"
                  className="input-with-prefix"
                  placeholder="912 345 678"
                  value={telefone}
                  onChange={handleTelefoneChange}
                  required
                />
              </div>
            </div>

            <div className="input-container">
              <label>Palavra-passe</label>
              <input
                type="password"
                placeholder="Crie uma senha forte"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "5px",
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
              Finalizar Registo
            </button>
          </form>

          <footer className="form-footer">
            <span>Já tens conta?</span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                irParaLogin();
              }}
            >
              Iniciar Sessão
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
