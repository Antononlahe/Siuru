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
    }

    // Update URL with song title
    const url = new URL(window.location);
    url.searchParams.set('song', encodeURIComponent(song.title));
    window.history.pushState({}, '', url);
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
            
            // Add event listeners for better debugging
            audioPlayer.addEventListener('loadstart', () => console.log('Audio loading started'));
            audioPlayer.addEventListener('loadeddata', () => console.log('Audio data loaded'));
            audioPlayer.addEventListener('error', (e) => {
                console.error('Audio error:', audioPlayer.error);
                alert(`Audio error: ${audioPlayer.error.message}`);
            });

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
                document.getElementById('lyrics-display').style.display = 'none';
                document.getElementById('song-list').style.display = 'block';
                document.getElementById('back-button').style.display = 'none';
            }).finished;
        } else {
            document.getElementById('lyrics-display').style.display = 'none';
            document.getElementById('song-list').style.display = 'block';
            document.getElementById('back-button').style.display = 'none';
        }
    }
}

document.getElementById('back-button').onclick = () => {
    if (window.innerWidth < 768) {
        document.body.classList.remove('lyrics-view'); // Add this line
        document.getElementById('lyrics-display').style.display = 'none';
        document.getElementById('song-list').style.display = 'block';
        document.getElementById('back-button').style.display = 'none';
        document.getElementById('search-input-container').classList.remove('hide-search');

        // Restore the saved scroll position
        setTimeout(() => {
            window.scrollTo({
                top: lastScrollPosition,
                behavior: 'smooth'
            });
        }, 0); // Use setTimeout to ensure the DOM has updated before scrolling
    }
    // Remove song parameter from URL
    const url = new URL(window.location);
    url.searchParams.delete('song');
    window.history.pushState({}, '', url);
};

window.addEventListener('popstate', function(event) {
    if (window.innerWidth < 768 && !document.getElementById('lyrics-display').style.display) {
        // Assuming you want to restore scroll only when not in lyrics view
        document.body.classList.remove('lyrics-view');
        window.scrollTo({
            top: lastScrollPosition,
            behavior: 'smooth'
        });
    }
    handleUrlParams(); // This will handle the URL parameters as before
});

function performSearch() {
    const searchTerm = document.getElementById('search-bar').value.toLowerCase();
    const searchLyrics = document.getElementById('search-lyrics').checked;

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
document.getElementById('search-lyrics').onchange = performSearch;

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

// Add event listener for popstate to handle browser back/forward navigation
window.addEventListener('popstate', handleUrlParams);
