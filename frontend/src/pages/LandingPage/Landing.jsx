import React, { useState, useEffect, useRef } from "react";
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

export default function Landing({
  irParaLogin,
  irParaRegisto,
  irParaFigurinos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  const [utilizador, setUtilizador] = useState(null);
  const [modoPortal, setModoPortal] = useState(false);

  const modalidadesRef = useRef(null);
  const professoresRef = useRef(null);

  useEffect(() => {
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) {
      setUtilizador(JSON.parse(userGuardado));
      setModoPortal(true);
    }
    document.title = "Viva D'arte | Escola de Dança";
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("viva_user");
    localStorage.removeItem("viva_token");
    localStorage.removeItem("token");
    setUtilizador(null);
    setModoPortal(false);
    window.location.reload();
  };

  const handleIrParaInicio = (e) => {
    if (e) e.preventDefault();
    setModoPortal(false);

    window.history.replaceState(null, "", window.location.pathname);

    const heroSection = document.getElementById("inicio");
    if (heroSection) {
      heroSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  };

  const scrollCarrossel = (ref, direcao, tipo) => {
    if (ref.current) {
      const scrollAmount = tipo === "unico" ? ref.current.clientWidth : 420;
      ref.current.scrollBy({
        left: direcao === "esquerda" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

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

  return (
    <div className="landing-container">
      {/* --- NAVBAR --- */}
      <nav className="navbar">
        <div className="nav-brand">
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span className="texto-viva-simples">
            {"VIVA D'ARTE".split("").map((letra, index) => (
              <span
                key={index}
                className="letra-ritmo"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  whiteSpace: "pre",
                }}
              >
                {letra}
              </span>
            ))}
          </span>
        </div>

        <ul className="nav-menu">
          <li>
            <a href="#inicio" onClick={handleIrParaInicio}>
              Início
            </a>
          </li>

          {!utilizador ? (
            <>
              <li>
                <a href="#sobre">Sobre Nós</a>
              </li>
              <li>
                <a href="#modalidades">Modalidades</a>
              </li>
              <li>
                <a href="#professores">Professores</a>
              </li>
            </>
          ) : !modoPortal ? (
            <>
              <li>
                <a href="#sobre">Sobre Nós</a>
              </li>
              <li>
                <a href="#modalidades">Modalidades</a>
              </li>
              <li>
                <a href="#professores">Professores</a>
              </li>

              <li className="nav-separator">|</li>
              {isProfessorUtilizador(utilizador) ? (
                <>
                  <li
                    className="student-menu-group"
                    onClick={() => setModoPortal(true)}
                  >
                    <div
                      className="student-menu-bg"
                      style={{ cursor: "pointer", padding: "8px 20px" }}
                    >
                      <a
                        href="#portal"
                        className="student-link"
                        onClick={(e) => e.preventDefault()}
                      >
                        Portal do Professor
                      </a>
                    </div>
                  </li>
                </>
              ) : (
                <>
                  <li
                    className="student-menu-group"
                    onClick={() => setModoPortal(true)}
                  >
                    <div
                      className="student-menu-bg"
                      style={{ cursor: "pointer", padding: "8px 20px" }}
                    >
                      <a
                        href="#portal"
                        className="student-link"
                        onClick={(e) => e.preventDefault()}
                      >
                        Portal do EE
                      </a>
                    </div>
                  </li>
                </>
              )}
            </>
          ) : (
            <>
              <li className="nav-separator">|</li>
              {isProfessorUtilizador(utilizador) ? (
                <>
                  <li>
                    <a
                      href="#minha-agenda-professor"
                      className="special-link"
                      onClick={(e) => {
                        e.preventDefault();
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
                      href="#minha-agenda-ee"
                      className="special-link"
                      onClick={(e) => {
                        e.preventDefault();
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
      </nav>

      {/* 1. INÍCIO  */}
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

      {/* 2. SOBRE NÓS */}
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

      {/* 3. MODALIDADES */}
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

      {/* 4. PROFESSORES */}
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

      {/* --- FOOTER  --- */}
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
