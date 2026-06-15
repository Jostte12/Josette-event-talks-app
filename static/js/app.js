document.addEventListener('DOMContentLoaded', () => {
    // State management
    let updates = [];
    let filteredUpdates = [];
    let selectedUpdate = null;
    let currentFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const retryBtn = document.getElementById('retry-btn');
    const spinner = document.getElementById('spinner');
    const searchInput = document.getElementById('search-input');
    const filterTags = document.querySelectorAll('.filter-tag');
    const releasesList = document.getElementById('releases-list');
    const itemCount = document.getElementById('item-count');

    // States
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const emptyState = document.getElementById('empty-state');
    const errorMessage = document.getElementById('error-message');

    // Composer Elements
    const composerPrompt = document.getElementById('composer-prompt');
    const composerForm = document.getElementById('composer-form');
    const selectedType = document.getElementById('selected-type');
    const selectedDate = document.getElementById('selected-date');
    const selectedPreview = document.getElementById('selected-preview');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCurrent = document.getElementById('char-current');
    const progressCircle = document.getElementById('progress-ring-circle');
    const tweetBtn = document.getElementById('tweet-btn');

    // Progress Ring Setup
    const radius = progressCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference;

    function setProgress(percent) {
        const offset = circumference - (percent / 100 * circumference);
        progressCircle.style.strokeDashoffset = offset;
    }

    // Fetch releases from API
    async function fetchReleases() {
        showState('loading');
        spinner.classList.add('fa-spin');
        refreshBtn.disabled = true;

        try {
            const response = await fetch('/api/releases');
            const data = await response.json();
            
            if (data.success) {
                updates = data.updates;
                applyFiltersAndSearch();
            } else {
                throw new Error(data.error || 'Server returned unsuccessful response');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            errorMessage.textContent = `Error: ${error.message || 'Failed to connect to the server.'}`;
            showState('error');
        } finally {
            spinner.classList.remove('fa-spin');
            refreshBtn.disabled = false;
        }
    }

    // Show Loading/Error/List states
    function showState(state) {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        emptyState.classList.add('hidden');
        releasesList.classList.add('hidden');

        if (state === 'loading') {
            loadingState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
        } else if (state === 'empty') {
            emptyState.classList.remove('hidden');
        } else if (state === 'list') {
            releasesList.classList.remove('hidden');
        }
    }

    // Filter & Search Logic
    function applyFiltersAndSearch() {
        filteredUpdates = updates.filter(update => {
            // Category tag filter
            const matchesType = currentFilter === 'all' || 
                update.type.toLowerCase() === currentFilter.toLowerCase();
            
            // Search input filter
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query || 
                update.text.toLowerCase().includes(query) || 
                update.type.toLowerCase().includes(query) || 
                update.date.toLowerCase().includes(query);
                
            return matchesType && matchesSearch;
        });

        itemCount.textContent = filteredUpdates.length;

        if (filteredUpdates.length === 0) {
            showState('empty');
        } else {
            renderReleases();
            showState('list');
        }
    }

    // Render Release Cards
    function renderReleases() {
        releasesList.innerHTML = '';
        filteredUpdates.forEach((update, index) => {
            const card = document.createElement('div');
            card.className = `release-card card ${selectedUpdate && selectedUpdate.text === update.text ? 'selected' : ''}`;
            
            // Get Category Badge Style
            const typeLower = update.type.toLowerCase();
            let typeClass = 'tag-update';
            if (typeLower.includes('feature')) typeClass = 'tag-feature';
            else if (typeLower.includes('deprecated')) typeClass = 'tag-deprecated';
            else if (typeLower.includes('changed')) typeClass = 'tag-changed';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="type-tag ${typeClass}">${update.type}</span>
                        <span class="card-date">${update.date}</span>
                    </div>
                    ${update.link ? `
                        <a href="${update.link}" target="_blank" class="external-link" title="Open official notes" onclick="event.stopPropagation();">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    ` : ''}
                </div>
                <div class="card-content">
                    ${update.html}
                </div>
            `;

            card.addEventListener('click', () => selectCard(update, card));
            releasesList.appendChild(card);
        });
    }

    // Select Card & Open Composer
    function selectCard(update, cardElement) {
        // Deselect previous
        document.querySelectorAll('.release-card').forEach(c => c.classList.remove('selected'));
        
        // Select new
        selectedUpdate = update;
        cardElement.classList.add('selected');

        // Show composer
        composerPrompt.classList.add('hidden');
        composerForm.classList.remove('hidden');

        // Populate composer metadata
        selectedType.textContent = update.type;
        selectedType.className = `type-tag ${
            update.type.toLowerCase().includes('feature') ? 'tag-feature' :
            update.type.toLowerCase().includes('deprecated') ? 'tag-deprecated' :
            update.type.toLowerCase().includes('changed') ? 'tag-changed' : 'tag-update'
        }`;
        selectedDate.textContent = update.date;
        selectedPreview.textContent = update.text;

        // Draft Tweet text
        // X counts all URLs as 23 characters. Let's calculate proper limits.
        const dateStr = update.date;
        const prefix = `BigQuery [${update.type}] (${dateStr}): `;
        const link = update.link;
        
        // Max characters for main text = 280 - (link length/X count 23) - space (1) - prefix
        // We will show the link explicitly at the end of the text.
        const urlXLength = 23;
        const availableTextSpace = 280 - urlXLength - 1 - prefix.length;
        
        let draftText = update.text;
        if (draftText.length > availableTextSpace) {
            draftText = draftText.substring(0, availableTextSpace - 3) + '...';
        }
        
        tweetTextarea.value = `${prefix}${draftText} ${link}`;
        updateCharCount();
    }

    // Update Character Count
    function updateCharCount() {
        const text = tweetTextarea.value;
        
        // Calculate X-compatible length (counting URLs as 23 characters)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let xLength = text.length;
        const urls = text.match(urlRegex) || [];
        
        urls.forEach(url => {
            xLength = xLength - url.length + 23;
        });

        charCurrent.textContent = xLength;

        // Visual progress feedback
        const percentage = Math.min((xLength / 280) * 100, 100);
        setProgress(percentage);

        // Styling based on length
        if (xLength > 280) {
            charCurrent.style.color = 'var(--accent-red)';
            progressCircle.style.stroke = 'var(--accent-red)';
            tweetBtn.disabled = true;
        } else if (xLength > 260) {
            charCurrent.style.color = 'var(--accent-yellow)';
            progressCircle.style.stroke = 'var(--accent-yellow)';
            tweetBtn.disabled = false;
        } else {
            charCurrent.style.color = 'var(--text-secondary)';
            progressCircle.style.stroke = 'var(--accent-cyan)';
            tweetBtn.disabled = false;
        }
    }

    // Handle Tweet button click
    tweetBtn.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400');
    });

    // Event listeners for Filters
    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.dataset.type;
            applyFiltersAndSearch();
        });
    });

    // Event listener for Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        applyFiltersAndSearch();
    });

    // Event listener for Refresh
    refreshBtn.addEventListener('click', fetchReleases);
    retryBtn.addEventListener('click', fetchReleases);
    tweetTextarea.addEventListener('input', updateCharCount);

    // Initial Load
    fetchReleases();
});
