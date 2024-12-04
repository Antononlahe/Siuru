let songs = [];

async function loadSongs() {
    try {
        const response = await fetch('songs.yaml');
        const yamlText = await response.text();
        songs = jsyaml.load(yamlText);
        songs.sort((a, b) => (a?.title || '\uffff').localeCompare(b?.title || '\uffff'));        displaySongs(songs);
        handleUrlParams();
    } catch (error) {
        console.error('Error loading songs:', error);
    }
}

function getFirstFourWords(text) {
    return text.split(/\s+/).slice(0, 4).join(' ');
}

function displaySongs(songsToDisplay) {
    const songList = document.getElementById('songs');
    songList.innerHTML = '';
    songsToDisplay.forEach(song => {
        const li = document.createElement('li');
        
        const title = document.createElement('span');
        title.textContent = song.title;
        title.className = 'title';
        li.appendChild(title);
        

        const artists = document.createElement('span');
        artists.className = 'artists';
        
        // Handle both single artist (string) and multiple artists (array) cases
        const artistList = Array.isArray(song.artist) ? song.artist : [song.artist];
        
        artistList.forEach((artist, index) => {
            const artistSpan = document.createElement('span');
            artistSpan.textContent = artist;
            artistSpan.className = 'artist';
            artistSpan.onclick = (e) => {
                e.stopPropagation();
                searchByArtist(artist);
            };
            artists.appendChild(artistSpan);
            if (index < artistList.length - 1) {
                artists.appendChild(document.createTextNode(', '));
            }
        });
        li.appendChild(artists);

        
        const preview = document.createElement('div');
        preview.textContent = getFirstFourWords(song.lyrics) + '...';
        preview.className = 'preview';
        li.appendChild(preview);
        
        li.onclick = () => displayLyrics(song);
        songList.appendChild(li);
    });
    console.log('Displayed songs:', songsToDisplay.length);
}

function displayLyrics(song) {
    if (window.innerWidth < 768) {
        document.getElementById('song-list').style.display = 'none';
        document.getElementById('lyrics-display').style.display = 'block';
        document.getElementById('back-button').style.display = 'block';
    }
    document.getElementById('song-title').textContent = song.title;
    const artistElement = document.getElementById('song-artist');
    artistElement.innerHTML = '';
    
    // Handle both single artist (string) and multiple artists (array) cases
    const artistList = Array.isArray(song.artist) ? song.artist : [song.artist];
    
    artistList.forEach((artist, index) => {
        const artistSpan = document.createElement('span');
        artistSpan.textContent = artist;
        artistSpan.onclick = () => searchByArtist(artist);
        artistElement.appendChild(artistSpan);
        if (index < artistList.length - 1) {
            artistElement.appendChild(document.createTextNode(', '));
        }
    });
    document.getElementById('song-lyrics').textContent = song.lyrics;

    // Update URL with song title
    const url = new URL(window.location);
    url.searchParams.set('song', encodeURIComponent(song.title));
    window.history.pushState({}, '', url);
}

function searchByArtist(artist) {
    document.getElementById('search-bar').value = `a:${artist}`;
    performSearch();
    if (window.innerWidth < 768) {
        document.getElementById('lyrics-display').style.display = 'none';
        document.getElementById('song-list').style.display = 'block';
        document.getElementById('back-button').style.display = 'none';
    }
}

document.getElementById('back-button').onclick = () => {
    if (window.innerWidth < 768) {
        document.getElementById('lyrics-display').style.display = 'none';
        document.getElementById('song-list').style.display = 'block';
        document.getElementById('back-button').style.display = 'none';
    }
    // Remove song parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('song');
    window.history.pushState({}, '', url);
};

function performSearch() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const searchLyrics = document.querySelector('.checkbox-container input').checked;
    
    let filteredSongs;
    if (searchTerm.startsWith('a:')) {
        const artistSearchTerm = searchTerm.slice(2).trim();
        filteredSongs = songs.filter(song => {
            const artistList = Array.isArray(song.artist) ? song.artist : [song.artist];
            return artistList.some(artist => artist && artist.toLowerCase().includes(artistSearchTerm));
        });
    } else {
        filteredSongs = songs.filter(song => {
            const artistList = Array.isArray(song.artist) ? song.artist : [song.artist];
            const titleMatch = song.title && song.title.toLowerCase().includes(searchTerm);
            const artistMatch = artistList.some(artist => artist && artist.toLowerCase().includes(searchTerm));
            const lyricsMatch = searchLyrics && song.lyrics && song.lyrics.toLowerCase().includes(searchTerm);
            return titleMatch || artistMatch || lyricsMatch;
        });
    }

    console.log('Search term:', searchTerm, 'Results:', filteredSongs.length);
    displaySongs(filteredSongs);

    const url = new URL(window.location.href);
    url.searchParams.set('search', encodeURIComponent(searchTerm));
    window.history.pushState({}, '', url);
}

document.getElementById('search-bar').oninput = performSearch;
document.querySelector('.checkbox-container input').onchange = performSearch;

document.getElementById('clear-search').onclick = () => {
    document.getElementById('search-bar').value = '';
    performSearch();
    // Remove search parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('search');
    window.history.pushState({}, '', url);
};

function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const songParam = urlParams.get('song');
    const searchParam = urlParams.get('search');

    if (songParam) {
        const decodedSongTitle = decodeURIComponent(songParam);
        const song = songs.find(s => s.title.toLowerCase() === decodedSongTitle.toLowerCase());
        if (song) {
            displayLyrics(song);
        }
    } else if (searchParam) {
        const decodedSearchTerm = decodeURIComponent(searchParam);
        document.getElementById('search-bar').value = decodedSearchTerm;
        performSearch();
    }
}

function initializeModeToggle() {
    const modeToggle = document.getElementById('mode-toggle');
    const body = document.body;
    const modeIcon = modeToggle.querySelector('.mode-icon');

    // Check if there's a saved mode preference
    const savedMode = localStorage.getItem('mode');
    if (savedMode === 'light') {
        body.classList.add('light-mode');
        updateModeIcon(true);
    }
  
    modeToggle.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        const isLightMode = body.classList.contains('light-mode');
        updateModeIcon(isLightMode);
        
        // Save the mode preference
        localStorage.setItem('mode', isLightMode ? 'light' : 'dark');
    });
}

function updateModeIcon(isLightMode) {
    const modeIcon = document.querySelector('.mode-icon');
    
    if (isLightMode) {
        modeIcon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
    } else {
        modeIcon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
    }
}

loadSongs();
initializeModeToggle();

// Add this event listener to handle window resizing
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        document.getElementById('song-list').style.display = 'block';
        document.getElementById('lyrics-display').style.display = 'block';
        document.getElementById('back-button').style.display = 'none';
    } else {
        if (document.getElementById('lyrics-display').style.display === 'block') {
            document.getElementById('song-list').style.display = 'none';
            document.getElementById('back-button').style.display = 'block';
        } else {
            document.getElementById('lyrics-display').style.display = 'none';
            document.getElementById('song-list').style.display = 'block';
            document.getElementById('back-button').style.display = 'none';
        }
    }
});

// Initialize back button visibility
document.getElementById('back-button').style.display = 'none';

// Add event listener for popstate to handle browser back/forward navigation
window.addEventListener('popstate', handleUrlParams);
