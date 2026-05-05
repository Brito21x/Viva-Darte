import React, { useState, useEffect } from 'react';
import './LoginRegisto.css'; 

export default function Registo({ irParaLogin, irParaLanding }) {
  const [tipo, setTipo] = useState('EE'); 

  // Estados para os campos do formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');

  // Estado para o nosso Alerta Customizado
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', redirectOnClose: false });

  useEffect(() => {
    document.title = "Criar Conta | Viva D'arte";
  }, []);

  // --- FUNÇÕES DE ALERTA ---
  const mostrarAlerta = (msg, redirect = false) => {
    setCustomAlert({ show: true, message: msg, redirectOnClose: redirect });
  };

  const fecharAlerta = () => {
    if (customAlert.redirectOnClose) {
      irParaLogin();
    }
    setCustomAlert({ show: false, message: '', redirectOnClose: false });
  };

  // Função para formatar o telefone como 999 999 999 enquanto digita
  const handleTelefoneChange = (e) => {
    let valor = e.target.value.replace(/\D/g, ''); 
    
    if (valor.length > 6) {
      valor = `${valor.substring(0, 3)} ${valor.substring(3, 6)} ${valor.substring(6, 9)}`;
    } else if (valor.length > 3) {
      valor = `${valor.substring(0, 3)} ${valor.substring(3, 6)}`;
    }
    
    setTelefone(valor.substring(0, 11)); 
  };
  
  const lidarComRegisto = async (e) => {
    e.preventDefault();

    // Validação de Frontend
    const regexEspecial = /[!@#$%^&*(),.?":{}|<>]/;
    
    if (password.length < 8) {
        mostrarAlerta("A password é demasiado curta (mínimo 8 caracteres).");
        return;
    }

    if (!regexEspecial.test(password)) {
        mostrarAlerta("A password deve incluir pelo menos um caractere especial (ex: !, @, #, $).");
        return;
    }

    // Limpa os espaços do telefone antes de enviar para o servidor
    const telefoneLimpo = telefone.replace(/\s/g, '');

    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              nome, 
              email, 
              telefone: telefoneLimpo, 
              password, 
              tipo 
            })
        });

        const resultado = await response.json();

        if (response.ok) {
            // Sucesso! Mostra o alerta e passa 'true' para redirecionar ao fechar
            mostrarAlerta("Conta criada com sucesso!", true);
        } else {
            mostrarAlerta(resultado.error || "Erro ao criar conta.");
        }
    } catch (error) {
        mostrarAlerta("Erro ao ligar ao servidor! Verifica a tua ligação.");
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
          <h1>Junta-te à nossa comunidade.</h1>
          <p>Dá o primeiro passo e cria a tua conta para gerir todo o teu percurso.</p>
        </div>
      </div>

      <div className="right-side">
        <div className="form-box">
          <header className="form-header">
            <h2>Criar Conta ✨</h2>
            <p>Preenche os teus dados abaixo</p>
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

          <form onSubmit={lidarComRegisto}>
            <div className="input-container">
              <label>Nome Completo</label>
              <input 
                type="text" 
                placeholder="Insira o seu nome" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required 
              />
            </div>

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
              <div className="input-tel-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="tel-prefix" style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  marginRight: '12px' 
                }}>
                  <img src="https://flagcdn.com/w20/pt.png" alt="PT" className="tel-flag" />
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

            <button type="submit" className="btn-login">Finalizar Registo</button>
          </form>

          <footer className="form-footer">
            <span>Já tens conta?</span>
            <a href="#" onClick={(e) => { e.preventDefault(); irParaLogin(); }}>
              Iniciar Sessão
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