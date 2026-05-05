import React, { useState, useEffect } from 'react';
import './VendaFigurinos.css';
import logoImg from '../../assets/logo.png'; 

export default function VendaFigurinos({ irParaLanding, irParaEmprestimos }) {
  const [utilizador, setUtilizador] = useState(null);
  const [figurinos, setFigurinos] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', type: 'alert', onConfirm: null });
  const [figurinoSelecionado, setFigurinoSelecionado] = useState(null);

  const [novaVenda, setNovaVenda] = useState({
    PECA_nome: '', 
    preco: '',
    condicao: 'Novo', // Deve bater com: 'Novo', 'Bom', 'Usado', 'Danificado'
    tamanho: '',
    descricao: '',
    metodos_pagamento: ['MBWay'], 
    fotos: [] 
  });

  const [figurinoEmEdicao, setFigurinoEmEdicao] = useState(null);
  const [metodoPagamentoCompra, setMetodoPagamentoCompra] = useState('MBWay');
  const [indicesImagens, setIndicesImagens] = useState({});

  // URL BASE DO NOVO BACKEND
  const API_URL = 'http://localhost:3000/api/inventario';

  const mostrarAlerta = (msg) => setCustomAlert({ show: true, message: msg, type: 'alert', onConfirm: null });
  const fecharAlerta = () => setCustomAlert({ show: false, message: '', type: 'alert', onConfirm: null });

  useEffect(() => {
    const userGuardado = localStorage.getItem('viva_user');
    if (userGuardado) setUtilizador(JSON.parse(userGuardado));
    document.title = "Venda de Figurinos | Viva D'arte";
    carregarFigurinos();
  }, []);

  // Busca o token do localStorage
  const getToken = () => localStorage.getItem('token') || '';

  // --- CARREGAR DADOS ---
  const carregarFigurinos = async () => {
    try {
      const response = await fetch(`${API_URL}/vendas`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
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
    localStorage.removeItem('token');
    setUtilizador(null);
    if(irParaLanding) irParaLanding(); 
    window.location.reload();
  };

  const proximaImagem = (e, id_venda, totalFotos) => {
    e.stopPropagation(); setIndicesImagens(prev => ({ ...prev, [id_venda]: ((prev[id_venda] || 0) + 1) % totalFotos }));
  };
  const imagemAnterior = (e, id_venda, totalFotos) => {
    e.stopPropagation(); setIndicesImagens(prev => ({ ...prev, [id_venda]: ((prev[id_venda] || 0) - 1 + totalFotos) % totalFotos }));
  };

  const handleFotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    const comprimirImagem = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image(); img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width, height = img.height;
            if (width > height) { if (width > 800) { height *= 800 / width; width = 800; } } 
            else { if (height > 800) { width *= 800 / height; height = 800; } }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
        };
      });
    };
    try {
        const Fotos = await Promise.all(files.map(file => comprimirImagem(file)));
        setNovaVenda(prev => ({ ...prev, fotos: [...prev.fotos, ...Fotos] }));
    } catch (error) { mostrarAlerta("Erro ao processar as imagens."); }
  };
  const removerFoto = (i) => setNovaVenda(prev => ({ ...prev, fotos: prev.fotos.filter((_, idx) => idx !== i) }));
  const handleCheckboxPagamento = (metodo) => {
    setNovaVenda(prev => ({
      ...prev, metodos_pagamento: prev.metodos_pagamento.includes(metodo) 
        ? prev.metodos_pagamento.filter(m => m !== metodo) : [...prev.metodos_pagamento, metodo]
    }));
  };

  // --- SUBMETER VENDA (NOVO BACKEND = 2 PASSOS) ---
  const handleSubmeterVenda = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); 
    
    if (!utilizador) {
        mostrarAlerta("Erro: Sessão inválida.");
        setIsSubmitting(false); return;
    }

    try {
        // PASSO 1: REGISTAR A PEÇA (Agora incluindo o array de fotos Base64)
        const resPeca = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                nome: novaVenda.PECA_nome,
                descricao: novaVenda.descricao,
                tamanho: novaVenda.tamanho,
                estado: novaVenda.condicao,
                idCategoria: 1, 
                fotos: novaVenda.fotos // Envia o array de strings Base64 comprimidas[cite: 8]
            })
        });

        if (!resPeca.ok) {
            const erro = await resPeca.json();
            throw new Error(erro.mensagem || "Erro ao registar a peça.");
        }
        
        const dataPeca = await resPeca.json();

        // PASSO 2: COLOCAR À VENDA USANDO O ID DA PEÇA RECÉM-CRIADA
        const resVenda = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                idPeca: dataPeca.idPeca,
                preco: parseFloat(novaVenda.preco)
            })
        });

        if (resVenda.ok) {
            mostrarAlerta('Figurino colocado à venda com sucesso!');
            setNovaVenda({ PECA_nome: '', preco: '', condicao: 'Novo', tamanho: '', descricao: '', metodos_pagamento: ['MBWay'], fotos: [] });
            setIsModalOpen(false);
            carregarFigurinos();
        } else {
            const erro = await resVenda.json();
            throw new Error(erro.mensagem || "Erro ao colocar a peça à venda.");
        }
    } catch (error) {
        mostrarAlerta(error.message);
    } finally {
        setIsSubmitting(false); 
    }
};

  // --- APAGAR (BACKEND NÃO TEM ROTA DE DELETE) ---
  const handleApagar = async (id_venda, id_peca) => {
  if (!window.confirm("Tens a certeza que queres eliminar este produto?")) return;

  try {
    const response = await fetch(`${API_URL}/${id_peca}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    

    if (response.ok) {
      mostrarAlerta("Produto removido!");
      carregarFigurinos(); // Atualiza a lista
    } else {
      mostrarAlerta("Erro ao apagar o produto.");
    }
  } catch (error) {
    mostrarAlerta("Erro de ligação ao servidor.");
  }
};

const confirmarEliminacao = (idVenda, idPeca) => {
  setCustomAlert({
    show: true,
    message: `Tens a certeza que queres apagar este produto?`,
    type: 'confirm',
    onConfirm: () => executarApagar(idPeca) // Chama a execução real se clicar em Confirmar
  });
};

const executarApagar = async (idPeca) => {
  fecharAlerta(); // Fecha o modal de confirmação
  
  if (!idPeca) {
    mostrarAlerta("Erro: ID da peça não encontrado.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/${idPeca}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${getToken()}` 
      }
    });

    const data = await response.json();

    if (response.ok) {
      mostrarAlerta("Produto removido com sucesso!");
      carregarFigurinos(); // Recarrega a lista
    } else {
      // Mostra o erro vindo do backend diretamente no teu alerta de ecrã
      mostrarAlerta(data.mensagem || "Erro ao apagar o produto.");
    }
  } catch (error) {
    mostrarAlerta("Erro de rede: Não foi possível contactar o servidor.");
  }
};

  // --- EDITAR (PUT /api/inventario/:id - Só edita Estado) ---
  const abrirEdicao = (figurino) => {
    setFigurinoEmEdicao({ ...figurino, estadoPeca: figurino.condicao_peca || 'Usado' });
    setIsEditModalOpen(true);
  };

  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    try {
        const response = await fetch(`${API_URL}/${figurinoEmEdicao.id_peca}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                estado: figurinoEmEdicao.estadoPeca, // 'Novo', 'Bom', 'Usado', 'Danificado'
                disponivelVenda: true
            })
        });

        if (response.ok) {
            mostrarAlerta('Estado da peça atualizado com sucesso!');
            setIsEditModalOpen(false);
            carregarFigurinos();
        } else {
          mostrarAlerta('Erro ao guardar as alterações no inventário.');
        }
    } catch (error) {
        mostrarAlerta("Erro de rede.");
    }
  };

  // --- COMPRAR VENDA (PUT /api/inventario/vendas/:id/concluir) ---
  const handleComprar = (figurino) => {
    setFigurinoSelecionado(figurino);
    setMetodoPagamentoCompra('MBWay');
    setIsCompraModalOpen(true);
  };

  const confirmarCompra = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); 

    if (!utilizador) {
        mostrarAlerta("Sessão inválida. Por favor, faz login novamente.");
        setIsSubmitting(false); return;
    }

    try {
        const response = await fetch(`${API_URL}/vendas/${figurinoSelecionado.id_venda}/concluir`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({
                idComprador: utilizador.id_utilizador || utilizador.id,
                metodoPagamento: metodoPagamentoCompra
            })
        });

        if (response.ok) {
            mostrarAlerta(`Compra de ${figurinoSelecionado.nome_peca} confirmada!`);
            setIsCompraModalOpen(false);
            carregarFigurinos(); 
        } else {
            const err = await response.json();
            // A rota backend exige que quem compra seja Admin, alertamos se for o caso
            mostrarAlerta(err.mensagem || 'Ocorreu um erro ou não tens permissões (Admin) para concluir a venda.');
        }
    } catch (error) {
        mostrarAlerta("Erro de rede.");
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
          // Obtém o índice atual para este figurino específico ou define 0 como padrão
          const idxImg = indicesImagens[fig.id_venda] || 0;
          const totalFotos = fig.fotos && fig.fotos.length > 0 ? fig.fotos.length : 0;
          
          // Garante que a foto existe antes de tentar renderizar
          const fotoExibida = totalFotos > 0 ? fig.fotos[idxImg] : null;

          return (
            <div className={`figurino-card ${fig.estado_venda === 'Concluída' ? 'vendido' : ''}`} key={fig.id_venda}>
              
              {/* --- ÁREA DA IMAGEM --- */}
              <div 
                className="figurino-img" 
                style={{ 
                  backgroundImage: fotoExibida ? `url(${fotoExibida})` : 'none',
                  backgroundColor: fotoExibida ? 'transparent' : '#dcd7ce' 
                }}
              >
                {/* Texto alternativo se não houver imagem */}
                {totalFotos === 0 && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b665e', fontWeight: '500', fontSize: '0.9rem' }}>
                    Sem Imagem
                  </div>
                )}

                <span className={`badge-estado ${fig.estado_venda === 'Concluída' ? 'bg-red' : 'bg-green'}`}>
                  {fig.estado_venda === 'Concluída' ? 'Vendido' : 'Disponível'}
                </span>

                {/* Navegação do Carrossel */}
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

                {/* Ações do Dono */}
                {(utilizador?.nome === fig.vendedor) && (
                  <div className="acoes-dono">
                    {fig.estado_venda !== 'Concluída' && (
                      <button className="btn-icon edit" title="Editar Estado" onClick={() => abrirEdicao(fig)}>✎</button>
                    )}
                    <button className="btn-icon delete" title="Apagar" onClick={() => confirmarEliminacao(fig.id_venda, fig.id_peca)}> 🗑️</button>
                  </div>
                )}
              </div>

              <div className="figurino-info">
                <h3>{fig.nome_peca}</h3>
                <div className="tags-container">
                  <span className="badge-condicao">{fig.condicao_peca}</span>
                  {fig.tamanho && <span className="badge-tamanho">Tam: {fig.tamanho}</span>}
                </div>
                
                {fig.descricao && <p className="descricao-peca">{fig.descricao}</p>}
                <p className="vendedor">Por: {fig.vendedor}</p>

                <div className="figurino-footer">
                  <span className="preco">{Number(fig.preco).toFixed(2)} €</span>
                  
                  {fig.estado_venda === 'Disponível' && utilizador?.nome !== fig.vendedor && (
                    <button className="btn-outline btn-sm" onClick={() => handleComprar(fig)} disabled={!utilizador}>
                      Comprar
                    </button>
                  )}
                  
                  {fig.estado_venda === 'Disponível' && utilizador?.nome === fig.vendedor && (
                    <span className="texto-teu-item">O teu item</span>
                  )}

                  {fig.estado_venda === 'Concluída' && (
                    <span className="texto-teu-item" style={{ color: '#b38b59', fontWeight: 'bold' }}>
                      Item Vendido
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* --- FOOTER ADICIONADO --- */}
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

      {/* --- MODAL 1: Nova Venda --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content form-venda">
            <h2>Vender Figurino</h2>
            <form onSubmit={handleSubmeterVenda}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input type="text" placeholder="Ex: Tutu Azul" value={novaVenda.PECA_nome} onChange={(e) => setNovaVenda({...novaVenda, PECA_nome: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço (€)</label>
                  <input type="number" placeholder="Ex: 15.45" step="0.01" value={novaVenda.preco} onChange={(e) => setNovaVenda({...novaVenda, preco: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input type="text" placeholder="Ex: S, 38, Único" value={novaVenda.tamanho} onChange={(e) => setNovaVenda({...novaVenda, tamanho: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select value={novaVenda.condicao} onChange={(e) => setNovaVenda({...novaVenda, condicao: e.target.value})} required>
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Usado">Usado</option>
                    <option value="Danificado">Danificado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição e Detalhes</label>
                <textarea rows="3" placeholder="Descreve o material, detalhes ou marcas de uso..." value={novaVenda.descricao} onChange={(e) => setNovaVenda({...novaVenda, descricao: e.target.value})} required></textarea>
              </div>
              <div className="form-group">
                <label>Métodos de Pagamento Opcional</label>
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

      {/* --- MODAL 2: Editar (Só altera estado da Peça) --- */}
      {isEditModalOpen && figurinoEmEdicao && (
        <div className="modal-overlay">
          <div className="modal-content form-venda">
            <h2>Editar Estado da Peça</h2>
            <p style={{marginBottom: '20px', color: '#666', fontSize:'0.9rem'}}>O backend atual apenas suporta a edição do Estado Físico da peça após publicação.</p>
            <form onSubmit={handleGuardarEdicao}>
              <div className="form-group">
                <label>Estado da Peça</label>
                <select value={figurinoEmEdicao.estadoPeca || ''} onChange={(e) => setFigurinoEmEdicao({...figurinoEmEdicao, estadoPeca: e.target.value})} required>
                  <option value="Novo">Novo</option>
                  <option value="Bom">Bom</option>
                  <option value="Usado">Usado</option>
                  <option value="Danificado">Danificado</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-dark">Guardar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Compra --- */}
      {isCompraModalOpen && figurinoSelecionado && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirmar Compra</h2>
            <div className="resumo-compra">
              <p><strong>Item:</strong> {figurinoSelecionado.nome_peca}</p>
              {figurinoSelecionado.tamanho && <p><strong>Tamanho:</strong> {figurinoSelecionado.tamanho}</p>}
              <p><strong>Total:</strong> {Number(figurinoSelecionado.preco).toFixed(2)} €</p>
            </div>
            <form onSubmit={confirmarCompra}>
              <div className="form-group">
                <label>Método de Pagamento</label>
                <select value={metodoPagamentoCompra} onChange={(e) => setMetodoPagamentoCompra(e.target.value)}>
                  <option value="MBWay">MBWay</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Numerário">Numerário</option>
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

      {/* ALERTA CUSTOMIZADO */}
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