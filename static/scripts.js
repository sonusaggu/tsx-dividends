document.addEventListener('DOMContentLoaded', function() {
    // Timeframe filtering
    document.getElementById('timeframe-buttons').addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') {
            const days = e.target.dataset.days === 'all' ? null : parseInt(e.target.dataset.days);
            
            // Update active button
            document.querySelectorAll('#timeframe-buttons .btn').forEach(btn => {
                btn.classList.toggle('active', btn === e.target);
            });
            
            // Update title
            document.getElementById('timeframe-title').textContent = 
                `${e.target.textContent} Dividend Stocks`;
            
            fetchStocks(days);
        }
    });

    // Initial load
    fetchStocks();
});

async function fetchStocks(days = null) {
    const spinner = document.getElementById('loading-spinner');
    const errorEl = document.getElementById('error-message');
    const tbody = document.getElementById('stocks-data');
    
    try {
        // Show loading state
        spinner.classList.remove('d-none');
        errorEl.classList.add('d-none');
        tbody.innerHTML = '';
        
        const response = await fetch(`/api/stocks${days ? `?days=${days}` : ''}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to fetch data');
        }
        
        renderStocks(data.data);
        document.getElementById('last-updated').innerHTML = `
            <i class="bi bi-clock-history"></i> Updated: ${data.updated}`;
            
    } catch (error) {
        console.error('Error:', error);
        errorEl.textContent = `Error: ${error.message}`;
        errorEl.classList.remove('d-none');
    } finally {
        spinner.classList.add('d-none');
    }
}

function renderStocks(stocks) {
    const tbody = document.getElementById('stocks-data');
    
    if (!stocks || stocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No dividends found</td></tr>';
        return;
    }
    
    tbody.innerHTML = stocks.map(stock => `
        <tr class="${parseFloat(stock.yield) > 5 ? 'high-yield' : ''}">
            <td class="ps-4 fw-bold">${stock.code || 'N/A'}</td>
            <td>${stock.company || 'N/A'}</td>
            <td>${stock.sector || 'N/A'}</td>
            <td>
                ${stock.upcoming_date || 'N/A'}
                ${stock.days_until !== undefined ? `
                <span class="badge ${
                    stock.days_until === 0 ? 'bg-danger' :
                    stock.days_until <= 3 ? 'bg-warning' : 'bg-primary'
                } ms-2">
                    ${
                        stock.days_until === 0 ? 'Today' :
                        stock.days_until === 1 ? 'Tomorrow' :
                        `${stock.days_until}d`
                    }
                </span>` : ''}
            </td>
            <td>${stock.formatted_pay_date || 'N/A'}</td>
            <td class="text-end">${stock.last_price || 'N/A'}</td>
            <td class="text-end ${parseFloat(stock.yield) > 5 ? 'text-success fw-bold' : ''}">
                ${stock.yield || 'N/A'}
            </td>
            <td class="text-end">${stock.dividend_currency || ''} ${stock.dividend || 'N/A'}</td>
            <td>${stock.payout_frequency || 'N/A'}</td>
        </tr>
    `).join('');
}