import React, { useEffect, useState, useMemo } from "react";
import logoImg from "../../assets/logo.png";
import { apiAuthFetch } from "../../services/api";

/* ─── Constantes ────────────────────────────────────────────────────────── */
const HORAS_GRELHA = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_EXTENSO = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

/* ─── Utilitários ───────────────────────────────────────────────────────── */
function formatHoraCurta(horaFull) {
  if (!horaFull) return "";
  return String(horaFull).substring(0, 5);
}

function modalidadeParaClasse(modalidade) {
  const s = String(modalidade || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (s.includes("ballet")) return "ballet";
  if (s.includes("jazz")) return "jazz";
  if (s.includes("acrobat")) return "acrobatica";
  if (s.includes("acrodance")) return "acrodance";
  if (s.includes("hip")) return "hiphop";
  if (s.includes("contempor")) return "contemporaneo";
  return "ballet";
}

/* ─── Componente Principal ──────────────────────────────────────────────── */
export default function AgendaAulas({
  irParaLanding,
  irParaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
  irParaAgenda,
}) {
  const [horarios, setHorarios] = useState([]);
  const [utilizador, setUtilizador] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menuInternoAberto, setMenuInternoAberto] = useState(false);

  // Filtros da Agenda
  const [filtroAluno, setFiltroAluno] = useState("TODOS");
  const [filtroModalidade, setFiltroModalidade] = useState("TODAS");

  // Estados para a funcionalidade de adicionar modalidade
  const [modalidadesDisponiveis, setModalidadesDisponiveis] = useState([]);
  const [alunoParaInscricao, setAlunoParaInscricao] = useState("");
  const [novaModalidade, setNovaModalidade] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sistema de Alertas
  const [globalToast, setGlobalToast] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, mensagem: "" });
  const [alertaExcl, setAlertaExcl] = useState({ isOpen: false, message: "" });

  function mostrarToast(texto, tipo = "sucesso") {
    setGlobalToast({ texto, tipo });
    setTimeout(() => setGlobalToast(null), 5000);
  }

  useEffect(() => {
    document.title = "Agenda Semanal | Viva D'arte";
    const userRaw = localStorage.getItem("viva_user");
    if (userRaw) setUtilizador(JSON.parse(userRaw));
  }, []);

  async function fetchAgenda() {
    setIsLoading(true);
    try {
      const data = await apiAuthFetch("/api/agenda");
      setHorarios(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar agenda:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!utilizador) return;
    fetchAgenda();

    // Carregar lista de todas as modalidades
    apiAuthFetch("/api/escola/modalidades")
      .then((res) => setModalidadesDisponiveis(Array.isArray(res) ? res : []))
      .catch((err) => console.error("Erro ao carregar modalidades", err));
  }, [utilizador]);

  const isEE = utilizador?.perfil?.toLowerCase().includes("ee") || false;
  const isProfessor =
    utilizador?.perfil?.toLowerCase().includes("prof") || false;

  // Extrai lista única de educandos
  const alunosUnicos = useMemo(() => {
    if (!isEE) return [];
    const map = new Map();
    horarios.forEach((h) => {
      if (h.id_aluno && h.nome_aluno) {
        map.set(h.id_aluno, h.nome_aluno);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [horarios, isEE]);

  // Modalidades únicas para o filtro dropdown
  const modalidadesUnicas = useMemo(() => {
    const map = new Map();
    horarios.forEach((h) => {
      if (h.id_modalidade && h.modalidade) {
        map.set(h.id_modalidade, h.modalidade);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [horarios]);

  // Filtra horários pelo educando e modalidade selecionados
  const horariosFiltrados = useMemo(() => {
    let filtrado = horarios;
    if (filtroAluno !== "TODOS") {
      filtrado = filtrado.filter(
        (h) =>
          String(h.id_aluno) === String(filtroAluno) || h.id_aluno === null,
      );
    }
    // Apenas filtra por modalidade se não for professor
    if (!isProfessor && filtroModalidade !== "TODAS") {
      filtrado = filtrado.filter(
        (h) => String(h.id_modalidade) === String(filtroModalidade),
      );
    }
    return filtrado;
  }, [horarios, filtroAluno, filtroModalidade, isProfessor]);

  // Estrutura os eventos para a grelha
  const grelhaEventos = useMemo(() => {
    const map = new Map();
    horariosFiltrados.forEach((h) => {
      const horaBloco = formatHoraCurta(h.hora_inicio).split(":")[0] + ":00";
      const diaAbrev = DIAS_SEMANA[h.dia_semana - 1];

      const key = `${diaAbrev}|${horaBloco}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(h);
    });
    return map;
  }, [horariosFiltrados]);

  // Submeter nova inscrição (EE e Alunos)
  const handleAdicionarModalidade = async () => {
    const idDoAluno = isEE
      ? Number(alunoParaInscricao)
      : Number(utilizador?.id || utilizador?.id_utilizador);
    if (!idDoAluno || !novaModalidade) return;

    setIsSubmitting(true);
    try {
      await apiAuthFetch("/api/escola/alunos/modalidades", {
        method: "POST",
        body: {
          idAluno: idDoAluno,
          idModalidade: Number(novaModalidade),
        },
      });
      setAlertModal({
        isOpen: true,
        mensagem: "Inscrição efetuada com sucesso!",
      });
      setAlunoParaInscricao("");
      setNovaModalidade("");
      fetchAgenda(); // Recarregar a agenda
    } catch (error) {
      setAlertaExcl({
        isOpen: true,
        message: error.message || "Erro ao inscrever na modalidade.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("viva_user");
    localStorage.removeItem("viva_token");
    localStorage.removeItem("token");
    if (irParaLanding) irParaLanding();
    window.location.reload();
  };

  return (
    <div className="dashboard-container">
      {globalToast && (
        <div className={`global-toast global-toast--${globalToast.tipo}`}>
          <span className="toast-icon">
            {globalToast.tipo === "sucesso" ? "✅" : "❌"}
          </span>
          {globalToast.texto}
        </div>
      )}

      {/* NAVBAR */}
      <nav className="navbar interna">
        <div className="nav-brand" onClick={irParaLanding}>
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span>VIVA D'ARTE</span>
        </div>

        <ul className={`nav-menu${menuInternoAberto ? " aberto" : ""}`}>
          <li>
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                irParaLanding?.();
              }}
            >
              Início
            </a>
          </li>
          <li className="nav-separator">|</li>
          <li>
            <a
              href="#agenda_semana"
              className="special-link active"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                irParaAgenda?.();
              }}
            >
              Agenda
            </a>
          </li>
          <li>
            <a
              href="#coaching"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                if (isProfessor) irParaMinhaAgendaProfessor?.();
                else irParaMinhaAgendaEE?.();
              }}
            >
              Coaching
            </a>
          </li>
          <li>
            <a
              href="#figurinos"
              onClick={(e) => {
                e.preventDefault();
                setMenuInternoAberto(false);
                irParaFigurinos?.();
              }}
            >
              Marketplace
            </a>
          </li>
        </ul>

        <div className="nav-actions nav-actions--interna">
          <div className="user-profile">
            <span className="welcome-text">
              Olá, <strong>{utilizador?.nome || ""}</strong>
            </span>
            <button className="btn-logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>

        <button
          className={`hamburger-interna${menuInternoAberto ? " ativo" : ""}`}
          onClick={() => setMenuInternoAberto(!menuInternoAberto)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      <div className="dashboard-wrapper">
        {/* CALENDÁRIO GERAL */}
        <main className="calendar-container">
          <div
            className="calendar-nav-bar"
            style={{ justifyContent: "center" }}
          >
            <span
              className="calendar-nav-label"
              style={{ fontSize: "1.1rem", padding: "8px 0" }}
            >
              Horário Semanal Regular
            </span>
          </div>

          <div className="calendar-mobile-scroll">
            <div className="calendar-days-sticky">
              <div className="time-corner"></div>
              {DIAS_SEMANA.map((dia, idx) => (
                <div key={dia} className="day-sticky-cell">
                  <span className="day-label-name">{dia}</span>
                  <span
                    className="day-label-date"
                    style={{ textTransform: "none", opacity: 0.8 }}
                  >
                    {DIAS_EXTENSO[idx]}
                  </span>
                </div>
              ))}
            </div>

            <div className="calendar-scrollable-area">
              {isLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#b38b59",
                    fontWeight: "bold",
                  }}
                >
                  A carregar as turmas...
                </div>
              ) : (
                <div className="calendar-grid-body">
                  {HORAS_GRELHA.map((hora) => (
                    <React.Fragment key={hora}>
                      <div className="time-label">{hora}</div>
                      {DIAS_SEMANA.map((dia) => {
                        const eventosBloco =
                          grelhaEventos.get(`${dia}|${hora}`) || [];
                        return (
                          <div key={`${dia}-${hora}`} className="slot-cell">
                            {eventosBloco.map((evt, idx) => (
                              <div
                                key={idx}
                                className={`event-block ${modalidadeParaClasse(evt.modalidade)}`}
                              >
                                <span className="event-time">
                                  {formatHoraCurta(evt.hora_inicio)} -{" "}
                                  {formatHoraCurta(evt.hora_fim)}
                                </span>
                                <h4 className="event-title">
                                  {evt.modalidade}
                                </h4>
                                <p className="event-student">
                                  Sala: {evt.sala || "A def."} <br />
                                  {!isProfessor
                                    ? `Prof: ${evt.professor}`
                                    : evt.nome_aluno
                                      ? `Aluno: ${evt.nome_aluno.split(" ")[0]}`
                                      : "Turma Geral"}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* SIDEBAR */}
        <aside className="sidebar">
          {/* =========================================================
              VISÃO DO ENCARREGADO DE EDUCAÇÃO / ALUNO
              ========================================================= */}
          {!isProfessor && (
            <div className="sidebar-card">
              <h3>Visualizar Agenda</h3>
              <p className="sidebar-subtitle" style={{ marginBottom: "20px" }}>
                Abaixo encontras o teu horário letivo. Podes filtrar a grelha
                por modalidade.
              </p>

              {/* Filtros */}
              {isEE && alunosUnicos.length > 0 && (
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <select
                    className="form-control"
                    value={filtroAluno}
                    onChange={(e) => setFiltroAluno(e.target.value)}
                    style={{ fontWeight: "bold" }}
                  >
                    <option value="TODOS">Todos os Alunos</option>
                    {alunosUnicos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalidadesUnicas.length > 0 && (
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <select
                    className="form-control"
                    value={filtroModalidade}
                    onChange={(e) => setFiltroModalidade(e.target.value)}
                    style={{ fontWeight: "bold" }}
                  >
                    <option value="TODAS">Todas as Modalidades</option>
                    {modalidadesUnicas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Menu para adicionar modalidades */}
              <hr style={{ borderTop: "1px solid #eee", margin: "24px 0" }} />

              <h4
                style={{
                  fontSize: "0.95rem",
                  color: "var(--primary-dark)",
                  marginBottom: "12px",
                }}
              >
                Adicionar às minhas modalidades
              </h4>

              {isEE && (
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <select
                    className="form-control"
                    value={alunoParaInscricao}
                    onChange={(e) => setAlunoParaInscricao(e.target.value)}
                  >
                    <option value="">Selecione o Aluno...</option>
                    {alunosUnicos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <select
                  className="form-control"
                  value={novaModalidade}
                  onChange={(e) => setNovaModalidade(e.target.value)}
                >
                  <option value="">Selecione a Modalidade...</option>
                  {modalidadesDisponiveis.map((m) => (
                    <option key={m.id_modalidade} value={m.id_modalidade}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn-gold"
                style={{ width: "100%", padding: "12px", borderRadius: "8px" }}
                onClick={handleAdicionarModalidade}
                disabled={
                  (isEE && !alunoParaInscricao) ||
                  !novaModalidade ||
                  isSubmitting
                }
              >
                {isSubmitting ? "A processar..." : "Inscrever"}
              </button>
            </div>
          )}

          {!isProfessor && (
            <div className="sidebar-card info-card">
              <h3>Informação Coaching</h3>
              <p>
                Aqui podes consultar o horário semanal das tuas aulas. Para
                pedires uma sessão de coaching, vai ao separador{" "}
                <strong
                  onClick={irParaMinhaAgendaProfessor}
                  style={{ cursor: "pointer" }}
                >
                  Coaching
                </strong>{" "}
                no menu em cima.
              </p>
            </div>
          )}

          {/* =========================================================
              VISÃO DO PROFESSOR
              ========================================================= */}
          {isProfessor && (
            <>
              {/* 1. Resumo das "Aulas de Hoje" */}
              <div className="sidebar-card">
                <h3>Aulas de Hoje</h3>
                <p className="sidebar-subtitle">
                  O teu horário regular para o dia de hoje.
                </p>
                <div
                  className="dispo-list-hud"
                  style={{ maxHeight: "none", marginTop: "12px" }}
                >
                  {horarios.filter(
                    (h) =>
                      h.dia_semana ===
                      (new Date().getDay() === 0 ? 7 : new Date().getDay()),
                  ).length === 0 ? (
                    <div className="empty-dispo" style={{ padding: "15px" }}>
                      Não tens turmas regulares agendadas para hoje.
                    </div>
                  ) : (
                    horarios
                      .filter(
                        (h) =>
                          h.dia_semana ===
                          (new Date().getDay() === 0 ? 7 : new Date().getDay()),
                      )
                      .sort((a, b) =>
                        a.hora_inicio.localeCompare(b.hora_inicio),
                      )
                      .map((aula, idx) => (
                        <div
                          key={idx}
                          className="pedido-item-simples"
                          style={{
                            alignItems: "flex-start",
                            flexDirection: "column",
                          }}
                        >
                          <strong
                            style={{
                              color: "var(--primary-dark)",
                              fontSize: "0.9rem",
                              marginBottom: "4px",
                            }}
                          >
                            {formatHoraCurta(aula.hora_inicio)} -{" "}
                            {formatHoraCurta(aula.hora_fim)}
                          </strong>
                          <span
                            style={{
                              fontSize: "0.85rem",
                              color: "#555",
                              fontWeight: "bold",
                            }}
                          >
                            {aula.modalidade}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#888" }}>
                            Sala: {aula.sala || "A definir"}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* 2. Legenda das Suas Modalidades */}
              <div className="sidebar-card info-card">
                <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>
                  Minhas Modalidades
                </h3>
                <p
                  className="sidebar-subtitle"
                  style={{ marginBottom: "16px" }}
                >
                  Legenda de cores para a grelha.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {Array.from(new Set(horarios.map((h) => h.modalidade)))
                    .length === 0 ? (
                    <span style={{ fontSize: "0.85rem", color: "#888" }}>
                      Nenhuma modalidade atribuída.
                    </span>
                  ) : (
                    Array.from(new Set(horarios.map((h) => h.modalidade))).map(
                      (mod) => (
                        <span
                          key={mod}
                          className={`dia-tag ${modalidadeParaClasse(mod)}`}
                          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                        >
                          {mod}
                        </span>
                      ),
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* FOOTER */}
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

      {/* ================================================================
          MODAIS DE ALERTA DO SISTEMA
          ================================================================ */}
      {alertModal.isOpen && (
        <div
          className="modal-overlay modal-overlay-high-z"
          onClick={() => setAlertModal({ isOpen: false, mensagem: "" })}
        >
          <div className="alert-modal-box" onClick={(e) => e.stopPropagation()}>
            <p>{alertModal.mensagem}</p>
            <button
              className="btn-dark"
              onClick={() => setAlertModal({ isOpen: false, mensagem: "" })}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {alertaExcl.isOpen && (
        <div className="modal-alerta-overlay">
          <div className="modal-alerta-box">
            <h3 className="modal-alerta-titulo">Aviso do Sistema</h3>
            <p className="modal-alerta-mensagem">{alertaExcl.message}</p>
            <button
              type="button"
              className="btn-gold modal-alerta-btn"
              onClick={() => setAlertaExcl({ isOpen: false, message: "" })}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
