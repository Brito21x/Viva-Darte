import React, { useState, useEffect } from 'react';
import './LoginRegisto.css'; 

export default function Login({
  irParaRegisto,
  irParaLanding,
  irParaRecuperar,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE
}) {
  const [tipo, setTipo] = useState('EE'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [customAlert, setCustomAlert] = useState({ show: false, message: '' });

  useEffect(() => {
    document.title = "Iniciar Sessão | Viva D'arte";
  }, []);

  const mostrarAlerta = (msg) => {
    setCustomAlert({ show: true, message: msg });
  };

  const fecharAlerta = () => {
    setCustomAlert({ show: false, message: '' });
  };

  const lidarComLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // AGORA ENVIAMOS O "tipo" PARA O BACKEND VALIDAR
        body: JSON.stringify({ email, password, tipo }) 
      });

      const resultado = await response.json();

      if (response.ok) {
        // Grava o objeto que o backend envia (inclui o perfil ativo validado)
        localStorage.setItem('viva_user', JSON.stringify(resultado.utilizador));
        localStorage.setItem('viva_token', resultado.token);
        
        // Redireciona sempre para a Landing Page após o login
        irParaLanding?.();
      } else {
        mostrarAlerta(resultado.mensagem || "Dados de acesso incorretos.");
      }
    } catch (error) {
      mostrarAlerta("Erro ao ligar ao servidor. Verifica a tua ligação.");
    }
  };

  return (
    <div className="login-container">
      <button className="voltar-landing" onClick={irParaLanding} aria-label="Voltar">
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
            <h2>Iniciar Sessão ✨</h2>
            <p>Selecione o seu perfil</p>
          </header>

          <div className="user-toggle">
            <button type="button" className={tipo === 'EE' ? 'active' : ''} onClick={() => setTipo('EE')}>Enc. Educação</button>
            <button type="button" className={tipo === 'PROF' ? 'active' : ''} onClick={() => setTipo('PROF')}>Professor</button>
          </div>

          <form onSubmit={lidarComLogin}>
            <div className="input-container">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@email.com" required />
            </div>

            <div className="input-container" style={{ marginBottom: '5px' }}>
              <label>Palavra-passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="A sua senha" required />
            </div>
            
            <div className="forgot-password-link">
              <a href="#" onClick={(e) => { e.preventDefault(); irParaRecuperar(); }}>Esqueceu-se da palavra-passe?</a>
            </div>

            <button type="submit" className="btn-login">Entrar</button>
          </form>

          <footer className="form-footer">
            <span>Ainda não tens conta?</span>
            <a href="#" onClick={(e) => { e.preventDefault(); irParaRegisto(); }}>Criar Conta</a>
          </footer>
        </div>
      </div>

      {customAlert.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content alert-box" style={{ maxWidth: '400px' }}>
            <p className="alert-message" style={{ marginBottom: '30px' }}>{customAlert.message}</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-dark" onClick={fecharAlerta}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}