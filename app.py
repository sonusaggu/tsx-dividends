from flask import Flask, jsonify, request, render_template
import requests
from datetime import datetime
from functools import lru_cache
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def format_date(date_str):
    """Safely format dates from YYYY-MM-DD to Month Day, Year"""
    if not date_str:
        return "N/A"
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").strftime("%b %d, %Y")
    except ValueError:
        return "Invalid Date"

@lru_cache(maxsize=1)
def get_cached_stocks():
    scraper = TSXScraper()
    return scraper.get_stocks(days=60) or []  # Cache 60 days by default

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/stocks')
def api_stocks():
    try:
        days = request.args.get('days', type=int)
        stocks = get_cached_stocks()
        today = datetime.now()
        filtered_stocks = []
        
        for stock in stocks:
            try:
                ex_date = datetime.strptime(stock['dividend_date'], "%Y-%m-%d")
                days_until = (ex_date - today).days
                
                if not days or (0 <= days_until <= days):
                    filtered_stocks.append({
                        **stock,
                        'upcoming_date': format_date(stock['dividend_date']),
                        'formatted_pay_date': format_date(stock['dividend_payable_date']),
                        'days_until': days_until
                    })
            except (ValueError, KeyError):
                continue
                
        return jsonify({
            "success": True,
            "data": filtered_stocks,
            "updated": datetime.now().strftime("%Y-%m-%d %H:%M")
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
   
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
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)