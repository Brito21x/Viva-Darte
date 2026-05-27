import React, { useState, useEffect } from "react";
import "./Figurinos.css";
import logoImg from "../../assets/logo.png";
import { API_URL, getAuthToken } from "../../services/api";

// Import do calendário
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function Figurinos({
  irParaLanding,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  const [utilizador, setUtilizador] = useState(null);
  const [pecasOriginais, setPecasOriginais] = useState([]);
  const [vendasOriginais, setVendasOriginais] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pedidosAtuais, setPedidosAtuais] = useState([]);
  const [reservaEmGestao, setReservaEmGestao] = useState(null);

  // Tabs e Filtros
  const [activeTab, setActiveTab] = useState("marketplace"); // 'marketplace' ou 'meus'
  const [pesquisa, setPesquisa] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroTipoMarket, setFiltroTipoMarket] = useState("Todos"); // 'Todos', 'Vendas', 'Emprestimos'
  const [ordenacao, setOrdenacao] = useState("recentes");

  const [indicesImagens, setIndicesImagens] = useState({});
  const [itemDetalhe, setItemDetalhe] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modais de Ação
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDisponibilizarModalOpen, setIsDisponibilizarModalOpen] =
    useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [isSolicitarEmprestimoModalOpen, setIsSolicitarEmprestimoModalOpen] =
    useState(false);
  const [isGerirEmprestimoModalOpen, setIsGerirEmprestimoModalOpen] =
    useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Forms States
  const [itemSelecionado, setItemSelecionado] = useState(null);

  const [novaPeca, setNovaPeca] = useState({
    nome: "",
    tamanho: "",
    condicao: "Novo",
    descricao: "",
    fotos: [],
    disponibilidade: "Nenhuma",
    preco: "",
    metodos_pagamento: ["MBWay"],
  });

  const [pecaEmEdicao, setPecaEmEdicao] = useState({
    id_peca: "",
    nome: "",
    tamanho: "",
    condicao: "",
    descricao: "",
    disponibilidade: "Nenhuma",
    preco: "",
    metodos_pagamento: [],
  });

  const [formDisponibilizar, setFormDisponibilizar] = useState({
    tipo: "Venda",
    preco: "",
    metodos_pagamento: ["MBWay"],
  });

  const [formCompra, setFormCompra] = useState({ metodoPagamento: "MBWay" });

  const [formEmprestimo, setFormEmprestimo] = useState({
    dataInicio: null,
    dataFim: null,
    metodoPagamento: "MBWay",
    observacoes: "",
  });

  const [acaoEmprestimoForm, setAcaoEmprestimoForm] = useState({
    tipoAcao: "Aprovar",
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

  const datasOcupadasTeste = React.useMemo(() => {
    let datas = [];
    pedidosAtuais.forEach((p) => {
      if (p.estado === "Aprovado" || p.estado === "Em Curso") {
        let atual = new Date(p.data_inicio);
        let fim = new Date(p.data_fim);
        while (atual <= fim) {
          datas.push(new Date(atual));
          atual.setDate(atual.getDate() + 1);
        }
      }
    });
    return datas;
  }, [pedidosAtuais]);

  const abrirSolicitarEmprestimo = async (e, item) => {
    e.stopPropagation();
    setItemSelecionado(item);
    setFormEmprestimo({
      ...formEmprestimo,
      dataInicio: null,
      dataFim: null,
      metodoPagamento: item.metodos[0] || "MBWay",
    });
    setIsSolicitarEmprestimoModalOpen(true);

    // Vai buscar as reservas desta peça para bloquear no calendário
    try {
      const res = await fetch(`${API_INV}/pecas/${item.id_peca}/emprestimos`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setPedidosAtuais(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const abrirGerirEmprestimo = async (e, item) => {
    e.stopPropagation();
    setItemSelecionado(item);
    setIsGerirEmprestimoModalOpen(true);

    // Vai buscar a lista de pedidos para gerir
    try {
      const res = await fetch(`${API_INV}/pecas/${item.id_peca}/emprestimos`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setPedidosAtuais(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const API_INV = `${API_URL}/api/inventario`;

  const getToken = () => getAuthToken() || "";
  const userId = utilizador?.id_utilizador || utilizador?.id;

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

  const handleLogout = () => {
    localStorage.clear();
    setUtilizador(null);
    if (irParaLanding) {
      irParaLanding();
    } else {
      window.location.reload();
    }
  };

  const parsearLocalizacao = (peca) => {
    if (!peca || typeof peca !== "object")
      return { valor_dia: "0", metodos: ["MBWay"] };

    // 1. Dar prioridade aos campos reais da Base de Dados (sempre atualizados após edições)
    if (peca.metodos_pagamento) {
      return {
        valor_dia: peca.valor_dia || "0",
        metodos:
          typeof peca.metodos_pagamento === "string"
            ? peca.metodos_pagamento.split(",").map((m) => m.trim())
            : ["MBWay"],
      };
    }

    // 2. Fallback (legado) para a string hardcoded no campo 'localizacao'
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
        return {
          valor_dia,
          metodos: metodosStr.split(",").map((m) => m.trim()),
        };
      } catch {
        return { valor_dia: "0", metodos: ["MBWay"] };
      }
    }

    return { valor_dia: "0", metodos: ["MBWay"] };
  };

  const carregarDados = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const [resPecas, resVendas] = await Promise.all([
        fetch(API_INV, { headers, cache: "no-store" }),
        fetch(`${API_INV}/vendas`, { headers, cache: "no-store" }),
      ]);

      let dPecas = resPecas.ok ? await resPecas.json() : [];
      let dVendas = resVendas.ok ? await resVendas.json() : [];

      setPecasOriginais((prevPecas) => {
        dPecas.forEach((np) => {
          const existing = prevPecas.find((p) => p.id_peca === np.id_peca);
          if (existing && existing.fotosCompletas) {
            np.fotos = existing.fotos;
            np.fotosCompletas = true;
          } else {
            np.fotos = np.foto_principal ? [np.foto_principal] : [];
            np.fotosCompletas = false;
            fetch(`${API_INV}/${np.id_peca}`, { headers })
              .then((r) => r.json())
              .then((det) => {
                setPecasOriginais((curr) =>
                  curr.map((cp) =>
                    cp.id_peca === np.id_peca
                      ? {
                          ...cp,
                          fotos: det.fotos?.length
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
        return dPecas;
      });

      setVendasOriginais(dVendas);
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Figurinos | Viva D'arte";
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) setUtilizador(JSON.parse(userGuardado));
    carregarDados(true);
  }, []);

  const buildMarketplaceItems = () => {
    let items = [];
    // Emprestimos
    pecasOriginais.forEach((p) => {
      // NÃO MOSTRAR AS MINHAS PRÓPRIAS PEÇAS NO MARKETPLACE COMUNITÁRIO
      if (p.UTILIZADORid_utilizador === userId) return;

      if (
        p.disponivel_para_emprestimo ||
        (p.localizacao && p.localizacao.includes("valor_dia:"))
      ) {
        const loc = parsearLocalizacao(p);
        items.push({
          unique_id: `emp_${p.id_peca}`,
          source: "Emprestimo",
          id_peca: p.id_peca,
          id_transacao: p.active_id_emprestimo,
          nome: p.nome_peca || p.nome,
          descricao: p.descricao,
          tamanho: p.tamanho,
          condicao: p.condicao_peca || p.estado,
          fotos: p.fotos || [],
          precoDisplay: parseFloat(loc.valor_dia || 0).toFixed(2),
          precoDisplayLabel: "/dia",
          vendedorDisplay:
            p.registado_por || p.vendedor || p.nome_utilizador || "Comunidade",
          vendedor_id: p.UTILIZADORid_utilizador,
          metodos: loc.metodos,
          estado: "Disponível",
          comprador_display: p.requisitante || p.emprestado_a,
          rawPeca: p,
        });
      }
    });

    // Vendas
    vendasOriginais.forEach((v) => {
      // NÃO MOSTRAR AS MINHAS PRÓPRIAS VENDAS NO MARKETPLACE COMUNITÁRIO
      const pecaBase = pecasOriginais.find((p) => p.id_peca === v.id_peca);
      if (pecaBase && pecaBase.UTILIZADORid_utilizador === userId) return;

      items.push({
        unique_id: `venda_${v.id_venda}`,
        source: "Venda",
        id_peca: v.id_peca,
        id_transacao: v.id_venda,
        nome: v.nome_peca,
        descricao: v.descricao,
        tamanho: v.tamanho,
        condicao: v.condicao_peca,
        fotos: v.fotos || [],
        precoDisplay: parseFloat(v.preco || 0).toFixed(2),
        precoDisplayLabel: "",
        vendedorDisplay: v.vendedor || "Comunidade",
        vendedor_id: pecaBase ? pecaBase.UTILIZADORid_utilizador : null,
        metodos: v.metodos_aceites ? v.metodos_aceites.split(",") : ["MBWay"],
        estado:
          v.estado_venda === "Concluída" || v.estado_venda === "Concluida"
            ? "Vendido"
            : "Disponível",
        comprador_display: v.comprador,
        rawVenda: v,
      });
    });
    return items;
  };

  const buildMeusItems = () => {
    if (!userId) return [];
    return pecasOriginais
      .filter((p) => p.UTILIZADORid_utilizador === userId)
      .map((p) => {
        const vendaAtiva = vendasOriginais.find(
          (v) =>
            v.id_peca === p.id_peca &&
            v.estado_venda !== "Concluída" &&
            v.estado_venda !== "Concluida",
        );
        const emprestimoAtivo =
          p.disponivel_para_emprestimo ||
          (p.localizacao && p.localizacao.includes("valor_dia:"));

        let estadoGlobal = "Guardado";
        let precoDisplay = "";

        if (vendaAtiva) {
          estadoGlobal = "À Venda";
          precoDisplay = `${parseFloat(vendaAtiva.preco).toFixed(2)}`;
        } else if (emprestimoAtivo) {
          estadoGlobal = "Para Empréstimo";
          const loc = parsearLocalizacao(p);
          precoDisplay = `${parseFloat(loc.valor_dia).toFixed(2)}`;
        }

        return {
          unique_id: `meu_${p.id_peca}`,
          source: "MeuItem",
          id_peca: p.id_peca,
          nome: p.nome_peca || p.nome,
          descricao: p.descricao,
          tamanho: p.tamanho,
          condicao: p.condicao_peca || p.estado,
          fotos: p.fotos || [],
          estadoGlobal,
          precoDisplay,
          vendaAtiva,
          emprestimoAtivo,
          rawPeca: p,
        };
      });
  };

  const itemsAtuais =
    activeTab === "marketplace" ? buildMarketplaceItems() : buildMeusItems();

  const itemsFiltrados = itemsAtuais
    .filter((i) =>
      (i.nome || "").toLowerCase().includes(pesquisa.toLowerCase()),
    )
    .filter((i) =>
      filtroEstado === "Todos" ? true : i.condicao === filtroEstado,
    )
    .filter((i) => {
      if (activeTab === "meus") return true;
      if (filtroTipoMarket === "Todos") return true;
      if (filtroTipoMarket === "Vendas") return i.source === "Venda";
      return i.source === "Emprestimo";
    })
    .sort((a, b) => {
      if (ordenacao === "preco_asc") {
        return (
          parseFloat(a.precoDisplay || 0) - parseFloat(b.precoDisplay || 0)
        );
      }
      if (ordenacao === "preco_desc") {
        return (
          parseFloat(b.precoDisplay || 0) - parseFloat(a.precoDisplay || 0)
        );
      }
      return (b.id_peca || 0) - (a.id_peca || 0);
    });

  // Handlers de Imagens
  const proximaImagem = (e, uid, total) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [uid]: ((prev[uid] || 0) + 1) % total,
    }));
  };
  const imagemAnterior = (e, uid, total) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [uid]: ((prev[uid] || 0) - 1 + total) % total,
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

  // Funções de API Principais
  const submitNovaPeca = async (e) => {
    e.preventDefault();
    if (!utilizador) return mostrarAlerta("Erro: Sessão inválida.");

    if (
      novaPeca.disponibilidade !== "Nenhuma" &&
      novaPeca.metodos_pagamento.length === 0
    ) {
      return mostrarAlerta(
        "Seleciona pelo menos um método de pagamento para disponibilizar a peça.",
      );
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(API_INV, {
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
          disponibilidade: novaPeca.disponibilidade,
          preco: novaPeca.preco,
          metodosPagamento: novaPeca.metodos_pagamento,
        }),
      });

      if (!res.ok) {
        mostrarAlerta(
          (await res.json()).mensagem || "Erro ao registar a peça.",
        );
        setIsSubmitting(false);
        return;
      }

      const dataPeca = await res.json();
      const idPeca = dataPeca.idPeca;

      if (novaPeca.disponibilidade === "Venda") {
        await fetch(`${API_INV}/vendas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            idPeca: idPeca,
            preco: parseFloat(novaPeca.preco),
            nomePeca: novaPeca.nome,
            condicaoPeca: novaPeca.condicao,
            metodosPagamento: novaPeca.metodos_pagamento,
          }),
        });
      } else if (novaPeca.disponibilidade === "Emprestimo") {
        await fetch(`${API_INV}/${idPeca}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            estado: novaPeca.condicao,
            disponivelEmprestimo: true,
            disponivelVenda: false,
            localizacao: null,
          }),
        });
      }

      mostrarAlerta("Peça adicionada ao teu inventário com sucesso!");
      setIsAddModalOpen(false);
      setNovaPeca({
        nome: "",
        tamanho: "",
        condicao: "Novo",
        descricao: "",
        fotos: [],
        disponibilidade: "Nenhuma",
        preco: "",
        metodos_pagamento: ["MBWay"],
      });
      carregarDados(false);
    } catch {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const apagarPeca = async (idPeca) => {
    fecharAlerta();
    try {
      const res = await fetch(`${API_INV}/${idPeca}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        mostrarAlerta("Removido com sucesso!");
        carregarDados(false);
      } else mostrarAlerta((await res.json()).mensagem || "Erro");
    } catch {
      mostrarAlerta("Erro");
    }
  };

  // Abrir o modal de edição com os dados mapeados
  const abrirEdicao = (e, item) => {
    e.stopPropagation();
    let metodosPre = [];

    if (item.emprestimoAtivo) {
      metodosPre = parsearLocalizacao(item.rawPeca).metodos;
    } else if (item.vendaAtiva && item.vendaAtiva.metodos_aceites) {
      metodosPre =
        typeof item.vendaAtiva.metodos_aceites === "string"
          ? item.vendaAtiva.metodos_aceites.split(",")
          : ["MBWay"];
    } else if (item.metodos && item.metodos.length > 0) {
      metodosPre = item.metodos;
    }

    let disp = "Nenhuma";
    if (item.estadoGlobal === "À Venda" || item.source === "Venda")
      disp = "Venda";
    else if (
      item.estadoGlobal === "Para Empréstimo" ||
      item.source === "Emprestimo"
    )
      disp = "Emprestimo";

    setPecaEmEdicao({
      id_peca: item.id_peca,
      nome: item.nome,
      tamanho: item.tamanho || "",
      condicao: item.condicao || "Novo",
      descricao: item.descricao || "",
      disponibilidade: disp,
      preco: item.precoDisplay ? parseFloat(item.precoDisplay) : "",
      metodos_pagamento: metodosPre,
    });
    setIsEditModalOpen(true);
  };

  // CORREÇÃO: ENVIO DO idUtilizador PARA EVITAR ERRO 500 NA BASE DE DADOS
  const handleGuardarEdicao = async (e) => {
    e.preventDefault();
    if (
      pecaEmEdicao.disponibilidade !== "Nenhuma" &&
      pecaEmEdicao.metodos_pagamento.length === 0
    ) {
      return mostrarAlerta("Seleciona pelo menos um método de pagamento.");
    }

    setIsSubmitting(true);
    try {
      const isVenda = pecaEmEdicao.disponibilidade === "Venda";
      const isEmp = pecaEmEdicao.disponibilidade === "Emprestimo";
      const precoNum = parseFloat(pecaEmEdicao.preco) || 0;

      const payload = {
        nome: pecaEmEdicao.nome,
        descricao: pecaEmEdicao.descricao,
        tamanho: pecaEmEdicao.tamanho,
        estado: pecaEmEdicao.condicao,
        disponivelVenda: isVenda,
        disponivelEmprestimo: isEmp,
        preco: isVenda ? precoNum : 0,
        valor_dia: isEmp ? precoNum : 0,
        metodosPagamento: pecaEmEdicao.metodos_pagamento,
        metodosStr: pecaEmEdicao.metodos_pagamento.join(","),
        metodosStrEmprestimo: pecaEmEdicao.metodos_pagamento.join(","),
        idUtilizador: userId,
      };

      const res = await fetch(
        `${API_URL}/api/inventario/${pecaEmEdicao.id_peca}/editar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        mostrarAlerta("Figurino editado com sucesso!");
        setIsEditModalOpen(false);

        // FORÇAR ATUALIZAÇÃO VISUAL:
        // 1. Limpar detalhes para forçar o fechamento do modal/view
        setItemDetalhe(null);
        // 2. Recarregar dados do servidor
        await carregarDados(true);
      } else {
        const err = await res.json();
        mostrarAlerta(err.mensagem || "Erro ao editar informações.");
      }
    } catch (err) {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmarCompra = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${API_INV}/vendas/${itemSelecionado.id_transacao}/concluir`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            idComprador: userId,
            metodoPagamento: formCompra.metodoPagamento,
          }),
        },
      );
      if (res.ok) {
        mostrarAlerta("Compra confirmada!");
        setIsCompraModalOpen(false);
        setItemDetalhe(null);
        carregarDados(false);
      } else mostrarAlerta((await res.json()).mensagem || "Erro");
    } catch {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmarEmprestimo = async (e) => {
    e.preventDefault();
    if (!formEmprestimo.dataInicio || !formEmprestimo.dataFim) {
      return mostrarAlerta(
        "Por favor seleciona as datas de início e fim no calendário.",
      );
    }
    if (formEmprestimo.dataFim <= formEmprestimo.dataInicio) {
      return mostrarAlerta("A data de fim deve ser depois da data de início.");
    }

    setIsSubmitting(true);
    try {
      const dInicioStr = formEmprestimo.dataInicio.toLocaleDateString("en-CA"); // Formata para YYYY-MM-DD
      const dFimStr = formEmprestimo.dataFim.toLocaleDateString("en-CA"); // Formata para YYYY-MM-DD

      const res = await fetch(`${API_INV}/emprestimos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          dataInicio: dInicioStr,
          dataFim: dFimStr,
          metodoPagamento: formEmprestimo.metodoPagamento,
          observacoes: formEmprestimo.observacoes,
          itens: [
            {
              idPeca: itemSelecionado.id_peca,
              estadoEntrega: itemSelecionado.condicao,
            },
          ],
        }),
      });
      if (res.ok) {
        mostrarAlerta(
          "Pedido de empréstimo enviado! Aguarda a confirmação do dono.",
        );
        setIsSolicitarEmprestimoModalOpen(false);
        setItemDetalhe(null);
        carregarDados(false);
      } else {
        mostrarAlerta(
          (await res.json()).mensagem || "Erro ao solicitar empréstimo.",
        );
      }
    } catch {
      mostrarAlerta("Erro de rede ao solicitar empréstimo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const gerirEstadoReserva = async (idEmprestimo, novoEstado) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_INV}/emprestimos/${idEmprestimo}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ status: novoEstado }),
      });

      if (res.ok) {
        mostrarAlerta(`Reserva ${novoEstado.toLowerCase()} com sucesso!`);

        // Atualiza a lista dentro do modal instantaneamente
        const resRefresh = await fetch(
          `${API_INV}/pecas/${itemSelecionado.id_peca}/emprestimos`,
          {
            headers: { Authorization: `Bearer ${getToken()}` },
          },
        );
        if (resRefresh.ok) setPedidosAtuais(await resRefresh.json());

        carregarDados(false); // Atualiza o catálogo por trás
      } else {
        mostrarAlerta(
          (await res.json()).mensagem || "Erro ao atualizar a reserva.",
        );
      }
    } catch {
      mostrarAlerta("Erro de rede ao comunicar com o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitGerirEmprestimo = async (e) => {
    e.preventDefault();
    const idEmp = reservaEmGestao;
    if (!idEmp) return mostrarAlerta("Empréstimo não selecionado.");

    setIsSubmitting(true);
    try {
      let endpoint = "";
      let payload = {};
      let methodType = "PUT";

      if (acaoEmprestimoForm.tipoAcao === "Pagamento") {
        endpoint = `${API_INV}/emprestimos/${idEmp}/pagamento`;
        payload = {
          valor: parseFloat(acaoEmprestimoForm.valorPagamento),
          metodoPagamento: acaoEmprestimoForm.metodoPagamento,
          estadoPagamento: acaoEmprestimoForm.estadoPagamento || "Pago",
        };
      } else if (acaoEmprestimoForm.tipoAcao === "Devolucao") {
        endpoint = `${API_INV}/emprestimos/${idEmp}/devolucao`;
        payload = {
          estadoFinal: acaoEmprestimoForm.estadoFinalDevolucao,
          observacoes: acaoEmprestimoForm.observacoesDevolucao,
          itens: [
            {
              idPeca: itemSelecionado.id_peca,
              estadoDevolucao: acaoEmprestimoForm.estadoPecaDevolucao,
            },
          ],
        };
      } else if (acaoEmprestimoForm.tipoAcao === "Penalizacao") {
        endpoint = `${API_INV}/emprestimos/${idEmp}/penalizacoes`;
        methodType = "POST";
        payload = {
          idPeca: itemSelecionado.id_peca,
          tipo: acaoEmprestimoForm.tipoPenalizacao,
          valor: parseFloat(acaoEmprestimoForm.valorPenalizacao),
          descricao: acaoEmprestimoForm.descricaoPenalizacao,
        };
      }

      const res = await fetch(endpoint, {
        method: methodType,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        mostrarAlerta("Ação registada com sucesso!");
        setReservaEmGestao(null); // Fecha o formulário

        // Atualiza a lista de pedidos no modal
        const resRefresh = await fetch(
          `${API_INV}/pecas/${itemSelecionado.id_peca}/emprestimos`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        if (resRefresh.ok) setPedidosAtuais(await resRefresh.json());

        carregarDados(false);
      } else {
        mostrarAlerta((await res.json()).mensagem || "Erro ao processar ação.");
      }
    } catch {
      mostrarAlerta("Erro de rede.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation Lightbox / Detalhe
  useEffect(() => {
    const hk = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (isLightboxOpen && itemDetalhe) {
        const tot = itemDetalhe.fotos?.length || 0;
        if (tot > 1) {
          if (e.key === "ArrowRight")
            proximaImagem(e, itemDetalhe.unique_id, tot);
          if (e.key === "ArrowLeft")
            imagemAnterior(e, itemDetalhe.unique_id, tot);
        }
        if (e.key === "Escape") setIsLightboxOpen(false);
      } else if (
        itemDetalhe &&
        !isLightboxOpen &&
        !isCompraModalOpen &&
        !isSolicitarEmprestimoModalOpen &&
        !isDisponibilizarModalOpen &&
        !isAddModalOpen &&
        !isEditModalOpen
      ) {
        if (e.key === "Escape") setItemDetalhe(null);
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const idx = itemsFiltrados.findIndex(
            (i) => i.unique_id === itemDetalhe.unique_id,
          );
          let n = e.key === "ArrowRight" ? idx + 1 : idx - 1;
          if (n < 0) n = itemsFiltrados.length - 1;
          if (n >= itemsFiltrados.length) n = 0;
          setItemDetalhe(itemsFiltrados[n]);
        }
      }
    };
    window.addEventListener("keydown", hk);
    return () => window.removeEventListener("keydown", hk);
  }, [itemDetalhe, isLightboxOpen, itemsFiltrados, isEditModalOpen]);

  return (
    <div className="figurinos-page">
      <nav className="navbar interna">
        <div className="nav-brand" onClick={irParaLanding}>
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
              Marketplace
            </a>
          </li>
        </ul>
        <div className="nav-actions">
          {utilizador ? (
            <div className="user-profile">
              <span className="welcome-text">
                Olá, <strong>{utilizador?.nome}</strong>
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

      <div className="content-wrapper">
        <div className="header-section">
          <div>
            <h1 className="page-title">Marketplace de Figurinos</h1>
            <p className="page-subtitle">
              Compra, partilha ou aluga peças e figurinos da nossa comunidade.
            </p>
          </div>
          {utilizador && activeTab === "meus" && (
            <button
              className="btn-add-peca"
              onClick={() => {
                setNovaPeca({
                  nome: "",
                  tamanho: "",
                  condicao: "Novo",
                  descricao: "",
                  fotos: [],
                  disponibilidade: "Nenhuma",
                  preco: "",
                  metodos_pagamento: ["MBWay"],
                });
                setIsAddModalOpen(true);
              }}
            >
              + Novo Figurino no Inventário Digital
            </button>
          )}
        </div>

        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === "marketplace" ? "active" : ""}`}
            onClick={() => setActiveTab("marketplace")}
          >
            Marketplace Comunitário
          </button>
          {utilizador && (
            <button
              className={`tab-btn ${activeTab === "meus" ? "active" : ""}`}
              onClick={() => setActiveTab("meus")}
            >
              Os Meus Figurinos
            </button>
          )}
        </div>

        {!isLoading && (
          <div
            style={{
              display: "flex",
              gap: "15px",
              marginBottom: "25px",
              flexWrap: "wrap",
            }}
          >
            {/* ESTES FILTROS SÓ APARECEM NO MARKETPLACE */}
            {activeTab === "marketplace" && (
              <>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.12)",
                  }}
                />

                <select
                  value={filtroTipoMarket}
                  onChange={(e) => setFiltroTipoMarket(e.target.value)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "#fff",
                  }}
                >
                  <option value="Todos">Todas as Transações</option>
                  <option value="Vendas">Apenas Vendas</option>
                  <option value="Emprestimos">Apenas Empréstimos</option>
                </select>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "#fff",
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
                    background: "#fff",
                  }}
                >
                  <option value="recentes">Mais Recentes</option>
                  <option value="preco_asc">Preço: Mais Barato</option>
                  <option value="preco_desc">Preço: Mais Caro</option>
                </select>
              </>
            )}
          </div>
        )}

        <div className="items-grid">
          {isLoading ? (
            <div className="empty-state-container">A sincronizar...</div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="empty-state-container">
              Nenhum item encontrado nesta secção.
            </div>
          ) : (
            itemsFiltrados.map((item) => {
              const idxImg = indicesImagens[item.unique_id] || 0;
              const tot = item.fotos?.length || 0;
              const isIndisponivel =
                item.estado === "Vendido" || item.estado === "Indisponível";
              const eMeu = activeTab === "meus" || userId === item.vendedor_id;

              return (
                <div
                  key={item.unique_id}
                  className={`item-card ${isIndisponivel ? "indisponivel" : ""}`}
                  onClick={() => setItemDetalhe(item)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="item-image-container"
                    style={
                      tot > 0
                        ? { backgroundImage: `url(${item.fotos[idxImg]})` }
                        : { backgroundColor: "#dcd7ce" }
                    }
                  >
                    {activeTab === "marketplace" ? (
                      <>
                        <span
                          className={`tipo-badge ${item.source === "Venda" ? "venda" : "emprestimo"}`}
                        >
                          {item.source}
                        </span>
                        <span
                          className={`status-badge ${isIndisponivel ? "vendido" : "disponivel"}`}
                        >
                          {isIndisponivel
                            ? item.source === "Venda"
                              ? "Vendido"
                              : "Emprestado"
                            : "Disponível"}
                        </span>
                      </>
                    ) : (
                      <span
                        className={`status-badge ${item.estadoGlobal === "Guardado" ? "meu-guardado" : "disponivel"}`}
                      >
                        {item.estadoGlobal}
                      </span>
                    )}

                    {tot > 1 && (
                      <>
                        <button
                          className="img-nav-btn left"
                          onClick={(e) =>
                            imagemAnterior(e, item.unique_id, tot)
                          }
                        >
                          ‹
                        </button>
                        <button
                          className="img-nav-btn right"
                          onClick={(e) => proximaImagem(e, item.unique_id, tot)}
                        >
                          ›
                        </button>
                        <div className="img-dots">
                          {item.fotos.map((_, i) => (
                            <span
                              key={i}
                              className={`dot ${i === idxImg ? "active" : ""}`}
                            ></span>
                          ))}
                        </div>
                      </>
                    )}

                    {eMeu && activeTab === "meus" && (
                      <div className="owner-actions">
                        <button
                          className="action-btn edit-btn"
                          title="Editar Peça"
                          onClick={(e) => abrirEdicao(e, item)}
                        >
                          ✎
                        </button>
                        <button
                          className="action-btn delete-btn"
                          title="Apagar"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomAlert({
                              show: true,
                              message:
                                "Eliminar definitivamente esta peça do teu inventário?",
                              type: "confirm",
                              onConfirm: () => apagarPeca(item.id_peca),
                            });
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="item-content">
                    <h3 className="item-nome">{item.nome}</h3>
                    <div className="item-tags">
                      <span>{item.condicao}</span>
                      {item.tamanho && (
                        <span className="tam-tag">Tam: {item.tamanho}</span>
                      )}
                    </div>
                    <p className="item-descricao">{item.descricao}</p>

                    {activeTab === "marketplace" && (
                      <p className="item-owner">Por: {item.vendedorDisplay}</p>
                    )}

                    {item.metodos && item.metodos.length > 0 && (
                      <div className="item-pagamentos">
                        {item.metodos.map((m) => (
                          <span key={m} className="tag-pagamento">
                            {m}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="item-footer">
                      {item.precoDisplay && item.estadoGlobal !== "Guardado" ? (
                        <span className="preco">
                          {item.precoDisplay}€{" "}
                          <small>{item.precoDisplayLabel}</small>
                        </span>
                      ) : (
                        <span style={{ color: "transparent" }}>_</span>
                      )}

                      {activeTab === "meus" ? (
                        item.estadoGlobal === "Guardado" ? (
                          <span className="texto-teu-item">
                            Apenas Guardado
                          </span>
                        ) : item.estadoGlobal === "Para Empréstimo" ? (
                          <button
                            className="btn-dark btn-sm"
                            onClick={(e) => abrirGerirEmprestimo(e, item)}
                          >
                            Gerir Reservas
                          </button>
                        ) : (
                          <span className="texto-teu-item">
                            Visível no Marketplace
                          </span>
                        )
                      ) : isIndisponivel ? (
                        <span className="texto-indisponivel">
                          {item.source === "Venda"
                            ? `Vendido a ${item.comprador_display || ""}`
                            : `Emprestado a ${item.comprador_display || ""}`}
                        </span>
                      ) : eMeu ? (
                        <span className="texto-teu-item">O teu item</span>
                      ) : (
                        <button
                          className="btn-outline btn-sm"
                          disabled={!utilizador}
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemSelecionado(item);
                            if (item.source === "Venda") {
                              setFormCompra({
                                metodoPagamento: item.metodos[0] || "MBWay",
                              });
                              setIsCompraModalOpen(true);
                            } else {
                              setFormEmprestimo({
                                ...formEmprestimo,
                                dataInicio: null,
                                dataFim: null,
                                metodoPagamento: item.metodos[0] || "MBWay",
                              });
                              setIsSolicitarEmprestimoModalOpen(true);
                            }
                          }}
                        >
                          {item.source === "Venda"
                            ? "Comprar Figurino"
                            : "Solicitar Empréstimo"}{" "}
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

      {/* --- HUD DE DETALHES --- */}
      {itemDetalhe &&
        (() => {
          const idx = indicesImagens[itemDetalhe.unique_id] || 0;
          const tot = itemDetalhe.fotos?.length || 0;
          const nav = (dir) => {
            const c = itemsFiltrados.findIndex(
              (i) => i.unique_id === itemDetalhe.unique_id,
            );
            if (c === -1) return;
            let n = c + dir;
            if (n < 0) n = itemsFiltrados.length - 1;
            if (n >= itemsFiltrados.length) n = 0;
            setItemDetalhe(itemsFiltrados[n]);
          };
          const indisp =
            itemDetalhe.estado === "Vendido" ||
            itemDetalhe.estado === "Indisponível";

          return (
            <div
              className="modal-overlay"
              onClick={() => setItemDetalhe(null)}
              style={{ zIndex: 2005, background: "rgba(21,19,17,0.92)" }}
            >
              {itemsFiltrados.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nav(-1);
                    }}
                    style={{
                      position: "absolute",
                      left: "20px",
                      background: "rgba(238,234,226,0.9)",
                      border: "none",
                      borderRadius: "50%",
                      width: "45px",
                      height: "45px",
                      fontSize: "1.8rem",
                      cursor: "pointer",
                      zIndex: 2006,
                    }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      nav(1);
                    }}
                    style={{
                      position: "absolute",
                      right: "20px",
                      background: "rgba(238,234,226,0.9)",
                      border: "none",
                      borderRadius: "50%",
                      width: "45px",
                      height: "45px",
                      fontSize: "1.8rem",
                      cursor: "pointer",
                      zIndex: 2006,
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "900px",
                  width: "90%",
                  maxHeight: "85vh",
                  padding: 0,
                  display: "flex",
                  flexDirection: "row",
                  overflow: "hidden",
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
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "20px",
                    }}
                  >
                    {tot > 0 ? (
                      <img
                        src={itemDetalhe.fotos[idx]}
                        alt="Item"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                          cursor: "zoom-in",
                        }}
                        onClick={() => setIsLightboxOpen(true)}
                      />
                    ) : (
                      <span>Sem Imagem</span>
                    )}
                  </div>
                  {tot > 1 && (
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        padding: "15px",
                        backgroundColor: "rgba(0,0,0,0.04)",
                        overflowX: "auto",
                        justifyContent: "center",
                      }}
                    >
                      {itemDetalhe.fotos.map((f, i) => (
                        <img
                          key={i}
                          src={f}
                          style={{
                            width: "65px",
                            height: "65px",
                            objectFit: "cover",
                            cursor: "pointer",
                            borderRadius: "8px",
                            border:
                              i === idx
                                ? "3px solid #ab855a"
                                : "2px solid transparent",
                            opacity: i === idx ? 1 : 0.6,
                          }}
                          onClick={() =>
                            setIndicesImagens((p) => ({
                              ...p,
                              [itemDetalhe.unique_id]: i,
                            }))
                          }
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
                          padding: "6px 14px",
                          borderRadius: "20px",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: indisp ? "#2a2724" : "#ab855a",
                          color: "#fff",
                        }}
                      >
                        {activeTab === "meus"
                          ? itemDetalhe.estadoGlobal
                          : indisp
                            ? itemDetalhe.estado
                            : `Disponível para ${itemDetalhe.source}`}
                      </span>
                      <button
                        onClick={() => setItemDetalhe(null)}
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
                      {itemDetalhe.nome}
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
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#8a8480",
                            textTransform: "uppercase",
                            fontWeight: 700,
                            display: "block",
                            margin: "0 0 4px 0",
                          }}
                        >
                          Estado
                        </span>
                        <strong style={{ fontSize: "0.9rem" }}>
                          {itemDetalhe.condicao}
                        </strong>
                      </div>
                      {itemDetalhe.tamanho && (
                        <div
                          style={{
                            background: "#dfdbd2",
                            padding: "10px 15px",
                            borderRadius: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#8a8480",
                              textTransform: "uppercase",
                              fontWeight: 700,
                              display: "block",
                              margin: "0 0 4px 0",
                            }}
                          >
                            Tamanho
                          </span>
                          <strong style={{ fontSize: "0.9rem" }}>
                            {itemDetalhe.tamanho}
                          </strong>
                        </div>
                      )}
                    </div>
                    <p
                      style={{
                        color: "#5a5450",
                        lineHeight: "1.6",
                        marginBottom: "30px",
                      }}
                    >
                      {itemDetalhe.descricao}
                    </p>

                    {activeTab === "marketplace" && (
                      <div style={{ marginBottom: "30px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#8a8480",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          Fornecido por
                        </span>
                        <p
                          style={{
                            color: "#b38b59",
                            fontWeight: "600",
                            margin: "4px 0 15px 0",
                            fontSize: "1.1rem",
                          }}
                        >
                          {itemDetalhe.vendedorDisplay}
                        </p>
                      </div>
                    )}
                  </div>

                  {itemDetalhe.precoDisplay && (
                    <div
                      style={{
                        borderTop: "1px solid #dcd7ce",
                        paddingTop: "30px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "#8a8480",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}
                        >
                          Preço
                        </span>
                        <div
                          style={{
                            fontSize: "2.2rem",
                            fontWeight: "800",
                            color: "#2a2724",
                          }}
                        >
                          {itemDetalhe.precoDisplay}€
                          <small
                            style={{ fontSize: "0.9rem", color: "#8a8480" }}
                          >
                            {itemDetalhe.precoDisplayLabel}
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === "marketplace" &&
                    userId !== itemDetalhe.vendedor_id && (
                      // Contentor simplificado que alinha os botões à direita, mantendo o seu tamanho natural
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginTop: "20px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          className="btn-dark" // Voltamos a usar apenas a classe CSS padrão, mantendo a lógica inteligente
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemSelecionado(itemDetalhe);

                            if (itemDetalhe.source === "Venda") {
                              setFormCompra({
                                metodoPagamento:
                                  itemDetalhe.metodos[0] || "MBWay",
                              });
                              setIsCompraModalOpen(true);
                            } else {
                              setFormEmprestimo({
                                ...formEmprestimo,
                                dataInicio: null,
                                dataFim: null,
                                metodoPagamento:
                                  itemDetalhe.metodos[0] || "MBWay",
                              });
                              setIsSolicitarEmprestimoModalOpen(true);
                            }
                          }}
                        >
                          {itemDetalhe.source === "Venda"
                            ? "Comprar Figurino"
                            : "Solicitar Empréstimo"}
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* --- MODAIS DE FORMS --- */}
      {isAddModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-modal">
            <h2>Adicionar ao Inventário Digital</h2>
            <form onSubmit={submitNovaPeca}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tutu Azul, Sapatilhas de Ponta..."
                  value={novaPeca.nome}
                  onChange={(e) =>
                    setNovaPeca({ ...novaPeca, nome: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: M, 38, Único"
                    value={novaPeca.tamanho}
                    onChange={(e) =>
                      setNovaPeca({ ...novaPeca, tamanho: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select
                    value={novaPeca.condicao}
                    onChange={(e) =>
                      setNovaPeca({ ...novaPeca, condicao: e.target.value })
                    }
                  >
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Usado">Usado</option>
                    <option value="Danificado">Danificado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  required
                  rows="2"
                  maxLength="250"
                  placeholder="Descreve o material, detalhes ou marcas de uso... (Máx: 250 caracteres)"
                  value={novaPeca.descricao}
                  onChange={(e) =>
                    setNovaPeca({ ...novaPeca, descricao: e.target.value })
                  }
                ></textarea>
              </div>

              <div className="form-group">
                <label>O que pretendes fazer com o figurino?</label>
                <select
                  value={novaPeca.disponibilidade}
                  onChange={(e) =>
                    setNovaPeca({
                      ...novaPeca,
                      disponibilidade: e.target.value,
                    })
                  }
                >
                  <option value="Nenhuma">
                    Apenas guardar no Inventário Digital
                  </option>
                  <option value="Venda">Colocar à Venda</option>
                  <option value="Emprestimo">
                    Disponibilizar para Empréstimo
                  </option>
                </select>
              </div>

              {novaPeca.disponibilidade !== "Nenhuma" && (
                <>
                  <div className="form-group">
                    <label>
                      {novaPeca.disponibilidade === "Venda"
                        ? "Preço Fixo (€)"
                        : "Preço por Dia (€)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="Ex: 15.00"
                      value={novaPeca.preco}
                      onChange={(e) =>
                        setNovaPeca({ ...novaPeca, preco: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Métodos de Pagamento</label>
                    <div className="checkbox-group">
                      {["MBWay", "Transferência", "Numerário"].map((m) => (
                        <label className="checkbox-label" key={m}>
                          <input
                            type="checkbox"
                            checked={novaPeca.metodos_pagamento.includes(m)}
                            onChange={() => {
                              const arr = novaPeca.metodos_pagamento;
                              setNovaPeca({
                                ...novaPeca,
                                metodos_pagamento: arr.includes(m)
                                  ? arr.filter((x) => x !== m)
                                  : [...arr, m],
                              });
                            }}
                          />{" "}
                          {m}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Fotos (Máx 4)</label>
                <div className="fotos-preview-container">
                  {novaPeca.fotos.map((f, i) => (
                    <div className="foto-preview-box" key={i}>
                      <img src={f} />
                      <button
                        type="button"
                        className="btn-remover-foto"
                        onClick={() => removerFoto(i)}
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
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dark"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "A Guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL EDITAR PEÇA --- */}
      {isEditModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div className="modal-content form-modal">
            <h2>Editar Peça</h2>
            <form onSubmit={handleGuardarEdicao}>
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  required
                  value={pecaEmEdicao.nome}
                  onChange={(e) =>
                    setPecaEmEdicao({ ...pecaEmEdicao, nome: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Tamanho</label>
                  <input
                    type="text"
                    required
                    value={pecaEmEdicao.tamanho}
                    onChange={(e) =>
                      setPecaEmEdicao({
                        ...pecaEmEdicao,
                        tamanho: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Condição</label>
                  <select
                    value={pecaEmEdicao.condicao}
                    onChange={(e) =>
                      setPecaEmEdicao({
                        ...pecaEmEdicao,
                        condicao: e.target.value,
                      })
                    }
                  >
                    <option value="Novo">Novo</option>
                    <option value="Bom">Bom</option>
                    <option value="Usado">Usado</option>
                    <option value="Danificado">Danificado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea
                  required
                  rows="2"
                  value={pecaEmEdicao.descricao}
                  onChange={(e) =>
                    setPecaEmEdicao({
                      ...pecaEmEdicao,
                      descricao: e.target.value,
                    })
                  }
                ></textarea>
              </div>

              <div className="form-group">
                <label>Alterar Disponibilidade</label>
                <select
                  value={pecaEmEdicao.disponibilidade}
                  onChange={(e) =>
                    setPecaEmEdicao({
                      ...pecaEmEdicao,
                      disponibilidade: e.target.value,
                    })
                  }
                >
                  <option value="Nenhuma">
                    Ocultar (Apenas no Inventário)
                  </option>
                  <option value="Venda">Colocar à Venda</option>
                  <option value="Emprestimo">Para Empréstimo</option>
                </select>
              </div>

              {pecaEmEdicao.disponibilidade !== "Nenhuma" && (
                <>
                  <div className="form-group">
                    <label>
                      {pecaEmEdicao.disponibilidade === "Venda"
                        ? "Preço (€)"
                        : "Preço por Dia (€)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={pecaEmEdicao.preco}
                      onChange={(e) =>
                        setPecaEmEdicao({
                          ...pecaEmEdicao,
                          preco: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Métodos de Pagamento</label>
                    <div className="checkbox-group">
                      {["MBWay", "Transferência", "Numerário"].map((m) => (
                        <label className="checkbox-label" key={m}>
                          <input
                            type="checkbox"
                            checked={pecaEmEdicao.metodos_pagamento.includes(m)}
                            onChange={() => {
                              const arr = pecaEmEdicao.metodos_pagamento;
                              setPecaEmEdicao({
                                ...pecaEmEdicao,
                                metodos_pagamento: arr.includes(m)
                                  ? arr.filter((x) => x !== m)
                                  : [...arr, m],
                              });
                            }}
                          />{" "}
                          {m}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dark"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "A Guardar..." : "Guardar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIRMAR COMPRA --- */}
      {isCompraModalOpen && itemSelecionado && (
        <div className="modal-overlay" style={{ zIndex: 2010 }}>
          <div
            className="modal-content"
            style={{ maxWidth: "400px", padding: "35px" }}
          >
            <h2 style={{ marginBottom: "10px" }}>Confirmar Compra</h2>
            <div className="resumo-compra">
              <p>
                <strong>Total:</strong> {itemSelecionado.precoDisplay}€{" "}
                {itemSelecionado.precoDisplayLabel}
              </p>
            </div>
            <form onSubmit={confirmarCompra}>
              <div className="form-group">
                <label>Método de Pagamento</label>
                <select
                  value={formCompra.metodoPagamento}
                  onChange={(e) =>
                    setFormCompra({
                      ...formCompra,
                      metodoPagamento: e.target.value,
                    })
                  }
                  required
                >
                  {itemSelecionado.metodos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
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
                  Comprar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL SOLICITAR EMPRÉSTIMO --- */}
      {isSolicitarEmprestimoModalOpen &&
        itemSelecionado &&
        (() => {
          // Cálculo matemático de dias
          let diffDays = 0;
          if (formEmprestimo.dataInicio && formEmprestimo.dataFim) {
            const diffTime = Math.abs(
              formEmprestimo.dataFim - formEmprestimo.dataInicio,
            );
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          } else if (formEmprestimo.dataInicio) {
            diffDays = 1;
          }

          // Cálculo do valor
          const precoPorDia = parseFloat(itemSelecionado.precoDisplay) || 0;
          const estimatedPrice = (precoPorDia * diffDays).toFixed(2);

          return (
            <div className="modal-overlay" style={{ zIndex: 2010 }}>
              <div
                className="modal-content"
                style={{ maxWidth: "450px", padding: "35px" }}
              >
                <h2 style={{ marginBottom: "10px" }}>Solicitar Empréstimo</h2>

                {/* Novo Cartão de Resumo Dinâmico */}
                <div className="resumo-compra">
                  <p>
                    <strong>Preço Base:</strong> {itemSelecionado.precoDisplay}€{" "}
                    {itemSelecionado.precoDisplayLabel}
                  </p>
                  {diffDays > 0 && (
                    <div
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid rgba(0,0,0,0.1)",
                      }}
                    >
                      <p style={{ margin: "0 0 5px 0" }}>
                        <strong>Dias Selecionados:</strong> {diffDays}{" "}
                        {diffDays === 1 ? "dia" : "dias"}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong>Total Estimado:</strong> {estimatedPrice}€
                      </p>
                    </div>
                  )}
                </div>

                <form onSubmit={confirmarEmprestimo}>
                  <div className="form-row">
                    <div className="form-group" style={{ zIndex: 100 }}>
                      <label>Data de Início</label>
                      <DatePicker
                        selected={formEmprestimo.dataInicio}
                        onChange={(date) =>
                          setFormEmprestimo({
                            ...formEmprestimo,
                            dataInicio: date,
                          })
                        }
                        selectsStart
                        startDate={formEmprestimo.dataInicio}
                        endDate={formEmprestimo.dataFim}
                        minDate={new Date()}
                        excludeDates={datasOcupadasTeste}
                        highlightDates={[
                          {
                            "react-datepicker__day--highlighted-ocupado":
                              datasOcupadasTeste,
                          },
                        ]}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Escolher Início"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ zIndex: 100 }}>
                      <label>Data de Fim</label>
                      <DatePicker
                        selected={formEmprestimo.dataFim}
                        onChange={(date) =>
                          setFormEmprestimo({
                            ...formEmprestimo,
                            dataFim: date,
                          })
                        }
                        selectsEnd
                        startDate={formEmprestimo.dataInicio}
                        endDate={formEmprestimo.dataFim}
                        minDate={formEmprestimo.dataInicio || new Date()}
                        excludeDates={datasOcupadasTeste}
                        highlightDates={[
                          {
                            "react-datepicker__day--highlighted-ocupado":
                              datasOcupadasTeste,
                          },
                        ]}
                        dateFormat="dd/MM/yyyy"
                        placeholderText="Escolher Fim"
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Pagamento</label>
                    <select
                      value={formEmprestimo.metodoPagamento}
                      onChange={(e) =>
                        setFormEmprestimo({
                          ...formEmprestimo,
                          metodoPagamento: e.target.value,
                        })
                      }
                      required
                    >
                      {itemSelecionado.metodos.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    style={{ display: "flex", gap: "10px", marginTop: "20px" }}
                  >
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setIsSolicitarEmprestimoModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-dark"
                      style={{ flex: 1.5 }}
                      disabled={isSubmitting}
                    >
                      Confirmar Pedido
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

      {/* --- NOVO MODAL GERIR PEDIDOS DE EMPRÉSTIMO --- */}
      {isGerirEmprestimoModalOpen && itemSelecionado && (
        <div className="modal-overlay" style={{ zIndex: 2002 }}>
          <div
            className="modal-content form-modal"
            style={{ maxWidth: "650px", padding: "35px" }}
          >
            {/* Header do Modal Limpo */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "30px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 5px 0",
                    fontSize: "1.6rem",
                    color: "#2a2724",
                  }}
                >
                  Gerir Reservas
                </h2>
                <span
                  style={{
                    fontSize: "1.05rem",
                    color: "#8a8480",
                    fontWeight: "500",
                  }}
                >
                  Figurino: {itemSelecionado.nome}
                </span>
              </div>
              <button
                onClick={() => setIsGerirEmprestimoModalOpen(false)}
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

            <div
              style={{
                maxHeight: "60vh",
                overflowY: "auto",
                paddingRight: "10px",
              }}
            >
              {pedidosAtuais.length > 0 ? (
                pedidosAtuais.map((pedido) => {
                  const isPendente = pedido.estado === "Pendente";
                  const isAprovado =
                    pedido.estado === "Aprovado" ||
                    pedido.estado === "Em Curso";

                  // Cálculo de dias para a interface
                  const d1 = new Date(pedido.data_inicio);
                  const d2 = new Date(pedido.data_fim);
                  const diffTime = Math.abs(d2 - d1);
                  const diffDays =
                    Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <div key={pedido.id} className="reserva-card">
                      <div className="reserva-header">
                        <div className="reserva-user">
                          <span className="user-name">
                            {pedido.requisitante}
                          </span>
                        </div>
                        <span
                          className={`reserva-badge ${isPendente ? "badge-pendente" : isAprovado ? "badge-aprovado" : "badge-default"}`}
                        >
                          {pedido.estado}
                        </span>
                      </div>

                      <div className="reserva-body">
                        {/* Datas e dias */}
                        <div className="reserva-detail">
                          <div className="detail-text">
                            <span className="detail-label">
                              Período de Empréstimo ({diffDays}{" "}
                              {diffDays === 1 ? "dia" : "dias"})
                            </span>
                            <span className="detail-value">
                              {d1.toLocaleDateString("pt-PT")} até{" "}
                              {d2.toLocaleDateString("pt-PT")}
                            </span>
                          </div>
                        </div>

                        {/* Informações de pagamento do requisitante */}
                        <div
                          className="reserva-detail"
                          style={{ marginTop: "12px" }}
                        >
                          <div className="detail-text">
                            <span className="detail-label">
                              Informação de Pagamento
                            </span>
                            <span
                              className="detail-value"
                              style={{ display: "block", marginTop: "2px" }}
                            >
                              Método selecionado:{" "}
                              <strong>
                                {pedido.metodo_pagamento || "Não especificado"}
                              </strong>
                            </span>
                            <span
                              className="detail-value"
                              style={{ display: "block", marginTop: "2px" }}
                            >
                              Total a cobrar:{" "}
                              <strong>
                                {(
                                  parseFloat(pedido.valor || 0) * diffDays
                                ).toFixed(2)}
                                €
                              </strong>{" "}
                              ({parseFloat(pedido.valor || 0).toFixed(2)}€/dia)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botões só aparecem se estiver pendente */}
                      {isPendente && (
                        <div className="reserva-actions">
                          <button
                            className="btn-rejeitar-reserva"
                            onClick={() =>
                              gerirEstadoReserva(pedido.id, "Rejeitado")
                            }
                            disabled={isSubmitting}
                          >
                            Rejeitar
                          </button>
                          <button
                            className="btn-aprovar-reserva"
                            onClick={() =>
                              gerirEstadoReserva(pedido.id, "Aprovado")
                            }
                            disabled={isSubmitting}
                          >
                            Aprovar Reserva
                          </button>
                        </div>
                      )}

                      {/* Botão para reservas Aprovadas / Em Curso */}
                      {isAprovado && reservaEmGestao !== pedido.id && (
                        <div className="reserva-actions">
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => {
                              setReservaEmGestao(pedido.id);
                              setAcaoEmprestimoForm({
                                ...acaoEmprestimoForm,
                                tipoAcao: "Pagamento",
                              });
                            }}
                          >
                            ⚙️ Gerir Empréstimo
                          </button>
                        </div>
                      )}

                      {/* Formulário de Gestão Embutido para a Reserva Selecionada */}
                      {reservaEmGestao === pedido.id && (
                        <div
                          style={{
                            marginTop: "20px",
                            paddingTop: "20px",
                            borderTop: "1px dashed #e0dcd2",
                          }}
                        >
                          <form onSubmit={submitGerirEmprestimo}>
                            <div className="form-group">
                              <label>Ação a Realizar</label>
                              <select
                                value={acaoEmprestimoForm.tipoAcao}
                                onChange={(e) =>
                                  setAcaoEmprestimoForm({
                                    ...acaoEmprestimoForm,
                                    tipoAcao: e.target.value,
                                  })
                                }
                              >
                                <option value="Pagamento">
                                  Registar Pagamento Recebido
                                </option>
                                <option value="Devolucao">
                                  Registar Devolução da Peça
                                </option>
                                <option value="Penalizacao">
                                  Aplicar Penalização (Multa)
                                </option>
                              </select>
                            </div>

                            {acaoEmprestimoForm.tipoAcao === "Pagamento" && (
                              <div className="form-row">
                                <div className="form-group">
                                  <label>Valor (€)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={acaoEmprestimoForm.valorPagamento}
                                    onChange={(e) =>
                                      setAcaoEmprestimoForm({
                                        ...acaoEmprestimoForm,
                                        valorPagamento: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Método</label>
                                  <select
                                    value={acaoEmprestimoForm.metodoPagamento}
                                    onChange={(e) =>
                                      setAcaoEmprestimoForm({
                                        ...acaoEmprestimoForm,
                                        metodoPagamento: e.target.value,
                                      })
                                    }
                                  >
                                    <option value="MBWay">MBWay</option>
                                    <option value="Transferência">
                                      Transferência
                                    </option>
                                    <option value="Numerário">Numerário</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {acaoEmprestimoForm.tipoAcao === "Devolucao" && (
                              <div className="form-row">
                                <div className="form-group">
                                  <label>Condição em que foi devolvido</label>
                                  <select
                                    value={
                                      acaoEmprestimoForm.estadoPecaDevolucao
                                    }
                                    onChange={(e) =>
                                      setAcaoEmprestimoForm({
                                        ...acaoEmprestimoForm,
                                        estadoPecaDevolucao: e.target.value,
                                      })
                                    }
                                  >
                                    <option value="Excelente">Excelente</option>
                                    <option value="Bom">Bom estado</option>
                                    <option value="Sinais de Uso">
                                      Sinais de Uso
                                    </option>
                                    <option value="Danificado">
                                      Danificado (requer reparação)
                                    </option>
                                  </select>
                                </div>
                              </div>
                            )}

                            {acaoEmprestimoForm.tipoAcao === "Penalizacao" && (
                              <div className="form-row">
                                <div className="form-group">
                                  <label>Valor da Multa (€)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={acaoEmprestimoForm.valorPenalizacao}
                                    onChange={(e) =>
                                      setAcaoEmprestimoForm({
                                        ...acaoEmprestimoForm,
                                        valorPenalizacao: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Motivo</label>
                                  <select
                                    value={acaoEmprestimoForm.tipoPenalizacao}
                                    onChange={(e) =>
                                      setAcaoEmprestimoForm({
                                        ...acaoEmprestimoForm,
                                        tipoPenalizacao: e.target.value,
                                      })
                                    }
                                  >
                                    <option value="Atraso">Atraso</option>
                                    <option value="Dano">Dano</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                display: "flex",
                                gap: "10px",
                                marginTop: "15px",
                              }}
                            >
                              <button
                                type="button"
                                className="btn-outline"
                                style={{ flex: 1 }}
                                onClick={() => setReservaEmGestao(null)}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="btn-dark"
                                style={{ flex: 2 }}
                                disabled={isSubmitting}
                              >
                                Submeter Ação
                              </button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div
                  className="empty-state-container"
                  style={{
                    padding: "40px 20px",
                    background: "#f9f8f6",
                    border: "1px solid #e0dcd2",
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.1rem",
                      color: "#2a2724",
                      fontWeight: "600",
                    }}
                  >
                    Nenhuma reserva encontrada
                  </div>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: "#8a8480",
                      margin: "8px 0 0 0",
                    }}
                  >
                    Não existem pedidos de empréstimo ativos para esta peça.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isLightboxOpen && itemDetalhe && (
        <div
          className="modal-overlay"
          style={{ zIndex: 3000, background: "rgba(0,0,0,0.95)" }}
          onClick={() => setIsLightboxOpen(false)}
        >
          <img
            src={itemDetalhe.fotos[indicesImagens[itemDetalhe.unique_id] || 0]}
            style={{ maxWidth: "90%", maxHeight: "90vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />
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

      {customAlert.show && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content alert-box">
            <p className="alert-message">{customAlert.message}</p>
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
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
