// Configuration
const config = {
    itemsPerPage: 15,
    highYieldThreshold: 5,
    apiEndpoints: {
        stocks: '/api/stocks',
        search: '/api/search'
    }
};

// State management
const state = {
    currentPage: 1,
    currentDaysFilter: null,
    currentSearchSymbol: null,
    currentSectorFilter: null,
    currentHighYieldFilter: false,
    allStocks: [],
    filteredStocks: []
};

// DOM Elements
const elements = {
    loadingSpinner: document.getElementById('loading-spinner'),
    errorMessage: document.getElementById('error-message'),
    noResults: document.getElementById('no-results'),
    stocksTable: document.getElementById('stocks-table'),
    stocksData: document.getElementById('stocks-data'),
    pagination: document.getElementById('pagination'),
    timeframeTitle: document.getElementById('timeframe-title'),
    lastUpdated: document.getElementById('last-updated'),
    searchFeedback: document.getElementById('search-feedback'),
    symbolSearch: document.getElementById('symbol-search'),
    highYieldFilter: document.getElementById('high-yield-filter'),
    sectorTags: document.getElementById('sector-tags'),
    footerUpdateTime: document.getElementById('footer-update-time')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    fetchStocks();
});

// Set up all event listeners
function setupEventListeners() {
    // Timeframe filter buttons
    document.querySelectorAll('[data-days]').forEach(button => {
        button.addEventListener('click', handleTimeframeFilter);
    });

    // Set 'All' as active by default
    document.querySelector('[data-days="all"]').classList.add('active');

    // Pagination
    elements.pagination.addEventListener('click', handlePagination);

    // Search functionality
    document.getElementById('search-button').addEventListener('click', searchBySymbol);
    document.getElementById('clear-search').addEventListener('click', clearSearch);
    elements.symbolSearch.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') searchBySymbol();
    });

    // Sector tags
    elements.sectorTags.addEventListener('click', handleSectorFilter);

    // High yield filter
    elements.highYieldFilter.addEventListener('click', toggleHighYieldFilter);
}

// Handle timeframe filter changes
function handleTimeframeFilter(e) {
    const days = e.target.dataset.days === 'all' ? null : parseInt(e.target.dataset.days);
    
    // Update state
    state.currentDaysFilter = days;
    state.currentPage = 1;
    state.currentSearchSymbol = null;
    state.currentSectorFilter = null;
    state.currentHighYieldFilter = false;
    
    // Update UI
    document.querySelectorAll('[data-days]').forEach(btn => {
        btn.classList.toggle('active', btn === e.target);
    });
    
    elements.highYieldFilter.classList.remove('active');
    
    // Update title based on selection
    const timeframeText = e.target.textContent === 'All' ? 'All Upcoming' : `Next ${e.target.textContent}`;
    if (elements.timeframeTitle) {
        elements.timeframeTitle.innerHTML = `<i class="bi bi-tags me-2"></i> ${timeframeText} Dividend Stocks`;
    }
    
    elements.symbolSearch.value = '';
    elements.searchFeedback.textContent = '';
    
    filterAndRenderStocks(true);
}

// Handle pagination clicks
function handlePagination(e) {
    if (e.target.classList.contains('page-link')) {
        e.preventDefault();
        const page = parseInt(e.target.dataset.page);
        
        if (!isNaN(page) && page !== state.currentPage) {
            state.currentPage = page;
            renderStocks();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}

// Handle sector filter clicks
function handleSectorFilter(e) {
    if (e.target.classList.contains('sector-tag')) {
        const sector = e.target.dataset.sector === 'all' ? null : e.target.dataset.sector;
        
        // Update state
        state.currentSectorFilter = sector;
        state.currentPage = 1;
        
        // Update UI
        document.querySelectorAll('#sector-tags .sector-tag').forEach(tag => {
            tag.classList.toggle('active', tag === e.target);
        });
        
        filterAndRenderStocks();
    }
}

// Toggle high yield filter
function toggleHighYieldFilter() {
    state.currentHighYieldFilter = !state.currentHighYieldFilter;
    state.currentPage = 1;
    
    // Update UI
    elements.highYieldFilter.classList.toggle('active', state.currentHighYieldFilter);
    
    filterAndRenderStocks();
}

// Fetch stocks data from API
async function fetchStocks() {
    showLoading(true);
    elements.errorMessage.classList.add('d-none');
    elements.stocksData.innerHTML = '';
    
    try {
        const response = await fetch(config.apiEndpoints.stocks);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to fetch data');
        }
        
        state.allStocks = data.data;
        updateSectorTags(state.allStocks);
        filterAndRenderStocks(true);
        
        // Update last updated time
        const updatedTime = new Date(data.updated).toLocaleString();
        elements.lastUpdated.innerHTML = `<i class="bi bi-clock-history"></i> Updated: ${updatedTime}`;
        elements.footerUpdateTime.textContent = updatedTime;
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Search stocks by symbol
async function searchBySymbol() {
    const symbol = elements.symbolSearch.value.trim().toUpperCase();
    
    if (!symbol) {
        showSearchFeedback('Please enter a stock symbol', 'text-danger');
        return;
    }
    
    // Update state
    state.currentSearchSymbol = symbol;
    state.currentPage = 1;
    state.currentDaysFilter = null;
    state.currentSectorFilter = null;
    state.currentHighYieldFilter = false;
    
    // Update UI
    elements.highYieldFilter.classList.remove('active');
    showLoading(true);
    elements.searchFeedback.textContent = '';
    
    try {
        const response = await fetch(`${config.apiEndpoints.search}?symbol=${symbol}`);
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to fetch search results');
        }
        
        if (data.data.length === 0) {
            showSearchFeedback(`No dividend information found for ${symbol}`, 'text-warning');
            renderNoResults();
        } else {
            showSearchFeedback(`Showing results for ${symbol}`, 'text-success');
            state.allStocks = data.data;
            updateSectorTags(state.allStocks);
            filterAndRenderStocks(false);
        }
        
        // Update last updated time
        const updatedTime = new Date().toLocaleString();
        elements.lastUpdated.innerHTML = `<i class="bi bi-clock-history"></i> Updated: ${updatedTime}`;
        elements.footerUpdateTime.textContent = updatedTime;
    } catch (error) {
        console.error('Search error:', error);
        showSearchFeedback(error.message, 'text-danger');
        renderNoResults();
    } finally {
        showLoading(false);
    }
}

// Clear search and reset filters
function clearSearch() {
    elements.symbolSearch.value = '';
    elements.searchFeedback.textContent = '';
    
    // Reset state
    state.currentSearchSymbol = null;
    state.currentDaysFilter = null;
    state.currentSectorFilter = null;
    state.currentHighYieldFilter = false;
    state.currentPage = 1;
    
    // Reset UI
    elements.highYieldFilter.classList.remove('active');
    document.querySelector('[data-days="all"]').click();
    if (document.querySelector('#sector-tags .sector-tag[data-sector="all"]')) {
        document.querySelector('#sector-tags .sector-tag[data-sector="all"]').click();
    }
}

// Filter stocks based on current filters
function filterAndRenderStocks(excludePast = true) {
    state.filteredStocks = [...state.allStocks];
    
    // Apply filters
    if (excludePast) {
        state.filteredStocks = state.filteredStocks.filter(stock => 
            typeof stock.days_until === 'number' && stock.days_until >= 0
        );
    }
    
    // Apply days filter if set
    if (state.currentDaysFilter !== null) {
        state.filteredStocks = state.filteredStocks.filter(stock => 
            typeof stock.days_until === 'number' && 
            stock.days_until <= state.currentDaysFilter
        );
    }
    
    if (state.currentSectorFilter) {
        state.filteredStocks = state.filteredStocks.filter(stock =>
            stock.sector && stock.sector.toLowerCase() === state.currentSectorFilter.toLowerCase()
        );
    }
    
    if (state.currentHighYieldFilter) {
        state.filteredStocks = state.filteredStocks.filter(stock =>
            parseFloat(stock.yield) > config.highYieldThreshold
        );
    }
    
    renderStocks();
}

// Update sector tags based on current stocks
function updateSectorTags(stocks) {
    const sectors = [...new Set(stocks.map(stock => stock.sector).filter(Boolean))].sort();
    
    let tagsHtml = `
        <span class="sector-tag ${!state.currentSectorFilter ? 'active' : ''}" data-sector="all">
            All Sectors
        </span>
    `;
    
    sectors.forEach(sector => {
        tagsHtml += `
            <span class="sector-tag ${state.currentSectorFilter === sector ? 'active' : ''}" 
                  data-sector="${sector}">
                ${sector}
            </span>
        `;
    });
    
    elements.sectorTags.innerHTML = tagsHtml;
}

// Render stocks table
function renderStocks() {
    if (state.filteredStocks.length === 0) {
        renderNoResults();
        return;
    }
    
    const totalPages = Math.ceil(state.filteredStocks.length / config.itemsPerPage);
    const startIdx = (state.currentPage - 1) * config.itemsPerPage;
    const paginatedStocks = state.filteredStocks.slice(startIdx, startIdx + config.itemsPerPage);
    
    // Show table and hide no results message
    elements.stocksTable.classList.remove('d-none');
    elements.noResults.classList.add('d-none');
    
    // Render table rows
    elements.stocksData.innerHTML = paginatedStocks.map(stock => createStockRow(stock)).join('');
    
    // Render pagination
    renderPagination(totalPages);
}

function createStockRow(stock) {
    const isHighYield = parseFloat(stock.yield) > config.highYieldThreshold;
    
    return `
    <tr class="${isHighYield ? 'high-yield' : ''}">
        <td class="symbol-col">${stock.code || 'N/A'}</td>
        <td class="company-col">${stock.company || 'N/A'}</td>
        <td class="sector-col">${stock.sector || 'N/A'}</td>
        <td class="ex-date-col">
            ${stock.upcoming_date || 'N/A'}
            ${formatDaysBadge(stock.days_until)}
        </td>
        <td class="pay-date-col">${stock.formatted_pay_date || 'N/A'}</td>
        <td class="text-end price-col">${stock.last_price || 'N/A'}</td>
        <td class="text-end yield-col ${isHighYield ? 'text-success fw-bold' : ''}">
            ${stock.yield || 'N/A'}
        </td>
        <td class="text-end amount-col">
            ${stock.dividend_currency || ''} ${stock.dividend || 'N/A'}
        </td>
        <td class="freq-col">${stock.payout_frequency || 'N/A'}</td>
    </tr>
    `;
}

function formatDaysBadge(days) {
    if (days === undefined) return '';
    
    let badgeClass = 'bg-primary';
    if (days === 0) badgeClass = 'bg-danger';
    else if (days <= 3) badgeClass = 'bg-warning';
    
    return `<span class="badge ${badgeClass} ms-2">
        ${days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
    </span>`;
}

// Render no results message
function renderNoResults() {
    elements.stocksTable.classList.add('d-none');
    elements.noResults.classList.remove('d-none');
    elements.pagination.innerHTML = '';
}

// Render pagination controls
function renderPagination(totalPages) {
    if (totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let paginationHtml = `
        <li class="page-item ${state.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${state.currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        paginationHtml += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="1">1</a>
            </li>
            ${startPage > 2 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
        `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <li class="page-item ${i === state.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `;
    }
    
    if (endPage < totalPages) {
        paginationHtml += `
            ${endPage < totalPages - 1 ? '<li class="page-item disabled"><span class="page-link">...</span></li>' : ''}
            <li class="page-item">
                <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
            </li>
        `;
    }
    
    paginationHtml += `
        <li class="page-item ${state.currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${state.currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;
    
    elements.pagination.innerHTML = paginationHtml;
}

// Show loading spinner
function showLoading(show) {
    elements.loadingSpinner.classList.toggle('d-none', !show);
}

// Show error message
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('d-none');
}

// Show search feedback
function showSearchFeedback(message, className) {
    elements.searchFeedback.textContent = message;
    elements.searchFeedback.className = `search-feedback ${className}`;
}