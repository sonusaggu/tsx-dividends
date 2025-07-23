// Configuration
const itemsPerPage = 15;
let currentPage = 1;
let currentDaysFilter = null;
let currentSearchSymbol = null;
let currentSectorFilter = null;
let currentHighYieldFilter = false;
let allStocks = [];

document.addEventListener('DOMContentLoaded', function () {
    setupEventListeners();
    fetchStocks();
});

function setupEventListeners() {
    document.getElementById('timeframe-buttons').addEventListener('click', function (e) {
        if (e.target.tagName === 'BUTTON') {
            currentDaysFilter = e.target.dataset.days === 'all' ? null : parseInt(e.target.dataset.days);
            currentPage = 1;
            currentSearchSymbol = null;
            currentSectorFilter = null;
            currentHighYieldFilter = false;

            document.querySelectorAll('#timeframe-buttons .btn').forEach(btn => {
                btn.classList.toggle('active', btn === e.target);
            });

            document.getElementById('high-yield-filter').classList.remove('active');

            document.getElementById('timeframe-title').textContent =
                `${e.target.textContent} Upcoming Dividend Stocks`;

            fetchStocks(currentDaysFilter);
        }
    });

    document.getElementById('pagination').addEventListener('click', function (e) {
        if (e.target.classList.contains('page-link')) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page) && page !== currentPage) {
                currentPage = page;
                filterAndRenderStocks();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });

    document.getElementById('search-button').addEventListener('click', searchBySymbol);
    document.getElementById('clear-search').addEventListener('click', clearSearch);
    document.getElementById('symbol-search').addEventListener('keyup', function (e) {
        if (e.key === 'Enter') searchBySymbol();
    });

    document.getElementById('sector-tags').addEventListener('click', function (e) {
        if (e.target.classList.contains('sector-tag')) {
            const sector = e.target.dataset.sector === 'all' ? null : e.target.dataset.sector;

            document.querySelectorAll('#sector-tags .sector-tag').forEach(tag => {
                tag.classList.toggle('active', tag === e.target);
            });

            currentSectorFilter = sector;
            currentPage = 1;
            filterAndRenderStocks();
        }
    });

    document.getElementById('high-yield-filter').addEventListener('click', function () {
        currentHighYieldFilter = !currentHighYieldFilter;
        this.classList.toggle('active', currentHighYieldFilter);
        currentPage = 1;
        filterAndRenderStocks();
    });
}

async function fetchStocks(days = null) {
    if (currentSearchSymbol) return;

    const spinner = document.getElementById('loading-spinner');
    const errorEl = document.getElementById('error-message');
    const tbody = document.getElementById('stocks-data');

    try {
        showLoading(true);
        errorEl.classList.add('d-none');
        tbody.innerHTML = '';

        const response = await fetch(`/api/stocks${days ? `?days=${days}` : ''}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to fetch data');
        }

        allStocks = data.data;
        updateSectorTags(allStocks);
        filterAndRenderStocks();

        document.getElementById('last-updated').innerHTML = `
            <i class="bi bi-clock-history"></i> Updated: ${data.updated}`;
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function filterAndRenderStocks() {
    let filteredStocks = [...allStocks];

    // ✅ Show only today's and upcoming dividend stocks
    filteredStocks = filteredStocks.filter(stock =>
        typeof stock.days_until === 'number' && stock.days_until >= 0
    );

    if (currentSectorFilter) {
        filteredStocks = filteredStocks.filter(stock =>
            stock.sector && stock.sector.toLowerCase() === currentSectorFilter.toLowerCase()
        );
    }

    if (currentHighYieldFilter) {
        filteredStocks = filteredStocks.filter(stock =>
            parseFloat(stock.yield) > 5
        );
    }

    renderStocks(filteredStocks);
}

function updateSectorTags(stocks) {
    const sectorTagsContainer = document.getElementById('sector-tags');
    const sectors = [...new Set(stocks.map(stock => stock.sector).filter(Boolean))];
    sectors.sort();

    let tagsHtml = `
        <span class="sector-tag ${!currentSectorFilter ? 'active' : ''}" data-sector="all">
            All Sectors
        </span>
    `;

    sectors.forEach(sector => {
        tagsHtml += `
            <span class="sector-tag ${currentSectorFilter === sector ? 'active' : ''}" 
                  data-sector="${sector}">
                ${sector}
            </span>
        `;
    });

    sectorTagsContainer.innerHTML = tagsHtml;
}

async function searchBySymbol() {
    const symbol = document.getElementById('symbol-search').value.trim().toUpperCase();
    if (!symbol) {
        showSearchFeedback('Please enter a stock symbol', 'text-danger');
        return;
    }

    currentSearchSymbol = symbol;
    currentPage = 1;
    currentSectorFilter = null;
    currentHighYieldFilter = false;
    document.getElementById('high-yield-filter').classList.remove('active');

    const feedback = document.getElementById('search-feedback');
    showLoading(true);
    feedback.textContent = '';

    try {
        const response = await fetch(`/api/search?symbol=${symbol}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to fetch search results');
        }

        if (data.data.length === 0) {
            showSearchFeedback(`No dividend information found for ${symbol}`, 'text-warning');
            renderStocks([]);
        } else {
            showSearchFeedback(`Showing results for ${symbol}`, 'text-success');
            allStocks = data.data;
            updateSectorTags(allStocks);
            filterAndRenderStocks(); // ✅ Filter after search
        }

        document.getElementById('last-updated').innerHTML = `
            <i class="bi bi-clock-history"></i> Updated: ${new Date().toLocaleString()}`;
    } catch (error) {
        console.error('Search error:', error);
        showSearchFeedback(error.message, 'text-danger');
        renderStocks([]);
    } finally {
        showLoading(false);
    }
}

function clearSearch() {
    document.getElementById('symbol-search').value = '';
    document.getElementById('search-feedback').textContent = '';
    currentSearchSymbol = null;
    currentSectorFilter = null;
    currentHighYieldFilter = false;
    document.getElementById('high-yield-filter').classList.remove('active');
    currentPage = 1;
    fetchStocks(currentDaysFilter);
}

function renderStocks(stocks) {
    const tbody = document.getElementById('stocks-data');
    const pagination = document.getElementById('pagination');

    if (!stocks || stocks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No dividends found</td></tr>';
        pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(stocks.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedStocks = stocks.slice(startIdx, startIdx + itemsPerPage);

    tbody.innerHTML = paginatedStocks.map(stock => {
        const isHighYield = parseFloat(stock.yield) > 5;
        const daysUntil = stock.days_until;
        let daysBadge = '';

        if (daysUntil !== undefined) {
            let badgeClass = 'bg-primary';
            if (daysUntil === 0) badgeClass = 'bg-danger';
            else if (daysUntil <= 3) badgeClass = 'bg-warning';

            daysBadge = `<span class="badge ${badgeClass} ms-2">${
                daysUntil === 0 ? 'Today' :
                daysUntil === 1 ? 'Tomorrow' :
                `${daysUntil}d`
            }</span>`;
        }

        return `
        <tr class="${isHighYield ? 'high-yield' : ''}">
            <td class="ps-3 fw-bold" data-label="Symbol">${stock.code || 'N/A'}</td>
            <td data-label="Company">${stock.company || 'N/A'}</td>
            <td data-label="Sector">${stock.sector || 'N/A'}</td>
            <td data-label="Ex-Date">
                ${stock.upcoming_date || 'N/A'} ${daysBadge}
            </td>
            <td data-label="Pay Date">${stock.formatted_pay_date || 'N/A'}</td>
            <td class="text-end" data-label="Price">${stock.last_price || 'N/A'}</td>
            <td class="text-end ${isHighYield ? 'text-success fw-bold' : ''}" data-label="Yield">
                ${stock.yield || 'N/A'}
            </td>
            <td class="text-end" data-label="Amount">
                ${stock.dividend_currency || ''} ${stock.dividend || 'N/A'}
            </td>
            <td data-label="Frequency">${stock.payout_frequency || 'N/A'}</td>
        </tr>
        `;
    }).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    pagination.innerHTML = '';

    pagination.innerHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

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

    pagination.innerHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
}

function showLoading(show) {
    document.getElementById('loading-spinner').classList.toggle('d-none', !show);
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
}

function showSearchFeedback(message, className) {
    const feedback = document.getElementById('search-feedback');
    feedback.textContent = message;
    feedback.className = `text-center mt-2 small ${className}`;
}
