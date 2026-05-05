import React, { useState, useEffect } from 'react';
import './EmprestimosPecas.css';
import logoImg from '../../assets/logo.png';

export default function EmprestimosPecas({ irParaLanding, irParaVendaFigurinos, irParaAgendarCoaching }) {
  const [utilizador, setUtilizador] = useState(null);
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // --- ESTADO PARA NAVEGAÇÃO DAS FOTOS ---
  const [indicesImagens, setIndicesImagens] = useState({});

  // --- ESTADOS PARA OS MODAIS ---
  const [mostrarModalAdicionar, setMostrarModalAdicionar] = useState(false);
  const [mostrarModalEdicao, setMostrarModalEdicao] = useState(false);
  const [pecaEmEdicaoId, setPecaEmEdicaoId] = useState(null);

  const [novaPeca, setNovaPeca] = useState({
    nome: '',
    tamanho: '',
    condicao: 'Novo',
    valor_dia: '',
    descricao: '',
    metodos_pagamento: ['MBWay'], 
    fotos: []
  });

  // --- ESTADOS PARA O MODAL DE SOLICITAR ---
  const [isSolicitarModalOpen, setIsSolicitarModalOpen] = useState(false);
  const [pecaSelecionada, setPecaSelecionada] = useState(null);
  const [metodoPagamentoSolicitacao, setMetodoPagamentoSolicitacao] = useState('MBWay');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- ESTADO PARA O ALERTA CUSTOMIZADO ---
  const [customAlert, setCustomAlert] = useState({ show: false, message: '', type: 'alert', onConfirm: null });

  // Pede os dados ao Backend
  const carregarEmprestimos = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/emprestimos'); 
      if (response.ok) {
        const dados = await response.json();
        
        const pecasTratadas = dados.map(peca => {
            let fotosArray = [];
            if (peca.fotos && Array.isArray(peca.fotos)) {
                fotosArray = peca.fotos;
            } else if (peca.foto_url) {
                fotosArray = [peca.foto_url]; 
            }

            return {
                ...peca,
                fotos: fotosArray
            };
        });

        setPecas(pecasTratadas);
      }
    } catch (error) {
      console.error("Erro de ligação à BD:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    document.title = "Empréstimos de Peças | Viva D'arte";
    const userGuardado = localStorage.getItem('viva_user');
    if (userGuardado) {
      setUtilizador(JSON.parse(userGuardado));
    }
    carregarEmprestimos();
  }, []);

  // --- NAVEGAÇÃO DE IMAGENS ---
  const proximaImagem = (e, id_peca, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens(prev => ({
      ...prev, [id_peca]: ((prev[id_peca] || 0) + 1) % totalFotos
    }));
  };

  const imagemAnterior = (e, id_peca, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens(prev => ({
      ...prev, [id_peca]: ((prev[id_peca] || 0) - 1 + totalFotos) % totalFotos
    }));
  };

  // --- FUNÇÕES DE ALERTA ---
  const mostrarAlerta = (msg) => {
    setCustomAlert({ show: true, message: msg, type: 'alert', onConfirm: null });
  };

  const fecharAlerta = () => {
    setCustomAlert({ show: false, message: '', type: 'alert', onConfirm: null });
    if (customAlert.message.includes("sucesso")) {
      carregarEmprestimos();
    }
  };

  // --- GESTÃO DE INPUTS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNovaPeca(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (metodo) => {
    setNovaPeca(prev => {
      const novosMetodos = prev.metodos_pagamento.includes(metodo)
        ? prev.metodos_pagamento.filter(m => m !== metodo)
        : [...prev.metodos_pagamento, metodo];
      return { ...prev, metodos_pagamento: novosMetodos };
    });
  };

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
        const Fotos = await Promise.all(files.map(file => comprimirImagem(file)));
        setNovaPeca(prev => ({ ...prev, fotos: [...prev.fotos, ...Fotos] }));
    } catch (error) {
        console.error("Erro ao converter fotos:", error);
        mostrarAlerta("Erro ao processar as imagens.");
    }
  };

  const removerFoto = (indexParaRemover) => {
    setNovaPeca(prev => ({ ...prev, fotos: prev.fotos.filter((_, index) => index !== indexParaRemover) }));
  };

  // --- FUNÇÕES DE ADICIONAR ---
  const abrirModalParaAdicionar = () => {
    setNovaPeca({ nome: '', tamanho: '', condicao: 'Novo', valor_dia: '', descricao: '', metodos_pagamento: ['MBWay'], fotos: [] });
    setMostrarModalAdicionar(true);
  };

  const handleSubmeterNovo = async (e) => {
    e.preventDefault();
    if (!utilizador || !utilizador.id_utilizador) return mostrarAlerta("Erro: Utilizador não identificado.");

    if (novaPeca.fotos.length === 0) {
      return mostrarAlerta("Por favor, adiciona pelo menos uma foto da peça.");
    }

    const dadosParaEnviar = {
      ...novaPeca,
      userId: utilizador.id_utilizador
    };

    try {
      const response = await fetch('http://localhost:3000/api/emprestimos/adicionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosParaEnviar)
      });

      if (response.ok) {
        setMostrarModalAdicionar(false);
        mostrarAlerta('Peça disponibilizada para empréstimo com sucesso!'); 
      } else {
        const erroDados = await response.json();
        mostrarAlerta("Erro ao publicar a peça: " + (erroDados.details || "Erro interno"));
      }
    } catch (error) {
      mostrarAlerta("Não foi possível conectar ao servidor.");
    }
  };

  // --- FUNÇÕES DE EDITAR ---
  const handleEditarPeca = (peca) => {
    setPecaEmEdicaoId(peca.id_peca);
    setNovaPeca({
      nome: peca.nome || '',
      tamanho: peca.tamanho || '',
      condicao: peca.condicao === 'Emprestado' ? 'Emprestado' : 'Disponível',
      valor_dia: peca.valor_dia ? peca.valor_dia.toString() : '',
      descricao: peca.descricao || '',
      metodos_pagamento: peca.metodos_pagamento || ['MBWay'],
      fotos: peca.fotos || []
    });
    setMostrarModalEdicao(true);
  };

  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:3000/api/emprestimos/${pecaEmEdicaoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaPeca)
      });

      if (response.ok) {
        setMostrarModalEdicao(false);
        mostrarAlerta('Peça atualizada com sucesso!');
      } else {
        mostrarAlerta("Erro ao editar a peça.");
      }
    } catch (error) {
      mostrarAlerta("Erro na ligação ao servidor.");
    }
  };

  // --- FUNÇÃO DE REMOVER ---
  const handleRemoverPeca = (id_peca) => {
    setCustomAlert({
      show: true,
      message: 'Tens a certeza que pretendes apagar esta peça? Esta ação é irreversível.',
      type: 'confirm',
      onConfirm: async () => {
        try {
          const response = await fetch(`http://localhost:3000/api/emprestimos/${id_peca}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            setCustomAlert({ show: true, message: 'Peça removida com sucesso!', type: 'alert', onConfirm: null });
          } else {
            setCustomAlert({ show: true, message: 'Erro ao remover a peça.', type: 'alert', onConfirm: null });
          }
        } catch (error) {
          setCustomAlert({ show: true, message: 'Erro na ligação ao servidor.', type: 'alert', onConfirm: null });
        }
      }
    });
  };

  // --- FUNÇÕES DO MODAL DE SOLICITAR ---
  const handleAbrirSolicitar = (peca) => {
    setPecaSelecionada(peca);
    let metodos = Array.isArray(peca.metodos_pagamento) ? peca.metodos_pagamento : [peca.metodos_pagamento];
    setMetodoPagamentoSolicitacao(metodos.length > 0 ? metodos[0] : 'MBWay');
    setIsSolicitarModalOpen(true);
  };

  const confirmarSolicitacao = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const idSolicitante = utilizador?.id_utilizador || utilizador?.id;

    if (!idSolicitante) {
        mostrarAlerta("Erro: Sessão inválida. Por favor, faz login novamente para solicitar.");
        setIsSubmitting(false);
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/emprestimos/${pecaSelecionada.id_peca}/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_solicitante: idSolicitante, metodo_pagamento: metodoPagamentoSolicitacao })
        });

        if (response.ok) {
            mostrarAlerta(`Solicitação de ${pecaSelecionada.nome} enviada com sucesso!`);
            setIsSolicitarModalOpen(false);
            // Atualizar o estado local imediatamente para refletir a peça como emprestada (visual escuro)
            setPecas(prev => prev.map(p => p.id_peca === pecaSelecionada.id_peca ? { ...p, condicao: 'Emprestado' } : p));
            carregarEmprestimos(); 
        } else {
            mostrarAlerta(`A tua solicitação para ${pecaSelecionada.nome} foi registada! (Simulado)`);
            setIsSolicitarModalOpen(false);
            // Simulação de alteração local também no fallback
            setPecas(prev => prev.map(p => p.id_peca === pecaSelecionada.id_peca ? { ...p, condicao: 'Emprestado' } : p));
        }
    } catch (error) {
        mostrarAlerta('Erro de ligação ao servidor.');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('viva_user');
    localStorage.removeItem('viva_token');
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
              <li>
                <a
                  href="#"
                  className="special-link"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaAgendarCoaching?.();
                  }}
                >
                  Agendar Coaching
                </a>
              </li>
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
          {utilizador && (
            <button className="btn-add-peca" onClick={abrirModalParaAdicionar}>
              + Disponibilizar Peça
            </button>
          )}
        </div>

        <div className="pecas-grid">
          {carregando ? (
            <div className="empty-state-container">A carregar peças...</div>
          ) : pecas.length === 0 ? (
            <div className="empty-state-container">
              <p>Ainda não existem peças disponíveis para empréstimo de momento.</p>
            </div>
          ) : (
            pecas.map((peca) => {
              const idxImg = indicesImagens[peca.id_peca] || 0;
              const totalFotos = peca.fotos && peca.fotos.length > 0 ? peca.fotos.length : 0;
              const estaEmprestado = peca.condicao === 'Emprestado' || peca.estado === 'Emprestado';

              return (
                // Se a peça estiver emprestada, ganha a classe CSS 'emprestado' para ficar escurecida
                <div key={peca.id_peca || peca.id} className={`peca-card ${estaEmprestado ? 'emprestado' : ''}`}>
                  
                  {/* --- ÁREA DA IMAGEM --- */}
                  <div className="peca-image-container" style={totalFotos > 0 ? { backgroundImage: `url(${peca.fotos[idxImg]})` } : { backgroundColor: '#dcd7ce' }}>
                    
                    {totalFotos === 0 && (
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b665e', fontWeight: '500', fontSize: '0.9rem' }}>
                        Sem Imagem
                      </div>
                    )}

                    {/* BADGE DINÂMICA: "DISPONÍVEL" ou "EMPRESTADO" */}
                    <span className={`status-badge ${estaEmprestado ? 'emprestado' : 'disponivel'}`}>
                      {estaEmprestado ? 'EMPRESTADO' : 'DISPONÍVEL'}
                    </span>

                    {totalFotos > 1 && (
                      <>
                        <button className="img-nav-btn left" onClick={(e) => imagemAnterior(e, peca.id_peca, totalFotos)}>‹</button>
                        <button className="img-nav-btn right" onClick={(e) => proximaImagem(e, peca.id_peca, totalFotos)}>›</button>
                        <div className="img-dots">
                          {peca.fotos.map((_, i) => (
                            <span key={i} className={`dot ${i === idxImg ? 'active' : ''}`}></span>
                          ))}
                        </div>
                      </>
                    )}

                    {utilizador && (utilizador.id_utilizador === peca.userId || utilizador.id_utilizador === peca.dono_id) && (
                      <div className="owner-actions">
                        <button className="action-btn edit-btn" title="Editar" onClick={(e) => { e.stopPropagation(); handleEditarPeca(peca); }}>✎</button>
                        <button className="action-btn delete-btn" title="Apagar" onClick={(e) => { e.stopPropagation(); handleRemoverPeca(peca.id_peca); }}>🗑️</button>
                      </div>
                    )}
                  </div>

                  {/* --- CONTEÚDO DO CARTÃO --- */}
                  <div className="peca-content">
                    <h3 className="peca-nome">{peca.nome}</h3>
                    
                    <div className="peca-tags">
                      <span>{peca.condicao !== 'Emprestado' ? (peca.condicao || peca.estado || 'Usado') : 'Usado'}</span>
                      <span>Tam: {peca.tamanho || 'N/A'}</span>
                    </div>

                    <p className="peca-descricao">{peca.descricao}</p>
                    <p className="peca-owner">Por: <strong>{peca.nome_dono || 'Comunidade'}</strong></p>

                    <div className="peca-pagamentos">
                      {peca.metodos_pagamento ? (
                        Array.isArray(peca.metodos_pagamento) 
                          ? peca.metodos_pagamento.map(m => <span key={m} className="tag-pagamento">{m}</span>)
                          : <span className="tag-pagamento">{peca.metodos_pagamento}</span>
                      ) : (
                        <span className="tag-pagamento">MBWay</span> 
                      )}
                    </div>

                    <div className="peca-footer">
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span className="preco">{Number(peca.valor_dia || 0).toFixed(2)} €</span>
                        <span className="texto-dia">/dia</span>
                      </div>
                      
                      {utilizador && (utilizador.id_utilizador === peca.userId || utilizador.id_utilizador === peca.dono_id) ? (
                        <span className="texto-teu-item">O teu item</span>
                      ) : estaEmprestado ? (
                        <span className="texto-teu-item" style={{ color: '#b38b59', fontWeight: 'bold' }}>Indisponível</span>
                      ) : (
                        <button className="btn-outline btn-sm" onClick={() => handleAbrirSolicitar(peca)} disabled={!utilizador}>
                          Solicitar
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- MODAL DE ADICIONAR --- */}
      {mostrarModalAdicionar && (
        <div className="modal-overlay">
          <div className="modal-content form-venda">
            <h2>Disponibilizar para Empréstimo</h2>
            
            <form onSubmit={handleSubmeterNovo}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input type="text" name="nome" placeholder="Ex: Sapatilhas de Ponta" value={novaPeca.nome} onChange={handleInputChange} required />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Preço por Dia (€)</label>
                  <input type="number" step="0.01" name="valor_dia" placeholder="Ex: 5.00" value={novaPeca.valor_dia} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input type="text" name="tamanho" placeholder="Ex: S, 38, Úni" value={novaPeca.tamanho} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select name="condicao" value={novaPeca.condicao} onChange={handleInputChange} required>
                    <option value="Novo">Novo</option>
                    <option value="Usado - Como Novo">Usado - Como Novo</option>
                    <option value="Usado - Bom estado">Usado - Bom estado</option>
                    <option value="Usado - Marcas de uso">Usado - Marcas de uso</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Descrição e Detalhes</label>
                <textarea name="descricao" placeholder="Descreve o material, detalhes ou marcas de uso..." value={novaPeca.descricao} onChange={handleInputChange} required></textarea>
              </div>

              <div className="form-group">
                <label>Métodos de Pagamento</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={novaPeca.metodos_pagamento.includes('MBWay')} onChange={() => handleCheckboxChange('MBWay')} /> MBWay
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={novaPeca.metodos_pagamento.includes('Transferência')} onChange={() => handleCheckboxChange('Transferência')} /> Transferência
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={novaPeca.metodos_pagamento.includes('Numerário')} onChange={() => handleCheckboxChange('Numerário')} /> Numerário
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Fotos (Máx 4)</label>
                <div className="fotos-preview-container">
                  {novaPeca.fotos.map((fotoUrl, index) => (
                    <div className="foto-preview-box" key={index}>
                      <img src={fotoUrl} alt="Preview" />
                      <button type="button" className="btn-remover-foto" onClick={() => removerFoto(index)}>X</button>
                    </div>
                  ))}
                </div>
                {novaPeca.fotos.length < 4 && (
                  <label className="btn-upload-foto">
                    <span>+ Adicionar Foto</span>
                    <input type="file" accept="image/*" multiple onChange={handleFotosUpload} style={{ display: 'none' }} />
                  </label>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setMostrarModalAdicionar(false)}>Cancelar</button>
                <button type="submit" className="btn-dark">Publicar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE EDITAR --- */}
      {mostrarModalEdicao && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '25px', color: '#2a2724' }}>Editar Figurino</h2>
            
            <form onSubmit={handleGuardarEdicao}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input 
                  type="text" 
                  name="nome" 
                  value={novaPeca.nome} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '22px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Preço (€)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    name="valor_dia" 
                    value={novaPeca.valor_dia} 
                    onChange={handleInputChange} 
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Tamanho</label>
                  <input 
                    type="text" 
                    name="tamanho" 
                    value={novaPeca.tamanho} 
                    onChange={handleInputChange} 
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Estado</label>
                  <select name="condicao" value={novaPeca.condicao} onChange={handleInputChange} required>
                    <option value="Disponível">Disponível</option>
                    <option value="Emprestado">Emprestado</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '30px' }}>
                <label>Descrição</label>
                <textarea 
                  name="descricao" 
                  value={novaPeca.descricao} 
                  onChange={handleInputChange} 
                  rows="4"
                  style={{ minHeight: '100px' }}
                  required
                ></textarea>
              </div>

              <div className="modal-actions" style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '20px', marginTop: '10px' }}>
                <button type="button" className="btn-text" style={{ fontWeight: '600' }} onClick={() => setMostrarModalEdicao(false)}>Cancelar</button>
                <button type="submit" className="btn-dark" style={{ backgroundColor: '#2a2724' }}>Guardar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL SOLICITAR --- */}
      {isSolicitarModalOpen && pecaSelecionada && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirmar Solicitação</h2>
            <div className="resumo-compra">
              <p><strong>Item:</strong> {pecaSelecionada.nome}</p>
              {pecaSelecionada.tamanho && <p><strong>Tamanho:</strong> {pecaSelecionada.tamanho}</p>}
              <p><strong>Preço:</strong> {Number(pecaSelecionada.valor_dia || 0).toFixed(2)} € /dia</p>
            </div>
            <form onSubmit={confirmarSolicitacao}>
              <div className="form-group">
                <label>Método de Pagamento</label>
                <select value={metodoPagamentoSolicitacao} onChange={(e) => setMetodoPagamentoSolicitacao(e.target.value)}>
                  {(Array.isArray(pecaSelecionada.metodos_pagamento) 
                      ? pecaSelecionada.metodos_pagamento 
                      : [pecaSelecionada.metodos_pagamento]
                  ).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={() => setIsSolicitarModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-dark" disabled={isSubmitting}>{isSubmitting ? 'A Processar...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
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