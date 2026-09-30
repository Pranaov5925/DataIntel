"""
Minimal Crawl4AI HTTP Microservice for Code Cubicle PS01
Exposes:
  GET  /health  -> Health status check
  POST /crawl   -> Accepts {"url": "https://..."} and returns {"url": "...", "title": "...", "markdown": "..."}
"""

import asyncio
import json
import os
import sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.request
from bs4 import BeautifulSoup

PORT = int(os.environ.get("CRAWL4AI_PORT", "11235"))

# Try importing Crawl4AI
try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
    CRAWL4AI_AVAILABLE = True
except Exception as e:
    CRAWL4AI_AVAILABLE = False
    print(f"[Warning] crawl4ai not fully loaded yet: {e}. Fallback HTML extractor will be active.")


async def crawl_with_crawl4ai(url: str) -> dict:
    browser_config = BrowserConfig(headless=True, verbose=False)
    run_config = CrawlerRunConfig(cache_mode=None)

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)
        markdown = result.markdown if hasattr(result, "markdown") and result.markdown else ""
        if not markdown and hasattr(result, "cleaned_html"):
            markdown = result.cleaned_html or ""
        title = ""
        if hasattr(result, "metadata") and isinstance(result.metadata, dict):
            title = result.metadata.get("title", "")
        return {
            "url": url,
            "title": title,
            "markdown": markdown[:25000],  # Bound to reasonable size for LLM context
        }


import ssl

def fallback_crawl(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=4, context=ctx) as response:
        html = response.read().decode("utf-8", errors="ignore")
        soup = BeautifulSoup(html, "html.parser")
        title = soup.title.string.strip() if soup.title and soup.title.string else ""
        # Remove scripts and styles
        for tag in soup(["script", "style", "noscript", "svg", "header", "footer"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return {
            "url": url,
            "title": title,
            "markdown": text[:20000],
        }


class CrawlRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "service": "crawl4ai",
                "crawl4ai_installed": CRAWL4AI_AVAILABLE,
            }).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/crawl":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                data = json.loads(body)
                url = data.get("url", "").strip()
                if not url:
                    self.send_response(400)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Missing 'url' parameter"}).encode("utf-8"))
                    return

                print(f"[Crawler] Crawling URL: {url}")
                result = None
                if CRAWL4AI_AVAILABLE:
                    try:
                        result = asyncio.run(asyncio.wait_for(crawl_with_crawl4ai(url), timeout=6.0))
                    except Exception as crawl_err:
                        print(f"[Crawler] Crawl4AI crawl error/timeout: {crawl_err}. Trying fallback parser.")

                if not result:
                    result = fallback_crawl(url)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode("utf-8"))

            except Exception as e:
                print(f"[Crawler] Error crawling {self.path}: {e}")
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[Crawl4AI Server] {args[0]} {args[1]}\n")


# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

def run():
    server_address = ("127.0.0.1", PORT)
    httpd = ThreadingHTTPServer(server_address, CrawlRequestHandler)
    print(f"[Crawl4AI Service] Listening on http://127.0.0.1:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Crawl4AI Service] Shutting down...")
        httpd.server_close()


if __name__ == "__main__":
    run()
