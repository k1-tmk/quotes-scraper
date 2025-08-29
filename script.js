class QuotesScraper {
    constructor() {
        // Initialize core properties for the quotes scraper
        this.quotes = [];              // Array to store all scraped quotes
        this.filteredQuotes = [];      // Array to store filtered quotes for display
        this.currentPage = 1;          // Current page number
        this.quotesPerPage = 6;        // Number of quotes to show per page
        this.isScraping = false;       // Flag to prevent multiple scraping operations
        
        // Initialize the application when the page loads
        this.init();
    }

    // Main initialization method
    init() {
        // Set up event listeners for user interactions
        this.setupEventListeners();
        
        // Start scraping quotes from the website
        this.startScraping();
        
        // Initialize the UI with empty state
        this.updateStats();
        this.renderQuotes();
        
        // Ensure quotes are available even if scraping fails
        setTimeout(() => this.ensureQuotesAvailable(), 1000);
        
        // Also try to ensure quotes are available immediately
        this.ensureQuotesAvailable();
        
        // Force load sample quotes if none available
        if (this.quotes.length === 0) {
            console.log("Forcing sample quotes load");
            this.quotes = this.getSampleQuotes();
            this.filteredQuotes = [...this.quotes];
            this.updateStats();
            this.populateTagFilter();
            this.renderQuotes();
        }
    }

    // Set up all event listeners for user interactions
    setupEventListeners() {
        // Search functionality - filter quotes as user types
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.filterQuotes();
        });

        // Tag filter dropdown - filter quotes by specific tags
        const tagFilter = document.getElementById('tagFilter');
        tagFilter.addEventListener('change', (e) => {
            this.filterQuotes();
        });

        // Export button - download quotes as CSV file
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => {
            this.exportToCSV();
        });

        // Pagination controls - navigate between pages
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        prevBtn.addEventListener('click', () => {
            this.goToPage(this.currentPage - 1);
        });
        
        nextBtn.addEventListener('click', () => {
            this.goToPage(this.currentPage + 1);
        });
    }

    // Main method to start the scraping process
    async startScraping() {
        // Prevent multiple scraping operations from running simultaneously
        if (this.isScraping) {
            console.log('Scraping already in progress...');
            return;
        }

        // Set scraping flag to true to prevent concurrent operations
        this.isScraping = true;
        
        // Show loading indicator to user
        this.showLoading(true);
        
        try {
            // Scrape quotes from multiple pages (quotes.toscrape.com has multiple pages)
            const maxPages = 3; // Limit to first 3 pages for demo purposes
            let allQuotes = [];
            
            // Loop through pages and scrape each one
            for (let page = 1; page <= maxPages; page++) {
                console.log(`Scraping page ${page}...`);
                
                // Scrape individual page and wait for completion
                const pageQuotes = await this.scrapePage(page);
                
                // Add page information to each quote
                const quotesWithPage = pageQuotes.map(quote => ({
                    ...quote,
                    page: page,
                    timestamp: new Date().toISOString()
                }));
                
                // Add quotes from this page to the main collection
                allQuotes = allQuotes.concat(quotesWithPage);
                
                // Small delay between pages to be respectful to the server
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Store all scraped quotes in the main quotes array
            this.quotes = allQuotes;
            
            // Initialize filtered quotes with all quotes (no filters applied yet)
            this.filteredQuotes = [...this.quotes];
            
            // Update statistics and UI
            this.updateStats();
            this.populateTagFilter();
            this.renderQuotes();
            
            console.log(`Successfully scraped ${this.quotes.length} quotes from ${maxPages} pages`);
            
        } catch (error) {
            console.warn("Scraping failed, using sample data as fallback");
            this.quotes = this.getSampleQuotes();
            this.filteredQuotes = [...this.quotes];
            this.updateStats();
            this.populateTagFilter();
            this.renderQuotes();
        } finally {
            // Always hide loading indicator and reset scraping flag
            this.showLoading(false);
            this.isScraping = false;
        }
    }

    // Scrape quotes from a specific page
    async scrapePage(pageNumber) {
        // List of CORS proxy services to try (in case one fails)
        const proxyServices = [
            'https://api.allorigins.win/raw?url=',
            'https://cors-anywhere.herokuapp.com/',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        
        // Try each proxy service until one works
        for (const proxy of proxyServices) {
            try {
                // Construct the URL for the specific page
                const targetUrl = `https://quotes.toscrape.com/page/${pageNumber}/`;
                const proxyUrl = proxy + targetUrl;
                
                console.log(`Trying proxy: ${proxy}`);
                
                // Fetch the page content through the proxy
                const response = await fetch(proxyUrl);
                
                // Check if the response is successful
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Get the HTML content from the response
                const html = await response.text();
                
                // Parse the HTML to extract quote data
                const quotes = this.parseQuotesFromHTML(html);
                
                console.log(`Successfully scraped ${quotes.length} quotes from page ${pageNumber}`);
                return quotes;
                
            } catch (error) {
                console.warn(`Proxy ${proxy} failed for page ${pageNumber}:`, error.message);
                // Continue to next proxy if this one fails
                continue;
            }
        }
        
        // If all proxies fail, throw an error
        throw new Error(`All proxy services failed for page ${pageNumber}`);
    }

    // Parse HTML content to extract quote information
    parseQuotesFromHTML(html) {
        // Create a temporary DOM element to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find all quote containers on the page
        const quoteElements = doc.querySelectorAll('.quote');
        const quotes = [];
        
        // Extract data from each quote element
        quoteElements.forEach((quoteElement, index) => {
            try {
                // Find the quote text within the quote element
                const textElement = quoteElement.querySelector('.text');
                const text = textElement ? textElement.textContent.trim() : '';
                
                // Find the author name within the quote element
                const authorElement = quoteElement.querySelector('.author');
                const author = authorElement ? authorElement.textContent.trim() : '';
                
                // Find all tags associated with this quote
                const tagElements = quoteElement.querySelectorAll('.tag');
                const tags = Array.from(tagElements).map(tag => tag.textContent.trim());
                
                // Create a unique ID for this quote (page + index)
                const id = quotes.length + 1;
                
                // Only add quotes that have both text and author
                if (text && author) {
                    quotes.push({
                        id: id,
                        text: text,
                        author: author,
                        tags: tags
                    });
                }
            } catch (error) {
                console.warn(`Error parsing quote ${index}:`, error);
                // Continue parsing other quotes even if one fails
            }
        });
        
        return quotes;
    }

    // Filter quotes based on search text and selected tag
    filterQuotes() {
        // Get current search text and selected tag
        const searchText = document.getElementById('searchInput').value.toLowerCase();
        const selectedTag = document.getElementById('tagFilter').value;
        
        // Filter quotes based on search criteria
        this.filteredQuotes = this.quotes.filter(quote => {
            // Check if quote text contains search text
            const matchesSearch = quote.text.toLowerCase().includes(searchText) ||
                                quote.author.toLowerCase().includes(searchText);
            
            // Check if quote has the selected tag (or no tag filter applied)
            const matchesTag = !selectedTag || selectedTag === 'all' || 
                             quote.tags.includes(selectedTag);
            
            // Quote must match both search and tag criteria
            return matchesSearch && matchesTag;
        });
        
        // Reset to first page when filtering
        this.currentPage = 1;
        
        // Update statistics and re-render quotes
        this.updateStats();
        this.renderQuotes();
    }

    // Render quotes on the current page
    renderQuotes() {
        // Get the container where quotes will be displayed
        const quotesContainer = document.getElementById('quotesContainer');
        
        // Calculate which quotes to show on current page
        const startIndex = (this.currentPage - 1) * this.quotesPerPage;
        const endIndex = startIndex + this.quotesPerPage;
        const quotesToShow = this.filteredQuotes.slice(startIndex, endIndex);
        
        // Clear previous content
        quotesContainer.innerHTML = '';
        
        // Check if there are quotes to display
        if (quotesToShow.length === 0) {
            // Show message when no quotes match the current filters
            quotesContainer.innerHTML = `
                <div class="no-quotes">
                    <i class="fas fa-search"></i>
                    <h3>No quotes found</h3>
                    <p>Try adjusting your search terms or tag filter.</p>
                </div>
            `;
            return;
        }
        
        // Create HTML for each quote and add to container
        quotesToShow.forEach(quote => {
            const quoteElement = this.createQuoteElement(quote);
            quotesContainer.appendChild(quoteElement);
        });
        
        // Update pagination controls
        this.updatePagination();
    }

    // Create HTML element for a single quote
    createQuoteElement(quote) {
        // Create the main quote container
        const quoteDiv = document.createElement('div');
        quoteDiv.className = 'quote-card';
        quoteDiv.innerHTML = `
            <div class="quote-content">
                <div class="quote-text">
                    <i class="fas fa-quote-left"></i>
                    <p>${this.escapeHTML(quote.text)}</p>
                    <i class="fas fa-quote-right"></i>
                </div>
                <div class="quote-author">
                    <span class="author-name">— ${this.escapeHTML(quote.author)}</span>
                </div>
                <div class="quote-tags">
                    ${quote.tags.map(tag => `
                        <span class="tag">${this.escapeHTML(tag)}</span>
                    `).join('')}
                </div>
                <div class="quote-meta">
                    <small>Page ${quote.page} • ${new Date(quote.timestamp).toLocaleDateString()}</small>
                </div>
            </div>
        `;
        
        return quoteDiv;
    }

    // Escape HTML to prevent XSS attacks
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update pagination controls and page information
    updatePagination() {
        // Calculate total pages needed
        const totalPages = Math.ceil(this.filteredQuotes.length / this.quotesPerPage);
        
        // Get pagination elements
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
        
        // Update button states based on current page
        prevBtn.disabled = this.currentPage <= 1;
        nextBtn.disabled = this.currentPage >= totalPages;
        
        // Update page information display
        if (totalPages > 0) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        } else {
            pageInfo.textContent = 'No pages';
        }
    }

    // Navigate to a specific page
    goToPage(pageNumber) {
        // Calculate total pages
        const totalPages = Math.ceil(this.filteredQuotes.length / this.quotesPerPage);
        
        // Validate page number
        if (pageNumber < 1 || pageNumber > totalPages) {
            console.warn(`Invalid page number: ${pageNumber}`);
            return;
        }
        
        // Update current page and re-render quotes
        this.currentPage = pageNumber;
        this.renderQuotes();
    }

    // Update statistics display
    updateStats() {
        // Get statistics elements
        const totalQuotes = document.getElementById('totalQuotes');
        const uniqueAuthors = document.getElementById('totalAuthors');
        const uniqueTags = document.getElementById('totalTags');
        
        // Calculate statistics
        const total = this.filteredQuotes.length;
        const authors = new Set(this.filteredQuotes.map(q => q.author));
        const tags = new Set(this.filteredQuotes.flatMap(q => q.tags));
        
        // Update display
        totalQuotes.textContent = total;
        uniqueAuthors.textContent = authors.size;
        uniqueTags.textContent = tags.size;
    }

    // Populate tag filter dropdown with available tags
    populateTagFilter() {
        // Get all unique tags from quotes
        const allTags = new Set(this.quotes.flatMap(q => q.tags));
        
        // Get the tag filter dropdown
        const tagFilter = document.getElementById('tagFilter');
        
        // Clear existing options (keep 'all' option)
        tagFilter.innerHTML = '<option value="all">All Tags</option>';
        
        // Add options for each unique tag
        allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
    }

    // Show or hide loading indicator
    showLoading(show) {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.classList.toggle('d-none', !show);
        }
    }

    // Export quotes to CSV file
    exportToCSV() {
        // Check if there are quotes to export
        if (this.filteredQuotes.length === 0) {
            alert('No quotes available to export.');
            return;
        }
        
        // Show export progress modal
        this.showExportModal(true);
        
        try {
            // Prepare CSV headers
            const headers = ['ID', 'Quote', 'Author', 'Tags', 'Page', 'Timestamp'];
            
            // Convert quotes to CSV rows
            const csvRows = [
                headers.join(','), // Header row
                ...this.filteredQuotes.map(quote => [
                    quote.id,
                    `"${quote.text.replace(/"/g, '""')}"`, // Escape quotes in text
                    quote.author,
                    quote.tags.join(';'), // Join tags with semicolon
                    quote.page,
                    quote.timestamp
                ].join(','))
            ];
            
            // Join all rows with newlines
            const csvContent = csvRows.join('\n');
            
            // Create blob and download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            
            // Set download attributes
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `quotes_export_${new Date().toISOString().split('T')[0]}.csv`);
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            console.log(`Successfully exported ${this.filteredQuotes.length} quotes to CSV`);
            
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            alert('Error exporting to CSV. Please try again.');
        } finally {
            // Hide export modal
            this.showExportModal(false);
        }
    }

    // Show or hide export progress modal
    showExportModal(show) {
        const modal = document.getElementById('exportModal');
        if (modal) {
            modal.style.display = show ? 'flex' : 'none';
        }
    }

    // Get sample quotes as fallback when scraping fails
    getSampleQuotes() {
        return [
            {
                id: 1,
                text: "The world as we have created it is a process of our thinking. It cannot be changed without changing our thinking.",
                author: "Albert Einstein",
                tags: ["change", "deep-thoughts", "thinking", "world"],
                page: 0,
                timestamp: new Date().toISOString()
            },
            {
                id: 2,
                text: "It is our choices, Harry, that show what we truly are, far more than our abilities.",
                author: "J.K. Rowling",
                tags: ["abilities", "choices"],
                page: 0,
                timestamp: new Date().toISOString()
            },
            {
                id: 3,
                text: "There are only two ways to live your life. One is as though nothing is a miracle. The other is as though everything is a miracle.",
                author: "Albert Einstein",
                tags: ["inspirational", "life", "live", "miracle", "miracles"],
                page: 0,
                timestamp: new Date().toISOString()
            },
            {
                id: 4,
                text: "The person, be it gentleman or lady, who has not pleasure in a good novel, must be intolerably stupid.",
                author: "Jane Austen",
                tags: ["aliteracy", "books", "classic", "humor"],
                page: 0,
                timestamp: new Date().toISOString()
            },
            {
                id: 5,
                text: "Imperfection is beauty, madness is genius and it's better to be absolutely ridiculous than absolutely boring.",
                author: "Marilyn Monroe",
                tags: ["be-yourself", "inspirational"],
                page: 0,
                timestamp: new Date().toISOString()
            },
            {
                id: 6,
                text: "Try not to become a man of success. Rather become a man of value.",
                author: "Albert Einstein",
                tags: ["adulthood", "success", "value"],
                page: 0,
                timestamp: new Date().toISOString()
            }
        ];
    }

    // Fallback method to ensure quotes are always available
    ensureQuotesAvailable() {
        if (this.quotes.length === 0) {
            console.log("No quotes available, loading sample data");
            this.quotes = this.getSampleQuotes();
            this.filteredQuotes = [...this.quotes];
            this.updateStats();
            this.populateTagFilter();
            this.renderQuotes();
        }
    }

    // Debug method to check current state
    debugState() {
        console.log("=== DEBUG STATE ===");
        console.log("Total quotes:", this.quotes.length);
        console.log("Filtered quotes:", this.filteredQuotes.length);
        console.log("Current page:", this.currentPage);
        console.log("Is scraping:", this.isScraping);
        console.log("Quotes array:", this.quotes);
        console.log("==================");
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create a new instance of the QuotesScraper class
    const scraper = new QuotesScraper();
    
    // Make it available globally for debugging purposes
    window.quotesScraper = scraper;
    
    console.log('Quotes Scraper initialized successfully!');
});
