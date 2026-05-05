import React, { useState, useEffect } from 'react';
import './LoginRegisto.css';
import { API_URL } from '../../services/api'; 

export default function RecoverPassword({ irParaLogin, irParaLanding }) {
  const [etapa, setEtapa] = useState(1); 
  const [email, setEmail] = useState('');
  
  // Estado para o input do utilizador
  const [token, setToken] = useState('');
  
  // Estado para guardar o token real gerado pelo backend
  const [tokenGerado, setTokenGerado] = useState(''); 
  
  const [novaPassword, setNovaPassword] = useState('');

  const [customAlert, setCustomAlert] = useState({ show: false, message: '', redirectOnClose: false });

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
    setCustomAlert({ show: false, message: '', redirectOnClose: false });
  };

  // ETAPA 1: Validar Email na BD e guardar o Token gerado
  const lidarComEmail = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/auth/recuperar-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const resultado = await response.json();

      if (response.ok) {
        // Guarda o token real em memória para comparar no passo 2
        setTokenGerado(resultado.token);
        
        setEtapa(2);
        // ALERTA COM O CÓDIGO (Simulação de Email)
        mostrarAlerta(`📧 SIMULAÇÃO DE EMAIL: O teu código de segurança é: ${resultado.token}`);
      } else {
        mostrarAlerta(resultado.mensagem || "Erro ao solicitar recuperação.");
      }
    } catch (error) {
      mostrarAlerta("Erro ao ligar ao servidor. Verifica a tua ligação.");
    }
  };

  // ETAPA 2: Validar se o token inserido é igual ao token gerado
  const lidarComToken = (e) => {
    e.preventDefault();
    
    // Compara ignorando espaços e garantindo maiúsculas
    if (token.trim().toUpperCase() === tokenGerado.trim().toUpperCase()) {
      setEtapa(3); // Se for igual, avança
    } else {
      mostrarAlerta("❌ O código inserido está incorreto. Verifica o token que recebeste no teu email.");
    }
  };

  // ETAPA 3: Envia Token + Nova Password para a Base de Dados
  const confirmarAlteracao = async (e) => {
    e.preventDefault();

    const regexEspecial = /[!@#$%^&*(),.?":{}|<>]/;
    if (novaPassword.length < 8 || !regexEspecial.test(novaPassword)) {
        mostrarAlerta("A password deve ter pelo menos 8 caracteres e um símbolo especial.");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/auth/redefinir-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: token.trim().toUpperCase(), 
                novaPassword: novaPassword 
            })
        });

        if (response.ok) {
            mostrarAlerta("Password alterada com sucesso! Podes agora iniciar sessão.", true);
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
      <button className="voltar-landing" onClick={irParaLanding}><span className="seta-voltar">&#8592;</span></button>

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
              {etapa === 1 && "Recuperar Password 🔑"}
              {etapa === 2 && "Verificação de Segurança 📱"}
              {etapa === 3 && "Nova Password ✨"}
            </h2>
          </header>

          {etapa === 1 && (
            <form onSubmit={lidarComEmail}>
              <div className="input-container">
                <label>O teu Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@email.com" required />
              </div>
              <button type="submit" className="btn-login">Enviar Código</button>
            </form>
          )}

          {etapa === 2 && (
            <form onSubmit={lidarComToken}>
              <div className="input-container">
                <label>Token recebido no email</label>
                <input type="text" placeholder="Cole o código de 8 caracteres" value={token} onChange={(e) => setToken(e.target.value)} required />
              </div>
              <button type="submit" className="btn-login">Validar Token</button>
            </form>
          )}

          {etapa === 3 && (
            <form onSubmit={confirmarAlteracao}>
              <div className="input-container">
                <label>Nova Palavra-passe</label>
                <input type="password" placeholder="Mínimo 8 caracteres + símbolo" value={novaPassword} onChange={(e) => setNovaPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn-login">Alterar Password</button>
            </form>
          )}

          <footer className="form-footer">
            <a href="#" onClick={(e) => { e.preventDefault(); irParaLogin(); }}>Voltar ao Login</a>
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