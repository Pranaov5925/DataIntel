# Code Cubicle PS01 - DataIntel

AI-Powered Data Intelligence & Web Harvesting Platform built with **Ollama (Qwen2.5 3B)**, **SearXNG**, and **Crawl4AI**.

Zero external cloud dependencies or paid API keys required.

---

## 🛠️ Required Software

1. **Node.js**: v18+ (tested on v22)
2. **Python**: 3.10+ with `pip`
3. **Docker Desktop**: For running local SearXNG
4. **Ollama**: [Download Ollama](https://ollama.com/download)

---

## 🚀 Local Service Startup

### 1. Ollama (Local LLM)
Install and pull the local `qwen2.5:3b` model:
```bash
ollama serve
ollama pull qwen2.5:3b
```

### 2. SearXNG (Local Meta-Search Engine)
Start the local SearXNG instance using Docker Compose:
```bash
docker compose -f services/searxng/docker-compose.yml up -d
```
Test that SearXNG is running on port 8088:
```bash
curl "http://localhost:8088/search?q=test&format=json"
```

### 3. Crawl4AI (Local Web Crawler Microservice)
Install Crawl4AI and Playwright browser:
```bash
pip install crawl4ai
crawl4ai-setup
```
Start the local crawler microservice:
```bash
python services/crawler/server.py
```
It exposes `POST /crawl` on `http://127.0.0.1:11235`.

---

## 💻 Application Startup

1. Install dependencies:
```bash
npm install
```

2. Environment configuration (`.env`):
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b

SEARXNG_URL=http://localhost:8088

CRAWL4AI_URL=http://127.0.0.1:11235
```

3. Start the application dev server:
```bash
npm run dev
```
Open [http://localhost:8081](http://localhost:8081) (or the assigned Vite port) in your browser.

---

## 🔄 Architecture & Data Flow

```text
User Request ("Find Indian SaaS companies hiring Java developers...")
                     │
                     ▼
             TanStack Start Server
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
  Ollama          SearXNG         Crawl4AI
(Qwen2.5 3B)     (Discovery)    (Web Crawling)
     │               │               │
     └───────────────┼───────────────┘
                     ▼
          Deterministic Extraction &
         Normalized Evidence Verification
                     ▼
               Dataset Store
```

### Key Capabilities
- **Provenance & Verification**: Every extracted record links back to real web page content with snippet confirmation.
- **Adaptive Collection**: Automatically detects information gaps (missing compensation, contradictory company sizes) and performs targeted secondary searches.
- **Run Versioning & Persistence**: Complete run history with diffs stored in `data/store.json`.
