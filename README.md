# AutoHeal — AI-Powered Self-Healing Application Platform

> An intelligent application monitoring and self-healing platform that detects service failures, creates incidents, executes safe rule-based recovery actions, verifies recovery, and uses Gemini AI for incident diagnosis.

[![Live Demo](https://img.shields.io/badge/Live-Demo-success)](https://autoheal-1.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/Suchishetty/autoheal)

---

## 🚀 Live Demo

**Application:**  
https://autoheal-1.onrender.com

**Backend Health:**  
https://autoheal-xqlt.onrender.com/api/healthz

> The application is deployed on Render. The free-tier backend may take some time to wake up after inactivity.

---

# 📌 Overview

AutoHeal is an **AI-assisted application monitoring and recovery platform** designed to reduce manual intervention when application services experience failures.

Instead of simply reporting that a service is down, AutoHeal follows a complete incident lifecycle:

```text
Application
     ↓
Health Monitoring
     ↓
Failure Detection
     ↓
Incident Creation
     ↓
Recovery Rule Evaluation
     ↓
Safe Recovery Action
     ↓
Recovery Verification
     ↓
Resolved / Failed
     ↓
AI Diagnosis

✨ Key Features
🔍 Health Monitoring
Monitors registered services using HTTP health checks.
Configurable health-check intervals and timeouts.
Tracks response time and consecutive failures.
Detects HEALTHY, DEGRADED, and DOWN states.
🚨 Incident Management
Automatically creates incidents after repeated service failures.
Tracks failure count and severity.
Maintains an incident timeline.
Records incident resolution and recovery attempts.
🔄 Rule-Based Recovery
Configurable recovery rules.
Supports predefined safe recovery actions.
Uses thresholds and cooldown periods.
Limits recovery attempts.
Verifies service health after recovery actions.
🤖 Gemini AI Incident Analysis
Analyzes detected incidents.
Provides:
Diagnosis
Possible root cause
Evidence
Confidence
Recommendations
Prevention suggestions
AI is used for diagnosis and recommendations, not unrestricted system control.
📊 Monitoring Dashboard
Application overview
Service health status
Active incidents
Recovery actions
Monitoring status
AI insights
🔐 Authentication & Security
Clerk authentication
Protected API routes
Environment variables for secrets
Allowlisted recovery actions
No API keys committed to the repository
🏗️ Tech Stack
Frontend
React
TypeScript
Vite
CSS
Backend
Node.js
Express.js
TypeScript
Database
PostgreSQL
Drizzle ORM
AI
Google Gemini API
Authentication
Clerk
Deployment
Render
Development Tools
Git
GitHub
pnpm
VS Code
🔧 How AutoHeal Works
1. Register an Application

An application can be registered with its environment and base URL.

2. Register Services

Each service contains a health endpoint that AutoHeal can monitor.

Example:

https://example.com/health
3. Monitor Service Health

AutoHeal periodically sends HTTP health-check requests.

It records:

HTTP status
Response time
Consecutive failures
Current service status
Last checked time
4. Detect Failure

After repeated consecutive failures, the service is marked as DOWN and an incident is created.

5. Execute Recovery Rule

The recovery engine checks enabled rules and determines whether a recovery action should be executed.

Example:

Trigger:
3 consecutive failures

Action:
Retry health check
6. Verify Recovery

After the recovery action, AutoHeal performs another health check.

The action can result in:

SUCCESS

or

FAILED
7. AI Analysis

Gemini analyzes the incident and provides diagnostic information and recommendations.

AI analysis is kept separate from the recovery execution path.

🛡️ Safety Approach

AutoHeal follows a controlled recovery model.

Detection
   ↓
Rule Evaluation
   ↓
Allowlisted Action
   ↓
Verification
   ↓
Result

Gemini does not directly execute arbitrary commands or make unrestricted infrastructure changes.

This separation helps keep recovery actions deterministic and controlled.

📂 Project Structure
AutoHeal/
│
├── artifacts/
│   ├── api-server/
│   │   └── src/
│   │       ├── routes/
│   │       ├── lib/
│   │       └── app.ts
│   │
│   ├── autoheal/
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── App.tsx
│   │       └── main.tsx
│   │
│   └── mockup-sandbox/
│
├── lib/
│   ├── db/
│   │   └── src/
│   │       └── schema/
│   │
│   └── api-client-react/
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
🧪 Example Failure Scenario

Suppose a monitored service returns:

HTTP 500

AutoHeal processes the failure:

HTTP 500
   ↓
Failure #1
   ↓
Failure #2
   ↓
Failure #3
   ↓
Service DOWN
   ↓
Incident Created
   ↓
Recovery Rule Evaluated
   ↓
Recovery Action
   ↓
Health Verification
   ↓
SUCCESS / FAILED

The incident can then be analyzed using Gemini AI.

☁️ Deployment

AutoHeal is deployed using Render.

Backend
Node.js + Express
        ↓
     Render
        ↓
PostgreSQL
Frontend
React + Vite
     ↓
Render Static Site

The frontend communicates with the publicly deployed backend API.

🔑 Environment Variables

Create the required environment variables locally or in the deployment platform.

DATABASE_URL=your_postgresql_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
GEMINI_API_KEY=your_gemini_api_key

Frontend:

VITE_API_BASE_URL=your_backend_url
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
BASE_PATH=/

⚠️ Never commit .env or API keys to GitHub.

🎯 Project Goals

AutoHeal was developed to demonstrate how application monitoring, automated recovery, incident management, and AI-assisted diagnosis can work together in a single platform.

The project focuses on:

Automated failure detection
Controlled recovery
Incident observability
AI-assisted troubleshooting
Cloud deployment
Full-stack development
🔮 Future Enhancements
Docker container auto-restart integration
Prometheus metrics
Grafana dashboards
More recovery actions
Email/Slack notifications
Kubernetes integration
Advanced incident analytics
CI/CD deployment monitoring
Multi-application monitoring
👩‍💻 Author

Suchitha Shetty

Computer Science & Engineering

⭐ Project

If you find this project useful, consider giving the repository a ⭐ on GitHub.


### For your GitHub repository, use this short description:

**`AI-powered application monitoring and self-healing platform with automated incident detection, rule-based recovery, and Gemini AI diagnosis.`**
