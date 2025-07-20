from flask import Flask, jsonify, render_template
import requests
from datetime import datetime
from functools import lru_cache
import os

app = Flask(__name__)

# Cache API results for 1 hour
@lru_cache(maxsize=1)
def get_cached_stocks():
    scraper = TSXScraper()
    return scraper.get_stocks(days=10) or []

@app.route('/')
def home():
    stocks = get_cached_stocks()
    return render_template('index.html', stocks=stocks)

@app.route('/api/stocks')
def api_stocks():
    stocks = get_cached_stocks()
    return jsonify({
        "success": True,
        "data": stocks,
        "updated": datetime.now().strftime("%Y-%m-%d %H:%M")
    })

class TSXScraper:
    def __init__(self):
        self.session = requests.Session()
        self.base_url = "https://tsx.exdividend.ca"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
        }

    def get_stocks(self, days=10):
        csrf_token = self._get_csrf_token()
        if not csrf_token:
            return None
            
        response = self.session.post(
            f"{self.base_url}/stocks/",
            headers=self.headers,
            data={"days": str(days), "csrf": csrf_token},
            timeout=10
        )
        return response.json().get("data") if response.status_code == 200 else None

    def _get_csrf_token(self):
        response = self.session.post(
            f"{self.base_url}/t/",
            headers=self.headers,
            data={"n": '[{"key":"userAgent","value":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}]'},
            timeout=5
        )
        return response.json().get("data") if response.text != "null" else None

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))