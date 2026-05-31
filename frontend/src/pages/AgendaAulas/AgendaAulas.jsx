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
  const str = String(horaFull);
  // SQL Server devolve TIME como '1970-01-01T10:00:00.000Z'
  if (str.includes("T")) {
    return str.split("T")[1].substring(0, 5);
  }
  return str.substring(0, 5);
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

/* ─── Estilos coaching ──────────────────────────────────────────────────── */
const coachingStyle = `
  .event-block--coaching {
    background: #fff8f0 !important;
    border: 2px solid #b38b59 !important;
    color: #4a3728 !important;
  }
  .event-block--coaching .event-time {
    color: #b38b59 !important;
  }
  .event-block--coaching .event-title {
    color: #4a3728 !important;
  }
  .event-block__badge {
    display: inline-block;
    background: #b38b59;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 7px;
    border-radius: 4px;
    margin-bottom: 4px;
  }
`;

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
  const [educandos, setEducandos] = useState([]);

  // Filtros
  const [filtroAluno, setFiltroAluno] = useState("TODOS");
  const [filtroModalidade, setFiltroModalidade] = useState("TODAS");

  // Inscrição
  const [modalidadesDisponiveis, setModalidadesDisponiveis] = useState([]);
  const [alunoParaInscricao, setAlunoParaInscricao] = useState("");
  const [novaModalidade, setNovaModalidade] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modalidades inscritas do aluno selecionado
  const [modalidadesInscritas, setModalidadesInscritas] = useState([]);
  const [isRemoving, setIsRemoving] = useState(false);

  // Alertas
  const [alertModal, setAlertModal] = useState({ isOpen: false, mensagem: "" });
  const [alertaExcl, setAlertaExcl] = useState({ isOpen: false, message: "" });
  const [confirmarRemocao, setConfirmarRemocao] = useState({
    isOpen: false,
    idModalidade: null,
    nomeModalidade: "",
  });

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

  async function fetchModalidadesInscritas(idAluno) {
    if (!idAluno) return setModalidadesInscritas([]);
    try {
      const data = await apiAuthFetch(
        `/api/agenda/alunos/${idAluno}/modalidades`,
      );
      setModalidadesInscritas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar modalidades inscritas:", error);
    }
  }

  // Detectar perfis antes do useEffect
  const isEE =
    utilizador?.perfis?.some(
      (p) =>
        p.toLowerCase().includes("ee") ||
        p.toLowerCase().includes("encarregado"),
    ) ||
    utilizador?.perfil?.toLowerCase().includes("encarregado") ||
    false;

  const isProfessor =
    utilizador?.perfis?.some((p) => p.toLowerCase().includes("prof")) ||
    utilizador?.perfil?.toLowerCase().includes("prof") ||
    false;

  useEffect(() => {
    if (!utilizador) return;

    fetchAgenda();

    apiAuthFetch("/api/escola/modalidades")
      .then((res) => setModalidadesDisponiveis(Array.isArray(res) ? res : []))
      .catch((err) => console.error("Erro ao carregar modalidades", err));

    if (isEE) {
      apiAuthFetch("/api/agenda/educandos")
        .then((res) => {
          const lista = Array.isArray(res) ? res : [];
          setEducandos(lista);
          if (lista.length === 1) {
            const idAuto = String(lista[0].id_aluno);
            setAlunoParaInscricao(idAuto);
            fetchModalidadesInscritas(idAuto);
          }
        })
        .catch((err) => console.error("Erro ao carregar educandos", err));
    }
  }, [utilizador]);

  // Quando o aluno selecionado muda, recarrega as modalidades inscritas
  useEffect(() => {
    if (isEE && alunoParaInscricao) {
      fetchModalidadesInscritas(alunoParaInscricao);
    } else {
      setModalidadesInscritas([]);
    }
  }, [alunoParaInscricao]);

  // Modalidades únicas para o filtro
  const modalidadesUnicas = useMemo(() => {
    const map = new Map();
    horarios.forEach((h) => {
      if (h.id_modalidade && h.modalidade) {
        map.set(h.id_modalidade, h.modalidade);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [horarios]);

  // Horários filtrados
  const horariosFiltrados = useMemo(() => {
    let filtrado = horarios;
    if (filtroAluno !== "TODOS") {
      filtrado = filtrado.filter(
        (h) =>
          String(h.id_aluno) === String(filtroAluno) || h.id_aluno === null,
      );
    }
    if (!isProfessor && filtroModalidade !== "TODAS") {
      filtrado = filtrado.filter(
        (h) => String(h.id_modalidade) === String(filtroModalidade),
      );
    }
    return filtrado;
  }, [horarios, filtroAluno, filtroModalidade, isProfessor]);

  // Grelha de eventos
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

  // Submeter inscrição
  const handleAdicionarModalidade = async () => {
    const idDoAluno = isEE
      ? Number(alunoParaInscricao)
      : Number(utilizador?.id || utilizador?.id_utilizador);
    if (!idDoAluno || !novaModalidade) return;

    setIsSubmitting(true);
    try {
      await apiAuthFetch("/api/agenda/alunos/modalidades", {
        method: "POST",
        body: { idAluno: idDoAluno, idModalidade: Number(novaModalidade) },
      });
      setAlertModal({
        isOpen: true,
        mensagem: "Inscrição efetuada com sucesso!",
      });
      setNovaModalidade("");
      fetchAgenda();
      fetchModalidadesInscritas(alunoParaInscricao);
    } catch (error) {
      setAlertaExcl({
        isOpen: true,
        message: error.message || "Erro ao inscrever na modalidade.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmar e remover inscrição
  const handleConfirmarRemocao = async () => {
    const idDoAluno = Number(alunoParaInscricao);
    const idModalidade = confirmarRemocao.idModalidade;
    setIsRemoving(true);
    try {
      await apiAuthFetch("/api/agenda/alunos/modalidades", {
        method: "DELETE",
        body: { idAluno: idDoAluno, idModalidade },
      });
      setConfirmarRemocao({
        isOpen: false,
        idModalidade: null,
        nomeModalidade: "",
      });
      setAlertModal({
        isOpen: true,
        mensagem: "Inscrição removida com sucesso!",
      });
      fetchAgenda();
      fetchModalidadesInscritas(alunoParaInscricao);
    } catch (error) {
      setAlertaExcl({
        isOpen: true,
        message: error.message || "Erro ao remover a inscrição.",
      });
    } finally {
      setIsRemoving(false);
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
      <style>{coachingStyle}</style>
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
        {/* CALENDÁRIO */}
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
                            {eventosBloco.map((evt, idx) =>
                              evt.tipo === "coaching" ? (
                                <div
                                  key={idx}
                                  className="event-block event-block--coaching"
                                >
                                  <span className="event-block__badge">
                                    Coaching
                                  </span>
                                  <span className="event-time">
                                    {formatHoraCurta(evt.hora_inicio)} –{" "}
                                    {formatHoraCurta(evt.hora_fim)}
                                  </span>
                                  <h4 className="event-title">
                                    {evt.modalidade}
                                  </h4>
                                  <p className="event-student">
                                    Prof: {evt.professor}
                                    {evt.data_aula && (
                                      <>
                                        <br />
                                        {new Date(
                                          evt.data_aula,
                                        ).toLocaleDateString("pt-PT")}
                                      </>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div
                                  key={idx}
                                  className={`event-block ${modalidadeParaClasse(evt.modalidade)}`}
                                >
                                  <span className="event-time">
                                    {formatHoraCurta(evt.hora_inicio)} –{" "}
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
                              ),
                            )}
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
          {/* EE / ALUNO */}
          {!isProfessor && (
            <div className="sidebar-card">
              <h3>Visualizar Agenda</h3>
              <p className="sidebar-subtitle" style={{ marginBottom: "20px" }}>
                Abaixo encontras o teu horário letivo. Podes filtrar a grelha
                por modalidade.
              </p>

              {/* Filtro por aluno — só aparece se tiver mais de 1 educando */}
              {isEE && educandos.length > 1 && (
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <select
                    className="form-control"
                    value={filtroAluno}
                    onChange={(e) => setFiltroAluno(e.target.value)}
                    style={{ fontWeight: "bold" }}
                  >
                    <option value="TODOS">Todos os Alunos</option>
                    {educandos.map((a) => (
                      <option key={a.id_aluno} value={a.id_aluno}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por modalidade — só aparece após clicar, default "Ver todas" */}
              {modalidadesUnicas.length > 0 && (
                <div className="form-group" style={{ marginBottom: "10px" }}>
                  <select
                    className="form-control"
                    value={filtroModalidade}
                    onChange={(e) => setFiltroModalidade(e.target.value)}
                    style={{ fontWeight: "bold" }}
                  >
                    <option value="TODAS">Ver todas</option>
                    {modalidadesUnicas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {/* Dropdown de aluno — só se tiver mais de 1 */}
              {isEE && educandos.length > 1 && (
                <div className="form-group" style={{ marginBottom: "12px" }}>
                  <select
                    className="form-control"
                    value={alunoParaInscricao}
                    onChange={(e) => setAlunoParaInscricao(e.target.value)}
                  >
                    <option value="">Selecione o Aluno...</option>
                    {educandos.map((a) => (
                      <option key={a.id_aluno} value={a.id_aluno}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Se só tem 1 educando, mostra o nome */}
              {isEE && educandos.length === 1 && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#555",
                    marginBottom: "12px",
                  }}
                >
                  Aluno: <strong>{educandos[0].nome}</strong>
                </p>
              )}

              {/* Modalidades em que o aluno já está inscrito */}
              {isEE && alunoParaInscricao && (
                <div style={{ marginBottom: "16px" }}>
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "#888",
                      marginBottom: "8px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Modalidades inscritas
                  </p>
                  {modalidadesInscritas.length === 0 ? (
                    <p
                      style={{
                        fontSize: "0.82rem",
                        color: "#aaa",
                        fontStyle: "italic",
                      }}
                    >
                      Sem inscrições ainda.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      {modalidadesInscritas.map((m) => (
                        <div
                          key={m.id_modalidade}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "#f9f5ef",
                            border: "1px solid #e8ddd0",
                            borderRadius: "8px",
                            padding: "7px 10px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.85rem",
                              fontWeight: "600",
                              color: "#4a3728",
                            }}
                          >
                            {m.nome}
                          </span>
                          <button
                            onClick={() =>
                              setConfirmarRemocao({
                                isOpen: true,
                                idModalidade: m.id_modalidade,
                                nomeModalidade: m.nome,
                              })
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#c0392b",
                              fontSize: "1rem",
                              lineHeight: 1,
                              padding: "2px 4px",
                              borderRadius: "4px",
                            }}
                            title="Remover inscrição"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Dropdown de nova modalidade */}
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <select
                  className="form-control"
                  value={novaModalidade}
                  onChange={(e) => setNovaModalidade(e.target.value)}
                >
                  <option value="">Selecione a Modalidade...</option>
                  {modalidadesDisponiveis
                    .filter(
                      (m) =>
                        !modalidadesInscritas.some(
                          (mi) => mi.id_modalidade === m.id_modalidade,
                        ),
                    )
                    .map((m) => (
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
                  onClick={
                    isProfessor
                      ? irParaMinhaAgendaProfessor
                      : irParaMinhaAgendaEE
                  }
                  style={{ cursor: "pointer" }}
                >
                  Coaching
                </strong>{" "}
                no menu em cima.
              </p>
            </div>
          )}

          {/* PROFESSOR */}
          {isProfessor && (
            <>
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
                            {formatHoraCurta(aula.hora_inicio)} –{" "}
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
                <span></span> Rua das Artes, nº 123, Braga
              </li>
              <li>
                <span></span> +351 000 000 000
              </li>
              <li>
                <span></span> geral@vivadarte.pt
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

      {/* ── MODAIS ── */}

      {/* Sucesso inscrição */}
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

      {/* Erro */}
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

      {/* Confirmação de remoção */}
      {confirmarRemocao.isOpen && (
        <div className="modal-alerta-overlay">
          <div className="modal-alerta-box">
            <h3 className="modal-alerta-titulo">Remover Inscrição</h3>
            <p className="modal-alerta-mensagem">
              Tens a certeza que queres remover a inscrição em{" "}
              <strong>{confirmarRemocao.nomeModalidade}</strong>?
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                className="btn-gold modal-alerta-btn"
                onClick={handleConfirmarRemocao}
                disabled={isRemoving}
              >
                {isRemoving ? "A remover..." : "Confirmar"}
              </button>
              <button
                type="button"
                className="btn-dark modal-alerta-btn"
                onClick={() =>
                  setConfirmarRemocao({
                    isOpen: false,
                    idModalidade: null,
                    nomeModalidade: "",
                  })
                }
                disabled={isRemoving}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
