// Localização: frontend/src/pages/.../VendaFigurinos.jsx
import React, { useState, useEffect } from 'react';
import './VendaFigurinos.css';
import logoImg from '../../assets/logo.png'; // Ajusta o caminho se for diferente

export default function VendaFigurinos({ irParaLanding, irParaEmprestimos }) {
  const [utilizador, setUtilizador] = useState(null);
  const [figurinos, setFigurinos] = useState([]);
  
  // Controlo de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para o nosso Alerta Customizado (Substitui o window.alert e window.confirm)
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', type: 'alert', onConfirm: null });
  
  const [figurinoSelecionado, setFigurinoSelecionado] = useState(null);

  // Formulário de Nova Venda (Agora com tamanho e descricao)
  const [novaVenda, setNovaVenda] = useState({
    PECA_nome: '', 
    preco: '',
    condicao: 'Novo',
    tamanho: '',
    descricao: '',
    metodos_pagamento: ['MBWay'], 
    fotos: [] 
  });

  const [figurinoEmEdicao, setFigurinoEmEdicao] = useState(null);
  const [metodoPagamentoCompra, setMetodoPagamentoCompra] = useState('MBWay');
  const [indicesImagens, setIndicesImagens] = useState({});

  // URL BASE DO BACKEND
  const API_URL = 'http://localhost:3000/api/vendas';

  // --- FUNÇÕES DE ALERTA ---
  const mostrarAlerta = (msg) => {
    setCustomAlert({ show: true, message: msg, type: 'alert', onConfirm: null });
  };

  const fecharAlerta = () => {
    setCustomAlert({ show: false, message: '', type: 'alert', onConfirm: null });
  };

  // --- CARREGAR DADOS INICIAIS ---
  useEffect(() => {
    const userGuardado = localStorage.getItem('viva_user');
    if (userGuardado) {
      setUtilizador(JSON.parse(userGuardado));
    }
    document.title = "Venda de Figurinos | Escola de Dança";
    carregarFigurinos();
  }, []);

  const carregarFigurinos = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setFigurinos(data);
      }
    } catch (error) {
      console.error("Erro a carregar figurinos:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('viva_user');
    setUtilizador(null);
    if(irParaLanding) irParaLanding(); 
    window.location.reload();
  };

  /* --- NAVEGAÇÃO DE IMAGENS --- */
  const proximaImagem = (e, id_venda, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens(prev => ({
      ...prev, [id_venda]: ((prev[id_venda] || 0) + 1) % totalFotos
    }));
  };

  const imagemAnterior = (e, id_venda, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens(prev => ({
      ...prev, [id_venda]: ((prev[id_venda] || 0) - 1 + totalFotos) % totalFotos
    }));
  };

  /* --- UPLOAD E COMPRESSÃO DE FOTOS --- */
  const handleFotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    
    const comprimirImagem = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; 
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
        };
      });
    };

    try {
        const base64Fotos = await Promise.all(files.map(file => comprimirImagem(file)));
        setNovaVenda(prev => ({ ...prev, fotos: [...prev.fotos, ...base64Fotos] }));
    } catch (error) {
        console.error("Erro ao converter fotos:", error);
        mostrarAlerta("Erro ao processar as imagens.");
    }
  };

  const removerFoto = (indexParaRemover) => {
    setNovaVenda(prev => ({ ...prev, fotos: prev.fotos.filter((_, index) => index !== indexParaRemover) }));
  };

  const handleCheckboxPagamento = (metodo) => {
    setNovaVenda(prev => {
      const jaSelecionado = prev.metodos_pagamento.includes(metodo);
      return jaSelecionado 
        ? { ...prev, metodos_pagamento: prev.metodos_pagamento.filter(m => m !== metodo) }
        : { ...prev, metodos_pagamento: [...prev.metodos_pagamento, metodo] };
    });
  };

  // --- SUBMETER VENDA (POST) ---
  const handleSubmeterVenda = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); 
    
    const userId = utilizador?.id_utilizador || utilizador?.id;

    if (!userId) {
        mostrarAlerta("Erro: Sessão inválida. O ID de utilizador não foi encontrado. Tenta fazer Logout e Login novamente.");
        setIsSubmitting(false); 
        return;
    }

    if (novaVenda.metodos_pagamento.length === 0) {
      mostrarAlerta("Por favor, seleciona pelo menos um método de pagamento.");
      setIsSubmitting(false); 
      return;
    }

    const payload = {
        ...novaVenda,
        id_utilizador: userId
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            mostrarAlerta('Figurino colocado à venda com sucesso!');
            setNovaVenda({ PECA_nome: '', preco: '', condicao: 'Novo', tamanho: '', descricao: '', metodos_pagamento: ['MBWay'], fotos: [] });
            setIsModalOpen(false);
            carregarFigurinos();
        } else {
            mostrarAlerta('Ocorreu um erro ao guardar na base de dados.');
        }
    } catch (error) {
        console.error("Erro:", error);
        mostrarAlerta('Erro de ligação ao servidor.');
    } finally {
        setIsSubmitting(false); 
    }
  };

  // --- APAGAR VENDA (DELETE) COM CONFIRMAÇÃO CUSTOMIZADA ---
  const handleApagar = (id_venda) => {
    setCustomAlert({
      show: true,
      type: 'confirm',
      message: 'Tens a certeza absoluta que queres apagar este figurino?',
      onConfirm: async () => {
        try {
            const response = await fetch(`${API_URL}/${id_venda}`, { method: 'DELETE' });
            if (response.ok) {
                carregarFigurinos();
            } else {
                mostrarAlerta('Erro ao apagar o figurino.');
            }
        } catch (error) {
            console.error("Erro ao apagar:", error);
        }
        fecharAlerta();
      }
    });
  };

  // --- EDITAR VENDA (PUT) ---
  const abrirEdicao = (figurino) => {
    setFigurinoEmEdicao({ ...figurino });
    setIsEditModalOpen(true);
  };

  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`${API_URL}/${figurinoEmEdicao.id_venda}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                PECA_nome: figurinoEmEdicao.PECA_nome,
                preco: figurinoEmEdicao.preco,
                estado: figurinoEmEdicao.estado,
                tamanho: figurinoEmEdicao.tamanho,
                descricao: figurinoEmEdicao.descricao
            })
        });

        if (response.ok) {
            mostrarAlerta('Alterações guardadas com sucesso!');
            setIsEditModalOpen(false);
            carregarFigurinos();
        } else {
          mostrarAlerta('Erro ao guardar as alterações.');
        }
    } catch (error) {
        console.error("Erro ao editar:", error);
    }
  };

  // --- COMPRAR VENDA (PUT) ---
  const handleComprar = (figurino) => {
    setFigurinoSelecionado(figurino);
    if (figurino.metodos_pagamento && figurino.metodos_pagamento.length > 0) {
      setMetodoPagamentoCompra(figurino.metodos_pagamento[0]);
    }
    setIsCompraModalOpen(true);
  };

  const confirmarCompra = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); 

    const idComprador = utilizador?.id_utilizador || utilizador?.id;

    if (!idComprador) {
        mostrarAlerta("Erro: Sessão inválida. Por favor, faz login novamente para comprar.");
        setIsSubmitting(false);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${figurinoSelecionado.id_venda}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                PECA_nome: figurinoSelecionado.PECA_nome,
                preco: figurinoSelecionado.preco,
                estado: 'Vendido', 
                UTILIZADORid_utilizador2: idComprador 
            })
        });

        if (response.ok) {
            mostrarAlerta(`Compra de ${figurinoSelecionado.PECA_nome} confirmada!`);
            setIsCompraModalOpen(false);
            carregarFigurinos(); 
        } else {
            mostrarAlerta('Ocorreu um erro ao confirmar a compra.');
        }
    } catch (error) {
        console.error("Erro a confirmar compra:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="nav-brand">
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>
        <ul className="nav-menu">
  <li><a href="#" onClick={(e) => { e.preventDefault(); irParaLanding(); }}>Início</a></li>
  
  {utilizador?.perfil === 'Professor' ? (
    <>
      <li><span className="nav-separator">|</span></li>
      <li><a href="#" className="special-link">Coaching Agendados</a></li>
      <li><a href="#" className="special-link" onClick={(e) => { e.preventDefault(); irParaEmprestimos(); }}>Empréstimos de peças</a></li>
      <li><a href="#" className="special-link active">Venda de figurinos</a></li>
    </>
  ) : utilizador ? (
    <>
      <li><span className="nav-separator">|</span></li>
      <li><a href="#" className="special-link">Agendar Coaching</a></li>
      <li><a href="#" className="special-link" onClick={(e) => { e.preventDefault(); irParaEmprestimos(); }}>Empréstimos de peças</a></li>
      <li><a href="#" className="special-link active">Venda de figurinos</a></li>
    </>
  ) : null}
</ul>
        <div className="nav-actions">
          {utilizador && (
            <div className="user-profile">
              <span className="welcome-text">Olá, <strong>{utilizador.nome}</strong></span>
              <button className="btn-logout" onClick={handleLogout}>Sair</button>
            </div>
          )}
        </div>
      </nav>

      <div className="vendas-container">
        <div className="vendas-header">
          <div>
            <h1>Mercado de Figurinos</h1>
            <p>Compra e vende figurinos usados dentro da comunidade Viva D'arte.</p>
          </div>
          {utilizador && (
            <button className="btn-dark btn-publicar" onClick={(e) => { e.preventDefault(); setIsModalOpen(true); }}>
              + Colocar à Venda
            </button>
          )}
        </div>

        <div className="figurinos-grid">
          {figurinos.map((fig) => {
            const idxImg = indicesImagens[fig.id_venda] || 0;
            const totalFotos = fig.fotos && fig.fotos.length > 0 ? fig.fotos.length : 0;

            return (
              <div className={`figurino-card ${fig.estado === 'Vendido' ? 'vendido' : ''}`} key={fig.id_venda}>
                
                <div className="figurino-img" style={{ backgroundImage: `url(${fig.fotos ? fig.fotos[idxImg] : ''})` }}>
                  <span className={`badge-estado ${fig.estado === 'Vendido' ? 'bg-red' : 'bg-green'}`}>
                    {fig.estado}
                  </span>

                  {totalFotos > 1 && (
                    <>
                      <button className="img-nav-btn left" onClick={(e) => imagemAnterior(e, fig.id_venda, totalFotos)}>‹</button>
                      <button className="img-nav-btn right" onClick={(e) => proximaImagem(e, fig.id_venda, totalFotos)}>›</button>
                      <div className="img-dots">
                        {fig.fotos.map((_, i) => (
                          <span key={i} className={`dot ${i === idxImg ? 'active' : ''}`}></span>
                        ))}
                      </div>
                    </>
                  )}

                  {utilizador?.id_utilizador === fig.id_utilizador && (
                    <div className="acoes-dono">
                      {fig.estado !== 'Vendido' && (
                        <button className="btn-icon edit" title="Editar" onClick={() => abrirEdicao(fig)}>✎</button>
                      )}
                      <button className="btn-icon delete" title="Apagar" onClick={() => handleApagar(fig.id_venda)}>🗑️</button>
                    </div>
                  )}
                </div>

                <div className="figurino-info">
                  <h3>{fig.PECA_nome}</h3>
                  <div className="tags-container">
                    <span className="badge-condicao">{fig.condicao}</span>
                    {fig.tamanho && <span className="badge-tamanho">Tam: {fig.tamanho}</span>}
                  </div>
                  
                  {fig.descricao && <p className="descricao-peca">{fig.descricao}</p>}
                  <p className="vendedor">Por: {fig.UTILIZADOR_nome}</p>
                  
                  <div className="metodos-pagamento-tags">
                    {fig.metodos_pagamento?.map(m => <span key={m} className="tag-pagamento">{m}</span>)}
                  </div>

                  <div className="figurino-footer">
                    <span className="preco">{Number(fig.preco).toFixed(2)} €</span>
                    
                    {fig.estado === 'Disponível' && utilizador?.id_utilizador !== fig.id_utilizador && (
                      <button className="btn-outline btn-sm" onClick={() => handleComprar(fig)} disabled={!utilizador}>
                        Comprar
                      </button>
                    )}
                    
                    {fig.estado === 'Disponível' && utilizador?.id_utilizador === fig.id_utilizador && (
                      <span className="texto-teu-item">O teu item</span>
                    )}

                    {fig.estado === 'Vendido' && fig.COMPRADOR_nome && (
                      <span className="texto-teu-item" style={{ color: '#b38b59', fontWeight: 'bold' }}>
                        Comprado por: {fig.COMPRADOR_nome}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {figurinos.length === 0 && (
             <div className="empty-state">
               <p>Não há figurinos à venda de momento.</p>
             </div>
          )}
        </div>
      </div>

      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Contacto</h3>
            <ul className="footer-info">
              <li><span>📍</span> Rua das Artes, nº 123, Lisboa</li>
              <li><span>📞</span> +351 912 345 678</li>
              <li><span>✉️</span> geral@vivadarte.pt</li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Links Rápidos</h3>
            <ul className="footer-links">
              <li><a href="#" onClick={(e) => { e.preventDefault(); if(irParaLanding) irParaLanding(); }}>Página Inicial</a></li>
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

      {/* --- MODAIS DE COMPRA, VENDA E ALERTA --- */}
      
      {/* 1. Modal de Nova Venda */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content form-venda">
            <h2>Vender Figurino</h2>
            <form onSubmit={handleSubmeterVenda}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input type="text" value={novaVenda.PECA_nome} onChange={(e) => setNovaVenda({...novaVenda, PECA_nome: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço (€)</label>
                  <input type="number" step="0.01" value={novaVenda.preco} onChange={(e) => setNovaVenda({...novaVenda, preco: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input type="text" placeholder="Ex: S, 38, Único" value={novaVenda.tamanho} onChange={(e) => setNovaVenda({...novaVenda, tamanho: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select value={novaVenda.condicao} onChange={(e) => setNovaVenda({...novaVenda, condicao: e.target.value})}>
                    <option value="Novo">Novo</option>
                    <option value="Usado - Como Novo">Usado - Como Novo</option>
                    <option value="Usado - Bom estado">Usado - Bom estado</option>
                    <option value="Usado - Marcas de uso">Usado - Marcas de uso</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição e Detalhes</label>
                <textarea rows="3" placeholder="Descreve o material, detalhes ou marcas de uso..." value={novaVenda.descricao} onChange={(e) => setNovaVenda({...novaVenda, descricao: e.target.value})}></textarea>
              </div>
              <div className="form-group">
                <label>Métodos de Pagamento</label>
                <div className="checkbox-group">
                  {['MBWay', 'Transferência', 'Numerário'].map(metodo => (
                    <label className="checkbox-label" key={metodo}>
                      <input type="checkbox" checked={novaVenda.metodos_pagamento.includes(metodo)} onChange={() => handleCheckboxPagamento(metodo)} />
                      {metodo}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Fotos (Máx 4)</label>
                <div className="fotos-preview-container">
                  {novaVenda.fotos.map((fotoUrl, index) => (
                    <div className="foto-preview-box" key={index}>
                      <img src={fotoUrl} alt="Preview" />
                      <button type="button" className="btn-remover-foto" onClick={() => removerFoto(index)}>X</button>
                    </div>
                  ))}
                </div>
                {novaVenda.fotos.length < 4 && (
                  <label className="btn-upload-foto">
                    <span>+ Adicionar Foto</span>
                    <input type="file" accept="image/*" multiple onChange={handleFotosUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-dark" disabled={isSubmitting}>{isSubmitting ? 'A Publicar...' : 'Publicar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Editar */}
      {isEditModalOpen && figurinoEmEdicao && (
        <div className="modal-overlay">
          <div className="modal-content form-venda">
            <h2>Editar Figurino</h2>
            <form onSubmit={handleGuardarEdicao}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input type="text" value={figurinoEmEdicao.PECA_nome || ''} onChange={(e) => setFigurinoEmEdicao({...figurinoEmEdicao, PECA_nome: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço (€)</label>
                  <input type="number" step="0.01" value={figurinoEmEdicao.preco || ''} onChange={(e) => setFigurinoEmEdicao({...figurinoEmEdicao, preco: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input type="text" value={figurinoEmEdicao.tamanho || ''} onChange={(e) => setFigurinoEmEdicao({...figurinoEmEdicao, tamanho: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={figurinoEmEdicao.estado || ''} onChange={(e) => setFigurinoEmEdicao({...figurinoEmEdicao, estado: e.target.value})}>
                    <option value="Disponível">Disponível</option>
                    <option value="Vendido">Vendido</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea rows="3" value={figurinoEmEdicao.descricao || ''} onChange={(e) => setFigurinoEmEdicao({...figurinoEmEdicao, descricao: e.target.value})}></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-dark">Guardar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Compra */}
      {isCompraModalOpen && figurinoSelecionado && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirmar Compra</h2>
            <div className="resumo-compra">
              <p><strong>Item:</strong> {figurinoSelecionado.PECA_nome}</p>
              {figurinoSelecionado.tamanho && <p><strong>Tamanho:</strong> {figurinoSelecionado.tamanho}</p>}
              <p><strong>Total:</strong> {Number(figurinoSelecionado.preco).toFixed(2)} €</p>
            </div>
            <form onSubmit={confirmarCompra}>
              <div className="form-group">
                <label>Pagamento</label>
                <select value={metodoPagamentoCompra} onChange={(e) => setMetodoPagamentoCompra(e.target.value)}>
                  {figurinoSelecionado.metodos_pagamento?.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setIsCompraModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-dark" disabled={isSubmitting}>{isSubmitting ? 'A Processar...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. NOSSO NOVO ALERTA CUSTOMIZADO (Substitui os Alertas do Navegador) */}
      {customAlert.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content alert-box">
            <p className="alert-message">{customAlert.message}</p>
            <div className="alert-buttons">
              {customAlert.type === 'confirm' && (
                <button className="btn-outline btn-sm" onClick={fecharAlerta}>Cancelar</button>
              )}
              <button className="btn-dark" onClick={customAlert.type === 'confirm' ? customAlert.onConfirm : fecharAlerta}>
                {customAlert.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}