# DataIntel

Data collection and intelligence platform powered by Mistral API.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example environment file:

```bash
cp .env.example .env
```

Add your Mistral API key in `.env`:

```env
MISTRAL_API_KEY=your_mistral_api_key_here
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) (or the port shown in your terminal) in your browser.

## Build

To verify and bundle for production:

```bash
npm run build
```
