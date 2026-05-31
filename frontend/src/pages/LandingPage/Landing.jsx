import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./Landing.css";
import logoImg from "../../assets/logo.png";
import { isProfessorUtilizador } from "../../utils/perfilUtilizador";

/*
import anaSilva from "../../assets/ana-silva.jpg";
import carlosMendes from "../../assets/carlos-mendes.jpg";
import joanaFerreira from "../../assets/joana-ferreira.jpg";

import acrobatica from "../../assets/acrobatica.jpg";
import acrodance from "../../assets/acrodance.jpg";
import ballet from "../../assets/ballet.jpg";
import dançaUrbana from "../../assets/dança-urbana.jpg";
import hipHop from "../../assets/hip-hop.jpg";
import jazz from "../../assets/jazz.jpg";
*/

/**
 * Componente principal da página de landing da Viva D'arte.
 *
 * Responsabilidades:
 * - Renderizar a navbar com navegação condicional (visitante / aluno / professor)
 * - Gerir o estado de autenticação a partir do localStorage
 * - Controlar o modo portal (vista do utilizador autenticado)
 * - Apresentar as secções Hero, Sobre Nós, Modalidades e Professores
 * - Gerir os carrosseis automáticos de modalidades e professores
 *
 * @param {Function} irParaLogin               - Navega para a página de login
 * @param {Function} irParaRegisto             - Navega para a página de registo
 * @param {Function} irParaFigurinos           - Navega para o marketplace de figurinos
 * @param {Function} irParaMinhaAgendaProfessor - Navega para a agenda do professor
 * @param {Function} irParaMinhaAgendaEE       - Navega para a agenda do encarregado de educação
 */
export default function Landing({
  irParaLogin,
  irParaRegisto,
  irParaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
  irParaAgenda,
}) {
  /* ─── Estado local ─────────────────────────────────────────────────────── */
  const [utilizador, setUtilizador] = useState(null);
  const [modoPortal, setModoPortal] = useState(false);

  /** Controla a visibilidade do menu hamburger em mobile */
  const [menuAberto, setMenuAberto] = useState(false);

  /* ─── Referências para os carrosseis ───────────────────────────────────── */
  const modalidadesRef = useRef(null);
  const professoresRef = useRef(null);

  /* ─── Efeito: inicialização — leitura do utilizador guardado ───────────── */
  useEffect(() => {
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) {
      setUtilizador(JSON.parse(userGuardado));
      setModoPortal(true);
    }
    document.title = "Viva D'arte | Escola de Dança";
  }, []);

  /* ─── Handler: logout do utilizador ────────────────────────────────────── */
  const handleLogout = () => {
    localStorage.removeItem("viva_user");
    localStorage.removeItem("viva_token");
    localStorage.removeItem("token");
    setUtilizador(null);
    setModoPortal(false);
    window.location.reload();
  };

  /**
   * Navega para a secção inicial (#inicio) e desativa o modo portal.
   * Utiliza scrollIntoView para uma transição suave.
   */
  const handleIrParaInicio = (e) => {
    if (e) e.preventDefault();
    setModoPortal(false);
    setMenuAberto(false);

    window.history.replaceState(null, "", window.location.pathname);

    const heroSection = document.getElementById("inicio");
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  /**
   * Avança ou recua o carrossel indicado pela referência.
   *
   * @param {React.RefObject} ref    - Referência ao elemento do carrossel
   * @param {"esquerda"|"direita"} direcao - Sentido do scroll
   * @param {"unico"|"multiplo"} tipo       - "unico" desloca uma largura completa;
   *                                          "multiplo" desloca 420 px
   */
  const scrollCarrossel = (ref, direcao, tipo) => {
    if (ref.current) {
      const scrollAmount = tipo === "unico" ? ref.current.clientWidth : 420;
      ref.current.scrollBy({
        left: direcao === "esquerda" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  /* ─── Efeito: auto-scroll do carrossel de Modalidades (6 s) ────────────── */
  useEffect(() => {
    const autoScroll = setInterval(() => {
      if (modalidadesRef.current) {
        const container = modalidadesRef.current;

        const isAtEnd =
          container.scrollLeft + container.clientWidth >=
          container.scrollWidth - 10;

        if (isAtEnd) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          container.scrollBy({
            left: container.clientWidth,
            behavior: "smooth",
          });
        }
      }
    }, 6000);

    return () => clearInterval(autoScroll);
  }, []);

  /* ─── Efeito: auto-scroll do carrossel de Professores (6 s) ────────────── */
  useEffect(() => {
    const autoScroll = setInterval(() => {
      if (professoresRef.current) {
        const container = professoresRef.current;

        const isAtEnd =
          container.scrollLeft + container.clientWidth >=
          container.scrollWidth - 10;

        if (isAtEnd) {
          container.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          container.scrollBy({
            left: container.clientWidth,
            behavior: "smooth",
          });
        }
      }
    }, 6000);

    return () => clearInterval(autoScroll);
  }, []);

  /* ─── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="landing-container">
      {/* ================================================================
          NAVBAR
          Sticky no topo; adapta os itens consoante o estado de autenticação.
          Em mobile exibe um botão hamburger que expande o menu.
          ================================================================ */}
      <nav className="navbar">
        {/* Marca / logótipo */}
        <div className="nav-brand">
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span className="texto-viva-simples">
            {"VIVA D'ARTE".split("").map((letra, index) => (
              /*
               * Cada letra recebe um animationDelay dinâmico (baseado no índice)
               * para criar o efeito de onda. O whiteSpace é definido via CSS
               * na classe .letra-ritmo para preservar o espaço entre palavras.
               */
              <span
                key={index}
                className="letra-ritmo"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {letra}
              </span>
            ))}
          </span>
        </div>

        {/* Botão hamburger — visível apenas em mobile (≤ 768 px) */}
        <button
          className={`hamburger${menuAberto ? " ativo" : ""}`}
          onClick={() => setMenuAberto((prev) => !prev)}
          aria-label="Abrir menu de navegação"
          aria-expanded={menuAberto}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Desktop: nav-content normal dentro da navbar */}
        <div
          className={`nav-content nav-content-desktop${menuAberto ? " aberto" : ""}`}
        >
          <ul className="nav-menu">
            <li>
              <a href="#inicio" onClick={handleIrParaInicio}>
                Início
              </a>
            </li>
            <li className="nav-separator">|</li>
            {(!utilizador || !modoPortal) && (
              <>
                <li>
                  <a href="#sobre" onClick={() => setMenuAberto(false)}>
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#modalidades" onClick={() => setMenuAberto(false)}>
                    Modalidades
                  </a>
                </li>
                <li>
                  <a href="#professores" onClick={() => setMenuAberto(false)}>
                    Professores
                  </a>
                </li>
              </>
            )}
            {utilizador && modoPortal && (
              <>
                {isProfessorUtilizador(utilizador) ? (
                  <>
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
                        href="#minha-agenda-professor"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaMinhaAgendaProfessor?.();
                        }}
                      >
                        Coaching
                      </a>
                    </li>
                    <li>
                      <a
                        href="#figurinos"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaFigurinos();
                        }}
                      >
                        Marketplace
                      </a>
                    </li>
                  </>
                ) : (
                  <>
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
                        href="#minha-agenda-ee"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaMinhaAgendaEE?.();
                        }}
                      >
                        Coaching
                      </a>
                    </li>
                    <li>
                      <a
                        href="#figurinos"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaFigurinos();
                        }}
                      >
                        Marketplace
                      </a>
                    </li>
                  </>
                )}
              </>
            )}
            {utilizador && !modoPortal && (
              <li className="nav-portal-pill">
                <div
                  className="student-menu-bg"
                  onClick={() => {
                    setModoPortal(true);
                    setMenuAberto(false);
                  }}
                >
                  <a
                    href="#portal"
                    className="student-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    {isProfessorUtilizador(utilizador)
                      ? "Portal do Professor"
                      : "Portal do EE"}
                  </a>
                </div>
              </li>
            )}
          </ul>
          <div className="nav-actions">
            {utilizador ? (
              <div className="user-profile">
                <span className="welcome-text">
                  Olá, <strong>{utilizador.nome}</strong>
                </span>
                <button className="btn-logout" onClick={handleLogout}>
                  Sair
                </button>
              </div>
            ) : (
              <>
                <button className="btn-text" onClick={irParaLogin}>
                  Iniciar Sessão
                </button>
                <button className="btn-dark" onClick={irParaRegisto}>
                  Criar Conta
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile: nav-content via portal no document.body —
          escapa completamente qualquer overflow:hidden nos containers pai */}
      {createPortal(
        <div
          className={`nav-content nav-content-mobile${menuAberto ? " aberto" : ""}`}
        >
          <ul className="nav-menu">
            <li>
              <a href="#inicio" onClick={handleIrParaInicio}>
                Início
              </a>
            </li>
            {(!utilizador || !modoPortal) && (
              <>
                <li>
                  <a href="#sobre" onClick={() => setMenuAberto(false)}>
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#modalidades" onClick={() => setMenuAberto(false)}>
                    Modalidades
                  </a>
                </li>
                <li>
                  <a href="#professores" onClick={() => setMenuAberto(false)}>
                    Professores
                  </a>
                </li>
              </>
            )}
            {utilizador && modoPortal && (
              <>
                {isProfessorUtilizador(utilizador) ? (
                  <>
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
                        href="#minha-agenda-professor"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaMinhaAgendaProfessor?.();
                        }}
                      >
                        Coaching
                      </a>
                    </li>
                    <li>
                      <a
                        href="#figurinos"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaFigurinos();
                        }}
                      >
                        Marketplace
                      </a>
                    </li>
                  </>
                ) : (
                  <>
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
                        href="#minha-agenda-ee"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaMinhaAgendaEE?.();
                        }}
                      >
                        Coaching
                      </a>
                    </li>
                    <li>
                      <a
                        href="#figurinos"
                        className="special-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuAberto(false);
                          irParaFigurinos();
                        }}
                      >
                        Marketplace
                      </a>
                    </li>
                  </>
                )}
              </>
            )}
            {utilizador && !modoPortal && (
              <li className="nav-portal-pill">
                <div
                  className="student-menu-bg"
                  onClick={() => {
                    setModoPortal(true);
                    setMenuAberto(false);
                  }}
                >
                  <a
                    href="#portal"
                    className="student-link"
                    onClick={(e) => e.preventDefault()}
                  >
                    {isProfessorUtilizador(utilizador)
                      ? "Portal do Professor"
                      : "Portal do EE"}
                  </a>
                </div>
              </li>
            )}
          </ul>
          <div className="nav-actions">
            {utilizador ? (
              <div className="user-profile">
                <span className="welcome-text">
                  Olá, <strong>{utilizador.nome}</strong>
                </span>
                <button className="btn-logout" onClick={handleLogout}>
                  Sair
                </button>
              </div>
            ) : (
              <>
                <button className="btn-text" onClick={irParaLogin}>
                  Iniciar Sessão
                </button>
                <button className="btn-dark" onClick={irParaRegisto}>
                  Criar Conta
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* ================================================================
          1. SECÇÃO HERO — Início
          Imagem de fundo com parallax e texto de boas-vindas.
          ================================================================ */}
      <header id="inicio" className="hero">
        <div className="hero-content">
          <h1>
            A Arte de Dançar <br />{" "}
            <span className="text-highlight">Começa Aqui.</span>
          </h1>
          <p>
            Mais do que uma escola, somos o teu palco. Explora as nossas
            modalidades e gere a tua vida artística num só lugar.
          </p>
        </div>
      </header>

      {/* ================================================================
          2. SECÇÃO SOBRE NÓS
          Texto institucional centrado.
          ================================================================ */}
      <section id="sobre" className="section-container">
        <div className="sobre-layout">
          <h2>A Nossa Escola</h2>
          <div className="sobre-texto">
            <p>
              A <strong>Viva D'arte</strong> nasceu da visão de criar um
              ecossistema onde a dança é celebrada em todas as suas vertentes.
              Mais do que uma instituição de ensino, somos uma comunidade
              vibrante focada no desenvolvimento técnico, artístico e humano de
              cada aluno. Aliamos uma infraestrutura moderna a um ambiente de
              suporte e acolhimento, garantindo que os nossos bailarinos tenham
              as ferramentas necessárias para atingirem o seu potencial máximo.
              Na Viva D'arte, preparamos talentos para brilharem com confiança,
              tanto no palco como nos desafios da vida.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================
          3. SECÇÃO MODALIDADES
          Carrossel horizontal com auto-scroll a cada 6 segundos.
          ================================================================ */}
      <section id="modalidades" className="section-container bg-light">
        <div className="section-header">
          <h2>Modalidades</h2>
        </div>

        <div className="carousel-wrapper">
          <button
            className="carousel-btn left"
            onClick={() =>
              scrollCarrossel(modalidadesRef, "esquerda", "multiplo")
            }
          >
            &#8249;
          </button>

          <div className="carousel-container" ref={modalidadesRef}>
            <div className="modalidade-card">
              <div className="modalidade-left">
                <img src="" alt="Acrobática" className="imagem-modalidade" />
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Acrobática</span>
                <p>
                  Combina a técnica da dança com elementos de ginástica,
                  desenvolvendo força, flexibilidade e um enorme controlo
                  corporal.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <img src="" alt="Acrodance" className="imagem-modalidade" />
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Acrodance</span>
                <p>
                  Uma fusão perfeita e fluida entre a arte e expressão da dança
                  e o atletismo da acrobacia em movimentos dinâmicos.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <img src="" alt="Ballet" className="imagem-modalidade" />
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Ballet</span>
                <p>
                  A base clássica de todas as danças. Foca-se na graciosidade,
                  postura, precisão técnica e disciplina.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <img src="" alt="Dança Urbana" className="imagem-modalidade" />
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Dança Urbana</span>
                <p>
                  Movimentos fortes nascidos nas ruas, englobando vários estilos
                  repletos de atitude, energia e criatividade.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <img src="" alt="Hip Hop" className="imagem-modalidade" />
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Hip Hop</span>
                <p>
                  Ritmo contagiante e expressão livre. Aprende coreografias
                  dinâmicas ao som das melhores batidas urbanas.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <img src="" alt="Jazz" className="imagem-modalidade" />
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Jazz</span>
                <p>
                  Uma dança enérgica e versátil que mistura técnica clássica com
                  movimentos soltos, ritmados e muita expressão teatral.
                </p>
              </div>
            </div>
          </div>

          <button
            className="carousel-btn right"
            onClick={() =>
              scrollCarrossel(modalidadesRef, "direita", "multiplo")
            }
          >
            &#8250;
          </button>
        </div>
      </section>

      {/* ================================================================
          4. SECÇÃO PROFESSORES
          Carrossel de item único com auto-scroll a cada 6 segundos.
          ================================================================ */}
      <section id="professores" className="section-container">
        <div className="section-header">
          <h2>Os Nossos Professores</h2>
        </div>

        <div className="carousel-wrapper">
          <button
            className="carousel-btn left"
            onClick={() => scrollCarrossel(professoresRef, "esquerda", "unico")}
          >
            &#8249;
          </button>

          <div className="carousel-container single-item" ref={professoresRef}>
            <div className="horizontal-card">
              <div className="card-left">
                <img
                  src=""
                  alt="Ana Silva - Ballet Clássico"
                  className="prof-avatar-img"
                />
              </div>
              <div className="card-right">
                <h3>Ana Silva</h3>
                <span className="subtitle">Ballet Clássico</span>
                <p>
                  Formada pelo Conservatório Real, a Ana traz 10 anos de
                  experiência internacional para as nossas salas, focando-se na
                  precisão técnica e no bem-estar dos alunos.
                </p>
              </div>
            </div>

            <div className="horizontal-card">
              <div className="card-left">
                <img
                  src=""
                  alt="Carlos Mendes - Hip Hop & Dança Urbana"
                  className="prof-avatar-img"
                />
              </div>
              <div className="card-right">
                <h3>Carlos Mendes</h3>
                <span className="subtitle">Hip Hop & Dança Urbana</span>
                <p>
                  Com atuações nos maiores palcos da Europa, o Carlos transmite
                  a sua energia contagiante e técnica apurada a todos os que
                  entram na sua aula.
                </p>
              </div>
            </div>

            <div className="horizontal-card">
              <div className="card-left">
                <img
                  src=""
                  alt="Joana Ferreira - Dança Acrobática"
                  className="prof-avatar-img"
                />
              </div>
              <div className="card-right">
                <h3>Joana Ferreira</h3>
                <span className="subtitle">Dança Acrobática</span>
                <p>
                  Especialista em artes aéreas e acrobacia, a nossa professora
                  combina força e graciosidade, guiando os alunos na superação
                  de limites com total segurança e domínio técnico.
                </p>
              </div>
            </div>
          </div>

          <button
            className="carousel-btn right"
            onClick={() => scrollCarrossel(professoresRef, "direita", "unico")}
          >
            &#8250;
          </button>
        </div>
      </section>

      {/* ================================================================
          FOOTER
          Grelha de três colunas: Contacto, Links Rápidos, Redes Sociais.
          ================================================================ */}
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
                <a href="#sobre">Sobre Nós</a>
              </li>
              <li>
                <a href="#professores">Os Nossos Professores</a>
              </li>
              <li>
                <a href="#modalidades">Modalidades</a>
              </li>
            </ul>
          </div>

          <div className="footer-column">
            <h3>Redes Sociais</h3>
            <div className="social-icons-only">
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
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
                href="https://www.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
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
    </div>
  );
}
