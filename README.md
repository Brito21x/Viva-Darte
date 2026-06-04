<div align="center">

<img src="https://raw.githubusercontent.com/Brito21x/vivadarte/main/frontend/src/assets/logo.png" alt="Viva D'arte Logo" width="130" />

# Viva D'arte

### Plataforma de Gestão de Escola de Dança

Aplicação web full-stack desenvolvida para digitalizar e centralizar a gestão de uma escola de dança —  
comunicação entre coordenação, professores e encarregados de educação numa única plataforma.

[![Frontend](https://img.shields.io/badge/Frontend-Railway-7B2FBE?style=flat-square&logo=railway&logoColor=white)](https://vivadarte-production.up.railway.app)
[![API](https://img.shields.io/badge/API-Render-46E3B7?style=flat-square&logo=render&logoColor=black)](https://api-vivadarte.onrender.com/api/health)
[![DB](https://img.shields.io/badge/Database-AWS%20RDS%20MySQL-FF9900?style=flat-square&logo=amazonaws&logoColor=white)](https://aws.amazon.com/rds/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Node](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Vitest](https://img.shields.io/badge/Testes-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev)

---

🌐 **Aplicação:** [vivadarte-production.up.railway.app](https://vivadarte-production.up.railway.app)  
🔧 **API Health:** [api-vivadarte.onrender.com/api/health](https://api-vivadarte.onrender.com/api/health)  
👤 **Painel Admin:** [vivadarte-production.up.railway.app/admin](https://vivadarte-production.up.railway.app/admin)

</div>

---

## 📋 Índice

- [Contexto Académico](#-contexto-académico)
- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Arquitetura](#-arquitetura)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [API — Endpoints](#-api--endpoints)
- [Testes](#-testes)
- [Instalação e Configuração](#-instalação-e-configuração)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Perfis de Utilizador](#-perfis-de-utilizador)
- [Segurança](#-segurança)
- [Documentação](#-documentação)
- [Autor](#-autor)

---

## 🎓 Contexto Académico

| Campo | Detalhe |
|---|---|
| **Instituição** | Instituto Politécnico do Cávado e do Ave (IPCA) |
| **Curso** | Engenharia de Sistemas Informáticos |
| **Ano** | 2.º Ano |
| **Tipo** | Projeto de Desenvolvimento de Software |

---

## 🎯 Sobre o Projeto

A **Viva D'arte** é uma plataforma digital desenvolvida para responder a necessidades reais identificadas na gestão de escolas de dança: comunicação dispersa, agendamento manual de aulas, falta de transparência financeira e ausência de um canal centralizado entre os vários intervenientes.

A solução implementa três perfis distintos de utilizador com fluxos de trabalho próprios, comunicando através de uma API REST protegida por JWT, com dados persistidos numa base de dados MySQL gerida na cloud AWS.

---

## ✨ Funcionalidades

### 👨‍💼 Coordenação / Admin
- Dashboard com estatísticas em tempo real (utilizadores, pedidos, aulas, receita)
- Gestão completa de utilizadores — criação, aprovação, revogação e eliminação
- Gestão de horários de aulas regulares por modalidade, sala e dia da semana
- Aprovação e rejeição de pedidos de coaching com atribuição de professor, sala e valor final
- Agendamento direto de sessões de coaching sem passar pelo fluxo de pedido
- Tabela de preços configurável por modalidade e formato de aula
- Histórico financeiro completo com filtragem por período
- Log de auditoria de todas as ações sensíveis do sistema
- Gestão de inventário de figurinos

### 👩‍🏫 Professor
- Grelha semanal interativa com disponibilidades e aulas agendadas
- Gestão de disponibilidades horárias semanais (criação e remoção)
- Receção e resposta a pedidos de coaching (aceitar / rejeitar)
- Validação de realização de aulas com registo de método de pagamento
- Resumo financeiro mensal filtrado por mês e ano letivo
- Painel de gestão de pedidos pendentes e próximas aulas

### 👨‍👩‍👧 Encarregado de Educação
- Consulta da agenda semanal de aulas regulares dos educandos
- Pedido de sessões de coaching com seleção de professor, modalidade, formato e duração
- Acompanhamento do estado dos pedidos em tempo real
- Inscrição e remoção de educandos em modalidades
- Pesquisa de outros EE por email para pedidos em grupo (Dueto, Trio, Ensemble)
- Marketplace de figurinos — compra e empréstimo com calendário de disponibilidade

### 🛍️ Marketplace de Figurinos
- Listagem com carrossel de imagens, upload múltiplo e pré-visualização
- Filtros por tipo de transação, condição e ordenação
- Sistema de pedidos de empréstimo com gestão de reservas e calendário de datas ocupadas
- Ciclo completo de gestão — pedido → aprovação → pagamento → devolução

---

## 🛠️ Tecnologias

### Frontend
| Tecnologia | Versão | Utilização |
|---|---|---|
| React | 19.2.5 | Framework principal (SPA) |
| Vite | 8.0.10 | Build tool e dev server |
| React Router DOM | 7.15.0 | Navegação client-side |
| Lucide React | 1.17.0 | Biblioteca de ícones |
| React DatePicker | 9.1.0 | Seleção de datas |
| React Google reCAPTCHA | 3.1.0 | Proteção contra bots |
| date-fns | 4.3.0 | Manipulação de datas |
| ESLint | 10.2.1 | Linting de código |

### Backend
| Tecnologia | Versão | Utilização |
|---|---|---|
| Node.js | 18+ | Runtime JavaScript |
| Express | 4.18.2 | Framework HTTP |
| mssql / MySQL2 | — | Driver da base de dados |
| jsonwebtoken | 9.0.3 | Autenticação JWT |
| bcryptjs | 3.0.3 | Hash de passwords |
| multer | 2.1.1 | Upload de ficheiros (imagens) |
| dotenv | 16.4.5 | Variáveis de ambiente |
| cors | 2.8.6 | Política de origens cruzadas |
| nodemon | 3.1.0 | Hot reload em desenvolvimento |
| Vitest | 4.1.5 | Testes unitários e de integração |
| Supertest | 7.2.2 | Testes de endpoints HTTP |
| JSDoc | 4.0.5 | Geração de documentação |

### Infraestrutura
| Serviço | Plano | Utilização |
|---|---|---|
| Railway | Hobby | Hosting do frontend (build estático) |
| Render | Free | Hosting da API REST (Node.js) |
| AWS RDS | Free Tier | Base de dados MySQL 8 gerida |

---

## 🏗️ Arquitetura

```
┌──────────────────────────────────────────────────────────┐
│                     CLIENTE (Browser)                     │
│           React 19 SPA — Railway CDN                      │
│                                                           │
│  Landing  │  Auth  │  Agenda  │  Coaching  │  Figurinos   │
│                    │  Admin Dashboard                     │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTPS + Bearer JWT
┌───────────────────────────▼──────────────────────────────┐
│                   API REST — Render                       │
│              Node.js 18 + Express 4                       │
│                                                           │
│  /api/auth       /api/escola      /api/coaching           │
│  /api/inventario /api/faturacao   /api/auditoria          │
│  /api/agenda     /api/health                              │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │  Middlewares: JWT Auth │ CORS │ Error Handler    │     │
│  └─────────────────────────────────────────────────┘     │
└───────────────────────────┬──────────────────────────────┘
                            │ MySQL2 / mssql
┌───────────────────────────▼──────────────────────────────┐
│               Base de Dados — AWS RDS                     │
│                     MySQL 8                               │
└──────────────────────────────────────────────────────────┘
```

O frontend é uma SPA servida como ficheiros estáticos, comunicando exclusivamente com a API via HTTPS. Toda a autenticação é stateless (JWT), sem sessões no servidor.

---

## 📁 Estrutura do Projeto

```
vivadarte/
│
├── frontend/                              # React 19 + Vite
│   ├── src/
│   │   ├── assets/                        # Logótipo e imagens estáticas
│   │   ├── pages/
│   │   │   ├── LandingPage/               # Página pública com carosseis
│   │   │   ├── Login-Registo/             # Login, Registo, RecoverPassword
│   │   │   ├── AgendaAulas/               # Grelha semanal de aulas regulares
│   │   │   ├── MinhaAgendaProfessor/      # Coaching — Professor e EE
│   │   │   ├── Figurinos/                 # Marketplace de figurinos
│   │   │   └── AdminDashboard/            # Painel de administração
│   │   ├── services/
│   │   │   └── api.js                     # Fetch autenticado com JWT
│   │   ├── utils/
│   │   │   └── perfilUtilizador.js        # Helpers de perfil
│   │   ├── App.jsx                        # Roteamento por estado
│   │   └── main.jsx
│   └── package.json
│
└── backend/                               # Node.js + Express
    ├── src/
    │   ├── config/
    │   │   └── db.js                      # Pool de conexões MySQL
    │   ├── controllers/                   # Lógica de negócio (MVC)
    │   │   ├── authController.js
    │   │   ├── coachingController.js
    │   │   ├── escolaController.js
    │   │   ├── inventarioController.js
    │   │   ├── faturacaoController.js
    │   │   ├── auditoriaController.js
    │   │   └── agendaController.js
    │   ├── models/                        # Queries à base de dados
    │   │   ├── authModel.js
    │   │   ├── coachingModel.js
    │   │   ├── escolaModel.js
    │   │   ├── inventarioModel.js
    │   │   ├── faturacaoModel.js
    │   │   ├── auditoriaModel.js
    │   │   ├── agendaModel.js
    │   │   └── precoCoachingModel.js
    │   ├── routes/                        # Definição de endpoints
    │   │   ├── authRoutes.js
    │   │   ├── coachingRoutes.js
    │   │   ├── escolaRoutes.js
    │   │   ├── inventarioRoutes.js
    │   │   ├── faturacaoRoutes.js
    │   │   ├── auditoriaRoutes.js
    │   │   └── agendaRoutes.js
    │   ├── middlewares/
    │   │   ├── auth.js                    # Verificação JWT e perfil
    │   │   └── errorHandler.js            # Tratamento global de erros
    │   └── helpers/
    │       └── auditoriaHelper.js         # Registo de eventos de auditoria
    ├── tests/                             # Testes Vitest + Supertest
    │   ├── authController.test.js
    │   ├── coachingController.test.js
    │   ├── faturacaoController.test.js
    │   ├── inventarioController.test.js
    │   └── unit/
    │       └── coachingController.test.js
    ├── docs/                              # Documentação JSDoc gerada
    ├── app.js                             # Entry point Express
    └── package.json
```

---

## 🔌 API — Endpoints

| Prefixo | Controlador | Descrição |
|---|---|---|
| `/api/auth` | authController | Registo, login, recuperação de password, gestão de utilizadores |
| `/api/escola` | escolaController | Modalidades, salas, anos letivos, horários regulares |
| `/api/coaching` | coachingController | Pedidos, agenda, disponibilidades, validação de realização |
| `/api/inventario` | inventarioController | Figurinos, vendas, empréstimos, reservas |
| `/api/faturacao` | faturacaoController | Preços por modalidade, histórico financeiro |
| `/api/auditoria` | auditoriaController | Log de eventos do sistema |
| `/api/agenda` | agendaController | Agenda de aulas regulares por utilizador |
| `/api/health` | — | Health check da API e da base de dados |

---

## 🧪 Testes

O projeto inclui **5 ficheiros de teste** com cobertura sobre os principais módulos do backend, escritos com **Vitest** e **Supertest**.

```bash
# Executar testes em modo watch
cd backend
npm test

# Executar uma vez (CI)
npm run test:run
```

| Ficheiro de Teste | Módulo Coberto | Exemplos de Casos |
|---|---|---|
| `authController.test.js` | Autenticação | Login com credenciais inválidas, conta desativada, token JWT gerado |
| `coachingController.test.js` | Coaching | Criação de pedidos, validação de disponibilidade, cancelamento |
| `coachingController.unit.test.js` | Coaching (unitário) | Lógica isolada com mocks completos |
| `faturacaoController.test.js` | Faturação | Cálculo de preços, histórico financeiro |
| `inventarioController.test.js` | Inventário | Criação de figurinos, pedidos de empréstimo |

---

## 🚀 Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- MySQL 8 (local ou remoto)
- npm

### 1. Clonar o repositório
```bash
git clone https://github.com/Brito21x/vivadarte.git
cd vivadarte
```

### 2. Configurar o Backend
```bash
cd backend
npm install
cp .env.example .env
# Preenche o .env com as tuas credenciais
npm run dev
```

### 3. Configurar o Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Define VITE_API_URL no .env
npm run dev
```

A aplicação fica disponível em `http://localhost:5173` e a API em `http://localhost:3000`.

---

## 🔐 Variáveis de Ambiente

### Backend — `.env`
```env
# Base de Dados (AWS RDS ou local)
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=vivadarte

# Autenticação
JWT_SECRET=

# Servidor
PORT=3000
NODE_ENV=development
```

### Frontend — `.env`
```env
VITE_API_URL=https://api-vivadarte.onrender.com
```

> ⚠️ **Nunca commites ficheiros `.env` com credenciais reais.** O `.gitignore` já os exclui — certifica-te que está configurado antes do primeiro commit.

---

## 👥 Perfis de Utilizador

| Perfil | Acesso | Aprovação Necessária |
|---|---|---|
| **Admin** | Painel de administração completo | — (criado manualmente) |
| **Professor** | Agenda de coaching, disponibilidades, resumo financeiro | ✅ Pela coordenação |
| **EE** | Agenda do educando, pedidos de coaching, marketplace | ✅ Pela coordenação |

O registo é público mas fica **pendente de aprovação** pela coordenação. Após 3 tentativas de login falhadas, é obrigatório resolver um reCAPTCHA v2.

---

## 🛡️ Segurança

- **JWT** com expiração curta para autenticação stateless em todas as rotas protegidas
- **bcryptjs** para hash de passwords — nunca armazenadas em texto simples
- **reCAPTCHA v2** nos formulários de login (após 3 falhas) e registo
- **Middleware de autorização** por perfil em todas as rotas sensíveis da API
- **CORS** configurado com lista branca de origens permitidas
- **Aprovação manual** de todos os novos registos pela coordenação
- **Log de auditoria** persistido em base de dados para todas as ações sensíveis
- **Error handler** global que nunca expõe stack traces em produção

---

## 📖 Documentação

A documentação da API foi gerada automaticamente com **JSDoc** a partir dos controllers, models e routes do backend.

```bash
# Gerar documentação (output em backend/docs/)
cd backend
npm run docs
```

A documentação gerada cobre todos os módulos: `authController`, `coachingController`, `escolaController`, `inventarioController`, `faturacaoController` e `auditoriaController`.

---

## 👨‍💻 Autor

Desenvolvido por **Brito** — IPCA, Engenharia de Sistemas Informáticos, 2.º Ano.

[![GitHub](https://img.shields.io/badge/GitHub-Brito21x-181717?style=flat-square&logo=github)](https://github.com/Brito21x)

---

<div align="center">

Desenvolvido com ❤️ no IPCA para a **Viva D'arte**

</div>
