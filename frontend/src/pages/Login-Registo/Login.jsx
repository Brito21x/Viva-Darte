import React, { useState, useEffect } from 'react';
import './LoginRegisto.css'; 

export default function Login({ irParaRegisto, irParaLanding, irParaRecuperar }) {
  const [tipo, setTipo] = useState('EE'); // 'EE' ou 'PROF'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Estado para o Alerta Customizado
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
        body: JSON.stringify({ email, password, tipo })
      });

      const resultado = await response.json();

      if (response.ok) {
        localStorage.setItem('viva_user', JSON.stringify(resultado.user));
        // Se sucesso, vai direto para a página inicial (sem alerta)
        irParaLanding(); 
      } else {
        // Se erro (passe errada, email não existe), mostra o alerta bonito
        mostrarAlerta(resultado.error || "Dados de acesso incorretos.");
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
            <button 
              type="button"
              className={tipo === 'EE' ? 'active' : ''} 
              onClick={() => setTipo('EE')}
            >
              Enc. Educação
            </button>
            <button 
              type="button"
              className={tipo === 'PROF' ? 'active' : ''} 
              onClick={() => setTipo('PROF')}
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

            <div className="input-container" style={{ marginBottom: '5px' }}>
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
              <a href="#" onClick={(e) => { e.preventDefault(); irParaRecuperar(); }}>
                Esqueceu-se da palavra-passe?
              </a>
            </div>

            <button type="submit" className="btn-login">Entrar</button>
          </form>

          <footer className="form-footer">
            <span>Ainda não tens conta?</span>
            <a href="#" onClick={(e) => { e.preventDefault(); irParaRegisto(); }}>
              Criar Conta
            </a>
          </footer>
        </div>
      </div>

      {/* --- O NOSSO ALERTA CUSTOMIZADO E ELEGANTE --- */}
      {customAlert.show && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(26, 24, 22, 0.85)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 9999, backdropFilter: 'blur(6px)'
          }}
        >
          <div 
            style={{
              backgroundColor: '#eeeae2', padding: '35px', borderRadius: '18px',
              maxWidth: '400px', width: '90%', textAlign: 'center',
              boxShadow: '0 15px 50px rgba(0,0,0,0.3)'
            }}
          >
            <p style={{ fontSize: '1.15rem', color: '#2a2724', marginBottom: '30px', fontWeight: '500', lineHeight: '1.4' }}>
              {customAlert.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={fecharAlerta}
                style={{
                  backgroundColor: '#2a2724', color: '#fff', border: 'none',
                  padding: '12px 24px', borderRadius: '8px', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.3s ease'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}