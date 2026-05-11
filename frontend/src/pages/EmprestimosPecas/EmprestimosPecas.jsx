import React, { useState, useEffect } from "react";
import "./EmprestimosPecas.css";
import logoImg from "../../assets/logo.png";
import { API_URL, getAuthToken } from "../../services/api";

export default function EmprestimosPecas({
  irParaLanding,
  irParaEmprestimos,
  irParaVendaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  const [utilizador, setUtilizador] = useState(null);
  const [pecas, setPecas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [pesquisa, setPesquisa] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [ordenacao, setOrdenacao] = useState("recentes");

  const [indicesImagens, setIndicesImagens] = useState({});

  const [isAdicionarModalOpen, setIsAdicionarModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSolicitarModalOpen, setIsSolicitarModalOpen] = useState(false);
  const [isAcoesModalOpen, setIsAcoesModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pecaDetalhe, setPecaDetalhe] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const [novaPeca, setNovaPeca] = useState({
    nome: "",
    tamanho: "",
    condicao: "Novo",
    valor_dia: "",
    descricao: "",
    metodos_pagamento: ["MBWay"],
    fotos: [],
  });

  const [pecaEmEdicao, setPecaEmEdicao] = useState(null);

  const [pecaSelecionada, setPecaSelecionada] = useState(null);
  const [metodoPagamentoSolicitacao, setMetodoPagamentoSolicitacao] =
    useState("MBWay");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [observacoesSolicitacao, setObservacoesSolicitacao] = useState("");

  const [acaoPeca, setAcaoPeca] = useState(null);
  const [acaoForm, setAcaoForm] = useState({
    idEmprestimo: "",
    tipoAcao: "Pagamento",
    valorPagamento: "",
    metodoPagamento: "MBWay",
    estadoPagamento: "Pago",
    estadoFinalDevolucao: "Concluído",
    observacoesDevolucao: "",
    estadoPecaDevolucao: "Bom",
    tipoPenalizacao: "Atraso",
    valorPenalizacao: "",
    descricaoPenalizacao: "",
  });

  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: "",
    type: "alert",
    onConfirm: null,
  });

  const API_URL_BASE = "http://localhost:3000/api/inventario";

  const getToken = () => getAuthToken() || "";
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

  const parsearLocalizacao = (peca) => {
    if (!peca || typeof peca !== "object")
      return { valor_dia: "0", metodos: ["MBWay"] };
    if (
      typeof peca.localizacao === "string" &&
      peca.localizacao.includes("valor_dia:")
    ) {
      try {
        const partes = peca.localizacao.split(";");
        const valor_dia =
          partes.find((p) => p.startsWith("valor_dia:"))?.split(":")[1] || "0";
        const metodosStr =
          partes.find((p) => p.startsWith("metodos:"))?.split(":")[1] ||
          "MBWay";
        return { valor_dia, metodos: metodosStr.split(",") };
      } catch {
        return { valor_dia: "0", metodos: ["MBWay"] };
      }
    }
    return {
      valor_dia: peca.valor_dia || "0",
      metodos:
        typeof peca.metodos_pagamento === "string"
          ? peca.metodos_pagamento.split(",")
          : ["MBWay"],
    };
  };

  const carregarPecas = async (mostrarLoading = false) => {
    if (mostrarLoading) setIsLoading(true);
    try {
      const response = await fetch(API_URL_BASE, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      if (response.ok) {
        const dados = await response.json();
        const tratadas = dados.filter(
          (p) =>
            p.disponivel_para_emprestimo === true ||
            p.disponivel_para_emprestimo === 1 ||
            (p.localizacao && p.localizacao.includes("valor_dia:")),
        );
        setPecas((prev) => {
          const newPecas = [...tratadas];
          newPecas.forEach((np) => {
            const existing = prev.find((p) => p.id_peca === np.id_peca);
            if (existing && existing.fotosCompletas) {
              np.fotos = existing.fotos;
              np.fotosCompletas = true;
            } else {
              np.fotos = np.foto_principal ? [np.foto_principal] : [];
              np.fotosCompletas = false;
              fetch(`${API_URL_BASE}/${np.id_peca}`, {
                headers: { Authorization: `Bearer ${getToken()}` },
              })
                .then((r) => r.json())
                .then((det) => {
                  setPecas((curr) =>
                    curr.map((cp) =>
                      cp.id_peca === np.id_peca
                        ? {
                            ...cp,
                            fotos:
                              det.fotos && det.fotos.length > 0
                                ? det.fotos.map((f) => f.foto)
                                : cp.fotos,
                            fotosCompletas: true,
                          }
                        : cp,
                    ),
                  );
                })
                .catch(() => {});
            }
          });
          return newPecas;
        });
      }
    } catch (error) {
      console.error("Erro a carregar peças:", error);
    } finally {
      if (mostrarLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Empréstimos | Viva D'arte";
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) setUtilizador(JSON.parse(userGuardado));
    carregarPecas(true);
    const interval = setInterval(() => carregarPecas(false), 3000);
    return () => clearInterval(interval);
  }, []);

  const userId = utilizador?.id_utilizador || utilizador?.id;

  const pecasFiltradas = pecas
    .filter((p) =>
      (p?.nome_peca || p?.nome || "")
        .toLowerCase()
        .includes(pesquisa.toLowerCase()),
    )
    .filter((p) =>
      filtroEstado === "Todos"
        ? true
        : (p?.condicao_peca || p?.estado) === filtroEstado,
    )
    .sort((a, b) => {
      const eMeuA = Boolean(
        userId &&
        a?.UTILIZADORid_utilizador &&
        userId === a.UTILIZADORid_utilizador,
      );
      const eMeuB = Boolean(
        userId &&
        b?.UTILIZADORid_utilizador &&
        userId === b.UTILIZADORid_utilizador,
      );
      if (eMeuA && !eMeuB) return -1;
      if (!eMeuA && eMeuB) return 1;
      const vaA = parseFloat(parsearLocalizacao(a).valor_dia || 0);
      const vaB = parseFloat(parsearLocalizacao(b).valor_dia || 0);
      if (ordenacao === "preco_asc") return vaA - vaB;
      if (ordenacao === "preco_desc") return vaB - vaA;
      return (b?.id_peca || 0) - (a?.id_peca || 0);
    });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (isLightboxOpen && pecaDetalhe) {
        const totalFotos = pecaDetalhe.fotos?.length || 0;
        if (totalFotos > 1) {
          if (e.key === "ArrowRight")
            setIndicesImagens((prev) => ({
              ...prev,
              [pecaDetalhe.id_peca]:
                ((prev[pecaDetalhe.id_peca] || 0) + 1) % totalFotos,
            }));
          else if (e.key === "ArrowLeft")
            setIndicesImagens((prev) => ({
              ...prev,
              [pecaDetalhe.id_peca]:
                ((prev[pecaDetalhe.id_peca] || 0) - 1 + totalFotos) %
                totalFotos,
            }));
        }
        if (e.key === "Escape") setIsLightboxOpen(false);
      } else if (
        pecaDetalhe &&
        !isLightboxOpen &&
        !isSolicitarModalOpen &&
        !isAcoesModalOpen &&
        !isAdicionarModalOpen &&
        !isEditModalOpen
      ) {
        if (e.key === "Escape") setPecaDetalhe(null);
        else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          if (pecasFiltradas.length <= 1) return;
          const currentIndex = pecasFiltradas.findIndex(
            (p) => p.id_peca === pecaDetalhe.id_peca,
          );
          let nextIndex =
            e.key === "ArrowRight" ? currentIndex + 1 : currentIndex - 1;
          if (nextIndex < 0) nextIndex = pecasFiltradas.length - 1;
          if (nextIndex >= pecasFiltradas.length) nextIndex = 0;
          setPecaDetalhe(pecasFiltradas[nextIndex]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    pecaDetalhe,
    isLightboxOpen,
    pecasFiltradas,
    isSolicitarModalOpen,
    isAcoesModalOpen,
    isAdicionarModalOpen,
    isEditModalOpen,
  ]);

  const handleLogout = () => {
    localStorage.clear();
    setUtilizador(null);
    if (irParaLanding) irParaLanding();
    window.location.reload();
  };

  const proximaImagem = (e, id_peca, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [id_peca]: ((prev[id_peca] || 0) + 1) % totalFotos,
    }));
  };
  const imagemAnterior = (e, id_peca, totalFotos) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [id_peca]: ((prev[id_peca] || 0) - 1 + totalFotos) % totalFotos,
    }));
  };

  const handleFotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const comprimir = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (ev) => {
          const img = new Image();
          img.src = ev.target.result;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let w = img.width,
              h = img.height;
            if (w > h) {
              if (w > 800) {
                h *= 800 / w;
                w = 800;
              }
            } else {
              if (h > 800) {
                w *= 800 / h;
                h = 800;
              }
            }
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
        };
      });
    try {
      const novas = await Promise.all(files.map(comprimir));
      setNovaPeca((prev) => ({ ...prev, fotos: [...prev.fotos, ...novas] }));
    } catch {
      mostrarAlerta("Erro ao processar as imagens.");
    }
  };

  const removerFoto = (idx) =>
    setNovaPeca((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((_, i) => i !== idx),
    }));

  const handleCheckboxPagamento = (metodo) =>
    setNovaPeca((prev) => ({
      ...prev,
      metodos_pagamento: prev.metodos_pagamento.includes(metodo)
        ? prev.metodos_pagamento.filter((m) => m !== metodo)
        : [...prev.metodos_pagamento, metodo],
    }));

  const handleSubmeterNovo = async (e) => {
    e.preventDefault();
    if (!utilizador) return mostrarAlerta("Erro: Sessão inválida.");
    if (!novaPeca.fotos.length)
      return mostrarAlerta("Adiciona pelo menos uma foto.");
    if (!novaPeca.metodos_pagamento.length)
      return mostrarAlerta("Seleciona pelo menos um método de pagamento.");
    setIsSubmitting(true);
    try {
      const res = await fetch(API_URL_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          nome: novaPeca.nome,
          descricao: novaPeca.descricao,
          tamanho: novaPeca.tamanho,
          estado: novaPeca.condicao,
          idCategoria: 1,
          fotos: novaPeca.fotos,
          valor_dia: novaPeca.valor_dia,
          metodos_pagamento: novaPeca.metodos_pagamento,
        }),
      });
      if (res.ok) {
        mostrarAlerta("Peça publicada!");
        setIsAdicionarModalOpen(false);
        setNovaPeca({
          nome: "",
          tamanho: "",
          condicao: "Novo",
          valor_dia: "",
          descricao: "",
          metodos_pagamento: ["MBWay"],
          fotos: [],
        });
        carregarPecas(false);
      } else {
        mostrarAlerta((await res.json()).mensagem || "Erro ao registar.");
      }
    } catch {
      mostrarAlerta("Erro de ligação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const abrirEdicao = (peca) => {
    const metaParsed = parsearLocalizacao(peca);
    setPecaEmEdicao({
      ...peca,
      valor_dia: metaParsed.valor_dia || "",
      metodos_pagamento: metaParsed.metodos || ["MBWay"],
      fotos: peca.fotos || [],
    });
    setIsEditModalOpen(true);
  };

  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    if (!pecaEmEdicao.metodos_pagamento.length)
      return mostrarAlerta("Seleciona pelo menos um método de pagamento.");
    try {
      const response = await fetch(
        `${API_URL_BASE}/${pecaEmEdicao.id_peca}/editar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            nome: pecaEmEdicao.nome_peca || pecaEmEdicao.nome,
            descricao: pecaEmEdicao.descricao,
            tamanho: pecaEmEdicao.tamanho,
            estado: pecaEmEdicao.condicao_peca || pecaEmEdicao.estado,
          }),
        },
      );
      if (response.ok) {
        await fetch(`${API_URL_BASE}/${pecaEmEdicao.id_peca}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            estado: pecaEmEdicao.condicao_peca || pecaEmEdicao.estado,
            disponivelEmprestimo: true,
            disponivelVenda: false,
            localizacao: `valor_dia:${pecaEmEdicao.valor_dia};metodos:${pecaEmEdicao.metodos_pagamento.join(",")}`,
          }),
        });
        mostrarAlerta("Peça atualizada com sucesso!");
        setIsEditModalOpen(false);
        if (pecaDetalhe && pecaDetalhe.id_peca === pecaEmEdicao.id_peca)
          setPecaDetalhe(null);
        carregarPecas(false);
      } else {
        mostrarAlerta(
          (await response.json()).mensagem || "Erro ao guardar as alterações.",
        );
      }
    } catch {
      mostrarAlerta("Erro de rede.");
    }
  };

  const confirmarEliminacao = (idPeca) => {
    setCustomAlert({
      show: true,
      message:
        "Tens a certeza que queres apagar esta peça? Esta ação é irreversível.",
      type: "confirm",
      onConfirm: () => executarApagar(idPeca),
    });
  };

  const executarApagar = async (idPeca) => {
    fecharAlerta();
    try {
      const response = await fetch(`${API_URL_BASE}/${idPeca}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (response.ok) {
        mostrarAlerta("Peça removida com sucesso!");
        if (pecaDetalhe?.id_peca === idPeca) setPecaDetalhe(null);
        carregarPecas(false);
      } else {
        mostrarAlerta(
          (await response.json()).mensagem || "Erro ao apagar a peça.",
        );
      }
    } catch {
      mostrarAlerta("Erro de rede.");
    }
  };

  const handleAbrirSolicitar = (peca) => {
    const meta = parsearLocalizacao(peca);
    setPecaSelecionada({
      ...peca,
      valor_dia: meta.valor_dia,
      metodos_pagamento: meta.metodos,
    });
    setMetodoPagamentoSolicitacao(meta.metodos?.[0] || "MBWay");
    setDataInicio("");
    setDataFim("");
    setObservacoesSolicitacao("");
    setIsSolicitarModalOpen(true);
  };

  const confirmarSolicitacao = async (e) => {
    e.preventDefault();
    if (!utilizador)
      return mostrarAlerta("Sessão inválida. Faz login novamente.");
    if (!dataInicio || !dataFim)
      return mostrarAlerta("Indica as datas de início e fim do empréstimo.");
    if (new Date(dataFim) <= new Date(dataInicio))
      return mostrarAlerta(
        "A data de fim deve ser posterior à data de início.",
      );
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL_BASE}/emprestimos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          dataInicio,
          dataFim,
          metodoPagamento: metodoPagamentoSolicitacao,
          observacoes: observacoesSolicitacao,
          itens: [
            {
              idPeca: pecaSelecionada.id_peca,
              estadoEntrega:
                pecaSelecionada.condicao_peca ||
                pecaSelecionada.estado ||
                "Bom",
            },
          ],
        }),
      });
      if (response.ok) {
        mostrarAlerta(`Solicitação enviada com sucesso!`);
        setIsSolicitarModalOpen(false);
        carregarPecas(false);
      } else {
        mostrarAlerta((await response.json()).mensagem || "Erro ao solicitar.");
      }
    } catch {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAbrirAcoesEmprestimo = (peca) => {
    setAcaoPeca(peca);
    setAcaoForm({ ...acaoForm, idEmprestimo: "" });
    setIsAcoesModalOpen(true);
  };

  const handleSubmeterAcaoEmprestimo = async (e) => {
    e.preventDefault();
    const idEmp = acaoPeca?.active_id_emprestimo;
    if (!idEmp)
      return mostrarAlerta(
        "Erro: Não foi possível identificar o empréstimo ativo. Atualiza a página.",
      );
    setIsSubmitting(true);
    try {
      if (acaoForm.tipoAcao === "Pagamento") {
        const res = await fetch(
          `${API_URL_BASE}/emprestimos/${idEmp}/pagamento`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              valor: parseFloat(acaoForm.valorPagamento),
              metodoPagamento: acaoForm.metodoPagamento,
              estadoPagamento: acaoForm.estadoPagamento,
            }),
          },
        );
        if (res.ok) mostrarAlerta("Pagamento registado com sucesso!");
        else mostrarAlerta((await res.json()).mensagem || "Erro ao registar.");
      } else if (acaoForm.tipoAcao === "Devolucao") {
        const res = await fetch(
          `${API_URL_BASE}/emprestimos/${idEmp}/devolucao`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              estadoFinal: acaoForm.estadoFinalDevolucao,
              observacoes: acaoForm.observacoesDevolucao || null,
              itens: [
                {
                  idPeca: acaoPeca.id_peca,
                  estadoDevolucao: acaoForm.estadoPecaDevolucao,
                },
              ],
            }),
          },
        );
        if (res.ok) {
          mostrarAlerta("Devolução concluída!");
          setIsAcoesModalOpen(false);
          carregarPecas(false);
        } else
          mostrarAlerta((await res.json()).mensagem || "Erro ao registar.");
      } else if (acaoForm.tipoAcao === "Penalizacao") {
        const res = await fetch(
          `${API_URL_BASE}/emprestimos/${idEmp}/penalizacoes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              idPeca: acaoPeca.id_peca,
              tipo: acaoForm.tipoPenalizacao,
              valor: parseFloat(acaoForm.valorPenalizacao),
              descricao: acaoForm.descricaoPenalizacao || null,
            }),
          },
        );
        if (res.ok) mostrarAlerta("Penalização aplicada com sucesso!");
        else mostrarAlerta((await res.json()).mensagem || "Erro ao registar.");
      }
    } catch {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div className="emprestimos-page">
      <nav className="navbar interna">
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
              href="#"
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
              href="#"
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
            <a href="#" className="special-link active">
              Empréstimos de peças
            </a>
          </li>
          <li>
            <a
              href="#"
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
          {utilizador ? (
            <div className="user-profile">
              <span className="welcome-text">
                Olá, <strong>{utilizador.nome?.split(" ")[0]}</strong>
              </span>
              <button className="btn-logout" onClick={handleLogout}>
                Sair
              </button>
            </div>
          ) : (
            <button className="btn-text" onClick={irParaLanding}>
              Voltar
            </button>
          )}
        </div>
      </nav>

      <div className="emprestimos-content-wrapper">
        <div className="emprestimos-header-section">
          <div>
            <h1 className="emprestimos-title">Peças para Empréstimo</h1>
            <p className="emprestimos-subtitle">
              Descobre figurinos e acessórios partilhados pela comunidade.
            </p>
          </div>
          {utilizador && (
            <button
              className="btn-add-peca"
              onClick={() => {
                setNovaPeca({
                  nome: "",
                  tamanho: "",
                  condicao: "Novo",
                  valor_dia: "",
                  descricao: "",
                  metodos_pagamento: ["MBWay"],
                  fotos: [],
                });
                setIsAdicionarModalOpen(true);
              }}
            >
              + Disponibilizar Artigo
            </button>
          )}
        </div>

        {!isLoading && pecas.length > 0 && (
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

        <div className="pecas-grid">
          {isLoading ? (
            <div className="empty-state-container">
              A sincronizar inventário...
            </div>
          ) : pecasFiltradas.length === 0 ? (
            <div className="empty-state-container">
              <p>Nenhuma peça encontrada.</p>
            </div>
          ) : (
            pecasFiltradas.map((peca) => {
              const idxImg = indicesImagens[peca.id_peca] || 0;
              const totalFotos = peca.fotos?.length || 0;
              const estaEmprestado = !!peca.emprestimo_inicio;
              const meta = parsearLocalizacao(peca);
              const eMinha = Boolean(
                userId && peca.UTILIZADORid_utilizador === userId,
              );

              // FALLBACKS para Proprietário e Requisitante baseados na BD
              const dono =
                peca.registado_por ||
                peca.vendedor ||
                peca.nome_utilizador ||
                "Comunidade";
              const requisitante =
                peca.requisitante || peca.emprestado_a || peca.comprador;

              return (
                <div
                  key={peca.id_peca}
                  className={`peca-card ${estaEmprestado ? "emprestado" : ""}`}
                  onClick={() => setPecaDetalhe(peca)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="peca-image-container"
                    style={
                      totalFotos > 0
                        ? { backgroundImage: `url(${peca.fotos[idxImg]})` }
                        : { backgroundColor: "#dcd7ce" }
                    }
                  >
                    <span
                      className={`status-badge ${estaEmprestado ? "emprestado" : "disponivel"}`}
                    >
                      {estaEmprestado ? "Indisponível" : "Disponível"}
                    </span>
                    {totalFotos > 1 && (
                      <>
                        <button
                          className="img-nav-btn left"
                          onClick={(e) =>
                            imagemAnterior(e, peca.id_peca, totalFotos)
                          }
                        >
                          ‹
                        </button>
                        <button
                          className="img-nav-btn right"
                          onClick={(e) =>
                            proximaImagem(e, peca.id_peca, totalFotos)
                          }
                        >
                          ›
                        </button>
                        <div className="img-dots">
                          {peca.fotos.map((_, i) => (
                            <span
                              key={i}
                              className={`dot ${i === idxImg ? "active" : ""}`}
                            ></span>
                          ))}
                        </div>
                      </>
                    )}
                    {eMinha && (
                      <div className="owner-actions">
                        <button
                          className="action-btn edit-btn"
                          title="Editar"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirEdicao(peca);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className="action-btn delete-btn"
                          title="Apagar"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmarEliminacao(peca.id_peca);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="peca-content">
                    <h3 className="peca-nome">{peca.nome_peca || peca.nome}</h3>

                    <div className="peca-tags">
                      <span>{peca.condicao_peca || peca.estado}</span>
                      <span>Tam: {peca.tamanho || "N/A"}</span>
                    </div>

                    <p className="peca-descricao">{peca.descricao}</p>

                    {/* DONO NA GRID */}
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#b38b59",
                        fontWeight: "600",
                        margin: "0 0 10px 0",
                      }}
                    >
                      Por: {dono}
                    </p>

                    <div className="peca-pagamentos">
                      {meta.metodos.map((m) => (
                        <span key={m} className="tag-pagamento">
                          {m}
                        </span>
                      ))}
                    </div>

                    <div className="peca-footer">
                      <span className="preco">
                        {parseFloat(meta.valor_dia).toFixed(2)}€{" "}
                        <small style={{ fontSize: "0.6rem", color: "#888" }}>
                          /dia
                        </small>
                      </span>
                      {estaEmprestado ? (
                        <div
                          style={{
                            textAlign: "right",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                          }}
                        >
                          {eMinha ? (
                            <button
                              className="btn-dark btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirAcoesEmprestimo(peca);
                              }}
                            >
                              Gerir Empréstimo
                            </button>
                          ) : (
                            <span
                              className="texto-emprestado-rodape"
                              style={{
                                color: "#b38b59",
                                fontWeight: "bold",
                                fontSize: "0.9rem",
                              }}
                            >
                              Emprestado
                            </span>
                          )}

                          {/* REQUISITANTE NA GRID */}
                          {requisitante && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "#666",
                                marginTop: "4px",
                                fontWeight: "600",
                              }}
                            >
                              a {requisitante}
                            </span>
                          )}
                        </div>
                      ) : eMinha ? (
                        <span className="texto-teu-item">Teu Item</span>
                      ) : (
                        <button
                          className="btn-outline btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbrirSolicitar(peca);
                          }}
                          disabled={!utilizador}
                        >
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

      {/* --- HUD DE DETALHES MELHORADA --- */}
      {pecaDetalhe &&
        (() => {
          const meta = parsearLocalizacao(pecaDetalhe);
          const idxImg = indicesImagens[pecaDetalhe.id_peca] || 0;
          const totalFotos = pecaDetalhe.fotos?.length || 0;
          const eMinha = Boolean(
            userId && pecaDetalhe.UTILIZADORid_utilizador === userId,
          );
          const estaEmprestado = !!pecaDetalhe.emprestimo_inicio;

          const donoHUD =
            pecaDetalhe.registado_por ||
            pecaDetalhe.vendedor ||
            pecaDetalhe.nome_utilizador ||
            "Comunidade";
          const requisitanteHUD =
            pecaDetalhe.requisitante ||
            pecaDetalhe.emprestado_a ||
            pecaDetalhe.comprador;

          const navigatePiece = (direction, e) => {
            e.stopPropagation();
            const currentIndex = pecasFiltradas.findIndex(
              (p) => p.id_peca === pecaDetalhe.id_peca,
            );
            if (currentIndex === -1) return;
            let nextIndex = currentIndex + direction;
            if (nextIndex < 0) nextIndex = pecasFiltradas.length - 1;
            if (nextIndex >= pecasFiltradas.length) nextIndex = 0;
            setPecaDetalhe(pecasFiltradas[nextIndex]);
          };

          return (
            <div
              className="modal-overlay"
              onClick={() => setPecaDetalhe(null)}
              style={{ zIndex: 2005, background: "rgba(21, 19, 17, 0.92)" }}
            >
              {pecasFiltradas.length > 1 && (
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

              {pecasFiltradas.length > 1 && (
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
                        src={pecaDetalhe.fotos[idxImg]}
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
                      {pecaDetalhe.fotos.map((foto, index) => (
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
                              [pecaDetalhe.id_peca]: index,
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
                          backgroundColor: estaEmprestado
                            ? "#2a2724"
                            : "#ab855a",
                          color: "#fff",
                        }}
                      >
                        {estaEmprestado
                          ? "Indisponível"
                          : "Disponível para Empréstimo"}
                      </span>
                      <button
                        onClick={() => setPecaDetalhe(null)}
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
                      {pecaDetalhe.nome_peca || pecaDetalhe.nome}
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
                          {pecaDetalhe.condicao_peca ||
                            pecaDetalhe.estado ||
                            "Bom"}
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
                          {pecaDetalhe.tamanho || "Universal"}
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
                      {pecaDetalhe.descricao || "Sem descrição detalhada."}
                    </p>

                    <div style={{ marginBottom: "30px" }}>
                      {/* DONO NA HUD */}
                      <span style={stylesHUD.label}>Disponibilizado Por</span>
                      <p
                        style={{
                          color: "#b38b59",
                          fontWeight: "600",
                          margin: "4px 0 15px 0",
                          fontSize: "1.1rem",
                        }}
                      >
                        {donoHUD}
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
                        {meta.metodos.map((m) => (
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
                      <span style={stylesHUD.label}>Custo Diário</span>
                      <div
                        style={{
                          fontSize: "2.2rem",
                          fontWeight: "800",
                          color: "#2a2724",
                        }}
                      >
                        {parseFloat(meta.valor_dia).toFixed(2)}€
                        <small
                          style={{
                            fontSize: "0.9rem",
                            color: "#8a8480",
                            fontWeight: "400",
                          }}
                        >
                          {" "}
                          / dia
                        </small>
                      </div>
                    </div>

                    {estaEmprestado ? (
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontStyle: "italic",
                            color: "#2a2724",
                            fontWeight: "700",
                            fontSize: "1.3rem",
                            display: "block",
                          }}
                        >
                          Emprestado
                        </span>

                        {/* REQUISITANTE NA HUD */}
                        {requisitanteHUD && (
                          <span
                            style={{
                              fontSize: "0.9rem",
                              color: "#666",
                              fontWeight: "500",
                            }}
                          >
                            a {requisitanteHUD}
                          </span>
                        )}
                      </div>
                    ) : eMinha ? (
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
                        onClick={() => {
                          setPecaDetalhe(null);
                          handleAbrirSolicitar(pecaDetalhe);
                        }}
                        disabled={!utilizador}
                      >
                        Solicitar Agora
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* --- ECRÃ INTEIRO DAS IMAGENS (LIGHTBOX) --- */}
      {isLightboxOpen &&
        pecaDetalhe &&
        (() => {
          const totalFotos = pecaDetalhe.fotos?.length || 0;
          const idxImg = indicesImagens[pecaDetalhe.id_peca] || 0;

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
                    imagemAnterior(e, pecaDetalhe.id_peca, totalFotos);
                  }}
                >
                  ‹
                </button>
              )}

              <img
                src={pecaDetalhe.fotos[idxImg]}
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
                    proximaImagem(e, pecaDetalhe.id_peca, totalFotos);
                  }}
                >
                  ›
                </button>
              )}
            </div>
          );
        })()}

      {/* --- MODAL DE DISPONIBILIZAR PEÇA --- */}
      {isAdicionarModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-venda">
            <h2>Disponibilizar para Empréstimo</h2>

            <form onSubmit={handleSubmeterNovo}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input
                  type="text"
                  name="nome"
                  placeholder="Ex: Sapatilhas de Ponta"
                  value={novaPeca.nome}
                  onChange={(e) =>
                    setNovaPeca({ ...novaPeca, nome: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Preço por Dia (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 5.00"
                    value={novaPeca.valor_dia}
                    onChange={(e) =>
                      setNovaPeca({ ...novaPeca, valor_dia: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    placeholder="Ex: S, 38, Único"
                    value={novaPeca.tamanho}
                    onChange={(e) =>
                      setNovaPeca({ ...novaPeca, tamanho: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select
                    value={novaPeca.condicao}
                    onChange={(e) =>
                      setNovaPeca({ ...novaPeca, condicao: e.target.value })
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
                  value={novaPeca.descricao}
                  onChange={(e) =>
                    setNovaPeca({ ...novaPeca, descricao: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Métodos de Pagamento Aceites</label>
                <div className="checkbox-group">
                  {["MBWay", "Transferência", "Numerário"].map((metodo) => (
                    <label className="checkbox-label" key={metodo}>
                      <input
                        type="checkbox"
                        checked={novaPeca.metodos_pagamento.includes(metodo)}
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
                  {novaPeca.fotos.map((fotoUrl, idx) => (
                    <div className="foto-preview-box" key={idx}>
                      <img src={fotoUrl} alt="Preview" />
                      <button
                        type="button"
                        className="btn-remover-foto"
                        onClick={() => removerFoto(idx)}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
                {novaPeca.fotos.length < 4 && (
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
                  onClick={() => setIsAdicionarModalOpen(false)}
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

      {/* --- MODAL DE EDITAR PEÇA --- */}
      {isEditModalOpen && pecaEmEdicao && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-venda">
            <h2>Editar Peça</h2>

            <form onSubmit={handleGuardarEdicao}>
              <div className="form-group">
                <label>Nome da Peça</label>
                <input
                  type="text"
                  value={pecaEmEdicao.nome_peca || pecaEmEdicao.nome || ""}
                  onChange={(e) =>
                    setPecaEmEdicao({
                      ...pecaEmEdicao,
                      nome_peca: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Preço por Dia (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pecaEmEdicao.valor_dia || ""}
                    onChange={(e) =>
                      setPecaEmEdicao({
                        ...pecaEmEdicao,
                        valor_dia: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    value={pecaEmEdicao.tamanho || ""}
                    onChange={(e) =>
                      setPecaEmEdicao({
                        ...pecaEmEdicao,
                        tamanho: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select
                    value={
                      pecaEmEdicao.condicao_peca || pecaEmEdicao.estado || "Bom"
                    }
                    onChange={(e) =>
                      setPecaEmEdicao({
                        ...pecaEmEdicao,
                        condicao_peca: e.target.value,
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
                  value={pecaEmEdicao.descricao || ""}
                  onChange={(e) =>
                    setPecaEmEdicao({
                      ...pecaEmEdicao,
                      descricao: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Métodos de Pagamento Aceites</label>
                <div className="checkbox-group">
                  {["MBWay", "Transferência", "Numerário"].map((metodo) => (
                    <label className="checkbox-label" key={metodo}>
                      <input
                        type="checkbox"
                        checked={pecaEmEdicao.metodos_pagamento?.includes(
                          metodo,
                        )}
                        onChange={() =>
                          setPecaEmEdicao((prev) => ({
                            ...prev,
                            metodos_pagamento: prev.metodos_pagamento.includes(
                              metodo,
                            )
                              ? prev.metodos_pagamento.filter(
                                  (m) => m !== metodo,
                                )
                              : [...(prev.metodos_pagamento || []), metodo],
                          }))
                        }
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

      {/* --- MODAL DE SOLICITAÇÃO (VERSÃO ANTIGA CLÁSSICA E DETALHADA RESTAURADA) --- */}
      {isSolicitarModalOpen &&
        pecaSelecionada &&
        (() => {
          const dias =
            dataInicio && dataFim && new Date(dataFim) > new Date(dataInicio)
              ? Math.ceil(
                  (new Date(dataFim) - new Date(dataInicio)) /
                    (1000 * 60 * 60 * 24),
                )
              : null;
          const totalEstimado = dias
            ? (parseFloat(pecaSelecionada.valor_dia || 0) * dias).toFixed(2)
            : null;

          return (
            <div className="modal-overlay" style={{ zIndex: 2010 }}>
              <div
                className="modal-content"
                style={{ maxWidth: "450px", padding: "35px" }}
              >
                <h2 style={{ marginBottom: "10px" }}>Solicitar Empréstimo</h2>
                <p
                  style={{
                    color: "#8a8480",
                    fontSize: "0.9rem",
                    marginBottom: "25px",
                  }}
                >
                  Estás a solicitar:{" "}
                  <strong>
                    {pecaSelecionada.nome_peca || pecaSelecionada.nome}
                  </strong>
                </p>

                <div className="resumo-compra" style={{ marginBottom: "25px" }}>
                  <p>
                    <strong>Preço:</strong>{" "}
                    {Number(pecaSelecionada.valor_dia || 0).toFixed(2)} € / dia
                  </p>
                  {totalEstimado && (
                    <p>
                      <strong>
                        Total estimado ({dias} dia{dias > 1 ? "s" : ""}):
                      </strong>{" "}
                      {totalEstimado} €
                    </p>
                  )}
                </div>

                <form onSubmit={confirmarSolicitacao}>
                  <div className="form-row" style={{ marginBottom: "20px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Início</label>
                      <input
                        type="date"
                        value={dataInicio}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setDataInicio(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Fim</label>
                      <input
                        type="date"
                        value={dataFim}
                        min={
                          dataInicio || new Date().toISOString().split("T")[0]
                        }
                        onChange={(e) => setDataFim(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "25px" }}>
                    <label>Forma de Pagamento</label>
                    <select
                      value={metodoPagamentoSolicitacao}
                      onChange={(e) =>
                        setMetodoPagamentoSolicitacao(e.target.value)
                      }
                      required
                    >
                      {(pecaSelecionada.metodos_pagamento || ["MBWay"]).map(
                        (m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: "25px" }}>
                    <label>Observações (opcional)</label>
                    <textarea
                      rows="2"
                      placeholder="Ex: Preciso para o espetáculo..."
                      value={observacoesSolicitacao}
                      onChange={(e) =>
                        setObservacoesSolicitacao(e.target.value)
                      }
                    />
                  </div>

                  <div style={{ display: "flex", gap: "15px" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setIsSolicitarModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-dark"
                      style={{ flex: 1.5 }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "A enviar..." : "Confirmar Pedido"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      {/* --- MODAL DE GERIR EMPRÉSTIMO --- */}
      {isAcoesModalOpen && acaoPeca && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-venda">
            <h2>Gerir Empréstimo</h2>
            <p
              className="resumo-compra"
              style={{ fontSize: "0.9rem", marginBottom: "20px" }}
            >
              Estás a gerir o empréstimo ativo da peça:{" "}
              <strong>{acaoPeca.nome_peca || acaoPeca.nome}</strong>. Seleciona
              a ação que pretendes realizar.
            </p>

            <form onSubmit={handleSubmeterAcaoEmprestimo}>
              <div className="form-group">
                <label>Ação a Realizar</label>
                <select
                  value={acaoForm.tipoAcao}
                  onChange={(e) =>
                    setAcaoForm({ ...acaoForm, tipoAcao: e.target.value })
                  }
                >
                  <option value="Pagamento">Registar Pagamento Recebido</option>
                  <option value="Devolucao">Registar Devolução da Peça</option>
                  <option value="Penalizacao">
                    Aplicar Penalização (Multa)
                  </option>
                </select>
              </div>

              {acaoForm.tipoAcao === "Pagamento" && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Valor Pago (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Ex: 15.00"
                      value={acaoForm.valorPagamento}
                      onChange={(e) =>
                        setAcaoForm({
                          ...acaoForm,
                          valorPagamento: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Método de Pagamento</label>
                    <select
                      value={acaoForm.metodoPagamento}
                      onChange={(e) =>
                        setAcaoForm({
                          ...acaoForm,
                          metodoPagamento: e.target.value,
                        })
                      }
                    >
                      <option value="MBWay">MBWay</option>
                      <option value="Transferência">Transferência</option>
                      <option value="Numerário">Numerário</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Estado Pagamento</label>
                    <select
                      value={acaoForm.estadoPagamento}
                      onChange={(e) =>
                        setAcaoForm({
                          ...acaoForm,
                          estadoPagamento: e.target.value,
                        })
                      }
                    >
                      <option value="Pago">Pago</option>
                      <option value="Pendente">Pendente</option>
                    </select>
                  </div>
                </div>
              )}

              {acaoForm.tipoAcao === "Devolucao" && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Estado do Empréstimo</label>
                      <select
                        value={acaoForm.estadoFinalDevolucao}
                        onChange={(e) =>
                          setAcaoForm({
                            ...acaoForm,
                            estadoFinalDevolucao: e.target.value,
                          })
                        }
                      >
                        <option value="Concluído">Concluído com sucesso</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Condição em que foi devolvida</label>
                      <select
                        value={acaoForm.estadoPecaDevolucao}
                        onChange={(e) =>
                          setAcaoForm({
                            ...acaoForm,
                            estadoPecaDevolucao: e.target.value,
                          })
                        }
                      >
                        <option value="Bom">Bom estado</option>
                        <option value="Usado">Marcas de Uso</option>
                        <option value="Danificado">Danificado</option>
                        <option value="Perdido">Perdido</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Observações sobre a devolução</label>
                    <textarea
                      rows="2"
                      placeholder="Ex: Devolvido a tempo e horas..."
                      value={acaoForm.observacoesDevolucao}
                      onChange={(e) =>
                        setAcaoForm({
                          ...acaoForm,
                          observacoesDevolucao: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}

              {acaoForm.tipoAcao === "Penalizacao" && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Motivo da Penalização</label>
                      <select
                        value={acaoForm.tipoPenalizacao}
                        onChange={(e) =>
                          setAcaoForm({
                            ...acaoForm,
                            tipoPenalizacao: e.target.value,
                          })
                        }
                      >
                        <option value="Atraso">Atraso na entrega</option>
                        <option value="Dano">Danos à peça</option>
                        <option value="Perda">Perda da peça</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Valor da Multa (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="Ex: 5.00"
                        value={acaoForm.valorPenalizacao}
                        onChange={(e) =>
                          setAcaoForm({
                            ...acaoForm,
                            valorPenalizacao: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Descrição da Penalização</label>
                    <textarea
                      rows="2"
                      required
                      placeholder="Ex: A peça foi entregue com 3 dias de atraso..."
                      value={acaoForm.descricaoPenalizacao}
                      onChange={(e) =>
                        setAcaoForm({
                          ...acaoForm,
                          descricaoPenalizacao: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setIsAcoesModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dark"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "A Processar..." : "Confirmar Ação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    irParaLanding();
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
