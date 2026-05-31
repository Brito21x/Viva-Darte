import React, { useState, useEffect } from "react";
import { Pencil, Trash2, MapPin, Phone, Mail } from "lucide-react";
import "./Figurinos.css";
import logoImg from "../../assets/logo.png";
import { API_URL, getAuthToken } from "../../services/api";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * Componente Marketplace de Figurinos da Viva D'arte.
 *
 * Responsabilidades:
 * - Listar peças disponíveis para venda e empréstimo da comunidade
 * - Gerir o inventário pessoal do utilizador (adicionar, editar, apagar)
 * - Permitir compras e pedidos de empréstimo
 * - Gerir pedidos de empréstimo recebidos (aprovar, rejeitar, devolução, multas)
 * - Acompanhar as requisições feitas pelo utilizador
 *
 * @param {Function} irParaLanding              - Navega para a landing page
 * @param {Function} irParaMinhaAgendaProfessor - Navega para agenda do professor
 * @param {Function} irParaMinhaAgendaEE        - Navega para agenda do EE
 */
export default function Figurinos({
  irParaLanding,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
  irParaAgenda,
}) {
  const [utilizador, setUtilizador] = useState(null);
  /** Controla a visibilidade do menu hamburger em mobile */
  const [menuAberto, setMenuAberto] = useState(false);
  const [pecasOriginais, setPecasOriginais] = useState([]);
  const [vendasOriginais, setVendasOriginais] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pedidosAtuais, setPedidosAtuais] = useState([]);
  const [reservaEmGestao, setReservaEmGestao] = useState(null);
  const [minhasRequisicoes, setMinhasRequisicoes] = useState([]);

  const [activeTab, setActiveTab] = useState("marketplace");
  const [pesquisa, setPesquisa] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroTipoMarket, setFiltroTipoMarket] = useState("Todos");
  const [ordenacao, setOrdenacao] = useState("recentes");

  const [indicesImagens, setIndicesImagens] = useState({});
  const [itemDetalhe, setItemDetalhe] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDisponibilizarModalOpen, setIsDisponibilizarModalOpen] =
    useState(false);
  const [isCompraModalOpen, setIsCompraModalOpen] = useState(false);
  const [isSolicitarEmprestimoModalOpen, setIsSolicitarEmprestimoModalOpen] =
    useState(false);
  const [isGerirEmprestimoModalOpen, setIsGerirEmprestimoModalOpen] =
    useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  /**
   * Calcula as datas já ocupadas para um item, para bloquear no DatePicker.
   * Inclui pedidos Aprovados, Em Curso e Pendentes.
   */
  const datasOcupadasTeste = React.useMemo(() => {
    let datas = [];
    pedidosAtuais.forEach((p) => {
      if (
        p.estado === "Aprovado" ||
        p.estado === "Em Curso" ||
        p.estado === "Pendente"
      ) {
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

  /**
   * Abre o modal de solicitação de empréstimo e carrega os pedidos
   * existentes para mostrar datas ocupadas no calendário.
   */
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

    try {
      const res = await fetch(`${API_INV}/pecas/${item.id_peca}/emprestimos`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (res.ok) setPedidosAtuais(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Abre o modal de gestão de pedidos de empréstimo (visão do dono da peça)
   * e carrega a lista de pedidos atuais.
   */
  const abrirGerirEmprestimo = async (e, item) => {
    e.stopPropagation();
    setItemSelecionado(item);
    setIsGerirEmprestimoModalOpen(true);

    try {
      const res = await fetch(`${API_INV}/pecas/${item.id_peca}/emprestimos`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (res.ok) setPedidosAtuais(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  /** URL base da API de inventário */
  const API_INV = `${API_URL}/api/inventario`;

  /** Obtém o token JWT do utilizador autenticado */
  const getToken = () => getAuthToken() || "";
  /** ID do utilizador autenticado — usado para distinguir itens próprios */
  const userId = utilizador?.id_utilizador || utilizador?.id;

  /** Mostra um alerta personalizado ao utilizador */
  const mostrarAlerta = (msg) =>
    setCustomAlert({
      show: true,
      message: msg,
      type: "alert",
      onConfirm: null,
    });

  /** Fecha o alerta/confirmação ativo */
  const fecharAlerta = () =>
    setCustomAlert({
      show: false,
      message: "",
      type: "alert",
      onConfirm: null,
    });

  /** Termina a sessão do utilizador, limpa o localStorage e redireciona */
  const handleLogout = () => {
    localStorage.clear();
    setUtilizador(null);
    if (irParaLanding) {
      irParaLanding();
    } else {
      window.location.reload();
    }
  };

  /**
   * Extrai valor_dia e métodos de pagamento de uma peça de empréstimo.
   * Suporta dois formatos: campo metodos_pagamento direto ou campo
   * localizacao serializado como "valor_dia:X;metodos:Y,Z".
   */
  const parsearLocalizacao = (peca) => {
    if (!peca || typeof peca !== "object")
      return { valor_dia: "0", metodos: ["MBWay"] };

    if (peca.metodos_pagamento) {
      return {
        valor_dia: peca.valor_dia || "0",
        metodos:
          typeof peca.metodos_pagamento === "string"
            ? peca.metodos_pagamento.split(",").map((m) => m.trim())
            : ["MBWay"],
      };
    }

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

  /**
   * Carrega peças, vendas e pedidos do utilizador da API.
   * Para cada peça nova, carrega as fotos completas em segundo plano
   * sem bloquear o render inicial.
   * @param {boolean} showLoading - Se true, mostra spinner durante o carregamento
   */
  const carregarDados = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${getToken()}`,
        "ngrok-skip-browser-warning": "true",
      };
      const [resPecas, resVendas, resMeusPedidos] = await Promise.all([
        fetch(API_INV, { headers, cache: "no-store" }),
        fetch(`${API_INV}/vendas`, { headers, cache: "no-store" }),
        fetch(`${API_INV}/meus-pedidos`, { headers, cache: "no-store" }),
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

      if (resMeusPedidos.ok) {
        setMinhasRequisicoes(await resMeusPedidos.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  /** Inicialização: define o título da página, carrega o utilizador do localStorage e os dados da API */
  useEffect(() => {
    document.title = "Figurinos | Viva D'arte";
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) setUtilizador(JSON.parse(userGuardado));
    carregarDados(true);
  }, []);

  /**
   * Constrói a lista de itens para o tab Marketplace.
   * Combina peças de empréstimo (da tabela inventário) com vendas
   * (da tabela vendas), excluindo os próprios itens do utilizador.
   * @returns {Array} Lista normalizada de items com campos comuns
   */
  const buildMarketplaceItems = () => {
    let items = [];
    pecasOriginais.forEach((p) => {
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
          pedidos_pendentes: p.pedidos_pendentes || 0,
        });
      }
    });

    vendasOriginais.forEach((v) => {
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

  /**
   * Constrói a lista de itens para o tab "Os Meus Figurinos".
   * Filtra apenas as peças que pertencem ao utilizador autenticado
   * e enriquece com estado global (Guardado / À Venda / Para Empréstimo).
   * @returns {Array} Lista de peças do utilizador com estado calculado
   */
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
          pedidos_pendentes: p.pedidos_pendentes || 0,
        };
      });
  };

  /** Lista de items da tab ativa (marketplace ou meus) */
  const itemsAtuais =
    activeTab === "marketplace" ? buildMarketplaceItems() : buildMeusItems();

  /** Items da tab ativa após aplicar pesquisa, filtros e ordenação */
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

  /** Avança para a próxima foto do carrossel de um item */
  const proximaImagem = (e, uid, total) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [uid]: ((prev[uid] || 0) + 1) % total,
    }));
  };
  /** Recua para a foto anterior do carrossel de um item */
  const imagemAnterior = (e, uid, total) => {
    e.stopPropagation();
    setIndicesImagens((prev) => ({
      ...prev,
      [uid]: ((prev[uid] || 0) - 1 + total) % total,
    }));
  };

  /**
   * Processa o upload de fotos: redimensiona cada imagem para máx 800px
   * e converte para JPEG com qualidade 0.7, reduzindo o tamanho de envio.
   */
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

  /** Remove uma foto da lista de fotos do novo figurino pelo índice */
  const removerFoto = (idx) =>
    setNovaPeca((prev) => ({
      ...prev,
      fotos: prev.fotos.filter((_, i) => i !== idx),
    }));

  /**
   * Submete o formulário de nova peça.
   * Cria a peça na API; se disponibilidade = Venda, cria também o registo
   * de venda; se Emprestimo, atualiza a peça com disponivel_para_emprestimo.
   */
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
          "ngrok-skip-browser-warning": "true",
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
            "ngrok-skip-browser-warning": "true",
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
            "ngrok-skip-browser-warning": "true",
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

  /**
   * Apaga definitivamente uma peça do inventário do utilizador.
   * Chamado após confirmação no alerta customizado.
   */
  const apagarPeca = async (idPeca) => {
    fecharAlerta();
    try {
      const res = await fetch(`${API_INV}/${idPeca}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (res.ok) {
        mostrarAlerta("Removido com sucesso!");
        carregarDados(false);
      } else mostrarAlerta((await res.json()).mensagem || "Erro");
    } catch {
      mostrarAlerta("Erro");
    }
  };

  /**
   * Prepara e abre o modal de edição de uma peça.
   * Detecta automaticamente os métodos de pagamento e disponibilidade atuais.
   */
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

  /**
   * Submete as alterações de edição de uma peça.
   * Atualiza nome, tamanho, condição, preço, disponibilidade e métodos.
   */
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
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        mostrarAlerta("Figurino editado com sucesso!");
        setIsEditModalOpen(false);

        setItemDetalhe(null);
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

  /**
   * Confirma a compra de um figurino.
   * Regista o comprador e o método de pagamento na API.
   */
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
            "ngrok-skip-browser-warning": "true",
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

  /**
   * Submete o pedido de empréstimo com as datas e método de pagamento.
   * Valida que as datas foram selecionadas e que fim > início.
   */
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
      const dInicioStr = formEmprestimo.dataInicio.toLocaleDateString("en-CA");
      const dFimStr = formEmprestimo.dataFim.toLocaleDateString("en-CA");

      const res = await fetch(`${API_INV}/emprestimos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
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

  /**
   * Aprova ou rejeita um pedido de empréstimo pendente.
   * Após a ação, recarrega a lista de pedidos para refletir o novo estado.
   */
  const gerirEstadoReserva = async (idEmprestimo, novoEstado) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_INV}/emprestimos/${idEmprestimo}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ status: novoEstado }),
      });

      if (res.ok) {
        mostrarAlerta(`Pedido ${novoEstado.toLowerCase()} com sucesso!`);

        const resRefresh = await fetch(
          `${API_INV}/pecas/${itemSelecionado.id_peca}/emprestimos`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "ngrok-skip-browser-warning": "true",
            },
          },
        );
        if (resRefresh.ok) setPedidosAtuais(await resRefresh.json());

        carregarDados(false);
      } else {
        mostrarAlerta(
          (await res.json()).mensagem || "Erro ao atualizar o pedido.",
        );
      }
    } catch {
      mostrarAlerta("Erro de rede ao comunicar com o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Submete uma ação de gestão sobre um empréstimo aprovado:
   * - Pagamento: regista o valor e método recebido
   * - Devolução: regista a entrega da peça e a sua condição
   * - Penalização: aplica uma multa por atraso ou dano
   */
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
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        mostrarAlerta("Ação registada com sucesso!");
        setReservaEmGestao(null);

        const resRefresh = await fetch(
          `${API_INV}/pecas/${itemSelecionado.id_peca}/emprestimos`,
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "ngrok-skip-browser-warning": "true",
            },
          },
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

  /**
   * Atalhos de teclado globais:
   * - Setas esquerda/direita: navegar entre itens no detalhe ou lightbox
   * - Escape: fechar detalhe ou lightbox
   */
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
      {/* ================================================================
          NAVBAR INTERNA
          Versão autenticada da navbar. Em mobile oculta o logótipo e
          apresenta hamburger (esquerda) + perfil (direita).
          ================================================================ */}
      <nav className="navbar interna">
        {/* Marca — oculta em mobile via CSS */}
        <div className="nav-brand" onClick={irParaLanding}>
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>

        {/* Links de navegação — dropdown em mobile */}
        <ul className={`nav-menu${menuAberto ? " aberto" : ""}`}>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMenuAberto(false);
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
              className="special-link"
              onClick={(e) => {
                e.preventDefault();
                irParaAgenda();
              }}
            >
              Agenda
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMenuAberto(false);
                const user = JSON.parse(
                  localStorage.getItem("viva_user") || "{}",
                );
                if (user.tipo === "PROF" || user.role === "PROFESSOR")
                  irParaMinhaAgendaProfessor?.();
                else irParaMinhaAgendaEE?.();
              }}
            >
              Coaching{" "}
            </a>
          </li>
          <li>
            <a
              href="#"
              className="special-link active"
              onClick={() => setMenuAberto(false)}
            >
              Marketplace
            </a>
          </li>
        </ul>

        {/* Perfil — sempre visível à direita */}
        <div className="nav-actions nav-actions--fig">
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

        {/* Botão hamburger — visível apenas em mobile */}
        <button
          className={`hamburger-interna${menuAberto ? " ativo" : ""}`}
          onClick={() => setMenuAberto((prev) => !prev)}
          aria-label="Abrir menu de navegação"
          aria-expanded={menuAberto}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
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
          {utilizador && (
            <button
              className={`tab-btn ${activeTab === "requisicoes" ? "active" : ""}`}
              onClick={() => setActiveTab("requisicoes")}
            >
              As Minhas Requisições
            </button>
          )}
        </div>

        {!isLoading && (
          <div className="filtros-bar">
            {activeTab === "marketplace" && (
              <>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                  className="filtro-input"
                />

                <select
                  value={filtroTipoMarket}
                  onChange={(e) => setFiltroTipoMarket(e.target.value)}
                  className="filtro-select"
                >
                  <option value="Todos">Todas as Transações</option>
                  <option value="Vendas">Apenas Vendas</option>
                  <option value="Emprestimos">Apenas Empréstimos</option>
                </select>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="filtro-select"
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
                  className="filtro-select"
                >
                  <option value="recentes">Mais Recentes</option>
                  <option value="preco_asc">Preço: Mais Barato</option>
                  <option value="preco_desc">Preço: Mais Caro</option>
                </select>
              </>
            )}
          </div>
        )}

        {activeTab === "requisicoes" && !isLoading && (
          <div className="requisicoes-list">
            {minhasRequisicoes.length === 0 ? (
              <div className="empty-state-container">
                Ainda não solicitaste nenhum empréstimo.
              </div>
            ) : (
              minhasRequisicoes.map((req) => {
                const isRejeitado = req.estado === "Rejeitado";
                const isAprovado =
                  req.estado === "Aprovado" ||
                  req.estado === "Em Curso" ||
                  req.estado === "Concluído";

                return (
                  <div
                    key={req.id_emprestimo}
                    className="reserva-card reserva-card-req"
                  >
                    <div className="req-info-col">
                      <h3 className="req-titulo">{req.peca_nome}</h3>
                      <p className="req-detail">
                        <strong>Fornecedor:</strong> {req.dono_peca}
                      </p>
                      <p className="req-detail-last">
                        <strong>Período:</strong>{" "}
                        {new Date(req.data_inicio).toLocaleDateString()} a{" "}
                        {new Date(req.data_fim).toLocaleDateString()}
                      </p>

                      <div className="req-badges">
                        <span
                          className={`reserva-badge ${
                            req.estado === "Pendente"
                              ? "badge-pendente"
                              : isAprovado
                                ? "badge-aprovado"
                                : ""
                          } ${isRejeitado ? "badge-rejeitado" : ""}`}
                        >
                          Pedido {req.estado}
                        </span>

                        {isAprovado && (
                          <span
                            className={`reserva-badge ${req.estado_pagamento === "Pago" ? "badge-aprovado" : "badge-default"}`}
                          >
                            {req.estado_pagamento === "Pago"
                              ? "Pagamento Recebido"
                              : "Pagamento Pendente"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="req-gestao-col">
                      <h4 className="req-gestao-titulo">Detalhes da Gestão</h4>

                      {!isRejeitado && (
                        <p className="req-gestao-detail">
                          <strong>Pagamento:</strong>{" "}
                          {req.estado_pagamento === "Pago"
                            ? `${parseFloat(req.valor || 0).toFixed(2)}€ pago a ${req.data_pagamento ? new Date(req.data_pagamento).toLocaleDateString() : "N/A"}`
                            : "A aguardar pagamento"}
                        </p>
                      )}

                      <p className="req-gestao-detail">
                        <strong>Devolução:</strong>{" "}
                        {req.data_devolucao
                          ? `Registada a ${new Date(req.data_devolucao).toLocaleDateString()}`
                          : "Ainda não devolvido"}
                      </p>
                      <p className="req-gestao-detail">
                        <strong>Penalizações/Multas:</strong>{" "}
                        {req.total_multas > 0
                          ? `${req.total_multas.toFixed(2)}€ aplicados`
                          : "Nenhuma"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab !== "requisicoes" && (
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
                const eMeu =
                  activeTab === "meus" || userId === item.vendedor_id;

                return (
                  <div
                    key={item.unique_id}
                    className={`item-card item-card-clickable ${isIndisponivel ? "indisponivel" : ""}`}
                    onClick={() => setItemDetalhe(item)}
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
                            onClick={(e) =>
                              proximaImagem(e, item.unique_id, tot)
                            }
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
                            <Pencil size={14} />
                          </button>
                          <button
                            className="action-btn delete-btn"
                            title="Apagar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomAlert({
                                show: true,
                                message:
                                  "Eliminar definitivamente este figurino do teu inventário?",
                                type: "confirm",
                                onConfirm: () => apagarPeca(item.id_peca),
                              });
                            }}
                          >
                            <Trash2 size={14} />
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
                        <p className="item-owner">
                          Por: {item.vendedorDisplay}
                        </p>
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
                        {item.precoDisplay &&
                        item.estadoGlobal !== "Guardado" ? (
                          <span className="preco">
                            {item.precoDisplay}€{" "}
                            <small>{item.precoDisplayLabel}</small>
                          </span>
                        ) : (
                          <span className="preco-placeholder">_</span>
                        )}

                        {activeTab === "meus" ? (
                          item.estadoGlobal === "Guardado" ? (
                            <span className="texto-teu-item">
                              Apenas Guardado
                            </span>
                          ) : item.estadoGlobal === "Para Empréstimo" ? (
                            <div className="gerir-pedidos-wrapper">
                              <button
                                className="btn-dark"
                                onClick={(e) => abrirGerirEmprestimo(e, item)}
                              >
                                Gerir Pedidos
                              </button>

                              {item.pedidos_pendentes > 0 && (
                                <span className="badge-pedidos-pendentes">
                                  {item.pedidos_pendentes}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="texto-teu-item">
                              Visível no Market
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
        )}
      </div>

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
              className="modal-overlay modal-overlay-detalhe"
              onClick={() => setItemDetalhe(null)}
            >
              {itemsFiltrados.length > 1 && (
                <>
                  <button
                    className="nav-detalhe-btn left"
                    onClick={(e) => {
                      e.stopPropagation();
                      nav(-1);
                    }}
                  >
                    ‹
                  </button>
                  <button
                    className="nav-detalhe-btn right"
                    onClick={(e) => {
                      e.stopPropagation();
                      nav(1);
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              <div
                className="modal-content modal-content-detalhe"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="detalhe-imagem-col">
                  <div className="detalhe-imagem-main">
                    {tot > 0 ? (
                      <img
                        src={itemDetalhe.fotos[idx]}
                        alt="Item"
                        className="detalhe-imagem-img"
                        onClick={() => setIsLightboxOpen(true)}
                      />
                    ) : (
                      <span>Sem Imagem</span>
                    )}
                  </div>
                  {tot > 1 && (
                    <div className="detalhe-thumbs">
                      {itemDetalhe.fotos.map((f, i) => (
                        <img
                          key={i}
                          src={f}
                          className={`detalhe-thumb ${i === idx ? "active" : ""}`}
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
                <div className="detalhe-info-col">
                  <div>
                    <div className="detalhe-header">
                      <span
                        className={`detalhe-badge ${indisp ? "indisp" : ""}`}
                      >
                        {activeTab === "meus"
                          ? itemDetalhe.estadoGlobal
                          : indisp
                            ? itemDetalhe.estado
                            : `Disponível para ${itemDetalhe.source}`}
                      </span>
                      <button
                        className="btn-fechar-detalhe"
                        onClick={() => setItemDetalhe(null)}
                      >
                        &times;
                      </button>
                    </div>
                    <h2 className="detalhe-titulo">{itemDetalhe.nome}</h2>
                    <div className="detalhe-tags">
                      <div className="detalhe-tag-box">
                        <span className="detalhe-tag-label">Estado</span>
                        <strong className="detalhe-tag-value">
                          {itemDetalhe.condicao}
                        </strong>
                      </div>
                      {itemDetalhe.tamanho && (
                        <div className="detalhe-tag-box">
                          <span className="detalhe-tag-label">Tamanho</span>
                          <strong className="detalhe-tag-value">
                            {itemDetalhe.tamanho}
                          </strong>
                        </div>
                      )}
                    </div>
                    <p className="detalhe-descricao">{itemDetalhe.descricao}</p>

                    {activeTab === "marketplace" && (
                      <div className="detalhe-fornecedor-wrap">
                        <span className="detalhe-tag-label">Fornecido por</span>
                        <p className="detalhe-fornecedor-nome">
                          {itemDetalhe.vendedorDisplay}
                        </p>
                      </div>
                    )}
                  </div>

                  {itemDetalhe.precoDisplay && (
                    <div className="detalhe-preco-bar">
                      <div>
                        <span className="detalhe-tag-label">Preço</span>
                        <div className="detalhe-preco-valor">
                          {itemDetalhe.precoDisplay}€
                          <small className="detalhe-preco-small">
                            {itemDetalhe.precoDisplayLabel}
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                  {activeTab === "marketplace" &&
                    userId !== itemDetalhe.vendedor_id && (
                      <div className="detalhe-actions">
                        <button
                          className="btn-dark"
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

      {isAddModalOpen && (
        <div className="modal-overlay modal-overlay-form">
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
                      className="input-hidden"
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

      {isEditModalOpen && (
        <div className="modal-overlay modal-overlay-form">
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

      {isCompraModalOpen && itemSelecionado && (
        <div className="modal-overlay modal-overlay-action">
          <div className="modal-content modal-content-sm">
            <h2 className="modal-h2-tight">Confirmar Compra</h2>
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
              <div className="form-actions-row">
                <button
                  type="button"
                  className="btn-outline btn-flex-1"
                  onClick={() => setIsCompraModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-dark btn-flex-15"
                  disabled={isSubmitting}
                >
                  Comprar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSolicitarEmprestimoModalOpen &&
        itemSelecionado &&
        (() => {
          let diffDays = 0;
          if (formEmprestimo.dataInicio && formEmprestimo.dataFim) {
            const diffTime = Math.abs(
              formEmprestimo.dataFim - formEmprestimo.dataInicio,
            );
            diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          } else if (formEmprestimo.dataInicio) {
            diffDays = 1;
          }

          const precoPorDia = parseFloat(itemSelecionado.precoDisplay) || 0;
          const estimatedPrice = (precoPorDia * diffDays).toFixed(2);

          return (
            <div className="modal-overlay modal-overlay-action">
              <div className="modal-content modal-content-md">
                <h2 className="modal-h2-tight">Solicitar Empréstimo</h2>

                <div className="resumo-compra">
                  <p>
                    <strong>Preço Base:</strong> {itemSelecionado.precoDisplay}€{" "}
                    {itemSelecionado.precoDisplayLabel}
                  </p>
                  {diffDays > 0 && (
                    <div className="resumo-divider">
                      <p className="p-margem-zero-bot">
                        <strong>Dias Selecionados:</strong> {diffDays}{" "}
                        {diffDays === 1 ? "dia" : "dias"}
                      </p>
                      <p className="p-margem-zero">
                        <strong>Total Estimado:</strong> {estimatedPrice}€
                      </p>
                    </div>
                  )}
                </div>

                <form onSubmit={confirmarEmprestimo}>
                  <div className="form-row">
                    <div className="form-group form-group-datepicker">
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
                    <div className="form-group form-group-datepicker">
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
                  <div className="form-actions-row">
                    <button
                      type="button"
                      className="btn-outline btn-flex-1"
                      onClick={() => setIsSolicitarEmprestimoModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-dark btn-flex-15"
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

      {isGerirEmprestimoModalOpen && itemSelecionado && (
        <div className="modal-overlay modal-overlay-form">
          <div className="modal-content form-modal modal-content-lg">
            <div className="gerir-header">
              <div>
                <h2 className="gerir-titulo">Gerir Pedidos</h2>
                <span className="gerir-subtitulo">
                  Figurino: {itemSelecionado.nome}
                </span>
              </div>
              <button
                className="btn-fechar-detalhe"
                onClick={() => setIsGerirEmprestimoModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="gerir-lista">
              {pedidosAtuais.length > 0 ? (
                pedidosAtuais.map((pedido) => {
                  const isPendente = pedido.estado === "Pendente";
                  const isAprovado =
                    pedido.estado === "Aprovado" ||
                    pedido.estado === "Em Curso";

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

                        <div className="reserva-detail mt-12">
                          <div className="detail-text">
                            <span className="detail-label">
                              Informação de Pagamento
                            </span>
                            <span className="detail-value detail-value-block">
                              Método selecionado:{" "}
                              <strong>
                                {pedido.metodo_pagamento || "Não especificado"}
                              </strong>
                            </span>
                            <span className="detail-value detail-value-block">
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
                            Aprovar Pedido
                          </button>
                        </div>
                      )}

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
                            Gerir Empréstimo
                          </button>
                        </div>
                      )}

                      {reservaEmGestao === pedido.id && (
                        <div className="gerir-form-wrap">
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

                            <div className="gerir-form-actions">
                              <button
                                type="button"
                                className="btn-outline btn-flex-1"
                                onClick={() => setReservaEmGestao(null)}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="btn-dark btn-flex-2"
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
                <div className="empty-state-container empty-state-card">
                  <div className="empty-state-titulo">
                    Nenhum pedido encontrada
                  </div>
                  <p className="empty-state-msg">
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
          className="modal-overlay lightbox-overlay"
          onClick={() => setIsLightboxOpen(false)}
        >
          <img
            src={itemDetalhe.fotos[indicesImagens[itemDetalhe.unique_id] || 0]}
            className="lightbox-img"
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
                <MapPin
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />{" "}
                Rua das Artes, nº 123, Braga
              </li>
              <li>
                <Phone
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />{" "}
                +351 000 000 000
              </li>
              <li>
                <Mail
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />{" "}
                geral@vivadarte.pt
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
        <div className="modal-overlay modal-overlay-alert">
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
