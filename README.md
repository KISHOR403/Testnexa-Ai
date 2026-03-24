<p align="center">
  <img src="public/screenshots/hero-preview.png" alt="Testnexa AI - Intelligent QA Design" width="100%" />
</p>

<h1 align="center">🧪 Testnexa AI</h1>

<p align="center">
  <b>AI-Powered Intelligent QA Test Case Generator</b><br/>
  <i>Transform unclear product requirements into complete, prioritized test suites — in seconds.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Google-Gemini%20AI-4285F4?logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/License-ISC-blue" alt="License" />
</p>

---

## 🌟 Overview

**Testnexa AI** is a full-stack, AI-powered web application that automatically converts product requirements — user stories, PRDs, or API specs — into comprehensive, prioritized test suites. It leverages **Google Gemini AI** to deeply analyze requirements, detect ambiguities, and generate multi-category test cases covering functional, negative, edge case, and API testing scenarios.

> 🎯 *Stop missing edge cases. Stop writing test cases manually. Let AI handle the heavy lifting.*

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **AI-Powered Analysis** | Advanced LLM intelligence for context-aware requirement parsing and domain-specific logic understanding |
| 📋 **Multi-Category Tests** | Generates Functional, Negative, Edge Case, and API tests simultaneously in one pass |
| 🔍 **Ambiguity Detection** | Identifies contradictions, missing logic, and unclear specs — then generates targeted clarification questions |
| 📊 **Risk-Based Prioritization** | Automatically assigns High/Medium/Low priority based on business impact and complexity |
| 📤 **Multi-Format Export** | Export test suites in JSON, Markdown, or structured formats ready for your test management tools |
| 📈 **Requirement Insights** | Quality scores, coverage metrics, and actionable tips on requirement completeness |
| 🔐 **Auth System** | Google & GitHub OAuth + JWT-based authentication with guest trial mode |
| 📜 **History & Sidebar** | Full generation history with search, saved sessions, and quick access sidebar |
| 🎨 **Premium Dark UI** | Glassmorphism design, animated particle background, smooth micro-animations |
| 🔔 **Desktop Notifications** | Get notified when your test suite is ready |
| 🎓 **Guided Tour** | First-time user onboarding with step-by-step walkthrough |

---

## 🚀 How It Works

### User Workflow

```mermaid
flowchart LR
    A["📝 Paste Requirement"] --> B["⚙️ Select Settings"]
    B --> C["🚀 Generate"]
    C --> D{"🔍 Ambiguity Found?"}
    D -->|Yes| E["❓ Clarification Questions"]
    E --> F["✏️ Refine Requirement"]
    F --> C
    D -->|No| G["📊 View Results"]
    G --> H["📤 Export / Save"]
```

### AI Test Generation Pipeline

```mermaid
flowchart TD
    A["📄 Raw Requirement Input"] --> B["🔬 Requirement Deconstruction"]
    B --> C["Break into atomic business rules"]
    B --> D["Identify logical branches"]
    C --> E["🔍 Ambiguity Detection Engine"]
    D --> E
    E --> F{"Contradictions or gaps?"}
    F -->|Yes| G["Generate clarification questions"]
    F -->|No| H["🧪 Multi-Category Test Generation"]
    G --> H
    H --> I["Functional Tests"]
    H --> J["Negative Tests"]
    H --> K["Edge Case Tests"]
    H --> L["API Tests"]
    I --> M["📊 Risk-Based Prioritization"]
    J --> M
    K --> M
    L --> M
    M --> N["High Priority"]
    M --> O["Medium Priority"]
    M --> P["Low Priority"]
    N --> Q["✅ Complete Test Suite"]
    O --> Q
    P --> Q

    style A fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style E fill:#1a1a2e,stroke:#a855f7,color:#fff
    style H fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style M fill:#1a1a2e,stroke:#f59e0b,color:#fff
    style Q fill:#1a1a2e,stroke:#22c55e,color:#fff
```

### System Architecture

```mermaid
flowchart TB
    subgraph Frontend["🖥️ Frontend - React + Vite"]
        UI["UI Components"] --> Router["React Router"]
        Router --> Pages["Pages"]
        Pages --> Context["Auth & Settings Context"]
        Context --> API["API Service Layer"]
    end

    subgraph Backend["⚙️ Backend - Node.js + Express"]
        Routes["Express Routes"] --> Controllers["Controllers"]
        Controllers --> Middleware["Auth Middleware"]
        Controllers --> Services["AI Service"]
        Services --> Gemini["Google Gemini AI"]
    end

    subgraph Database["🗄️ Database"]
        MongoDB[("MongoDB")]
    end

    subgraph Auth["🔐 Authentication"]
        JWT["JWT Tokens"]
        Google["Google OAuth"]
        GitHub["GitHub OAuth"]
    end

    API -->|HTTP/REST| Routes
    Controllers --> MongoDB
    Middleware --> JWT
    Middleware --> Google
    Middleware --> GitHub

    style Frontend fill:#0d1117,stroke:#00d4aa,color:#fff
    style Backend fill:#0d1117,stroke:#a855f7,color:#fff
    style Database fill:#0d1117,stroke:#3b82f6,color:#fff
    style Auth fill:#0d1117,stroke:#f59e0b,color:#fff
```

---

## 🎯 Who Is This For?

### 🔧 SDETs (Software Development Engineers in Test)
> Accelerate test design and automation planning. Get structured test cases with automation feasibility ratings, execution prerequisites, and API coverage analysis.

### 📋 Product Managers & Business Analysts
> Identify requirement gaps before development starts. Receive clear visibility into missing acceptance criteria, business risk areas, and ambiguous requirements.

### 🎓 QA Freshers & Entry-Level Engineers
> Learn testing fundamentals while building real test cases. Get guided test cases with explanations of testing concepts and clear priorities.

---

## 🛠️ Real QA Pain Points, Solved

| ❌ Problem | ✅ Solution |
|---|---|
| Missing edge cases in fast sprints | AI generates functional, negative, edge & API tests automatically |
| Ambiguous requirements from product | Auto-detects ambiguity and asks targeted clarification questions |
| Manual test case writing takes hours | Outputs clean, reusable test cases instantly |

---

## 💡 Why This Matters

- **🛡️ Reduce Production Risk** — Catch critical edge cases before they reach your users
- **⚡ Accelerate Sprints** — Reduce manual test design time by up to 80%
- **📝 Improve Clarity** — Force requirement precision early in the SDLC

---

## 🏗️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19.2** | UI framework with hooks & context API |
| **Vite 7.2** | Lightning-fast build tool & dev server |
| **React Router DOM 7.12** | Client-side routing & navigation |
| **Lucide React** | Beautiful, consistent icon library |
| **Axios** | HTTP client for API communication |
| **Vanilla CSS** | Custom glassmorphism design system |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express** | REST API server |
| **Google Gemini AI** | LLM for intelligent test generation |
| **MongoDB + Mongoose** | Database for users, history & sessions |
| **JWT + bcryptjs** | Token-based authentication & password hashing |
| **Passport.js** | OAuth strategies (Google, GitHub) |
| **Joi** | Request validation schemas |

---

## 📂 Project Structure

```
Testnexa-AI/
├── 📁 public/                    # Static assets & logo
├── 📁 frontend/                  # Frontend source code
│   ├── 📁 components/            # Reusable UI components
│   │   ├── AnimatedBackground    # Particle animation system
│   │   ├── AntigravityBackground # Dynamic space-like background
│   │   ├── Features              # Key features showcase grid
│   │   ├── Hero                  # Landing hero section
│   │   ├── HowItWorks            # Step-by-step process
│   │   ├── InputPanel            # Requirement input with examples
│   │   ├── ResultsSection        # Generated test suite display
│   │   ├── RefineRegeneratePanel # Iterative refinement controls
│   │   ├── HistorySidebar        # Collapsible history panel
│   │   ├── Navbar                # Navigation with auth state
│   │   ├── Footer                # Site-wide footer
│   │   └── ... (22 components)
│   ├── 📁 pages/                 # Route-level pages
│   │   ├── GeneratorPage         # Main AI test generator
│   │   ├── HistoryPage           # Past generation history
│   │   ├── LoginPage             # Email/OAuth login
│   │   ├── SignUpPage            # Registration with OAuth
│   │   ├── AboutUsPage           # Company information
│   │   ├── ContactPage           # Contact form
│   │   ├── HelpPage              # Documentation
│   │   ├── ApiReferencePage      # API documentation
│   │   ├── BestPracticesPage     # QA best practices
│   │   ├── PrivacyPolicyPage     # Privacy policy
│   │   └── TermsPage             # Terms of service
│   ├── 📁 context/               # React Context providers
│   ├── 📁 hooks/                 # Custom React hooks
│   ├── 📁 services/              # API service layer
│   ├── 📁 styles/                # Additional stylesheets
│   └── 📁 utils/                 # Utility functions
├── 📁 backend/                   # Backend API server
│   └── 📁 src/
│       ├── 📁 config/            # Database & auth config
│       ├── 📁 controllers/       # Route handlers
│       ├── 📁 middleware/        # Auth & validation middleware
│       ├── 📁 models/            # Mongoose schemas
│       ├── 📁 routes/            # API route definitions
│       ├── 📁 services/          # Business logic & AI service
│       ├── 📁 utils/             # Helper utilities
│       └── server.js             # Express server entry point
├── index.html                    # App entry point
├── vite.config.js                # Vite configuration
└── package.json                  # Frontend dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (local or Atlas connection)
- **Google Gemini API Key**

### 1. Clone the Repository
```bash
git clone https://github.com/KISHOR403/Testnexa-Ai.git
cd Testnexa-Ai
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Install Backend Dependencies
```bash
cd backend
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_google_gemini_api_key
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
```

### 5. Start the Backend Server
```bash
cd backend
npm run dev
```

### 6. Start the Frontend Dev Server
```bash
npm run dev
```

### 7. Open in Browser
```
http://localhost:5173
```

---

## 📸 Website Sections

| Section | Description |
|---|---|
| **🏠 Hero** | Eye-catching landing with animated particle background and key value propositions |
| **⚡ AI Workspace** | Main input panel with example requirements dropdown and detail level selector |
| **📊 Results Dashboard** | Comprehensive test suite output with quality scores, test cases, and export options |
| **🌟 Key Features** | 6-card interactive grid showcasing AI capabilities |
| **🔧 Pain Points** | Problem vs. Solution comparison for real QA challenges |
| **⚙️ How It Works** | 4-step engineering process visualization |
| **👥 Who Is This For** | Persona-based cards for SDETs, PMs, and QA Freshers |
| **💡 Why This Matters** | Decision-maker value proposition with key metrics |
| **📚 Help & Docs** | Comprehensive documentation and API reference |
| **📞 Contact** | Contact form and support information |

---

## 🔒 Authentication

Testnexa AI supports multiple authentication methods:
- **Guest Mode** — Try the tool with limited free generations
- **Email/Password** — Traditional signup with JWT tokens
- **Google OAuth** — One-click Google sign-in
- **GitHub OAuth** — Developer-friendly GitHub login

---

## 📄 License

This project is licensed under the **ISC License**.

---

<p align="center">
  Built with ❤️ by <b>Testnexa AI Team</b><br/>
  <a href="https://github.com/KISHOR403/Testnexa-Ai">⭐ Star this repo</a> if you find it useful!
</p>
