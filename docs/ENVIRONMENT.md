# Environment Variables — Testnexa AI

> Complete reference for all environment variables across the stack.

---

## Backend Environment Variables

Located in `backend/.env` (copy from `backend/.env.example`).

### AI Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | ❌ | `openai` | Active AI provider: `openai` or `gemini` |
| `GEMINI_API_KEY` | ✅* | — | Google Gemini API key |
| `GEMINI_MODEL` | ❌ | `gemini-1.5-flash` | Gemini model name (runtime uses `gemini-2.5-flash`) |
| `GEMINI_MAX_TOKENS` | ❌ | `8192` | Maximum output tokens for Gemini |
| `GEMINI_TEMPERATURE` | ❌ | `0.7` | Gemini generation temperature |
| `OPENAI_API_KEY` | ✅* | — | OpenAI API key (if using OpenAI provider) |
| `OPENAI_MODEL` | ❌ | `gpt-4` | OpenAI model name |
| `OPENAI_MAX_TOKENS` | ❌ | `2000` | Maximum output tokens for OpenAI |
| `OPENAI_TEMPERATURE` | ❌ | `0.7` | OpenAI generation temperature |

> \* Required based on which `AI_PROVIDER` is set.

### AI Retry Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_MAX_RETRIES` | ❌ | `3` | Maximum retry attempts on AI failure |
| `AI_RETRY_DELAY` | ❌ | `1000` | Base retry delay in milliseconds |

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `5000` | Express server port |
| `NODE_ENV` | ❌ | `development` | Environment: `development`, `production` |
| `SESSION_SECRET` | ❌ | `testnexa_secret` | Express session secret |

### Database (Supabase)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | — | Supabase project URL (`https://xxx.supabase.co`) |
| `SUPABASE_SECRET_KEY` | ✅ | — | Supabase service role key (server-side) |
| `SUPABASE_PUBLISHABLE_KEY` | ❌ | — | Supabase anon key (used in some contexts) |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | `secret123` | JWT signing secret (change in production!) |
| `GOOGLE_CLIENT_ID` | ❌ | — | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | — | Google OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | ❌ | — | Google OAuth callback URL |
| `GITHUB_CLIENT_ID` | ❌ | — | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | ❌ | — | GitHub OAuth client secret |
| `GITHUB_CALLBACK_URL` | ❌ | — | GitHub OAuth callback URL |
| `FRONTEND_URL` | ❌ | `http://localhost:5173` | Frontend URL for OAuth redirects and CORS |

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | ❌ | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | ❌ | `587` | SMTP server port |
| `SMTP_USER` | ❌ | — | SMTP username (email address) |
| `SMTP_PASS` | ❌ | — | SMTP password or app password |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW` | ❌ | `15` | Default rate limit window in minutes |
| `RATE_LIMIT_MAX` | ❌ | `100` | Default maximum requests per window |

---

## Frontend Environment Variables

Vite environment variables must be prefixed with `VITE_`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | ❌ | `http://localhost:5000/api/v1` | Backend API base URL |

### Setting Frontend Variables

**Local development:** Create a `.env` file in the project root:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

**Docker build:** Pass as build argument:

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.testnexa.com/api/v1 .
```

**Vercel:** Set in project settings → Environment Variables.

---

## Docker Build Arguments

| Argument | Used In | Default | Description |
|----------|---------|---------|-------------|
| `VITE_API_BASE_URL` | Frontend Dockerfile | `http://localhost:5000/api/v1` | Baked into static assets at build time |

---

## Kubernetes ConfigMap

File: `k8s/configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: testnexa-config
  namespace: testnexa
data:
  NODE_ENV: "production"
  PORT: "5000"
  AI_PROVIDER: "gemini"
```

---

## Kubernetes Secrets

File: `k8s/secret.yaml`

All values must be base64-encoded:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: testnexa-secrets
  namespace: testnexa
type: Opaque
data:
  SUPABASE_URL: <base64>
  SUPABASE_SECRET_KEY: <base64>
  JWT_SECRET: <base64>
  GEMINI_API_KEY: <base64>
  GOOGLE_CLIENT_ID: <base64>
  GOOGLE_CLIENT_SECRET: <base64>
  GITHUB_CLIENT_ID: <base64>
  GITHUB_CLIENT_SECRET: <base64>
  SMTP_USER: <base64>
  SMTP_PASS: <base64>
  SESSION_SECRET: <base64>
```

### Encoding Values

```bash
# Encode a value
echo -n "your_secret_value" | base64

# Decode a value (for verification)
echo "eW91cl9zZWNyZXRfdmFsdWU=" | base64 --decode
```

---

## GitHub Actions Secrets

Required for CI/CD pipeline:

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | DockerHub account username |
| `DOCKERHUB_TOKEN` | DockerHub access token |

---

## Example `.env` File

```env
# === AI ===
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MAX_TOKENS=65536
GEMINI_TEMPERATURE=0.2

# === Server ===
PORT=5000
NODE_ENV=development

# === Database ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=eyJhbGciOi...your_secret_key
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...your_anon_key

# === Auth ===
JWT_SECRET=your_strong_random_secret_here
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
GITHUB_CLIENT_ID=Iv1.abc123...
GITHUB_CLIENT_SECRET=secret_abc123...
GITHUB_CALLBACK_URL=http://localhost:5000/api/v1/auth/github/callback
FRONTEND_URL=http://localhost:5173

# === Email ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# === Rate Limiting ===
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

---

## Production Checklist

- [ ] `JWT_SECRET` is a strong, randomly generated value (not the default)
- [ ] `NODE_ENV` is set to `production`
- [ ] `FRONTEND_URL` is set to the actual production URL
- [ ] OAuth callback URLs point to production backend
- [ ] SMTP credentials are configured for email delivery
- [ ] Supabase keys are production project keys
- [ ] `AI_PROVIDER` is set to `gemini` (or `openai` if preferred)
- [ ] Gemini/OpenAI API key has sufficient quota
- [ ] All secrets are stored in K8s Secrets (not ConfigMap)

---

*Last updated: September 2026*
