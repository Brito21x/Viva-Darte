import React, { useState, useEffect, useRef } from "react";
import "./Landing.css";
import logoImg from "../../assets/logo.png";
import { isProfessorUtilizador } from "../../utils/perfilUtilizador";

export default function Landing({
  irParaLogin,
  irParaRegisto,
  irParaVendaFigurinos,
  irParaEmprestimos,
  irParaMinhaAgendaProfessor,
  irParaMinhaAgendaEE,
}) {
  // --- ESTADOS DE CONTROLO DE SESSÃO E CONTEXTO ---
  const [utilizador, setUtilizador] = useState(null);
  const [modoPortal, setModoPortal] = useState(false);

  // --- REFERÊNCIAS DOS ELEMENTOS DO CARROSSEL (DOM) ---
  const modalidadesRef = useRef(null);
  const professoresRef = useRef(null);

  // --- LEITURA DA SESSÃO LOCAL AO INICIALIZAR ---
  useEffect(() => {
    const userGuardado = localStorage.getItem("viva_user");
    if (userGuardado) {
      setUtilizador(JSON.parse(userGuardado));
      setModoPortal(true);
    }
    document.title = "Viva D'arte | Escola de Dança";
  }, []);

  // --- ENCERRAMENTO DE SESSÃO (LOGOUT) ---
  const handleLogout = () => {
    localStorage.removeItem("viva_user");
    localStorage.removeItem("viva_token");
    localStorage.removeItem("token");
    setUtilizador(null);
    setModoPortal(false);
    window.location.reload();
  };

  // --- RETORNO AO TOPO DA PÁGINA INICIAL ---
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

  // --- DESLOCAMENTO MANUAL DO CARROSSEL ---
  const scrollCarrossel = (ref, direcao, tipo) => {
    if (ref.current) {
      const scrollAmount = tipo === "unico" ? ref.current.clientWidth : 420;
      ref.current.scrollBy({
        left: direcao === "esquerda" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // --- TIMEOUT AUTOMÁTICO PARA SCROLL DO CARROSSEL DE PROFESSORES ---
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
      {/* --- BARRA DE NAVEGAÇÃO (NAVBAR) --- */}
      <nav className="navbar">
        <div className="nav-brand">
          <img src={logoImg} alt="Logo" className="nav-logo-img" />
          <span className="texto-viva-simples">
            {"VIVA D'ARTE".split("").map((letra, index) => (
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
              <li
                className="student-menu-group"
                onClick={() => setModoPortal(true)}
              >
                <div className="student-menu-bg">
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
            </>
          ) : (
            <>
              <li className="nav-separator">|</li>
              <li>
                <a
                  href="#minha-agenda"
                  className="special-link"
                  onClick={(e) => {
                    e.preventDefault();
                    if (isProfessorUtilizador(utilizador)) {
                      irParaMinhaAgendaProfessor?.();
                    } else {
                      irParaMinhaAgendaEE?.();
                    }
                  }}
                >
                  Minha agenda
                </a>
              </li>
              <li>
                <a
                  href="#emprestimos"
                  className="special-link"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaEmprestimos();
                  }}
                >
                  Empréstimos de peças
                </a>
              </li>
              <li>
                <a
                  href="#figurinos"
                  className="special-link"
                  onClick={(e) => {
                    e.preventDefault();
                    irParaVendaFigurinos();
                  }}
                >
                  Venda de figurinos
                </a>
              </li>
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

      {/* --- 1. APRESENTAÇÃO PRINCIPAL (HERO) --- */}
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

      {/* --- 2. SECÇÃO SOBRE NÓS --- */}
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

      {/* --- 3. SECÇÃO MODALIDADES --- */}
      <section id="modalidades" className="section-container bg-light">
        <div className="section-header">
          <h2>Modalidades</h2>
          <p>Descobre o estilo que faz o teu coração vibrar.</p>
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
                <span className="emoji-gigante">🩰</span>
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Técnica e Elegância</span>
                <p>
                  A base de todas as danças, focada na postura, flexibilidade e
                  disciplina artística para alunos de todas as idades.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <span className="emoji-gigante">👟</span>
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Ritmo e Atitude</span>
                <p>
                  Explora a cultura urbana através de coreografias dinâmicas,
                  focadas em groove, coordenação e muita energia.
                </p>
              </div>
            </div>

            <div className="modalidade-card">
              <div className="modalidade-left">
                <span className="emoji-gigante">💃</span>
              </div>
              <div className="modalidade-right">
                <span className="subtitle">Expressão Livre</span>
                <p>
                  Movimentos fluidos e expressionais corporais que quebram as
                  barreiras do estilo clássico, ligando o corpo e a mente.
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

      {/* --- 4. SECÇÃO EQUIPA DOCENTE (PROFESSORES) --- */}
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
                <div className="prof-avatar ana"></div>
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
                <div className="prof-avatar carlos"></div>
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
                <div className="prof-avatar joana"></div>
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

      {/* --- INFORMAÇÕES DE RODAPÉ (FOOTER) --- */}
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
