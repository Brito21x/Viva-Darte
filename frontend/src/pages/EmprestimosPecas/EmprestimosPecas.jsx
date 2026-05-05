// Localização: frontend/src/pages/EmprestimosPecas/EmprestimosPecas.jsx
import React, { useState, useEffect } from 'react';
import './EmprestimosPecas.css';
import logoImg from '../../assets/logo.png';

export default function EmprestimosPecas({ irParaLanding, irParaVendaFigurinos }) {
  const [utilizador, setUtilizador] = useState(null);

  // 1. STATE VAZIO: Preparado para receber os dados reais da BD
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    document.title = "Empréstimos de Peças | Viva D'arte";
    
    // Verificar se o utilizador tem sessão iniciada
    const userGuardado = localStorage.getItem('viva_user');
    if (userGuardado) {
      setUtilizador(JSON.parse(userGuardado));
    }

    // 2. BUSCAR DADOS REAIS À BASE DE DADOS
    const carregarEmprestimos = async () => {
      try {
        // Ajusta este URL para bater certo com a rota do teu backend (ex: /api/emprestimos)
        const response = await fetch('http://localhost:3000/api/emprestimos'); 
        if (response.ok) {
          const dados = await response.json();
          setPecas(dados);
        } else {
          console.error("Falha ao ir buscar as peças para empréstimo.");
        }
      } catch (error) {
        console.error("Erro de ligação à BD:", error);
      } finally {
        setCarregando(false);
      }
    };

    carregarEmprestimos();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('viva_user');
    window.location.reload();
  };

  return (
    <div className="emprestimos-page">
      
      {/* --- NAVBAR --- */}
      <nav className="navbar interna">
        <div className="nav-brand" onClick={irParaLanding} style={{ cursor: 'pointer' }}>
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>
        
        <ul className="nav-menu">
          <li><a href="#" onClick={(e) => { e.preventDefault(); irParaLanding(); }}>Início</a></li>
          {utilizador?.perfil === 'Professor' ? (
            <>
              <li><span className="nav-separator">|</span></li>
              <li><a href="#" className="special-link">Coaching Agendados</a></li>
              <li><a href="#" className="special-link active">Empréstimos de peças</a></li>
              <li><a href="#" className="special-link" onClick={(e) => { e.preventDefault(); irParaVendaFigurinos(); }}>Venda de figurinos</a></li>
            </>
          ) : utilizador ? (
            <>
              <li><span className="nav-separator">|</span></li>
              <li><a href="#" className="special-link">Agendar Coaching</a></li>
              <li><a href="#" className="special-link active">Empréstimos de peças</a></li>
              <li><a href="#" className="special-link" onClick={(e) => { e.preventDefault(); irParaVendaFigurinos(); }}>Venda de figurinos</a></li>
            </>
          ) : null}
        </ul>

        <div className="nav-actions">
          {utilizador ? (
            <div className="user-profile">
              <span className="welcome-text">Olá, <strong>{utilizador.nome.split(' ')[0]}</strong></span>
              <button className="btn-logout" onClick={handleLogout}>Sair</button>
            </div>
          ) : (
            <button className="btn-text" onClick={irParaLanding}>Voltar</button>
          )}
        </div>
      </nav>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="emprestimos-content-wrapper">
        <div className="emprestimos-header-section">
          <div>
            <h1 className="emprestimos-title">Empréstimos de Peças</h1>
            <p className="emprestimos-subtitle">
              Solicita ou partilha peças com a comunidade Viva D'arte.
            </p>
          </div>
          {/* O botão só aparece se o utilizador tiver sessão iniciada */}
          {utilizador && (
            <button className="btn-add-peca">
              + Disponibilizar Peça
            </button>
          )}
        </div>

        <div className="pecas-grid">
          {carregando ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888' }}>
              A carregar peças disponíveis...
            </div>
          ) : pecas.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
              Ainda não existem peças disponíveis para empréstimo. Sê o primeiro a disponibilizar!
            </div>
          ) : (
            pecas.map((peca) => (
              <div key={peca.id_peca || peca.id} className="peca-card">
                
                <div className="peca-image-container">
                  {peca.imagem || (peca.fotos && peca.fotos.length > 0) ? (
                    <img src={peca.imagem || peca.fotos[0]} alt={peca.nome} className="peca-image" />
                  ) : (
                    <div className="peca-image-placeholder">
                      <span>Sem Imagem</span>
                    </div>
                  )}
                  
                  {/* Assumimos que a BD devolve disponivel_para_emprestimo (1 ou 0) */}
                  <span className={`status-badge ${peca.disponivel_para_emprestimo ? 'disponivel' : 'emprestado'}`}>
                    {peca.disponivel_para_emprestimo ? 'DISPONÍVEL' : 'EMPRESTADO'}
                  </span>

                  {/* Ações do dono: Só aparecem se o utilizador logado for o dono da peça */}
                  {utilizador && utilizador.id_utilizador === peca.UTILIZADORid_utilizador && (
                    <div className="owner-actions">
                      <button className="action-btn edit-btn" title="Editar">✏️</button>
                      <button className="action-btn delete-btn" title="Apagar">🗑️</button>
                    </div>
                  )}
                </div>

                <div className="peca-content">
                  <h3 className="peca-nome">{peca.nome}</h3>
                  
                  <div className="peca-tags">
                    <span className="tag-estado">{peca.estado || peca.condicao}</span>
                    {peca.tamanho && <span className="tag-tamanho">Tam: {peca.tamanho}</span>}
                  </div>

                  <p className="peca-owner">Disponibilizado por: <strong>{peca.UTILIZADOR_nome || peca.proprietario}</strong></p>

                  <div className="peca-footer">
                    {peca.disponivel_para_emprestimo ? (
                      <>
                        <span className="peca-price">Gratuito</span>
                        <button className="btn-solicitar">Solicitar</button>
                      </>
                    ) : (
                      <>
                        <span className="peca-devolucao">
                          Devolução: {peca.data_devolucao ? new Date(peca.data_devolucao).toLocaleDateString('pt-PT') : 'Por definir'}
                        </span>
                        <button className="btn-solicitar disabled" disabled>Indisponível</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- FOOTER COMPACTO --- */}
      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Contacto</h3>
            <ul className="footer-info">
              <li><span>📍</span> Rua das Artes, nº 123, Braga</li>
              <li><span>📞</span> +351 000 000 000</li>
              <li><span>✉️</span> geral@vivadarte.pt</li>
            </ul>
          </div>

          <div className="footer-column">
            <h3>Links Rápidos</h3>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => { e.preventDefault(); irParaLanding(); }}>Página Inicial</a></li>
            </ul>
          </div>

          <div className="footer-column">
            <h3>Redes Sociais</h3>
            <div className="social-icons-only">
              <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-svg" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" className="social-svg" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-line"></div>
          <p>&copy; 2026 Viva D'arte. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}