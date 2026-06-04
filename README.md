<div align="center">

# Viva D'arte

### Plataforma de Gestão para Escolas de Dança

> Aplicação web full-stack, em produção, que centraliza toda a operação de uma escola de dança — ligando coordenação, professores e encarregados de educação numa plataforma única, orientada a perfis e protegida de ponta a ponta.

[![Em Produção](https://img.shields.io/badge/Estado-Em_Produção-success?style=flat-square&logo=railway&logoColor=white)](https://vivadarte-production.up.railway.app)
[![API](https://img.shields.io/badge/API-Operacional-46E3B7?style=flat-square&logo=render&logoColor=black)](https://api-vivadarte.onrender.com/api/health)
[![Base de Dados](https://img.shields.io/badge/AWS_RDS-MySQL_8-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/rds/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Testes](https://img.shields.io/badge/Testes-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev)
[![Docs](https://img.shields.io/badge/Documentação-JSDoc-orange?style=flat-square)](https://github.com/Brito21x/vivadarte)

---

| 🌐 Aplicação | 🔧 Estado da API | 👤 Painel de Coordenação |
|:---:|:---:|:---:|
| [vivadarte-production.up.railway.app](https://vivadarte-production.up.railway.app) | [/api/health](https://api-vivadarte.onrender.com/api/health) | [/admin](https://vivadarte-production.up.railway.app/admin) |

</div>

---

## Índice

- [Contexto Académico](#-contexto-académico)
- [Visão Geral](#-visão-geral)
- [O Problema e a Solução](#-o-problema-e-a-solução)
- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#-stack-tecnológica)
- [Arquitetura do Sistema](#-arquitetura-do-sistema)
- [Decisões de Engenharia](#-decisões-de-engenharia)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Referência da API](#-referência-da-api)
- [Testes](#-testes)
- [Começar](#-começar)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Perfis de Utilizador](#-perfis-de-utilizador)
- [Segurança](#-segurança)
- [Documentação](#-documentação)
- [Autor](#-autor)

---

## 🎓 Contexto Académico

| | |
|---|---|
| **Instituição** | Instituto Politécnico do Cávado e do Ave (IPCA) |
| **Curso** | Engenharia de Sistemas Informáticos |
| **Ano** | 2.º Ano |
| **Tipo de Projeto** | Projeto de Desenvolvimento de Software + Programação WEB (Projeto 50+10) |

---

## 🎯 Visão Geral

A **Viva D'arte** é uma plataforma digital que dá resposta a um desafio operacional concreto das escolas de artes performativas: a gestão dispersa, manual e pouco transparente do dia a dia letivo.

A solução materializa um ecossistema digital coeso onde cada interveniente — coordenação, professor e encarregado de educação — interage através de uma interface desenhada à medida do seu papel, sustentada por uma API REST segura. O sistema impõe controlo de acesso baseado em perfis, mantém um registo de auditoria completo das operações sensíveis e distribui-se de forma resiliente por três alvos de implementação: uma CDN estática na Railway, um runtime Node.js na Render e uma base de dados relacional gerida na AWS RDS.

O projeto foi concebido, desenhado e implementado de ponta a ponta como um esforço individual, abrangendo análise de requisitos, modelação de dados, desenho da API, engenharia de frontend, testes automatizados e implementação na cloud.

---

## 💡 O Problema e a Solução

As escolas de dança operam frequentemente com ferramentas fragmentadas — mensagens informais, folhas de cálculo dispersas e registos em papel. Isto traduz-se em três problemas recorrentes:

| Desafio | Resposta da Plataforma |
|---|---|
| **Comunicação dispersa** entre coordenação, professores e famílias | Canal único e centralizado com fluxos de trabalho dedicados a cada perfil |
| **Agendamento manual** de aulas e sessões privadas | Grelha semanal interativa com gestão de disponibilidades e pedidos em tempo real |
| **Opacidade financeira** no acompanhamento de pagamentos | Motor de preços configurável, validação de pagamentos e histórico financeiro auditável |

O resultado é uma redução significativa do esforço administrativo e um aumento da transparência para todos os intervenientes.

---

## ✨ Funcionalidades

### 👨‍💼 Coordenação
- Painel operacional com indicadores em tempo real — utilizadores, pedidos, aulas e receita
- Gestão completa do ciclo de vida do utilizador — registo, aprovação, suspensão e remoção
- Motor de preços configurável por modalidade e formato de aula (Solo, Dueto, Trio, Ensemble)
- Fluxo de aprovação de coaching em várias etapas: pedido → análise do professor → aprovação da coordenação → agendamento
- Agendamento direto de sessões, ignorando o fluxo de pedido quando necessário
- Livro financeiro completo com filtragem por período e detalhe por aula
- Registo de auditoria imutável de todas as ações sensíveis, com autor, data e resultado
- Gestão de inventário de figurinos integrada na plataforma

### 👩‍🏫 Professor
- Grelha semanal interativa com disponibilidades e sessões de coaching confirmadas
- Controlo total sobre as janelas de disponibilidade semanais — criar e remover horários autonomamente
- Resposta a pedidos de coaching em dois passos: aceitar (encaminhado para a coordenação) ou rejeitar com justificação
- Validação da realização de aulas com registo do método de pagamento por sessão
- Resumo de rendimentos mensal, filtrável por mês e ano letivo
- Painéis laterais de acesso rápido a pedidos pendentes e próximas aulas

### 👨‍👩‍👧 Encarregado de Educação
- Vista da agenda semanal dos educandos, filtrável por aluno e modalidade
- Inscrição e cancelamento de educandos em modalidades, de forma autónoma
- Submissão de pedidos de coaching com controlo total sobre professor, modalidade, formato e duração
- Acompanhamento do estado dos pedidos em tempo real ao longo de todo o fluxo de aprovação
- Marcação de sessões com vários participantes através de pesquisa por email (Dueto, Trio, Ensemble)
- Marketplace de figurinos integrado, para compra e empréstimo dentro da comunidade escolar

### 🛍️ Marketplace de Figurinos
- Listagem peer-to-peer com carrossel de múltiplas imagens e carregamento de fotos
- Filtragem avançada por tipo de transação, condição e recência
- Calendário de disponibilidade para pedidos de empréstimo com deteção automática de conflitos de datas
- Ciclo de empréstimo completo: pedido → aprovação → confirmação de pagamento → registo de devolução

---

## 🛠️ Stack Tecnológica

### Frontend
| Tecnologia | Versão | Função |
|---|---|---|
| React | 19.2.5 | Framework de UI — SPA orientada a componentes |
| Vite | 8.0.10 | Ferramenta de build e servidor de desenvolvimento com HMR |
| React Router DOM | 7.15.0 | Navegação client-side |
| Lucide React | 1.17.0 | Sistema de ícones consistente |
| React DatePicker | 9.1.0 | Seleção de datas acessível |
| React Google reCAPTCHA | 3.1.0 | Mitigação de bots nos formulários de autenticação |
| date-fns | 4.3.0 | Manipulação imutável de datas |
| ESLint | 10.2.1 | Análise estática e uniformização de código |

### Backend
| Tecnologia | Versão | Função |
|---|---|---|
| Node.js | 18+ | Runtime JavaScript do lado do servidor |
| Express | 4.18.2 | Framework HTTP e encaminhamento |
| MySQL2 / mssql | — | Driver da base de dados relacional |
| jsonwebtoken | 9.0.3 | Autenticação stateless por JWT |
| bcryptjs | 3.0.3 | Hashing adaptativo de palavras-passe |
| multer | 2.1.1 | Tratamento de upload de ficheiros (multipart) |
| dotenv | 16.4.5 | Configuração de ambiente (twelve-factor) |
| cors | 2.8.6 | Imposição de lista branca de origens |
| nodemon | 3.1.0 | Reinício automático em desenvolvimento |
| Vitest | 4.1.5 | Runner de testes unitários e de integração |
| Supertest | 7.2.2 | Biblioteca de asserções sobre endpoints HTTP |
| JSDoc | 4.0.5 | Geração automática de documentação da API |

### Infraestrutura
| Serviço | Plano | Papel |
|---|---|---|
| Railway | Hobby | Entrega do frontend estático via CDN global |
| Render | Free | Runtime da API Node.js com deployment zero-config |
| AWS RDS | Free Tier | MySQL 8 gerido, com backups automáticos |

---

## 🏗️ Arquitetura do Sistema

```
╔══════════════════════════════════════════════════════════╗
║              CAMADA DE CLIENTE — Browser                 ║
║               React 19 SPA · Railway CDN                 ║
║                                                          ║
║  Landing · Auth · Agenda · Coaching · Marketplace        ║
║                Painel de Coordenação                     ║
╚═══════════════════════╤══════════════════════════════════╝
                        │  HTTPS · JWT (Bearer)
╔═══════════════════════▼══════════════════════════════════╗
║            CAMADA DE APLICAÇÃO — Render                  ║
║               Node.js 18 · Express 4                     ║
║                                                          ║
║  /api/auth        /api/escola       /api/coaching        ║
║  /api/inventario  /api/faturacao    /api/auditoria       ║
║  /api/agenda      /api/health                            ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐ ║
║  │  Middleware JWT · Lista Branca CORS · Error Handler │ ║
║  └────────────────────────────────────────────────────┘ ║
╚═══════════════════════╤══════════════════════════════════╝
                        │  Pool de ligações MySQL2
╔═══════════════════════▼══════════════════════════════════╗
║               CAMADA DE DADOS — AWS RDS                  ║
║                      MySQL 8                             ║
╚══════════════════════════════════════════════════════════╝
```

O frontend é implementado como um build estático servido pela CDN da Railway, sem renderização do lado do servidor. Todos os dados dinâmicos circulam exclusivamente através da API REST sobre HTTPS. A autenticação é totalmente stateless — os JWT são emitidos no login, armazenados do lado do cliente e validados em cada pedido protegido. Não existe estado de sessão no servidor, o que permite escalabilidade horizontal sem estado partilhado.

---

## 🧠 Decisões de Engenharia

Algumas das opções técnicas que moldaram o projeto e a sua justificação:

| Decisão | Justificação |
|---|---|
| **Arquitetura em camadas (MVC)** no backend | Separação clara entre encaminhamento, lógica de negócio (controllers) e acesso a dados (models), facilitando testes e manutenção |
| **Autenticação stateless por JWT** | Elimina o estado de sessão no servidor, permitindo escalar horizontalmente e simplificar o deployment na Render |
| **Frontend e API desacoplados** | Permite implementar, escalar e versionar cada camada de forma independente; o frontend é apenas ficheiros estáticos na CDN |
| **Pool de ligações à base de dados** | Reutiliza ligações à AWS RDS em vez de abrir uma por pedido, reduzindo latência e carga na base de dados |
| **Aprovação manual de registos** | Modelo de confiança adequado a uma escola — nenhum acesso é concedido sem validação humana da coordenação |
| **Registo de auditoria persistido** | Garante rastreabilidade total de ações sensíveis, requisito essencial para um sistema com dados de menores |
| **Testes com mocks de dependências** | Os controllers são testados isoladamente, sem depender da base de dados real, garantindo testes rápidos e determinísticos |

---

## 📁 Estrutura do Projeto

```
vivadarte/
│
├── frontend/                              # React 19 · Vite 8
│   ├── src/
│   │   ├── assets/                        # Recursos estáticos — logótipo, ícones sociais
│   │   ├── pages/
│   │   │   ├── LandingPage/               # Página pública com carrosseis automáticos
│   │   │   ├── Login-Registo/             # Fluxos de autenticação: Login · Registo · Recuperação
│   │   │   ├── AgendaAulas/               # Agenda semanal de aulas regulares
│   │   │   ├── MinhaAgendaProfessor/      # Agenda de coaching — modo duplo (Professor e EE)
│   │   │   ├── Figurinos/                 # Marketplace de figurinos
│   │   │   └── AdminDashboard/            # Painel de coordenação completo
│   │   ├── services/
│   │   │   └── api.js                     # Wrapper de fetch autenticado com injeção de JWT
│   │   ├── utils/
│   │   │   └── perfilUtilizador.js        # Funções de resolução de perfil
│   │   ├── App.jsx                        # Encaminhamento por estado (sem router de URL)
│   │   └── main.jsx
│   └── package.json
│
└── backend/                               # Node.js 18 · Express 4 · MVC
    ├── src/
    │   ├── config/
    │   │   └── db.js                      # Pool de ligações — AWS RDS MySQL
    │   ├── controllers/                   # Tratamento de pedidos e lógica de negócio
    │   │   ├── authController.js          # Registo, login, recuperação de palavra-passe
    │   │   ├── coachingController.js      # Ciclo de marcações, agendamento, validação
    │   │   ├── escolaController.js        # Modalidades, salas, horários, anos letivos
    │   │   ├── inventarioController.js    # Listagens de figurinos, vendas, empréstimos
    │   │   ├── faturacaoController.js     # Regras de preço, histórico financeiro
    │   │   ├── auditoriaController.js     # Consulta do registo de auditoria
    │   │   └── agendaController.js        # Agenda de aulas regulares por utilizador
    │   ├── models/                        # Camada de acesso a dados — queries SQL
    │   │   ├── authModel.js
    │   │   ├── coachingModel.js
    │   │   ├── escolaModel.js
    │   │   ├── inventarioModel.js
    │   │   ├── faturacaoModel.js
    │   │   ├── auditoriaModel.js
    │   │   ├── agendaModel.js
    │   │   └── precoCoachingModel.js
    │   ├── routes/                        # Definição dos endpoints Express
    │   ├── middlewares/
    │   │   ├── auth.js                    # Verificação de JWT + imposição de perfil
    │   │   └── errorHandler.js            # Tratamento centralizado de erros — sem fuga de stack traces
    │   └── helpers/
    │       └── auditoriaHelper.js         # Utilitário de registo de eventos de auditoria
    ├── tests/                             # Suítes de teste Vitest + Supertest
    │   ├── authController.test.js
    │   ├── coachingController.test.js
    │   ├── faturacaoController.test.js
    │   ├── inventarioController.test.js
    │   └── unit/
    │       └── coachingController.test.js
    ├── docs/                              # Documentação JSDoc gerada
    ├── app.js                             # Ponto de entrada da aplicação
    └── package.json
```

---

## 🔌 Referência da API

Todos os endpoints têm o prefixo `/api` e exigem um cabeçalho `Authorization: Bearer <token>` válido, salvo indicação em contrário.

| Prefixo | Controlador | Responsabilidade |
|---|---|---|
| `/api/auth` | authController | Registo, login, emissão de JWT, recuperação de palavra-passe, gestão de utilizadores |
| `/api/escola` | escolaController | Modalidades, salas, anos letivos, horários de aulas regulares |
| `/api/coaching` | coachingController | Pedidos de sessão, fluxo de agendamento, disponibilidades, validação de realização |
| `/api/inventario` | inventarioController | Listagens de figurinos, vendas, ciclo de empréstimos, reservas |
| `/api/faturacao` | faturacaoController | Configuração de preços por modalidade e formato, histórico financeiro |
| `/api/auditoria` | auditoriaController | Registo de auditoria do sistema — apenas leitura, restrito à coordenação |
| `/api/agenda` | agendaController | Consulta da agenda de aulas regulares por utilizador autenticado |
| `/api/health` | — | Verificação de saúde da API e da ligação à base de dados · **público** |

---

## 🧪 Testes

A suíte de testes do backend assenta no **Vitest** com **Supertest** para asserções ao nível HTTP, seguindo uma abordagem que combina testes unitários com dependências simuladas (mocks) e testes de integração contra a aplicação Express real.

```bash
# Executar em modo watch (desenvolvimento)
cd backend && npm test

# Execução única — adequada para pipelines de CI
cd backend && npm run test:run
```

| Suíte | Âmbito | Casos Notáveis |
|---|---|---|
| `authController.test.js` | Autenticação | Credenciais em falta (400), conta desativada (403), emissão de JWT com sucesso (200) |
| `coachingController.test.js` | Fluxo de coaching | Criação de pedidos, validação de disponibilidade, lógica de cancelamento |
| `coachingController.unit.test.js` | Coaching (isolado) | Testes unitários puros, com isolamento total de dependências via `vi.mock()` |
| `faturacaoController.test.js` | Preços e faturação | Cálculo automático de custos, consulta de histórico financeiro |
| `inventarioController.test.js` | Marketplace | Criação de figurinos, processamento de pedidos de empréstimo, conflitos de reserva |

---

## 🚀 Começar

### Pré-requisitos

- Node.js ≥ 18
- Instância MySQL 8 (local ou remota)
- npm

### 1 — Clonar o repositório

```bash
git clone https://github.com/Brito21x/vivadarte.git
cd vivadarte
```

### 2 — Configurar e arrancar a API

```bash
cd backend
npm install
cp .env.example .env        # Preencher com as credenciais — ver secção abaixo
npm run dev                 # Arranca com nodemon na porta 3000
```

### 3 — Configurar e arrancar o frontend

```bash
cd frontend
npm install
cp .env.example .env        # Definir VITE_API_URL
npm run dev                 # Servidor de desenvolvimento Vite na porta 5173
```

A aplicação ficará disponível em `http://localhost:5173` e a API em `http://localhost:3000`.  
Executa `GET /api/health` para confirmar a API e a ligação à base de dados antes de prosseguir.

---

## 🔐 Variáveis de Ambiente

### Backend — `.env`

```env
# ── Base de Dados (AWS RDS ou MySQL local) ────────────────
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=vivadarte

# ── Autenticação ──────────────────────────────────────────
JWT_SECRET=            # Mín. 32 caracteres — usar um valor criptograficamente aleatório

# ── Servidor ──────────────────────────────────────────────
PORT=3000
NODE_ENV=development   # Definir como "production" em deployment
```

### Frontend — `.env`

```env
VITE_API_URL=https://api-vivadarte.onrender.com
```

---

## 👥 Perfis de Utilizador

| Perfil | Interface | Registo | Ativação |
|---|---|---|---|
| **Coordenação** | Painel de administração completo | Manual (interno) | Imediata |
| **Professor** | Agenda de coaching, disponibilidades, rendimentos | Auto-registo público | Requer aprovação da coordenação |
| **Enc. Educação** | Agenda do educando, pedidos de coaching, marketplace | Auto-registo público | Requer aprovação da coordenação |

Os novos registos entram num estado **pendente** e só são ativados após aprovação explícita da coordenação. Após três tentativas de login falhadas consecutivas, é imposta a verificação por reCAPTCHA v2.

---

## 🛡️ Segurança

A aplicação adota uma estratégia de defesa em profundidade em toda a stack:

| Controlo | Implementação |
|---|---|
| **Autenticação** | JWT stateless com expiração curta — sem sessões no servidor |
| **Armazenamento de palavras-passe** | Hashing adaptativo com bcryptjs — texto simples nunca é persistido |
| **Proteção contra bots** | reCAPTCHA v2 no registo e após tentativas de login repetidas |
| **Autorização** | Middleware por rota valida a validade do token e o perfil exigido |
| **Controlo de origens** | Lista branca de CORS imposta na camada Express — origens desconhecidas rejeitadas |
| **Controlo de contas** | Fluxo de aprovação manual previne acessos não autorizados à partida |
| **Trilho de auditoria** | Cada ação sensível é registada na base de dados com autor, data e resultado |
| **Tratamento de erros** | Handler centralizado devolve respostas higienizadas — stack traces nunca expostos em produção |

---

## 📖 Documentação

A API está documentada com **JSDoc**, com anotações em todos os controllers, models e rotas. A documentação é gerada como um site HTML estático para `backend/docs/`.

```bash
cd backend
npm run docs   # Gera o output em backend/docs/
```

A cobertura inclui: `authController`, `coachingController`, `escolaController`, `inventarioController`, `faturacaoController`, `auditoriaController` e os respetivos models e definições de rotas.

---

## 👨‍💻 Autor

**Edgar Brito** · Instituto Politécnico do Cávado e do Ave  
Engenharia de Sistemas Informáticos · 2.º Ano

[![GitHub](https://img.shields.io/badge/GitHub-Brito21x-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/Brito21x)

---

<div align="center">

Desenvolvido com dedicação · **Viva D'arte** · 2026

</div>
