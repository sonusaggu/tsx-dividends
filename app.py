from flask import Flask, jsonify, request, render_template, send_from_directory
import requests
from datetime import datetime
from functools import lru_cache
import os
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/test-css')
def test_css():
    return send_from_directory('static', 'styles.css')

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
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid stock data: {str(e)}")
                continue
                
        return jsonify({
            "success": True,
            "data": filtered_stocks,
            "updated": datetime.now().strftime("%Y-%m-%d %H:%M")
        })
    except Exception as e:
        logger.error(f"Error in api_stocks: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/search')
def api_search():
    symbol = request.args.get('symbol', '').upper().strip()
    if not symbol:
        return jsonify({
            "success": False,
            "message": "Please enter a stock symbol"
        }), 400

    try:
        scraper = TSXScraper()
        results = scraper.search_by_symbol(symbol)
        
        if results is None:
            logger.warning(f"Search service unavailable for symbol: {symbol}")
            return jsonify({
                "success": False,
                "message": "Temporarily unable to connect to data source. Please try again later."
            }), 503
            
        if not results:  # Empty list
            logger.info(f"No results found for symbol: {symbol}")
            return jsonify({
                "success": True,
                "data": [],
                "message": f"No dividend information found for {symbol}",
                "symbol": symbol
            })

        today = datetime.now()
        formatted_results = []
        
        for item in results:
            try:
                # Handle different response formats
                stock_data = {
                    "code": item.get("symbol") or item.get("code") or "",
                    "company": item.get("name") or item.get("company") or "",
                    "sector": item.get("sector") or "N/A",
                    "dividend": item.get("dividend") or "N/A",
                    "yield": item.get("yield") or "N/A",
                    "dividend_currency": "CAD",
                    "payout_frequency": item.get("frequency") or "N/A",
                    "last_price": item.get("price") or "N/A"
                }
                
                # Process dates
                if "dividend_date" in item:
                    ex_date = datetime.strptime(item["dividend_date"], "%Y-%m-%d")
                    stock_data.update({
                        "dividend_date": item["dividend_date"],
                        "upcoming_date": format_date(item["dividend_date"]),
                        "days_until": (ex_date - today).days
                    })
                
                if "dividend_payable_date" in item:
                    stock_data.update({
                        "dividend_payable_date": item["dividend_payable_date"],
                        "formatted_pay_date": format_date(item["dividend_payable_date"])
                    })
                
                formatted_results.append(stock_data)
                
            except Exception as e:
                logger.warning(f"Skipping invalid stock item: {str(e)}")
                continue
                
        logger.info(f"Found {len(formatted_results)} results for {symbol}")
        return jsonify({
            "success": True,
            "data": formatted_results,
            "symbol": symbol,
            "message": f"Found {len(formatted_results)} result(s) for {symbol}"
        })
        
    except Exception as e:
        logger.error(f"Error in api_search for {symbol}: {str(e)}")
        return jsonify({
            "success": False,
            "message": "An internal error occurred while processing your request"
        }), 500

class TSXScraper:
    def __init__(self):
        self.session = requests.Session()
        self.base_url = "https://tsx.exdividend.ca"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
        }
        self.session.headers.update(self.headers)

    def get_stocks(self, days=10):
        try:
            csrf_token = self._get_csrf_token()
            if not csrf_token:
                logger.error("Failed to get CSRF token for stocks")
                return None
                
            response = self.session.post(
                f"{self.base_url}/stocks/",
                data={"days": str(days), "csrf": csrf_token},
                timeout=15
            )
            
            if response.status_code != 200:
                logger.error(f"Stocks API returned status {response.status_code}")
                return None
                
            return response.json().get("data")
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed in get_stocks: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in get_stocks: {str(e)}")
            return None

    def _get_csrf_token(self):
        try:
            response = self.session.post(
                f"{self.base_url}/t/",
                data={"n": '[{"key":"userAgent","value":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"}]'},
                timeout=10
            )
            if response.status_code == 200:
                try:
                    return response.json().get("data")
                except ValueError:
                    logger.error("Failed to parse CSRF token response")
            return None
        except Exception as e:
            logger.error(f"Error getting CSRF token: {str(e)}")
            return None
    
    def search_by_symbol(self, symbol):
        try:
            csrf_token = self._get_csrf_token()
            if not csrf_token:
                logger.error(f"Failed to get CSRF token for symbol search: {symbol}")
                return None
                
            response = self.session.post(
                f"{self.base_url}/stocks/",
                data={"term": symbol, "csrf": csrf_token},
                timeout=15
            )
            
            if response.status_code != 200:
                logger.error(f"Search API returned status {response.status_code} for {symbol}")
                return None
                
            try:
                data = response.json()
                # Handle different response formats
                if isinstance(data, list):
                    return data
                return data.get('data', [])
            except ValueError:
                logger.error(f"Invalid JSON response for symbol: {symbol}")
                return None
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed in search_by_symbol for {symbol}: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in search_by_symbol for {symbol}: {str(e)}")
            return None

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)