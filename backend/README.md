<h1 align="center">⚙️ Testnexa AI — Backend</h1>

<p align="center">
  <b>AI-Powered Test Generation API Server</b><br/>
  <i>Node.js + Express backend powering intelligent test case generation with Google Gemini AI</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Google-Gemini%20AI-4285F4?logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Auth-Passport.js-34E27A?logo=passport&logoColor=white" alt="Passport" />
  <img src="https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

---

## 🌟 Overview

The backend is the core engine behind Testnexa AI. It receives product requirements from the frontend, processes them through a sophisticated **multi-service AI pipeline**, and returns comprehensive, prioritized test suites. It also handles user authentication via JWT, Google OAuth, and GitHub OAuth.

---

## 🏗️ Architecture

### Request Lifecycle

```mermaid
flowchart LR
    Client["🖥️ Frontend"] -->|HTTP POST| CORS["CORS Middleware"]
    CORS --> Session["Session Middleware"]
    Session --> Passport["Passport.js"]
    Passport --> Router["Express Router"]
    Router --> Controller["Controller"]
    Controller --> Service["Orchestrator Service"]
    Service --> Response["JSON Response"]
    Response -->|Result| Client

    style Client fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style Service fill:#1a1a2e,stroke:#a855f7,color:#fff
    style Response fill:#1a1a2e,stroke:#22c55e,color:#fff
```

### AI Orchestration Pipeline

```mermaid
flowchart TD
    Input["📄 Requirement Input"] --> Orchestrator["🎯 Orchestrator Service"]
    
    Orchestrator --> Prompt["📝 Prompt Service"]
    Orchestrator --> Domain["🌐 Domain Service"]
    
    Prompt --> AI["🤖 AI Service - Gemini API"]
    Domain --> AI
    
    AI --> Processor["⚙️ Processor Service"]
    
    Processor --> Ambiguity["🔍 Ambiguity Service"]
    Processor --> Confidence["📊 Confidence Service"]
    Processor --> Priority["🎯 Priority Service"]
    Processor --> Validation["✅ Validation Service"]
    
    Ambiguity --> Enrichment["💡 Enrichment Layer"]
    Confidence --> Enrichment
    Priority --> Enrichment
    Validation --> Enrichment
    
    Enrichment --> Persona["👤 Persona Services"]
    
    Persona --> PersonaPrompt["Persona Prompt"]
    Persona --> PersonaMeta["Persona Metadata"]
    Persona --> PersonaMsg["Persona Messaging"]
    Persona --> PersonaSafety["Persona Safety"]
    
    PersonaPrompt --> Assumption["🧠 Assumption Service"]
    PersonaMeta --> Assumption
    PersonaMsg --> Assumption
    PersonaSafety --> Assumption
    
    Assumption --> Output["✅ Complete Test Suite"]

    style Input fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style Orchestrator fill:#1a1a2e,stroke:#a855f7,color:#fff
    style AI fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style Enrichment fill:#1a1a2e,stroke:#f59e0b,color:#fff
    style Output fill:#1a1a2e,stroke:#22c55e,color:#fff
```

### Authentication Flow

```mermaid
flowchart TD
    User["👤 User"] --> Choice{"Auth Method?"}
    
    Choice -->|Email/Password| Register["📝 Register / Login"]
    Choice -->|Google| GoogleOAuth["🔵 Google OAuth 2.0"]
    Choice -->|GitHub| GitHubOAuth["⚫ GitHub OAuth"]
    
    Register --> Bcrypt["🔒 bcrypt Hash"]
    Bcrypt --> MongoDB["🗄️ MongoDB - User Model"]
    
    GoogleOAuth --> Passport["🛡️ Passport.js Strategy"]
    GitHubOAuth --> Passport
    Passport --> MongoDB
    
    MongoDB --> JWT["🎟️ JWT Token Generated"]
    JWT --> AuthMiddleware["🔑 Auth Middleware"]
    AuthMiddleware --> Protected["✅ Protected API Routes"]

    style User fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style JWT fill:#1a1a2e,stroke:#a855f7,color:#fff
    style Protected fill:#1a1a2e,stroke:#22c55e,color:#fff
```

---

## 📂 Project Structure

```
backend/
├── 📁 src/
│   ├── 📁 config/
│   │   ├── ai.config.js              # Gemini AI model configuration
│   │   └── passport.config.js         # Google & GitHub OAuth strategies
│   ├── 📁 controllers/
│   │   ├── auth.controller.js         # Login, Register, OAuth callbacks
│   │   └── generate.controller.js     # Test suite generation endpoint
│   ├── 📁 middleware/
│   │   └── auth.middleware.js         # JWT verification & route protection
│   ├── 📁 models/
│   │   └── user.model.js             # Mongoose User schema
│   ├── 📁 routes/
│   │   ├── api.routes.js             # /api/v1/* generation routes
│   │   └── auth.routes.js            # /api/v1/auth/* auth routes
│   ├── 📁 services/
│   │   ├── ai.service.js             # Google Gemini API integration
│   │   ├── orchestrator.service.js   # Main pipeline orchestrator
│   │   ├── prompt.service.js         # Dynamic prompt construction
│   │   ├── processor.service.js      # Response parsing & structuring
│   │   ├── ambiguity.service.js      # Requirement gap detection
│   │   ├── confidence.service.js     # Quality & confidence scoring
│   │   ├── domain.service.js         # Domain-specific logic detection
│   │   ├── priority.service.js       # Risk-based test prioritization
│   │   ├── assumption.service.js     # Assumption extraction & handling
│   │   ├── validation.service.js     # Input & output validation
│   │   ├── persona-prompt.service.js # Persona-based prompt tuning
│   │   ├── persona-metadata.service.js # Role-specific metadata
│   │   ├── persona-messaging.service.js # Persona-aware messaging
│   │   └── persona-safety.service.js # Safety & guardrail checks
│   ├── 📁 utils/
│   │   ├── errors.js                 # Custom error classes & formatting
│   │   └── logger.js                 # Structured logging utility
│   └── server.js                     # Express server entry point
├── .env                              # Environment variables
├── .env.example                      # Environment template
└── package.json                      # Dependencies & scripts
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/generate` | Generate test suite from requirement | Optional |
| `POST` | `/api/v1/auth/register` | Register new user | Public |
| `POST` | `/api/v1/auth/login` | Email/password login | Public |
| `GET` | `/api/v1/auth/google` | Initiate Google OAuth | Public |
| `GET` | `/api/v1/auth/google/callback` | Google OAuth callback | Public |
| `GET` | `/api/v1/auth/github` | Initiate GitHub OAuth | Public |
| `GET` | `/api/v1/auth/github/callback` | GitHub OAuth callback | Public |
| `GET` | `/api/v1/auth/me` | Get current user profile | Protected |
| `POST` | `/api/v1/auth/logout` | Logout user | Protected |
| `GET` | `/health` | Server health check | Public |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **Express.js** | REST API framework |
| **Google Gemini AI** | LLM for test generation |
| **Supabase (PostgreSQL)** | Database for users, test history, sessions & workspaces |
| **Passport.js** | OAuth 2.0 strategies |
| **JWT + bcryptjs** | Token auth & password hashing |
| **Joi** | Request validation |
| **express-session** | Session management |
| **CORS** | Cross-origin resource sharing |
| **dotenv** | Environment configuration |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev

# Server runs on http://localhost:5000
```

### Required Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/testnexa
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

---

## 🧪 Services Overview

| Service | Purpose |
|---|---|
| **Orchestrator** | Coordinates the entire generation pipeline |
| **AI Service** | Direct integration with Google Gemini API |
| **Prompt Service** | Builds dynamic, context-aware prompts |
| **Processor** | Parses and structures raw AI responses |
| **Ambiguity** | Detects contradictions & missing requirements |
| **Confidence** | Calculates quality & coverage scores |
| **Domain** | Identifies domain-specific testing patterns |
| **Priority** | Assigns risk-based priority levels |
| **Assumption** | Extracts & documents assumptions made |
| **Validation** | Validates inputs and outputs |
| **Persona (4 services)** | Adapts output for SDETs, PMs, and QA Freshers |

---

<p align="center">
  Part of <a href="https://github.com/KISHOR403/Testnexa-Ai"><b>Testnexa AI</b></a>
</p>
