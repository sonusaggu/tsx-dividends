document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    fetchStocks();

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
        fetchStocks(true); // Force refresh
    });
});

async function fetchStocks(forceRefresh = false) {
    const tbody = document.getElementById('stocks-data');
    const refreshBtn = document.getElementById('refresh-btn');
    
    try {
        // Show loading state
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>`;
        
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refreshing...';

        // API call
        const response = await fetch(`/api/stocks?force=${forceRefresh ? '1' : '0'}`);
        const data = await response.json();

        if (data.success) {
            renderStocks(data.data);
            updateMetadata(data.updated);
        } else {
            showError("Failed to load data. Please try later.");
        }
    } catch (error) {
        showError("Network error. Check your connection.");
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Data';
    }
}

function renderStocks(stocks) {
    const tbody = document.getElementById('stocks-data');
    
    if (!stocks || stocks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    No upcoming dividends found
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = stocks.map(stock => `
        <tr class="stock-row ${stock.yield > 5 ? 'high-yield' : ''}">
            <td class="ps-4 fw-bold">${stock.code}</td>
            <td>${stock.company}</td>
            <td>
                ${stock.upcoming_date}
                <span class="badge rounded-pill badge-ex-date 
                    ${stock.days_until === 0 ? 'today' : 
                      stock.days_until <= 3 ? 'soon' : 'future'} ms-2">
                    ${stock.days_until === 0 ? 'Today' : 
                     stock.days_until === 1 ? 'Tomorrow' : 
                     `${stock.days_until}d`}
                </span>
            </td>
            <td class="text-end ${stock.yield > 5 ? 'text-success fw-bold' : ''}">
                ${stock.yield}%
            </td>
            <td class="text-end">
                ${stock.dividend_currency} ${stock.dividend}
            </td>
            <td>${stock.payout_frequency}</td>
            <td class="pe-4">
                <button class="btn btn-sm btn-outline-primary">
                    <i class="bi bi-bell"></i> Alert
                </button>
            </td>
        </tr>
    `).join('');
}

function updateMetadata(timestamp) {
    document.getElementById('last-updated').innerHTML = `
        <i class="bi bi-clock-history"></i> Updated: ${timestamp}`;
    
    document.getElementById('data-source-time').textContent = 
        new Date().toLocaleTimeString();
}

function showError(message) {
    const tbody = document.getElementById('stocks-data');
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-4 text-danger">
                <i class="bi bi-exclamation-triangle"></i> ${message}
            </td>
        </tr>`;
}