import React, { useState, useEffect } from "react";
import "./VendaFigurinos.css";
import logoImg from "../../assets/logo.png";
import { API_URL, getAuthToken } from "../../services/api";

export default function VendaFigurinos({
  irParaLanding,
  irParaEmprestimos,
  irParaVendaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  const [utilizador, setUtilizador] = useState(null);
  const [figurinos, setFigurinos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [pesquisa, setPesquisa] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [ordenacao, setOrdenacao] = useState("recentes");

  const [indicesImagens, setIndicesImagens] = useState({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [figurinoDetalhe, setFigurinoDetalhe] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: "",
    type: "alert",
    onConfirm: null,
  });
  const [figurinoSelecionado, setFigurinoSelecionado] = useState(null);

  const [novaVenda, setNovaVenda] = useState({
    PECA_nome: "",
    preco: "",
    condicao: "Novo",
    tamanho: "",
    descricao: "",
    metodos_pagamento: ["MBWay"],
    fotos: [],
  });

  const [figurinoEmEdicao, setFigurinoEmEdicao] = useState(null);
  const [metodoPagamentoCompra, setMetodoPagamentoCompra] = useState("MBWay");

  const inventarioBase = `${API_URL}/api/inventario`;

  const mostrarAlerta = (msg) =>
    setCustomAlert({
      show: true,
      message: msg,
      type: "alert",
      onConfirm: null,
    });
  const fecharAlerta = () =>
    setCustomAlert({
      show: false,
      message: "",
      type: "alert",
      onConfirm: null,
    });

  const getToken = () => getAuthToken() || "";

  const carregarFigurinos = async (mostrarLoading = false) => {
    if (mostrarLoading) setIsLoading(true);
    try {
      const response = await fetch(`${inventarioBase}/vendas`, {
        method: "GET",
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setFigurinos(data);
      }
    } catch (error) {
      console.error("Erro a carregar figurinos:", error);
    } finally {
      if (mostrarLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Venda de Figurinos | Viva D'arte";
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) setUtilizador(JSON.parse(userGuardado));

    carregarFigurinos(true);
    const interval = setInterval(() => carregarFigurinos(false), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      if (isLightboxOpen && figurinoDetalhe) {
        const totalFotos = figurinoDetalhe.fotos?.length || 0;
        if (totalFotos > 1) {
          if (e.key === "ArrowRight") {
            setIndicesImagens((prev) => ({
              ...prev,
              [figurinoDetalhe.id_venda]:
                ((prev[figurinoDetalhe.id_venda] || 0) + 1) % totalFotos,
            }));
          } else if (e.key === "ArrowLeft") {
            setIndicesImagens((prev) => ({
              ...prev,
              [figurinoDetalhe.id_venda]:
                ((prev[figurinoDetalhe.id_venda] || 0) - 1 + totalFotos) %
                totalFotos,
            }));
          }
        }
        if (e.key === "Escape") setIsLightboxOpen(false);
      } else if (
        figurinoDetalhe &&
        !isLightboxOpen &&
        !isCompraModalOpen &&
        !isEditModalOpen &&
        !isModalOpen
      ) {
        if (e.key === "Escape") {
          setFigurinoDetalhe(null);
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          if (figurinosFiltrados.length <= 1) return;
          const currentIndex = figurinosFiltrados.findIndex(
            (f) => f.id_venda === figurinoDetalhe.id_venda,
          );
          if (currentIndex === -1) return;

          let nextIndex =
            e.key === "ArrowRight" ? currentIndex + 1 : currentIndex - 1;
          if (nextIndex < 0) nextIndex = figurinosFiltrados.length - 1;
          if (nextIndex >= figurinosFiltrados.length) nextIndex = 0;

          setFigurinoDetalhe(figurinosFiltrados[nextIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    figurinoDetalhe,
    isLightboxOpen,
    isCompraModalOpen,
    isEditModalOpen,
    isModalOpen,
  ]);

  const handleLogout = () => {
    localStorage.clear();
    setUtilizador(null);
    if (irParaLanding) irParaLanding();
    window.location.reload();
  };

  const proximaImagem = (e, id_venda, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [id_venda]: ((prev[id_venda] || 0) + 1) % totalFotos,
    }));
  };
  const imagemAnterior = (e, id_venda, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [id_venda]: ((prev[id_venda] || 0) - 1 + totalFotos) % totalFotos,
    }));
  };

  const handleFotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const comprimirImagem = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width,
              height = img.height;
            if (width > height) {
              if (width > 800) {
                height *= 800 / width;
                width = 800;
              }
            } else {
              if (height > 800) {
                width *= 800 / height;
                height = 800;
              }
            }
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
        };
      });
    };

    try {
      const NovasFotos = await Promise.all(
        files.map((file) => comprimirImagem(file)),
      );
      setNovaVenda((prev) => ({
        ...prev,
        fotos: [...prev.fotos, ...NovasFotos],
      }));
    } catch (error) {
      mostrarAlerta("Erro ao processar as imagens.");
    }
  };

  const removerFoto = (i) =>
    setNovaVenda((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((_, idx) => idx !== i),
    }));

  const handleCheckboxPagamento = (metodo) => {
    setNovaVenda((prev) => ({
      ...prev,
      metodos_pagamento: prev.metodos_pagamento.includes(metodo)
        ? prev.metodos_pagamento.filter((m) => m !== metodo)
        : [...prev.metodos_pagamento, metodo],
    }));
  };

  const handleSubmeterVenda = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!utilizador) {
      mostrarAlerta("Erro: Sessão inválida.");
      setIsSubmitting(false);
      return;
    }

    if (novaVenda.metodos_pagamento.length === 0) {
      mostrarAlerta("Tens de selecionar pelo menos um método de pagamento.");
      setIsSubmitting(false);
      return;
    }

    try {
      const resPeca = await fetch(inventarioBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          nome: novaVenda.PECA_nome,
          descricao: novaVenda.descricao,
          tamanho: novaVenda.tamanho,
          estado: novaVenda.condicao,
          idCategoria: 1,
          fotos: novaVenda.fotos || [],
        }),
      });

      if (!resPeca.ok) {
        const erro = await resPeca.json();
        throw new Error(erro.mensagem || "Erro ao registar a peça.");
      }

      const dataPeca = await resPeca.json();

      const resVenda = await fetch(`${inventarioBase}/vendas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          idPeca: dataPeca.idPeca,
          preco: parseFloat(novaVenda.preco),
          nomePeca: novaVenda.PECA_nome,
          condicaoPeca: novaVenda.condicao,
          metodosPagamento: novaVenda.metodos_pagamento,
        }),
      });

      if (resVenda.ok) {
        mostrarAlerta("Figurino colocado à venda com sucesso!");
        setNovaVenda({
          PECA_nome: "",
          preco: "",
          condicao: "Novo",
          tamanho: "",
          descricao: "",
          metodos_pagamento: ["MBWay"],
          fotos: [],
        });
        setIsModalOpen(false);
        carregarFigurinos(false);
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

  const confirmarEliminacao = (e, idVenda, idPeca) => {
    e.stopPropagation();
    setCustomAlert({
      show: true,
      message: `Tens a certeza que queres apagar este produto?`,
      type: "confirm",
      onConfirm: () => executarApagar(idPeca),
    });
  };

  const executarApagar = async (idPeca) => {
    fecharAlerta();
    if (!idPeca) return mostrarAlerta("Erro: ID da peça não encontrado.");

    try {
      const response = await fetch(`${inventarioBase}/${idPeca}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (response.ok) {
        mostrarAlerta("Produto removido com sucesso!");
        if (figurinoDetalhe?.id_peca === idPeca) setFigurinoDetalhe(null);
        carregarFigurinos(false);
      } else {
        const data = await response.json();
        mostrarAlerta(data.mensagem || "Erro ao apagar o produto.");
      }
    } catch (error) {
      mostrarAlerta("Erro de rede: Não foi possível contactar o servidor.");
    }
  };

  const abrirEdicao = (e, figurino) => {
    e.stopPropagation();
    setFigurinoEmEdicao({
      ...figurino,
      PECA_nome: figurino.nome_peca,
      preco: figurino.preco,
      tamanho: figurino.tamanho || "",
      estadoPeca: figurino.condicao_peca || "Usado",
      descricao: figurino.descricao || "",
      metodos_pagamento: figurino.metodos_aceites
        ? figurino.metodos_aceites.split(",")
        : ["MBWay", "Transferência", "Numerário"],
    });
    setIsEditModalOpen(true);
  };

  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    if (figurinoEmEdicao.metodos_pagamento.length === 0) {
      mostrarAlerta("Tens de selecionar pelo menos um método de pagamento.");
      return;
    }

    try {
      const response = await fetch(
        `${inventarioBase}/${figurinoEmEdicao.id_peca}/editar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            nome: figurinoEmEdicao.PECA_nome,
            preco: parseFloat(figurinoEmEdicao.preco),
            tamanho: figurinoEmEdicao.tamanho,
            estado: figurinoEmEdicao.estadoPeca,
            descricao: figurinoEmEdicao.descricao,
            metodosPagamento: figurinoEmEdicao.metodos_pagamento,
          }),
        },
      );

      if (response.ok) {
        mostrarAlerta("Figurino atualizado com sucesso!");
        setIsEditModalOpen(false);
        if (
          figurinoDetalhe &&
          figurinoDetalhe.id_venda === figurinoEmEdicao.id_venda
        ) {
          setFigurinoDetalhe(null);
        }
        carregarFigurinos(false);
      } else {
        const data = await response.json();
        mostrarAlerta(data.mensagem || "Erro ao guardar as alterações.");
      }
    } catch (error) {
      mostrarAlerta("Erro de rede.");
    }
  };

  const handleComprar = (e, figurino) => {
    if (e) e.stopPropagation();
    setFigurinoSelecionado(figurino);
    const acceptedMethods = figurino.metodos_aceites
      ? figurino.metodos_aceites.split(",")
      : ["MBWay"];
    setMetodoPagamentoCompra(acceptedMethods[0]);
    setIsCompraModalOpen(true);
  };

  const confirmarCompra = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!utilizador) {
      mostrarAlerta("Sessão inválida. Por favor, faz login novamente.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(
        `${inventarioBase}/vendas/${figurinoSelecionado.id_venda}/concluir`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            idComprador: utilizador.id_utilizador || utilizador.id,
            metodoPagamento: metodoPagamentoCompra,
          }),
        },
      );

      if (response.ok) {
        mostrarAlerta(`Compra de ${figurinoSelecionado.nome_peca} confirmada!`);
        setIsCompraModalOpen(false);
        setFigurinoDetalhe(null);
        carregarFigurinos(false);
      } else {
        const err = await response.json();
        mostrarAlerta(err.mensagem || "Ocorreu um erro.");
      }
    } catch (error) {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const figurinosFiltrados = figurinos
    .filter((fig) =>
      fig.nome_peca?.toLowerCase().includes(pesquisa.toLowerCase()),
    )
    .filter((fig) =>
      filtroEstado === "Todos" ? true : fig.condicao_peca === filtroEstado,
    )
    .sort((a, b) => {
      if (ordenacao === "preco_asc")
        return parseFloat(a.preco) - parseFloat(b.preco);
      if (ordenacao === "preco_desc")
        return parseFloat(b.preco) - parseFloat(a.preco);
      return b.id_venda - a.id_venda;
    });

  const stylesHUD = {
    badge: {
      padding: "6px 14px",
      borderRadius: "20px",
      fontSize: "0.8rem",
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    label: {
      fontSize: "0.75rem",
      color: "#8a8480",
      textTransform: "uppercase",
      letterSpacing: "1px",
      fontWeight: "700",
      margin: "0 0 4px 0",
      display: "block",
    },
  };

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div
          className="nav-brand"
          onClick={irParaLanding}
          style={{ cursor: "pointer" }}
        >
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>
        <ul className="nav-menu">
          <li>
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                irParaLanding?.();
              }}
            >
              Início
            </a>
          </li>
          <li className="nav-separator">|</li>
          <li>
            <a
              href="#agenda"
              onClick={(e) => {
                e.preventDefault();
                const user = JSON.parse(
                  localStorage.getItem("viva_user") || "{}",
                );
                if (user.tipo === "PROF" || user.role === "PROFESSOR")
                  irParaMinhaAgendaProfessor?.();
                else irParaMinhaAgendaEE?.();
              }}
            >
              Minha agenda
            </a>
          </li>
          <li>
            <a
              href="#emprestimos"
              onClick={(e) => {
                e.preventDefault();
                irParaEmprestimos?.();
              }}
            >
              Empréstimos de peças
            </a>
          </li>
          <li>
            <a
              href="#figurinos"
              className="special-link active"
              onClick={(e) => {
                e.preventDefault();
                irParaVendaFigurinos?.();
              }}
            >
              Venda de figurinos
            </a>
          </li>
        </ul>
        <div className="nav-actions">
          {utilizador && (
            <div className="user-profile">
              <span className="welcome-text">
                Olá, <strong>{utilizador?.nome || ""}</strong>
              </span>
              <button className="btn-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="vendas-container">
        <div className="vendas-header">
          <div>
            <h1>Mercado de Figurinos</h1>
            <p>
              Compra e vende figurinos usados dentro da comunidade Viva D'arte.
            </p>
          </div>
          {utilizador && (
            <button
              className="btn-dark btn-publicar"
              onClick={(e) => {
                e.preventDefault();
                setIsModalOpen(true);
              }}
            >
              + Colocar à Venda
            </button>
          )}
        </div>

        {/* --- BARRA DE FILTROS --- */}
        {!isLoading && figurinos.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "15px",
              marginBottom: "25px",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Pesquisar por nome..."
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              style={{
                flex: 1,
                minWidth: "220px",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.12)",
                fontSize: "0.95rem",
              }}
            />
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.12)",
                fontSize: "0.95rem",
                cursor: "pointer",
                backgroundColor: "#fff",
              }}
            >
              <option value="Todos">Todos os Estados</option>
              <option value="Novo">Novo</option>
              <option value="Bom">Bom</option>
              <option value="Usado">Usado</option>
              <option value="Danificado">Danificado</option>
            </select>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value)}
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(0,0,0,0.12)",
                fontSize: "0.95rem",
                cursor: "pointer",
                backgroundColor: "#fff",
              }}
            >
              <option value="recentes">Mais Recentes</option>
              <option value="preco_asc">Preço: Mais Barato</option>
              <option value="preco_desc">Preço: Mais Caro</option>
            </select>
          </div>
        )}

        {isLoading ? (
          <div className="empty-state">A carregar figurinos...</div>
        ) : figurinos.length === 0 ? (
          <div className="empty-state">
            Ainda não existem figurinos disponíveis para venda de momento.
          </div>
        ) : figurinosFiltrados.length === 0 ? (
          <div className="empty-state">
            Nenhum figurino encontrado com esses filtros. Tenta outra pesquisa!
          </div>
        ) : (
          <div className="figurinos-grid">
            {figurinosFiltrados.map((fig) => {
              const idxImg = indicesImagens[fig.id_venda] || 0;
              const totalFotos =
                fig.fotos && fig.fotos.length > 0 ? fig.fotos.length : 0;
              const fotoExibida =
                totalFotos > 0 && fig.fotos[idxImg] ? fig.fotos[idxImg] : null;

              return (
                <div
                  className={`figurino-card ${fig.estado_venda === "Concluída" || fig.estado_venda === "Concluida" ? "vendido" : ""}`}
                  key={fig.id_venda}
                  onClick={() => setFigurinoDetalhe(fig)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="figurino-img"
                    style={{
                      backgroundImage: fotoExibida
                        ? `url(${fotoExibida})`
                        : "none",
                      backgroundColor: fotoExibida ? "transparent" : "#dcd7ce",
                    }}
                  >
                    {!fotoExibida && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#6b665e",
                          fontWeight: "500",
                          fontSize: "0.9rem",
                        }}
                      >
                        Sem Imagem
                      </div>
                    )}

                    <span
                      className={`badge-estado ${fig.estado_venda === "Concluída" || fig.estado_venda === "Concluida" ? "bg-red" : "bg-green"}`}
                    >
                      {fig.estado_venda === "Concluída" ||
                      fig.estado_venda === "Concluida"
                        ? "Vendido"
                        : "Disponível"}
                    </span>

                    {totalFotos > 1 && (
                      <>
                        <button
                          className="img-nav-btn left"
                          onClick={(e) =>
                            imagemAnterior(e, fig.id_venda, totalFotos)
                          }
                        >
                          ‹
                        </button>
                        <button
                          className="img-nav-btn right"
                          onClick={(e) =>
                            proximaImagem(e, fig.id_venda, totalFotos)
                          }
                        >
                          ›
                        </button>
                        <div className="img-dots">
                          {fig.fotos.map((_, i) => (
                            <span
                              key={i}
                              className={`dot ${i === idxImg ? "active" : ""}`}
                            ></span>
                          ))}
                        </div>
                      </>
                    )}

                    {utilizador?.nome === fig.vendedor && (
                      <div className="acoes-dono">
                        {fig.estado_venda !== "Concluída" &&
                          fig.estado_venda !== "Concluida" && (
                            <button
                              className="btn-icon edit"
                              title="Editar Informações"
                              onClick={(e) => abrirEdicao(e, fig)}
                            >
                              ✎
                            </button>
                          )}
                        <button
                          className="btn-icon delete"
                          title="Apagar"
                          onClick={(e) =>
                            confirmarEliminacao(e, fig.id_venda, fig.id_peca)
                          }
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="figurino-info">
                    <h3>{fig.nome_peca}</h3>
                    <div className="tags-container">
                      <span className="badge-condicao">
                        {fig.condicao_peca}
                      </span>
                      {fig.tamanho && (
                        <span className="badge-tamanho">
                          Tam: {fig.tamanho}
                        </span>
                      )}
                    </div>
                    {fig.descricao && (
                      <p className="descricao-peca">{fig.descricao}</p>
                    )}
                    <p className="vendedor">Por: {fig.vendedor}</p>

                    <div className="metodos-pagamento-tags">
                      {fig.metodos_aceites &&
                        fig.metodos_aceites.split(",").map((m) => (
                          <span key={m} className="tag-pagamento">
                            {m}
                          </span>
                        ))}
                    </div>

                    <div className="figurino-footer">
                      <span className="preco">
                        {Number(fig.preco).toFixed(2)} €
                      </span>

                      {(fig.estado_venda === "Disponível" ||
                        fig.estado_venda === "Disponivel") &&
                        utilizador?.nome !== fig.vendedor && (
                          <button
                            className="btn-outline btn-sm"
                            onClick={(e) => handleComprar(e, fig)}
                            disabled={!utilizador}
                          >
                            Comprar
                          </button>
                        )}

                      {(fig.estado_venda === "Disponível" ||
                        fig.estado_venda === "Disponivel") &&
                        utilizador?.nome === fig.vendedor && (
                          <span className="texto-teu-item">O teu item</span>
                        )}

                      {(fig.estado_venda === "Concluída" ||
                        fig.estado_venda === "Concluida") && (
                        <div
                          style={{
                            textAlign: "right",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                          }}
                        >
                          <span
                            className="texto-teu-item"
                            style={{ color: "#b38b59", fontWeight: "bold" }}
                          >
                            Vendido
                          </span>
                          {fig.comprador && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "#666",
                                marginTop: "2px",
                              }}
                            >
                              a {fig.comprador}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- HUD DE DETALHES  --- */}
      {figurinoDetalhe &&
        (() => {
          const idxImg = indicesImagens[figurinoDetalhe.id_venda] || 0;
          const totalFotos = figurinoDetalhe.fotos?.length || 0;
          const eMeu = utilizador?.nome === figurinoDetalhe.vendedor;
          const estaVendido =
            figurinoDetalhe.estado_venda === "Concluída" ||
            figurinoDetalhe.estado_venda === "Concluida";
          const metodos = figurinoDetalhe.metodos_aceites
            ? figurinoDetalhe.metodos_aceites.split(",")
            : [];

          const navigatePiece = (direction, e) => {
            e.stopPropagation();
            const currentIndex = figurinosFiltrados.findIndex(
              (p) => p.id_venda === figurinoDetalhe.id_venda,
            );
            if (currentIndex === -1) return;
            let nextIndex = currentIndex + direction;
            if (nextIndex < 0) nextIndex = figurinosFiltrados.length - 1;
            if (nextIndex >= figurinosFiltrados.length) nextIndex = 0;
            setFigurinoDetalhe(figurinosFiltrados[nextIndex]);
          };

          return (
            <div
              className="modal-overlay"
              onClick={() => setFigurinoDetalhe(null)}
              style={{ zIndex: 2005, background: "rgba(21, 19, 17, 0.92)" }}
            >
              {figurinosFiltrados.length > 1 && (
                <button
                  onClick={(e) => navigatePiece(-1, e)}
                  style={{
                    position: "absolute",
                    left: "20px",
                    background: "rgba(238, 234, 226, 0.9)",
                    color: "#2a2724",
                    border: "none",
                    borderRadius: "50%",
                    width: "45px",
                    height: "45px",
                    fontSize: "1.8rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 2006,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  ‹
                </button>
              )}

              {figurinosFiltrados.length > 1 && (
                <button
                  onClick={(e) => navigatePiece(1, e)}
                  style={{
                    position: "absolute",
                    right: "20px",
                    background: "rgba(238, 234, 226, 0.9)",
                    color: "#2a2724",
                    border: "none",
                    borderRadius: "50%",
                    width: "45px",
                    height: "45px",
                    fontSize: "1.8rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 2006,
                    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  ›
                </button>
              )}

              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "900px",
                  width: "90%",
                  maxHeight: "85vh",
                  padding: "0",
                  display: "flex",
                  flexDirection: "row",
                  overflow: "hidden",
                  backgroundColor: "#eeeae2",
                  border: "1px solid rgba(0,0,0,0.1)",
                  minHeight: "500px",
                }}
              >
                {/* Esquerda: Imagem Principal com Miniaturas */}
                <div
                  style={{
                    flex: 1.1,
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#dcd7ce",
                    borderRight: "1px solid rgba(0,0,0,0.05)",
                    minHeight: 0,
                  }}
                >
                  {/* Imagem Maior */}
                  <div
                    style={{
                      flex: 1,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      padding: "20px",
                      minHeight: 0,
                    }}
                  >
                    {totalFotos > 0 ? (
                      <img
                        src={figurinoDetalhe.fotos[idxImg]}
                        alt="Peça"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          cursor: "zoom-in",
                        }}
                        onClick={() => setIsLightboxOpen(true)}
                        title="Clicar para ver em Ecrã Inteiro"
                      />
                    ) : (
                      <span style={{ color: "#8a8480" }}>Sem Imagem</span>
                    )}
                  </div>

                  {/* Galeria de Miniaturas */}
                  {totalFotos > 1 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        padding: "15px",
                        backgroundColor: "rgba(0,0,0,0.04)",
                        borderTop: "1px solid rgba(0,0,0,0.05)",
                        overflowX: "auto",
                        justifyContent: "center",
                      }}
                    >
                      {figurinoDetalhe.fotos.map((foto, index) => (
                        <img
                          key={index}
                          src={foto}
                          alt={`Thumbnail ${index}`}
                          style={{
                            width: "65px",
                            height: "65px",
                            objectFit: "cover",
                            cursor: "pointer",
                            borderRadius: "8px",
                            border:
                              index === idxImg
                                ? "3px solid #ab855a"
                                : "2px solid transparent",
                            opacity: index === idxImg ? 1 : 0.6,
                            transition: "all 0.2s ease",
                            boxShadow:
                              index === idxImg
                                ? "0 4px 10px rgba(0,0,0,0.1)"
                                : "none",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIndicesImagens((prev) => ({
                              ...prev,
                              [figurinoDetalhe.id_venda]: index,
                            }));
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = 1)
                          }
                          onMouseLeave={(e) => {
                            if (index !== idxImg)
                              e.currentTarget.style.opacity = 0.6;
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Direita: Painel de Informações */}
                <div
                  style={{
                    flex: 1,
                    padding: "40px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    overflowY: "auto",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "25px",
                      }}
                    >
                      <span
                        style={{
                          ...stylesHUD.badge,
                          backgroundColor: estaVendido ? "#2a2724" : "#ab855a",
                          color: "#fff",
                        }}
                      >
                        {estaVendido ? "Vendido" : "Disponível para Compra"}
                      </span>
                      <button
                        onClick={() => setFigurinoDetalhe(null)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: "1.8rem",
                          cursor: "pointer",
                          color: "#8a8480",
                        }}
                      >
                        &times;
                      </button>
                    </div>

                    <h2
                      style={{
                        fontSize: "2.4rem",
                        color: "#2a2724",
                        margin: "0 0 10px 0",
                        fontFamily: "'Cormorant Garamond', serif",
                      }}
                    >
                      {figurinoDetalhe.nome_peca}
                    </h2>

                    <div
                      style={{
                        display: "flex",
                        gap: "15px",
                        marginBottom: "30px",
                      }}
                    >
                      <div
                        style={{
                          background: "#dfdbd2",
                          padding: "10px 15px",
                          borderRadius: "8px",
                        }}
                      >
                        <span style={stylesHUD.label}>Estado</span>
                        <strong style={{ fontSize: "0.9rem" }}>
                          {figurinoDetalhe.condicao_peca}
                        </strong>
                      </div>
                      <div
                        style={{
                          background: "#dfdbd2",
                          padding: "10px 15px",
                          borderRadius: "8px",
                        }}
                      >
                        <span style={stylesHUD.label}>Tamanho</span>
                        <strong style={{ fontSize: "0.9rem" }}>
                          {figurinoDetalhe.tamanho || "Universal"}
                        </strong>
                      </div>
                    </div>

                    <span style={stylesHUD.label}>Descrição do Artigo</span>
                    <p
                      style={{
                        color: "#5a5450",
                        lineHeight: "1.6",
                        fontSize: "1rem",
                        marginBottom: "30px",
                      }}
                    >
                      {figurinoDetalhe.descricao || "Sem descrição detalhada."}
                    </p>

                    <div style={{ marginBottom: "30px" }}>
                      <span style={stylesHUD.label}>Vendido Por</span>
                      <p
                        style={{
                          color: "#b38b59",
                          fontWeight: "600",
                          margin: "4px 0 15px 0",
                        }}
                      >
                        {figurinoDetalhe.vendedor}
                      </p>

                      <span style={stylesHUD.label}>Métodos de Pagamento</span>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {metodos.map((m) => (
                          <span
                            key={m}
                            style={{
                              fontSize: "0.75rem",
                              background: "#fff",
                              border: "1px solid #dcd7ce",
                              padding: "5px 12px",
                              borderRadius: "15px",
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "1px solid #dcd7ce",
                      paddingTop: "30px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "20px",
                    }}
                  >
                    <div>
                      <span style={stylesHUD.label}>Preço Fixo</span>
                      <div
                        style={{
                          fontSize: "2.2rem",
                          fontWeight: "800",
                          color: "#2a2724",
                        }}
                      >
                        {parseFloat(figurinoDetalhe.preco).toFixed(2)}€
                      </div>
                    </div>

                    {estaVendido ? (
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontStyle: "italic",
                            color: "#2a2724",
                            fontWeight: "700",
                            fontSize: "1.2rem",
                            display: "block",
                          }}
                        >
                          Vendido
                        </span>
                        {figurinoDetalhe.comprador && (
                          <span style={{ fontSize: "0.8rem", color: "#888" }}>
                            a {figurinoDetalhe.comprador}
                          </span>
                        )}
                      </div>
                    ) : eMeu ? (
                      <span
                        style={{
                          fontStyle: "italic",
                          color: "#ab855a",
                          fontWeight: "600",
                        }}
                      >
                        Este artigo é teu
                      </span>
                    ) : (
                      <button
                        className="btn-dark"
                        style={{
                          padding: "15px 35px",
                          borderRadius: "30px",
                          whiteSpace: "nowrap",
                        }}
                        onClick={(e) => {
                          handleComprar(e, figurinoDetalhe);
                        }}
                        disabled={!utilizador}
                      >
                        Comprar Agora
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* --- ECRÃ INTEIRO DAS IMAGENS  --- */}
      {isLightboxOpen &&
        figurinoDetalhe &&
        (() => {
          const totalFotos = figurinoDetalhe.fotos?.length || 0;
          const idxImg = indicesImagens[figurinoDetalhe.id_venda] || 0;

          return (
            <div
              className="modal-overlay"
              style={{ zIndex: 3000, background: "rgba(0,0,0,0.95)" }}
              onClick={() => setIsLightboxOpen(false)}
            >
              <button
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "30px",
                  background: "none",
                  border: "none",
                  color: "white",
                  fontSize: "3rem",
                  cursor: "pointer",
                }}
                onClick={() => setIsLightboxOpen(false)}
              >
                &times;
              </button>

              {totalFotos > 1 && (
                <button
                  style={{
                    position: "absolute",
                    left: "30px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "rgba(255,255,255,0.1)",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "60px",
                    height: "60px",
                    fontSize: "2.5rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.3s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.3)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    imagemAnterior(e, figurinoDetalhe.id_venda, totalFotos);
                  }}
                >
                  ‹
                </button>
              )}

              <img
                src={figurinoDetalhe.fotos[idxImg]}
                style={{
                  maxWidth: "90%",
                  maxHeight: "90vh",
                  objectFit: "contain",
                  userSelect: "none",
                }}
                alt="Fullscreen"
                onClick={(e) => e.stopPropagation()}
              />

              {totalFotos > 1 && (
                <button
                  style={{
                    position: "absolute",
                    right: "30px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "rgba(255,255,255,0.1)",
                    color: "white",
                    border: "none",
                    borderRadius: "50%",
                    width: "60px",
                    height: "60px",
                    fontSize: "2.5rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.3s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.3)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    proximaImagem(e, figurinoDetalhe.id_venda, totalFotos);
                  }}
                >
                  ›
                </button>
              )}
            </div>
          );
        })()}

      <footer className="main-footer">
        <div className="footer-container">
          <div className="footer-column">
            <h3>Contacto</h3>
            <ul className="footer-info">
              <li>
                <span>📍</span> Rua das Artes, nº 123, Braga
              </li>
              <li>
                <span>📞</span> +351 000 000 000
              </li>
              <li>
                <span>✉️</span> geral@vivadarte.pt
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Links Rápidos</h3>
            <ul className="footer-links">
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (irParaLanding) irParaLanding();
                  }}
                >
                  Página Inicial
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-column">
            <h3>Redes Sociais</h3>
            <div className="social-icons-only">
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="social-svg"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="social-svg"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-line"></div>
          <p>&copy; 2026 Viva D'arte. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* --- MODAL 1: VENDA --- */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-venda">
            <h2>Vender Figurino</h2>
            <form onSubmit={handleSubmeterVenda}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input
                  type="text"
                  placeholder="Ex: Tutu Azul"
                  value={novaVenda.PECA_nome}
                  onChange={(e) =>
                    setNovaVenda({ ...novaVenda, PECA_nome: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço (€)</label>
                  <input
                    type="number"
                    placeholder="Ex: 15.45"
                    step="0.01"
                    min="0.01"
                    value={novaVenda.preco}
                    onChange={(e) =>
                      setNovaVenda({ ...novaVenda, preco: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    placeholder="Ex: S, 38, Único"
                    value={novaVenda.tamanho}
                    onChange={(e) =>
                      setNovaVenda({ ...novaVenda, tamanho: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select
                    value={novaVenda.condicao}
                    onChange={(e) =>
                      setNovaVenda({ ...novaVenda, condicao: e.target.value })
                    }
                    required
                  >
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Usado">Usado</option>
                    <option value="Danificado">Danificado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição e Detalhes</label>
                <textarea
                  rows="3"
                  maxLength="120"
                  placeholder="Descreve o material, detalhes ou marcas de uso... (Máx: 120 caracteres)"
                  value={novaVenda.descricao}
                  onChange={(e) =>
                    setNovaVenda({ ...novaVenda, descricao: e.target.value })
                  }
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label>Métodos de Pagamento Aceites</label>
                <div className="checkbox-group">
                  {["MBWay", "Transferência", "Numerário"].map((metodo) => (
                    <label className="checkbox-label" key={metodo}>
                      <input
                        type="checkbox"
                        checked={novaVenda.metodos_pagamento.includes(metodo)}
                        onChange={() => handleCheckboxPagamento(metodo)}
                      />
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
                      <button
                        type="button"
                        className="btn-remover-foto"
                        onClick={() => removerFoto(index)}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
                {novaVenda.fotos.length < 4 && (
                  <label className="btn-upload-foto">
                    <span>+ Adicionar Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFotosUpload}
                      onClick={(e) => (e.target.value = null)}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dark"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "A Publicar..." : "Publicar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIÇÃO --- */}
      {isEditModalOpen && figurinoEmEdicao && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-venda">
            <h2>Editar Figurino</h2>
            <form onSubmit={handleGuardarEdicao}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input
                  type="text"
                  value={figurinoEmEdicao.PECA_nome}
                  onChange={(e) =>
                    setFigurinoEmEdicao({
                      ...figurinoEmEdicao,
                      PECA_nome: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Preço (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={figurinoEmEdicao.preco}
                    onChange={(e) =>
                      setFigurinoEmEdicao({
                        ...figurinoEmEdicao,
                        preco: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    value={figurinoEmEdicao.tamanho}
                    onChange={(e) =>
                      setFigurinoEmEdicao({
                        ...figurinoEmEdicao,
                        tamanho: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select
                    value={figurinoEmEdicao.estadoPeca || ""}
                    onChange={(e) =>
                      setFigurinoEmEdicao({
                        ...figurinoEmEdicao,
                        estadoPeca: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Usado">Usado</option>
                    <option value="Danificado">Danificado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição e Detalhes</label>
                <textarea
                  rows="3"
                  maxLength="120"
                  value={figurinoEmEdicao.descricao}
                  onChange={(e) =>
                    setFigurinoEmEdicao({
                      ...figurinoEmEdicao,
                      descricao: e.target.value,
                    })
                  }
                  required
                ></textarea>
              </div>
              <div className="form-group">
                <label>Métodos de Pagamento Aceites</label>
                <div className="checkbox-group">
                  {["MBWay", "Transferência", "Numerário"].map((metodo) => (
                    <label className="checkbox-label" key={metodo}>
                      <input
                        type="checkbox"
                        checked={figurinoEmEdicao.metodos_pagamento?.includes(
                          metodo,
                        )}
                        onChange={() => {
                          setFigurinoEmEdicao((prev) => ({
                            ...prev,
                            metodos_pagamento: prev.metodos_pagamento.includes(
                              metodo,
                            )
                              ? prev.metodos_pagamento.filter(
                                  (m) => m !== metodo,
                                )
                              : [...(prev.metodos_pagamento || []), metodo],
                          }));
                        }}
                      />
                      {metodo}
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-dark">
                  Guardar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: COMPRA  --- */}
      {isCompraModalOpen && figurinoSelecionado && (
        <div className="modal-overlay" style={{ zIndex: 2010 }}>
          <div
            className="modal-content form-venda"
            style={{ maxWidth: "450px", padding: "35px" }}
          >
            <h2 style={{ marginBottom: "10px" }}>Confirmar Compra</h2>
            <p
              style={{
                color: "#8a8480",
                fontSize: "0.9rem",
                marginBottom: "25px",
              }}
            >
              Estás prestes a adquirir:{" "}
              <strong>{figurinoSelecionado.nome_peca}</strong>
            </p>

            <div className="resumo-compra">
              <p>
                <strong>Item:</strong> {figurinoSelecionado.nome_peca}
              </p>
              {figurinoSelecionado.tamanho && (
                <p>
                  <strong>Tamanho:</strong> {figurinoSelecionado.tamanho}
                </p>
              )}
              <p>
                <strong>Total:</strong>{" "}
                {Number(figurinoSelecionado.preco).toFixed(2)} €
              </p>
            </div>

            <form onSubmit={confirmarCompra}>
              <div className="form-group" style={{ marginBottom: "30px" }}>
                <label>Método de Pagamento a utilizar</label>
                <select
                  value={metodoPagamentoCompra}
                  onChange={(e) => setMetodoPagamentoCompra(e.target.value)}
                  required
                >
                  {figurinoSelecionado.metodos_aceites?.split(",").map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "15px" }}>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setIsCompraModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dark"
                  style={{ flex: 1.5 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "A Processar..." : "Confirmar Compra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customAlert.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div
            className="modal-content alert-box"
            style={{ maxWidth: "350px" }}
          >
            <p
              className="alert-message"
              style={{ fontSize: "1rem", marginBottom: "25px" }}
            >
              {customAlert.message}
            </p>
            <div className="alert-buttons">
              {customAlert.type === "confirm" && (
                <button className="btn-outline btn-sm" onClick={fecharAlerta}>
                  Cancelar
                </button>
              )}
              <button
                className="btn-dark"
                onClick={
                  customAlert.type === "confirm"
                    ? customAlert.onConfirm
                    : fecharAlerta
                }
              >
                {customAlert.type === "confirm" ? "Confirmar" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
