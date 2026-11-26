<div align="center">

# Viva D'arte

### Dance School Management Platform

> A production full-stack web application that centralizes all operations of a dance school — connecting administrators, instructors, and guardians in a single, role-based, end-to-end secured platform.

[![In Production](https://img.shields.io/badge/Status-In_Production-success?style=flat-square&logo=railway&logoColor=white)](https://vivadarte-production.up.railway.app)
[![API](https://img.shields.io/badge/API-Operational-46E3B7?style=flat-square&logo=render&logoColor=white)](https://api-vivadarte.onrender.com/api/health)
[![Database](https://img.shields.io/badge/AWS_RDS-MySQL_8-FF9900?style=flat-square&logo=mysql&logoColor=white)](https://aws.amazon.com/rds/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev)
[![Docs](https://img.shields.io/badge/Docs-JSDoc-orange?style=flat-square&logo=readthedocs&logoColor=white)](https://github.com/Brito21x/vivadarte)

---

| Application | API Status | Admin Dashboard |
|:---:|:---:|:---:|
| [vivadarte-production.up.railway.app](https://vivadarte-production.up.railway.app) | [/api/health](https://api-vivadarte.onrender.com/api/health) | [/admin](https://vivadarte-production.up.railway.app/admin) |

</div>

---

## Table of Contents

- [Academic Context](#academic-context)
- [Overview](#overview)
- [The Problem and Solution](#the-problem-and-solution)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Engineering Decisions](#engineering-decisions)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [User Roles](#user-roles)
- [Security](#security)
- [Documentation](#documentation)
- [Author](#author)

---

## Academic Context

| | |
|---|---|
| **Institution** | UPCA |
| **Degree** | Computer Systems Engineering |
| **Year** | 2nd Year |
| **Project Type** | Software Development Project + Web Programming (50+10 Project) |

---

## Overview

**Viva D'arte** is a digital platform built to address a concrete operational challenge faced by performing arts schools: fragmented, manual, and opaque day-to-day academic management.

The solution delivers a cohesive digital ecosystem where each stakeholder — administrators, instructors, and guardians — interacts through a dedicated, role-tailored interface backed by a secure REST API. The system enforces role-based access control (RBAC), maintains a comprehensive audit log of sensitive operations, and deploys resiliently across three cloud targets: a static CDN on Railway, a Node.js runtime on Render, and a managed relational database on AWS RDS.

This project was conceived, designed, and implemented end-to-end as an individual effort, spanning requirements analysis, data modeling, API design, frontend engineering, automated testing, and cloud deployment.

---

## The Problem and Solution

Dance schools frequently rely on disconnected tools — informal messaging apps, scattered spreadsheets, and paper records. This leads to three recurring pain points:

| Challenge | Platform Solution |
|---|---|
| **Fragmented communication** across administrators, instructors, and families | Single centralized channel with dedicated workflows for each user role |
| **Manual scheduling** of regular classes and private sessions | Interactive weekly grid with real-time availability and request management |
| **Financial opacity** when tracking payments | Configurable pricing engine, payment validation, and an auditable financial ledger |

The result is a significant reduction in administrative overhead and greater transparency for every stakeholder.

---

## Features

### Administration
- Operational dashboard with real-time metrics — users, requests, classes, and revenue
- Full user lifecycle management — registration, approval, suspension, and removal
- Configurable pricing engine by discipline and class format (Solo, Duet, Trio, Ensemble)
- Multi-stage coaching approval workflow: request → instructor review → admin approval → scheduling
- Direct session scheduling, bypassing the request workflow when needed
- Complete financial ledger with period filtering and per-class breakdowns
- Immutable audit log tracking all sensitive actions with actor, timestamp, and outcome
- Built-in costume inventory management

### Instructor
- Interactive weekly grid displaying availability slots and confirmed coaching sessions
- Full autonomy over weekly availability windows — create and remove time slots independently
- Two-step response to coaching requests: accept (forwarded to administration) or reject with a reason
- Class completion validation with per-session payment method tracking
- Monthly earnings summary, filterable by month and academic year
- Quick-access side panels for pending requests and upcoming classes

### Parent / Guardian
- Weekly class schedule view for their students, filterable by student and discipline
- Self-service enrollment and unenrollment of students in disciplines
- Coaching request submission with full control over instructor, discipline, format, and duration
- Real-time request status tracking across the entire approval workflow
- Multi-participant session booking via email search (Duet, Trio, Ensemble)
- Integrated costume marketplace for buying and borrowing costumes within the school community

### Costume Marketplace
- Peer-to-peer listings with multi-image carousels and photo uploads
- Advanced filtering by transaction type, condition, and recency
- Availability calendar for loan requests with automatic date-conflict detection
- End-to-end loan lifecycle: request → approval → payment confirmation → return tracking

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.5 | UI framework — component-driven SPA |
| Vite | 8.0.10 | Build tool and dev server with HMR |
| React Router DOM | 7.15.0 | Client-side navigation |
| Lucide React | 1.17.0 | Consistent icon system |
| React DatePicker | 9.1.0 | Accessible date selection |
| React Google reCAPTCHA | 3.1.0 | Bot mitigation on authentication forms |
| date-fns | 4.3.0 | Immutable date manipulation |
| ESLint | 10.2.1 | Static analysis and code linting |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Server-side JavaScript runtime |
| Express | 4.18.2 | HTTP framework and routing |
| MySQL2 / mssql | — | Relational database driver |
| jsonwebtoken | 9.0.3 | Stateless JWT authentication |
| bcryptjs | 3.0.3 | Adaptive password hashing |
| multer | 2.1.1 | Multipart file upload handling |
| dotenv | 16.4.5 | Environment configuration (twelve-factor) |
| cors | 2.8.6 | Origin allowlist enforcement |
| nodemon | 3.1.0 | Auto-restart during development |
| Vitest | 4.1.5 | Unit and integration test runner |
| Supertest | 7.2.2 | HTTP endpoint assertion library |
| JSDoc | 4.0.5 | Automated API documentation generator |

### Infrastructure
| Service | Tier | Role |
|---|---|---|
| Railway | Hobby | Static frontend delivery via global CDN |
| Render | Free | Node.js API runtime with zero-config deployment |
| AWS RDS | Free Tier | Managed MySQL 8 with automated backups |

---

## System Architecture

```
╔══════════════════════════════════════════════════════════╗
║                  CLIENT LAYER — Browser                  ║
║                React 19 SPA · Railway CDN                ║
║                                                          ║
║    Landing · Auth · Schedule · Coaching · Marketplace    ║
║                     Admin Dashboard                      ║
╚═══════════════════════╤══════════════════════════════════╝
                        │  HTTPS · JWT (Bearer)
╔═══════════════════════▼══════════════════════════════════╗
║                APPLICATION LAYER — Render                ║
║                  Node.js 18 · Express 4                  ║
║                                                          ║
║  /api/auth        /api/escola       /api/coaching        ║
║  /api/inventario  /api/faturacao    /api/auditoria       ║
║  /api/agenda      /api/health                            ║
║                                                          ║
║  ┌────────────────────────────────────────────────────┐  ║
║  │  JWT Middleware · CORS Allowlist · Error Handler   │  ║
║  └────────────────────────────────────────────────────┘  ║
╚═══════════════════════╤══════════════════════════════════╝
                        │  MySQL2 Connection Pool
╔═══════════════════════▼══════════════════════════════════╗
║                   DATA LAYER — AWS RDS                   ║
║                         MySQL 8                          ║
╚══════════════════════════════════════════════════════════╝
```

The frontend is deployed as a static build served through Railway's CDN, with no server-side rendering. All dynamic data flows exclusively through the REST API over HTTPS. Authentication is completely stateless — JWTs are issued at login, stored client-side, and validated on every protected request. No server-side session state is maintained, enabling horizontal scaling without shared state.

---

## Engineering Decisions

Key technical choices that shaped the project and their rationale:

| Decision | Rationale |
|---|---|
| **Layered MVC architecture** in the backend | Separates routing, business logic (controllers), and data access (models), improving testability and maintainability |
| **Stateless JWT authentication** | Eliminates server-side session state, enabling horizontal scaling and simplifying deployment on Render |
| **Decoupled frontend and API** | Allows independent deployment, scaling, and versioning of each layer; the frontend consists solely of static assets on a CDN |
| **Database connection pooling** | Reuses connections to AWS RDS instead of opening a new one per request, reducing latency and database load |
| **Manual registration approval** | Matches a school's trust model — no account gains access without human verification by an administrator |
| **Persisted audit log** | Ensures full traceability of sensitive actions, a critical requirement for systems handling data involving minors |
| **Dependency-mocked tests** | Tests controllers in isolation without relying on a live database, keeping test runs fast and deterministic |

---

## Project Structure

```
vivadarte/
│
├── frontend/                              # React 19 · Vite 8
│   ├── src/
│   │   ├── assets/                        # Static assets — logo, social icons
│   │   ├── pages/
│   │   │   ├── LandingPage/               # Public landing page with auto-playing carousels
│   │   │   ├── Login-Registo/             # Auth flows: Login · Register · Password Recovery
│   │   │   ├── AgendaAulas/               # Weekly regular class schedule
│   │   │   ├── MinhaAgendaProfessor/      # Coaching schedule — dual mode (Instructor & Guardian)
│   │   │   ├── Figurinos/                 # Costume marketplace
│   │   │   └── AdminDashboard/            # Full administration dashboard
│   │   ├── services/
│   │   │   └── api.js                     # Authenticated fetch wrapper with JWT injection
│   │   ├── utils/
│   │   │   └── perfilUtilizador.js        # User role resolution helpers
│   │   ├── App.jsx                        # State-driven routing (without URL router)
│   │   └── main.jsx
│   └── package.json
│
└── backend/                               # Node.js 18 · Express 4 · MVC
    ├── src/
    │   ├── config/
    │   │   └── db.js                      # Connection pool — AWS RDS MySQL
    │   ├── controllers/                   # Request handling and business logic
    │   │   ├── authController.js          # Registration, login, password recovery
    │   │   ├── coachingController.js      # Booking lifecycle, scheduling, validation
    │   │   ├── escolaController.js        # Disciplines, studios, schedules, academic years
    │   │   ├── inventarioController.js    # Costume listings, sales, loans
    │   │   ├── faturacaoController.js     # Pricing rules, financial history
    │   │   ├── auditoriaController.js     # Audit log queries
    │   │   └── agendaController.js        # Per-user regular class schedule
    │   ├── models/                        # Data access layer — SQL queries
    │   │   ├── authModel.js
    │   │   ├── coachingModel.js
    │   │   ├── escolaModel.js
    │   │   ├── inventarioModel.js
    │   │   ├── faturacaoModel.js
    │   │   ├── auditoriaModel.js
    │   │   ├── agendaModel.js
    │   │   └── precoCoachingModel.js
    │   ├── routes/                        # Express route definitions
    │   ├── middlewares/
    │   │   ├── auth.js                    # JWT verification + role enforcement
    │   │   └── errorHandler.js            # Centralized error handling — prevents stack trace leaks
    │   └── helpers/
    │       └── auditoriaHelper.js         # Audit event logging utility
    ├── tests/                             # Vitest + Supertest test suites
    │   ├── authController.test.js
    │   ├── coachingController.test.js
    │   ├── faturacaoController.test.js
    │   ├── inventarioController.test.js
    │   └── unit/
    │       └── coachingController.test.js
    ├── docs/                              # Generated JSDoc documentation
    ├── app.js                             # Application entry point
    └── package.json
```

---

## API Reference

All endpoints are prefixed with `/api` and require a valid `Authorization: Bearer <token>` header unless noted otherwise.

| Prefix | Controller | Responsibility |
|---|---|---|
| `/api/auth` | authController | Registration, login, JWT issuance, password recovery, user management |
| `/api/escola` | escolaController | Disciplines, studios, academic years, regular class schedules |
| `/api/coaching` | coachingController | Session requests, scheduling workflow, availability, completion validation |
| `/api/inventario` | inventarioController | Costume listings, sales, loan lifecycle, reservations |
| `/api/faturacao` | faturacaoController | Pricing configuration by discipline and format, financial history |
| `/api/auditoria` | auditoriaController | System audit log — read-only, restricted to administrators |
| `/api/agenda` | agendaController | Regular class schedule queries for the authenticated user |
| `/api/health` | — | API and database health check · **public** |

---

## Testing

The backend test suite uses **Vitest** alongside **Supertest** for HTTP-level assertions, combining isolated unit tests with mocked dependencies and integration tests against the live Express application.

```bash
# Run in watch mode (development)
cd backend && npm test

# Single run — suitable for CI pipelines
cd backend && npm run test:run
```

| Suite | Scope | Notable Cases |
|---|---|---|
| `authController.test.js` | Authentication | Missing credentials (400), disabled account (403), successful JWT issuance (200) |
| `coachingController.test.js` | Coaching workflow | Request creation, availability validation, cancellation logic |
| `coachingController.unit.test.js` | Coaching (isolated) | Pure unit tests with full dependency isolation via `vi.mock()` |
| `faturacaoController.test.js` | Pricing & billing | Automatic cost calculation, financial history queries |
| `inventarioController.test.js` | Marketplace | Costume creation, loan request processing, booking conflicts |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- MySQL 8 instance (local or remote)
- npm

### 1 — Clone the repository

```bash
git clone [https://github.com/Brito21x/vivadarte.git](https://github.com/Brito21x/vivadarte.git)
cd vivadarte
```

### 2 — Configure and start the API

```bash
cd backend
npm install
cp .env.example .env        # Fill in your credentials — see section below
npm run dev                 # Starts with nodemon on port 3000
```

### 3 — Configure and start the frontend

```bash
cd frontend
npm install
cp .env.example .env        # Set VITE_API_URL
npm run dev                 # Starts the Vite dev server on port 5173
```

The application will be available at `http://localhost:5173` and the API at `http://localhost:3000`.  
Send a `GET /api/health` request to verify both the API and database connection before proceeding.

---

## Environment Variables

### Backend — `.env`

```env
# ── Database (AWS RDS or local MySQL) ─────────────────────
DB_HOST=
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=vivadarte

# ── Authentication ────────────────────────────────────────
JWT_SECRET=            # Min. 32 characters — use a cryptographically random value

# ── Server ────────────────────────────────────────────────
PORT=3000
NODE_ENV=development   # Set to "production" when deploying
```

### Frontend — `.env`

```env
VITE_API_URL=[https://api-vivadarte.onrender.com](https://api-vivadarte.onrender.com)
```

---

## User Roles

| Role | Interface | Registration | Activation |
|---|---|---|---|
| **Administrator** | Full admin dashboard | Manual (internal) | Immediate |
| **Instructor** | Coaching schedule, availability, earnings | Public self-registration | Requires admin approval |
| **Guardian** | Student schedule, coaching requests, marketplace | Public self-registration | Requires admin approval |

New registrations enter a **pending** state and are activated only after explicit approval by an administrator. After three consecutive failed login attempts, reCAPTCHA v2 verification is enforced.

---

## Security

The application follows a defense-in-depth strategy across the entire stack:

| Control | Implementation |
|---|---|
| **Authentication** | Stateless JWT with short expiration — no server-side sessions |
| **Password storage** | Adaptive hashing with bcryptjs — plaintext passwords are never stored |
| **Bot protection** | reCAPTCHA v2 on registration and after repeated failed login attempts |
| **Authorization** | Per-route middleware verifies token validity and required user role |
| **Origin control** | CORS allowlist enforced at the Express layer — unknown origins are rejected |
| **Account gating** | Manual approval workflow prevents unauthorized access by default |
| **Audit trail** | Every sensitive action is logged in the database with actor, timestamp, and outcome |
| **Error handling** | Centralized handler returns sanitized responses — stack traces are never exposed in production |

---

## Documentation

The API is documented using **JSDoc**, with annotations across all controllers, models, and routes. Documentation compiles to a static HTML site in `backend/docs/`.

```bash
cd backend
npm run docs   # Generates output in backend/docs/
```

Coverage includes: `authController`, `coachingController`, `escolaController`, `inventarioController`, `faturacaoController`, `auditoriaController`, and their corresponding models and route definitions.

---

## Author

**Edgar Brito** · UPCA  
Computer Systems Engineering · 2nd Year

[![GitHub](https://img.shields.io/badge/GitHub-Brito21x-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/Brito21x)

---

<div align="center">

Built with care · **Viva D'arte** · 2026

</div>
