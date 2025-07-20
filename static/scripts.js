// Configuration
const itemsPerPage = 15;
let currentPage = 1;
let currentDaysFilter = null;
let allStocks = [];

document.addEventListener('DOMContentLoaded', function() {
    // Timeframe filtering
    document.getElementById('timeframe-buttons').addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') {
            currentDaysFilter = e.target.dataset.days === 'all' ? null : parseInt(e.target.dataset.days);
            currentPage = 1;
            
            // Update active button
            document.querySelectorAll('#timeframe-buttons .btn').forEach(btn => {
                btn.classList.toggle('active', btn === e.target);
            });
            
            // Update title
            document.getElementById('timeframe-title').textContent = 
                `${e.target.textContent} Dividend Stocks`;
            
            fetchStocks(currentDaysFilter);
        }
    });

    // Initial load
    fetchStocks();

    // Pagination click handler
    document.getElementById('pagination').addEventListener('click', function(e) {
        if (e.target.classList.contains('page-link')) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page) && page !== currentPage) {
                currentPage = page;
                renderStocks(allStocks);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });
    
    initializeTooltips();
});

async function fetchStocks(days = null) {
    if (currentSearchSymbol) {
        return; // Don't fetch all stocks if we're in search mode
    }
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
        
        allStocks = data.data;
        renderStocks(allStocks);
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
    const pagination = document.getElementById('pagination');
    
    if (!stocks || stocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No dividends found</td></tr>';
        pagination.innerHTML = '';
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(stocks.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedStocks = stocks.slice(startIdx, startIdx + itemsPerPage);
    
    // Render stocks
    tbody.innerHTML = paginatedStocks.map(stock => {
        const isHighYield = parseFloat(stock.yield) > 5;
        return `
        <tr class="${isHighYield ? 'high-yield' : ''}">
            <td class="ps-3 fw-bold position-relative">
                ${stock.code || 'N/A'}
            </td>
            <td>${stock.company || 'N/A'}</td>
            <td>${stock.sector || 'N/A'}</td>
            <td class="position-relative">
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
            <td class="text-end position-relative ${isHighYield ? 'text-success fw-bold' : ''}">
                ${stock.yield || 'N/A'}
            </td>
            <td class="text-end">${stock.dividend_currency || ''} ${stock.dividend || 'N/A'}</td>
            <td>${stock.payout_frequency || 'N/A'}</td>
        </tr>
        `;
    }).join('');
    
    // Render pagination
    renderPagination(totalPages);
    
    // Animate rows
    animateTableRows();
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    
    // Previous button
    pagination.innerHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        pagination.innerHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
            ${startPage > 2 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
        `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        pagination.innerHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    if (endPage < totalPages) {
        pagination.innerHTML += `
            ${endPage < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    // Next button
    pagination.innerHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
}

function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

function animateTableRows() {
    const rows = document.querySelectorAll('#stocks-data tr');
    rows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(20px)';
        row.style.transition = `all 0.3s ease ${index * 0.05}s`;
        
        setTimeout(() => {
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 50);
    });
}

// Add these at the top with your other variables
let currentSearchSymbol = null;

// Add this event listener with your other DOM listeners
document.getElementById('search-button').addEventListener('click', searchBySymbol);
document.getElementById('clear-search').addEventListener('click', clearSearch);
document.getElementById('symbol-search').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        searchBySymbol();
    }
});

// Add these new functions
function searchBySymbol() {
    const symbol = document.getElementById('symbol-search').value.trim().toUpperCase();
    if (!symbol) {
        showSearchFeedback('Please enter a stock symbol', 'text-danger');
        return;
    }

    currentSearchSymbol = symbol;
    currentPage = 1;
    
    const spinner = document.getElementById('loading-spinner');
    const feedback = document.getElementById('search-feedback');
    
    spinner.classList.remove('d-none');
    feedback.textContent = '';
    
    fetch(`/api/search?symbol=${symbol}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (data.data.length === 0) {
                    showSearchFeedback(`No dividend information found for ${symbol}`, 'text-warning');
                    renderStocks([]);
                } else {
                    showSearchFeedback(`Showing results for ${symbol}`, 'text-success');
                    renderStocks(data.data);
                }
            } else {
                showSearchFeedback(data.message, 'text-danger');
                renderStocks([]);
            }
        })
        .catch(error => {
            showSearchFeedback('Error searching for symbol', 'text-danger');
            console.error('Search error:', error);
        })
        .finally(() => {
            spinner.classList.add('d-none');
        });
}

function clearSearch() {
    document.getElementById('symbol-search').value = '';
    document.getElementById('search-feedback').textContent = '';
    currentSearchSymbol = null;
    currentPage = 1;
    fetchStocks(currentDaysFilter);
}

function showSearchFeedback(message, className) {
    const feedback = document.getElementById('search-feedback');
    feedback.textContent = message;
    feedback.className = `text-center mt-2 small ${className}`;
}