<h1 align="center">🖥️ Testnexa AI — Frontend</h1>

<p align="center">
  <b>Modern React UI for AI-Powered Test Generation</b><br/>
  <i>Premium dark-themed interface with glassmorphism design and animated backgrounds</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/React_Router-7.12-CA4245?logo=reactrouter&logoColor=white" alt="Router" />
  <img src="https://img.shields.io/badge/Lucide-Icons-F56565?logo=feather&logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/CSS-Glassmorphism-264de4?logo=css3&logoColor=white" alt="CSS" />
</p>

---

## 🌟 Overview

The frontend is a modern, premium React single-page application featuring a glassmorphism dark UI with animated particle backgrounds. It provides the complete user experience for generating, viewing, refining, exporting, and managing AI-generated test suites.

---

## 🏗️ Architecture

### Component Hierarchy

```mermaid
flowchart TD
    App["🏠 App.jsx"] --> Router["React Router"]
    App --> AG["🌌 AntigravityBackground"]
    App --> Navbar["📌 Navbar"]
    App --> Sidebar["📜 HistorySidebar"]
    App --> Footer["🔗 Footer"]
    
    Router --> GeneratorPage["⚡ GeneratorPage"]
    Router --> HistoryPage["📋 HistoryPage"]
    Router --> LoginPage["🔐 LoginPage"]
    Router --> SignUpPage["📝 SignUpPage"]
    Router --> HelpPage["❓ HelpPage"]
    Router --> AboutPage["ℹ️ AboutUsPage"]
    Router --> ContactPage["📞 ContactPage"]
    Router --> ApiRefPage["📚 ApiReferencePage"]
    Router --> BestPage["⭐ BestPracticesPage"]
    Router --> PrivacyPage["🔒 PrivacyPolicyPage"]
    Router --> TermsPage["📄 TermsPage"]
    
    GeneratorPage --> Hero["🦸 Hero"]
    GeneratorPage --> InputPanel["📝 InputPanel"]
    GeneratorPage --> LoadingArea["⏳ LoadingArea"]
    GeneratorPage --> ResultsSection["📊 ResultsSection"]
    GeneratorPage --> Features["✨ Features"]
    GeneratorPage --> PainPoints["🔧 PainPoints"]
    GeneratorPage --> HowItWorks["⚙️ HowItWorks"]
    GeneratorPage --> WhoIsThisFor["👥 WhoIsThisFor"]
    GeneratorPage --> WhyThisMatters["💡 WhyThisMatters"]

    style App fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style Router fill:#1a1a2e,stroke:#a855f7,color:#fff
    style GeneratorPage fill:#1a1a2e,stroke:#3b82f6,color:#fff
```

### Data Flow

```mermaid
flowchart LR
    User["👤 User Input"] --> InputPanel["📝 InputPanel"]
    InputPanel --> ApiService["🔌 apiService"]
    ApiService -->|HTTP POST| Backend["⚙️ Backend API"]
    Backend -->|JSON Response| ApiService
    ApiService --> ResultsSection["📊 ResultsSection"]
    ResultsSection --> Export["📤 Export"]
    ResultsSection --> Refine["🔄 RefineRegeneratePanel"]
    Refine -->|Updated Req| InputPanel
    ResultsSection --> Save["💾 Save to History"]
    Save --> UseHistory["useHistory Hook"]
    UseHistory --> LocalStorage["🗄️ localStorage"]

    style User fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style Backend fill:#1a1a2e,stroke:#a855f7,color:#fff
    style ResultsSection fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style LocalStorage fill:#1a1a2e,stroke:#f59e0b,color:#fff
```

### State Management

```mermaid
flowchart TD
    Providers["🏗️ Context Providers"] --> AuthContext["🔐 AuthContext"]
    Providers --> SettingsContext["⚙️ SettingsContext"]
    
    AuthContext --> AuthState["Auth State"]
    AuthState --> isAuthenticated["isAuthenticated"]
    AuthState --> UserData["user"]
    AuthState --> GuestUsage["guestUsage"]
    AuthState --> PendingAction["pendingAction"]
    
    SettingsContext --> Settings["Settings State"]
    Settings --> Theme["theme"]
    Settings --> Notifications["notifications"]
    Settings --> DetailLevel["detailLevel"]
    
    Hooks["🪝 Custom Hooks"] --> UseHistory["useHistory"]
    UseHistory --> HistoryOps["save / load / delete / search"]
    HistoryOps --> Storage["localStorage"]

    style Providers fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style AuthContext fill:#1a1a2e,stroke:#a855f7,color:#fff
    style SettingsContext fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style Hooks fill:#1a1a2e,stroke:#f59e0b,color:#fff
```

### Page Routing Map

```mermaid
flowchart LR
    Root["/"] --> Generator["GeneratorPage"]
    History["/history"] --> HistoryP["HistoryPage"]
    Help["/help"] --> HelpP["HelpPage"]
    Login["/login"] --> LoginP["LoginPage"]
    Signup["/signup"] --> SignUpP["SignUpPage"]
    Terms["/terms"] --> TermsP["TermsPage"]
    ApiRef["/api-reference"] --> ApiRefP["ApiReferencePage"]
    Best["/best-practices"] --> BestP["BestPracticesPage"]
    About["/about"] --> AboutP["AboutUsPage"]
    Contact["/contact"] --> ContactP["ContactPage"]
    Privacy["/privacy"] --> PrivacyP["PrivacyPolicyPage"]

    style Root fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style Generator fill:#1a1a2e,stroke:#22c55e,color:#fff
```

---

## 📂 Project Structure

```
frontend/
├── 📁 components/                   # Reusable UI Components (22 total)
│   ├── AnimatedBackground.jsx       # Canvas particle animation system
│   ├── AntigravityBackground.jsx    # Dynamic space warp background
│   ├── Features.jsx                 # 6-card feature showcase grid
│   ├── FeedbackModal.jsx            # User feedback collection modal
│   ├── Footer.jsx                   # Site-wide footer with links
│   ├── Hero.jsx                     # Landing hero section
│   ├── HistorySidebar.jsx           # Collapsible history drawer
│   ├── HowItWorks.jsx              # 4-step process visualization
│   ├── IndustryInsights.jsx         # Industry data & insights
│   ├── InputPanel.jsx              # Requirement textarea + settings
│   ├── LoadingArea.jsx             # Generation progress indicator
│   ├── LoginModal.jsx              # Quick login prompt modal
│   ├── Navbar.jsx                  # Top navigation + auth controls
│   ├── PainPoints.jsx             # Problem vs Solution cards
│   ├── ProfileModal.jsx           # User profile management
│   ├── RefineRegeneratePanel.jsx  # Iterative refinement controls
│   ├── ResultsSection.jsx         # Test suite results display
│   ├── ScrollToTop.jsx            # Route change scroll handler
│   ├── SettingsPanel.jsx          # User preferences panel
│   ├── UpgradeModal.jsx           # Pro upgrade prompt
│   ├── WhoIsThisFor.jsx           # Target audience personas
│   └── WhyThisMatters.jsx         # Value proposition section
├── 📁 pages/                       # Route-Level Pages (11 total)
│   ├── GeneratorPage.jsx           # Main AI test generator (home)
│   ├── HistoryPage.jsx             # Past generation history
│   ├── LoginPage.jsx               # Full login page (Email/OAuth)
│   ├── SignUpPage.jsx              # Registration page
│   ├── HelpPage.jsx               # Documentation & guides
│   ├── ApiReferencePage.jsx       # API documentation
│   ├── BestPracticesPage.jsx      # QA best practices
│   ├── AboutUsPage.jsx            # Company information
│   ├── ContactPage.jsx            # Contact form
│   ├── PrivacyPolicyPage.jsx      # Privacy policy
│   └── TermsPage.jsx             # Terms of service
├── 📁 context/                     # React Context Providers
│   ├── AuthContext.jsx             # Authentication state & methods
│   └── SettingsContext.jsx         # User preferences state
├── 📁 hooks/                       # Custom React Hooks
│   └── useHistory.js               # History CRUD with localStorage
├── 📁 services/                    # API Communication Layer
│   └── apiService.js               # Axios HTTP client for backend
├── 📁 styles/                      # Additional CSS modules
├── 📁 utils/                       # Utility functions
├── 📁 assets/                      # Static assets (images, etc.)
├── App.jsx                         # Root component with routing
├── App.css                         # App-level styles
├── main.jsx                        # React DOM entry point
└── index.css                       # Global design system (208KB)
```

---

## 🎨 Design System

| Element | Implementation |
|---|---|
| **Theme** | Premium dark mode (`#0d1117` base) |
| **Cards** | Glassmorphism with `backdrop-filter: blur()` |
| **Animations** | CSS `@keyframes` + canvas particle system |
| **Icons** | Lucide React (consistent stroke icons) |
| **Layout** | CSS Grid + Flexbox responsive system |
| **Background** | Antigravity particle warp animation |
| **Typography** | System font stack with gradient headings |
| **Colors** | Teal, Purple, Blue, Amber, Green, Rose accents |

---

## 🧩 Key Components

| Component | Description |
|---|---|
| **InputPanel** | Textarea with example requirements dropdown, detail level chips, language selector |
| **ResultsSection** | Full test suite display with tabs, quality scores, copy & export buttons |
| **RefineRegeneratePanel** | Edit requirement & regenerate with preserved context |
| **HistorySidebar** | Collapsible drawer with search, saved sessions, quick restore |
| **Navbar** | Responsive nav with auth state, sidebar toggle, new analysis button |
| **Hero** | Animated hero with badge, title, subtitle, and 3 feature cards |
| **Features** | 6-card grid with colored icons, descriptions, and bullet points |
| **AntigravityBackground** | Canvas-based space warp particle animation |

---

## 🚀 Getting Started

```bash
# From the project root
npm install
npm run dev

# Opens on http://localhost:5173
```

---

<p align="center">
  Part of <a href="https://github.com/KISHOR403/Testnexa-Ai"><b>Testnexa AI</b></a>
</p>
