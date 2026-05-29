let songs = [];
let currentPlayingSong = null;

// Accent-insensitive folding so e.g. "ohtu" matches "\u00f5htu". The map is
// length-preserving (one char in, one char out), which lets us reuse the
// folded indices to highlight matches in the original (accented) text.
const FOLD_MAP = { '\u00f5': 'o', '\u00e4': 'a', '\u00f6': 'o', '\u00fc': 'u', '\u0161': 's', '\u017e': 'z' };
function fold(str) {
    return (str || '').toLowerCase().replace(/[\u00f5\u00e4\u00f6\u00fc\u0161\u017e]/g, c => FOLD_MAP[c]);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Wrap the part of `title` that matches `foldedTerm` in <mark>. Returns HTML.
function highlightTitle(title, foldedTerm) {
    if (!foldedTerm) return escapeHtml(title);
    const idx = fold(title).indexOf(foldedTerm);
    if (idx === -1) return escapeHtml(title);
    const before = escapeHtml(title.slice(0, idx));
    const match = escapeHtml(title.slice(idx, idx + foldedTerm.length));
    const after = escapeHtml(title.slice(idx + foldedTerm.length));
    return `${before}<mark>${match}</mark>${after}`;
}

async function loadSongs() {
    try {
        const response = await fetch('songs.yaml');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const yamlText = await response.text();
        songs = jsyaml.load(yamlText);
        songs.sort((a, b) => (a?.title || '\uffff').localeCompare(b?.title || '\uffff'));
        displaySongs(songs);
        handleUrlParams();
    } catch (error) {
        console.error('Error loading songs:', error);
        const songList = document.getElementById('songs');
        songList.innerHTML =
            '<li class="load-error">Laulude laadimine eba\u00f5nnestus. Kontrolli interneti\u00fchendust ja proovi uuesti.</li>';
    }
}

function getFirstFourWords(text) {
    return text.split(/\s+/).slice(0, 4).join(' ');
}

// Show the result count only while a search is active.
function updateResultCount(count) {
    const el = document.getElementById('result-count');
    if (!el) return;
    const term = document.getElementById('search-bar').value.trim();
    if (!term) {
        el.style.display = 'none';
        return;
    }
    el.style.display = 'block';
    el.textContent = count === 1 ? '1 tulemus' : `${count} tulemust`;
}

function displaySongs(songsToDisplay) {
    const songList = document.getElementById('songs');

    // Highlight whatever the user is currently searching for (artist-only
    // `a:` searches don't match titles, so skip highlighting in that case).
    const rawTerm = document.getElementById('search-bar').value.trim();
    const highlightTerm = rawTerm.startsWith('a:') ? '' : fold(rawTerm);

    const fragment = document.createDocumentFragment();
    songsToDisplay.forEach(song => {
        const li = document.createElement('li');

        const title = document.createElement('span');
        title.innerHTML = highlightTitle(song.title, highlightTerm);

        ////////////////////////////////
        if (song.path) {
            title.append(' 🎵'); // Append the musical note emoji
        }
        ////////////////////////////////

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

        if (currentPlayingSong && song.title === currentPlayingSong.song.title) {
            li.classList.add('selected');
        }
        
        li.onclick = () => displayLyrics(song);
        fragment.appendChild(li);
    });
    songList.replaceChildren(fragment);
    updateResultCount(songsToDisplay.length);
    console.log('Displayed songs:', songsToDisplay.length);
}

let lastScrollPosition = 0;

async function displayLyrics(song) {
    if (window.innerWidth < 768) {
        lastScrollPosition = window.scrollY;
        if (document.startViewTransition) {
            await document.startViewTransition(async () => {
                document.body.classList.add('lyrics-view');
                document.getElementById('song-list').style.display = 'none';
                document.getElementById('lyrics-display').style.display = 'block';
                document.getElementById('back-button').style.display = 'block';
                document.getElementById('search-input-container').classList.add('hide-search');
                updateLyricsContent(song);
                window.scrollTo({ top: 0 });
            }).finished;
        } else {
            document.body.classList.add('lyrics-view');
            document.getElementById('song-list').style.display = 'none';
            document.getElementById('lyrics-display').style.display = 'block';
            document.getElementById('back-button').style.display = 'block';
            document.getElementById('search-input-container').classList.add('hide-search');
            updateLyricsContent(song);
            window.scrollTo({ top: 0 });
        }
    } else {
        updateLyricsContent(song);
        // Scroll to the selected song in desktop mode
        setTimeout(() => {
            const selectedItem = document.querySelector('#songs li.selected');
            if (selectedItem) {
                selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 0);
    }

    // Update URL with song title
    const url = new URL(window.location);
    url.searchParams.set('song', encodeURIComponent(song.title));
    window.history.pushState({}, '', url);
    
    if (currentPlayingSong && currentPlayingSong !== song) {
        currentPlayingSong.audioPlayer.pause(); 
      }
    currentPlayingSong = { 
        song: song, 
        audioPlayer: document.getElementById('song-audio') 
    };
    displaySongs(songs); 
    setupAudioPlayer(song);
}

// Audio player functionality
function setupAudioPlayer(song) {
    const playButton = document.getElementById('play-audio-btn');
    const audioPlayer = document.getElementById('song-audio');
    
    console.log('Setting up audio player for song:', song.title);
    console.log('Audio path:', song.path);

    // Hide play button if no path is specified
    if (!song.path) {
        console.log('No audio path specified for this song');
        playButton.style.display = 'none';
        audioPlayer.style.display = 'none';
        return;
    }

    playButton.style.display = 'block';
    audioPlayer.style.display = 'none';

    playButton.onclick = () => {
        console.log('Play button clicked');
        try {
            // Make sure the path is properly formatted for web URLs
            const audioPath = song.path.replace(/\\/g, '/');
            console.log('Attempting to play audio from:', audioPath);
            
            audioPlayer.src = audioPath;
            audioPlayer.style.display = 'block';

            // Assign as properties (not addEventListener) so repeated plays
            // overwrite the handlers instead of stacking duplicates.
            audioPlayer.onloadstart = () => console.log('Audio loading started');
            audioPlayer.onloadeddata = () => console.log('Audio data loaded');
            audioPlayer.onerror = () => {
                console.error('Audio error:', audioPlayer.error);
                alert(`Audio error: ${audioPlayer.error.message}`);
            };

            audioPlayer.play().then(() => {
                console.log('Audio playing successfully');
            }).catch(error => {
                console.error('Error playing audio:', error);
                alert(`Could not play audio file: ${error.message}`);
            });
        } catch (error) {
            console.error('Error setting audio source:', error);
            alert(`Could not load audio file: ${error.message}`);
        }
    };
}

function updateLyricsContent(song) {
    document.getElementById('song-title').textContent = song.title;
    const artistElement = document.getElementById('song-artist');
    artistElement.innerHTML = '';
    
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
}

async function searchByArtist(artist) {
    document.getElementById('search-bar').value = `a:${artist}`;
    performSearch();

    if (window.innerWidth < 768) {
        if (document.startViewTransition) {
            await document.startViewTransition(async () => {
                document.body.classList.remove('lyrics-view');
                document.getElementById('lyrics-display').style.display = 'none';
                document.getElementById('song-list').style.display = 'block';
                document.getElementById('back-button').style.display = 'none';
                document.getElementById('search-input-container').classList.remove('hide-search');
            }).finished;
        } else {
            document.body.classList.remove('lyrics-view');
            document.getElementById('lyrics-display').style.display = 'none';
            document.getElementById('song-list').style.display = 'block';
            document.getElementById('back-button').style.display = 'none';
            document.getElementById('search-input-container').classList.remove('hide-search');
        }
    }
}

document.getElementById('back-button').onclick = () => {
    if (window.innerWidth < 768) {
        document.body.classList.remove('lyrics-view');
        document.getElementById('lyrics-display').style.display = 'none';
        document.getElementById('song-list').style.display = 'block';
        document.getElementById('back-button').style.display = 'none';
        document.getElementById('search-input-container').classList.remove('hide-search');

        // Restore search results if there's a search term
        performSearch();

        // Restore the saved scroll position
        setTimeout(() => {
            window.scrollTo({
                top: lastScrollPosition,
                behavior: 'smooth'
            });
        }, 0);
    }
    // Remove song parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('song');
    window.history.pushState({}, '', url);

    if (currentPlayingSong) {
        currentPlayingSong.audioPlayer.pause();
        currentPlayingSong = null;
    }
};

window.addEventListener('popstate', function(event) {
    if (window.innerWidth < 768) {
        if (document.getElementById('lyrics-display').style.display === 'block' || 
            document.body.classList.contains('lyrics-view')) {
            document.body.classList.remove('lyrics-view');
            document.getElementById('lyrics-display').style.display = 'none';
            document.getElementById('song-list').style.display = 'block';
            document.getElementById('back-button').style.display = 'none';
            document.getElementById('search-input-container').classList.remove('hide-search');
            
            setTimeout(() => {
                window.scrollTo({
                    top: lastScrollPosition,
                    behavior: 'smooth'
                });
            }, 0);
            
            if (currentPlayingSong) {
                currentPlayingSong.audioPlayer.pause();
                currentPlayingSong = null;
            }
        } else {
            window.scrollTo({
                top: lastScrollPosition,
                behavior: 'smooth'
            });
        }
    }
    
    handleUrlParams();
});

function performSearch() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const searchLyrics = document.getElementById('search-lyrics').checked;

    let filteredSongs;
    if (searchTerm.startsWith('a:')) {
        const artistSearchTerm = fold(searchTerm.slice(2).trim());
        filteredSongs = songs.filter(song => {
            const artistList = Array.isArray(song.artist) ? song.artist : [song.artist];
            return artistList.some(artist => artist && fold(artist).includes(artistSearchTerm));
        });
    } else {
        const foldedTerm = fold(searchTerm);
        filteredSongs = songs.filter(song => {
            const artistList = Array.isArray(song.artist) ? song.artist : [song.artist];
            const titleMatch = song.title && fold(song.title).includes(foldedTerm);
            const artistMatch = artistList.some(artist => artist && fold(artist).includes(foldedTerm));
            const lyricsMatch = searchLyrics && song.lyrics && fold(song.lyrics).includes(foldedTerm);
            return titleMatch || artistMatch || lyricsMatch;
        });
    }

    console.log('Search term:', searchTerm, 'Results:', filteredSongs.length);
    displaySongs(filteredSongs);

    // replaceState (not pushState) so typing doesn't flood the history stack
    // with one entry per keystroke.
    const url = new URL(window.location.href);
    url.searchParams.set('search', encodeURIComponent(searchTerm));
    window.history.replaceState({}, '', url);
}

document.getElementById('search-bar').oninput = performSearch;
document.getElementById('search-lyrics').onchange = performSearch;

document.getElementById('clear-search').onclick = () => {
    document.getElementById('search-bar').value = '';
    performSearch();
    // Remove search parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('search');
    window.history.replaceState({}, '', url);
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

// Lyrics font size: persisted in localStorage, applied to the <pre>. Useful
// when singing off a phone held at arm's length.
const MIN_FONT = 0.7, MAX_FONT = 2.0, FONT_STEP = 0.15, DEFAULT_FONT = 0.9;

function applyLyricsFontSize(size) {
    const clamped = Math.min(MAX_FONT, Math.max(MIN_FONT, size));
    document.getElementById('song-lyrics').style.fontSize = `${clamped}rem`;
    localStorage.setItem('lyricsFontSize', clamped);
    return clamped;
}

function initializeFontSize() {
    let size = parseFloat(localStorage.getItem('lyricsFontSize')) || DEFAULT_FONT;
    applyLyricsFontSize(size);
    document.getElementById('font-decrease').onclick = () => {
        size = applyLyricsFontSize(size - FONT_STEP);
    };
    document.getElementById('font-increase').onclick = () => {
        size = applyLyricsFontSize(size + FONT_STEP);
    };
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err =>
                console.error('Service worker registration failed:', err));
        });
    }
}

loadSongs();
initializeModeToggle();
initializeFontSize();
registerServiceWorker();

// Add this event listener to handle window resizing
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        document.getElementById('song-list').style.display = 'block';
        document.getElementById('lyrics-display').style.display = 'block';
        document.getElementById('back-button').style.display = 'none';
        document.getElementById('search-input-container').classList.remove('hide-search');
    } else {
        if (document.getElementById('lyrics-display').style.display === 'block') {
            document.getElementById('song-list').style.display = 'none';
            document.getElementById('back-button').style.display = 'block';
            document.getElementById('search-input-container').classList.add('hide-search');
        } else {
            document.getElementById('lyrics-display').style.display = 'none';
            document.getElementById('song-list').style.display = 'block';
            document.getElementById('back-button').style.display = 'none';
            document.getElementById('search-input-container').classList.remove('hide-search');
        }
    }
});

// Initialize back button visibility
document.getElementById('back-button').style.display = 'none';
