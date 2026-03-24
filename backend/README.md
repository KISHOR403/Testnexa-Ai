# TestGEN AI Backend

Backend API for TestGEN AI - AI-powered test case generation service.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Add your AI provider API key to `.env`:
```env
OPENAI_API_KEY=your_api_key_here
```

4. Start the server:
```bash
npm start
```

The server will run on `http://localhost:5000`

## API Endpoints

### POST /api/v1/generate
Generate test cases from requirements.

**Request:**
```json
{
  "requirement": "User can login using email and password",
  "appType": "web",
  "detailLevel": "detailed",
  "language": "en-US"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feature": "Login",
    "summary": { ... },
    "functional": [...],
    "negative": [...],
    "edge": [...],
    "apiChecklist": [...],
    "nonFunctional": [...],
    "questions": [...]
  },
  "metadata": { ... }
}
```

### GET /health
Health check endpoint.

## Environment Variables

See `.env.example` for all available configuration options.

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   ├── routes/          # API routes
│   └── server.js        # Entry point
├── .env.example         # Environment template
└── package.json
```
