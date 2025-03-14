let searchCount = 5;
let spotifyPlayer = null;
let isPlaying = false;
let currentTrack = null;

// Add this at the top of your file, before any other code
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK Ready');
};

document.addEventListener('DOMContentLoaded', () => {
    // Get all required elements
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('songSearch');
    const subscribeButton = document.getElementById('subscribeButton');
    const searchCountDisplay = document.getElementById('searchCount');
    const spotifyLogo = document.querySelector('.spotify-corner img');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeBtn = document.getElementById('volumeBtn');
    const previousTrack = document.getElementById('previousTrack');
    const nextTrack = document.getElementById('nextTrack');
    
    // Verify all required elements exist
    if (!searchButton || !searchInput || !subscribeButton || !searchCountDisplay || !spotifyLogo) {
        console.error('Required elements not found. Please check your HTML structure.');
        return;
    }

    // Optional elements for player controls
    const playIcon = playPauseBtn?.querySelector('.play-icon');
    const pauseIcon = playPauseBtn?.querySelector('.pause-icon');

    // Check if we're returning from Spotify auth
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    
    if (code) {
        handleSpotifyCallback(code);
    }

    // Add autocomplete dropdown
    const autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.className = 'autocomplete-dropdown';
    searchInput.parentNode.appendChild(autocompleteDropdown);

    // Add input event listener for search suggestions
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            autocompleteDropdown.style.display = 'none';
            return;
        }

        try {
            const suggestions = await getMockSongSuggestions(query);
            displaySuggestions(suggestions, autocompleteDropdown, searchInput);
        } catch (error) {
            console.error('Error getting suggestions:', error);
        }
    });

    searchButton.addEventListener('click', async () => {
        const searchInputValue = document.getElementById('songSearch').value;
        console.log('Search clicked for:', searchInputValue);
        
        if (searchCount <= 0) {
            alert('You have used all your free searches. Please subscribe to continue!');
            return;
        }

        if (searchInputValue.trim() === '') {
            alert('Please enter a song to search');
            return;
        }

        // Check for access token
        const accessToken = localStorage.getItem('spotify_access_token');
        if (!accessToken) {
            console.log('No access token found, initiating Spotify connection...');
            alert('Please connect to Spotify to search for songs');
            connectToSpotify();
            return;
        }

        // Log token status
        console.log('Using access token:', accessToken.substring(0, 10) + '...');

        try {
            // First, verify the token is still valid
            console.log('Verifying token validity...');
            const isValid = await verifyTokenValidity();
            if (!isValid) {
                console.log('Token invalid, initiating reconnection...');
                alert('Please connect to Spotify to search for songs');
                connectToSpotify();
                return;
            }

            console.log('Token verified, proceeding with search...');

            // First, search for the track
            const searchResponse = await fetch('https://api.spotify.com/v1/search?' + new URLSearchParams({
                q: searchInputValue,
                type: 'track',
                limit: 1
            }), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!searchResponse.ok) {
                console.error('Search request failed:', searchResponse.status);
                throw new Error(`Search request failed: ${searchResponse.status}`);
            }

            const searchData = await searchResponse.json();
            console.log('Search results:', searchData);

            if (searchData.tracks && searchData.tracks.items.length > 0) {
                const track = searchData.tracks.items[0];
                console.log('Found track:', track.name);

                // Play the track
                await playSong(track.uri);

                // Get track features
                const features = await getTrackFeatures(track.id);
                console.log('Track features:', features);

                if (features) {
                    // Get recommendations
                    const recommendations = await getRecommendations(track.id, features);
                    console.log('Got recommendations:', recommendations);

                    if (recommendations) {
                        // Update recommendation cards
                        await updateRecommendationCards(recommendations);

                        // Decrease search count
                        searchCount--;
                        searchCountDisplay.textContent = searchCount;
                    }
                }
            } else {
                alert('No tracks found for your search');
            }
        } catch (error) {
            console.error('Error during search:', error);
            
            // Check specific error conditions
            if (error.message.includes('401')) {
                console.log('Authentication error, attempting to refresh token...');
                try {
                    await refreshAccessToken();
                    alert('Please try your search again');
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    alert('Please connect to Spotify again');
                    connectToSpotify();
                }
            } else if (error.message.includes('No access token available') || error.message.includes('Session expired')) {
                alert('Please connect to Spotify to continue');
                connectToSpotify();
            } else {
                alert(`Error: ${error.message}. Please try again.`);
            }
        }
    });

    subscribeButton.addEventListener('click', () => {
        // Redirect to subscription page
        window.location.href = 'subscription.html';
    });

    // Add click event to Spotify logo
    spotifyLogo.addEventListener('click', connectToSpotify);

    // Only add player control event listeners if elements exist
    if (volumeSlider) {
        volumeSlider.addEventListener('input', async () => {
            const volume = volumeSlider.value / 100;
            await setVolume(volume);
        });
    }

    if (volumeBtn) {
        volumeBtn.addEventListener('click', toggleMute);
    }

    if (previousTrack) {
        previousTrack.addEventListener('click', playPreviousTrack);
    }

    if (nextTrack) {
        nextTrack.addEventListener('click', playNextTrack);
    }

    if (playPauseBtn) {
        console.log('Play/Pause button found, adding click listener');
        playPauseBtn.addEventListener('click', () => {
            console.log('Play/Pause button clicked');
            togglePlayPause();
        });
        playPauseBtn.disabled = true; // Disable until connected to Spotify
    } else {
        console.error('Play/Pause button not found in the DOM');
    }
});

async function connectToSpotify() {
    // Clear any existing tokens
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);

    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: SPOTIFY_CLIENT_ID,
        scope: SPOTIFY_SCOPES,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        state: state,
        show_dialog: true // Force showing the auth dialog
    }).toString()}`;

    window.location = authUrl;
}

async function handleSpotifyCallback(code) {
    try {
        console.log('Handling Spotify callback with code:', code);
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: SPOTIFY_REDIRECT_URI,
                client_id: SPOTIFY_CLIENT_ID,
                client_secret: SPOTIFY_CLIENT_SECRET
            })
        });

        if (!response.ok) {
            throw new Error(`Token request failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received token data:', data);

        if (data.access_token) {
            localStorage.setItem('spotify_access_token', data.access_token);
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
            
            // Update UI to show connected state
            updateSpotifyConnectionState(true);
            
            // Remove the code from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Verify the token works
            try {
                const testResponse = await fetch('https://api.spotify.com/v1/me', {
                    headers: {
                        'Authorization': `Bearer ${data.access_token}`
                    }
                });
                if (testResponse.ok) {
                    console.log('Successfully connected to Spotify');
                } else {
                    throw new Error('Token verification failed');
                }
            } catch (error) {
                console.error('Token verification failed:', error);
                throw new Error('Failed to verify Spotify connection');
            }
        } else {
            throw new Error('No access token received');
        }
    } catch (error) {
        console.error('Error connecting to Spotify:', error);
        alert('Failed to connect to Spotify. Please try again.');
        updateSpotifyConnectionState(false);
    }
}

async function getMockSongSuggestions(query) {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        return []; // Return empty if not connected to Spotify
    }

    try {
        // Search for tracks
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const data = await response.json();
        
        // For each track, get its audio features
        const tracksWithFeatures = await Promise.all(data.tracks.items.map(async track => {
            const features = await getTrackFeatures(track.id);
            return {
                title: track.name,
                artist: track.artists[0].name,
                bpm: features && features.tempo ? Math.round(features.tempo) : null,
                uri: track.uri,
                preview_url: track.preview_url,
                features: features
            };
        }));

        return tracksWithFeatures;
    } catch (error) {
        console.error('Error searching Spotify:', error);
        return []; // Return empty on error
    }
}

function displaySuggestions(suggestions, dropdown, input) {
    dropdown.innerHTML = '';
    
    if (suggestions.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    suggestions.forEach(song => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        
        // Create play button if preview URL exists
        const playButton = song.preview_url ? 
            `<button class="play-sample-btn" onclick="event.stopPropagation(); playSampleFromUrl('${song.preview_url}')">▶</button>` : 
            '';

        div.innerHTML = `
            <div>
                <strong>${song.title}</strong> by ${song.artist}
            </div>
            ${playButton}
        `;
        
        div.addEventListener('click', () => {
            input.value = `${song.title} - ${song.artist}`;
            dropdown.style.display = 'none';
        });

        dropdown.appendChild(div);
    });

    dropdown.style.display = 'block';
}

function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(length)))
        .map(x => possible[x % possible.length])
        .join('');
}

function updateSpotifyConnectionState(isConnected) {
    const spotifyLogo = document.querySelector('.spotify-corner img');
    if (!spotifyLogo) {
        console.error('Spotify logo element not found');
        return;
    }

    if (isConnected) {
        spotifyLogo.style.filter = 'brightness(0) saturate(100%) invert(56%) sepia(98%) saturate(1116%) hue-rotate(121deg) brightness(97%) contrast(88%)';
        spotifyLogo.style.opacity = '1';
    } else {
        spotifyLogo.style.filter = 'brightness(0) invert(1)';
        spotifyLogo.style.opacity = '0.7';
    }
}

// Update the initializeSpotifyPlayer function
function initializeSpotifyPlayer(token) {
    if (!window.Spotify) {
        console.error('Spotify Web Playback SDK not loaded');
        return;
    }

    const player = new window.Spotify.Player({
        name: 'DJ Mix Assistant',
        getOAuthToken: cb => { cb(token); },
        volume: 0.5
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => {
        console.error('Failed to initialize', message);
    });
    player.addListener('authentication_error', ({ message }) => {
        console.error('Failed to authenticate', message);
    });
    player.addListener('account_error', ({ message }) => {
        console.error('Failed to validate Spotify account', message);
    });
    player.addListener('playback_error', ({ message }) => {
        console.error('Failed to perform playback', message);
    });

    // Playback status updates
    player.addListener('player_state_changed', state => {
        if (state) {
            isPlaying = !state.paused;
            currentTrack = state.track_window.current_track;
            updatePlaybackUI();
        }
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        localStorage.setItem('spotify_device_id', device_id);
        
        // Enable play button
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) {
            playPauseBtn.disabled = false;
        }
    });

    // Connect to the player
    player.connect().then(success => {
        if (success) {
            console.log('Successfully connected to Spotify!');
        }
    });

    spotifyPlayer = player;
}

// Add these new functions
async function togglePlayPause() {
    console.log('togglePlayPause function called');
    
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        console.log('No access token found');
        alert('Please connect to Spotify first');
        return;
    }

    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');
    
    console.log('Play icon found:', !!playIcon);
    console.log('Pause icon found:', !!pauseIcon);

    try {
        console.log('Fetching current playback state...');
        // Get the current playback state
        const stateResponse = await fetch('https://api.spotify.com/v1/me/player', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        console.log('Playback state response status:', stateResponse.status);

        // If no active playback or error getting state
        if (stateResponse.status === 204) {
            console.log('No active playback found');
            // Try to activate a device
            const deviceResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            const deviceData = await deviceResponse.json();
            console.log('Available devices:', deviceData);
            
            if (deviceData.devices && deviceData.devices.length > 0) {
                const device = deviceData.devices[0];
                console.log('Attempting to activate device:', device.id);
                await fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        device_ids: [device.id]
                    })
                });
            } else {
                console.log('No available devices found');
                const confirmOpen = confirm('No active Spotify devices found. Would you like to open Spotify Web Player?');
                if (confirmOpen) {
                    window.open('https://open.spotify.com', '_blank');
                }
            }
            return;
        }

        if (!stateResponse.ok) {
            console.error('Error getting playback state:', stateResponse.status);
            return;
        }

        const stateData = await stateResponse.json();
        console.log('Current playback state:', stateData);

        if (stateData.is_playing) {
            console.log('Currently playing, attempting to pause');
            const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            console.log('Pause response status:', response.status);

            if (response.status === 204) {
                console.log('Successfully paused playback');
                if (playIcon && pauseIcon) {
                    playIcon.style.display = 'inline';
                    pauseIcon.style.display = 'none';
                }
                isPlaying = false;
            } else {
                console.error('Failed to pause playback:', response.status);
            }
        } else {
            console.log('Currently paused, attempting to resume');
            const response = await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            console.log('Play response status:', response.status);

            if (response.status === 204) {
                console.log('Successfully resumed playback');
                if (playIcon && pauseIcon) {
                    playIcon.style.display = 'none';
                    pauseIcon.style.display = 'inline';
                }
                isPlaying = true;
            } else {
                console.error('Failed to resume playback:', response.status);
            }
        }
    } catch (error) {
        console.error('Error in togglePlayPause:', error);
        const errorMessage = error.message.includes('Failed to fetch') ? 
            'Please make sure Spotify is open and try again.' :
            'Error controlling playback. Please try again in a moment.';
        alert(errorMessage);
    }
}

function updatePlaybackUI() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (!playPauseBtn) return;

    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');

    if (playIcon && pauseIcon) {
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        }
    }

    const trackNameElement = document.getElementById('trackName');

    if (currentTrack) {
        if (trackNameElement) {
            // Reset animation
            trackNameElement.style.animation = 'none';
            trackNameElement.offsetHeight; // Trigger reflow
            trackNameElement.style.animation = null;
            trackNameElement.textContent = `${currentTrack.name} - ${currentTrack.artists[0].name}`;
        }
    } else {
        if (trackNameElement) {
            // Reset animation
            trackNameElement.style.animation = 'none';
            trackNameElement.offsetHeight; // Trigger reflow
            trackNameElement.style.animation = null;
            trackNameElement.textContent = 'No track playing';
        }
    }
}

// Update the updateRecommendationCards function
async function updateRecommendationCards(recommendations) {
    const sameBPMCard = document.getElementById('sameBPM');
    const increaseBPMCard = document.getElementById('increaseBPM');
    const decreaseBPMCard = document.getElementById('decreaseBPM');

    if (!sameBPMCard || !increaseBPMCard || !decreaseBPMCard) {
        console.error('One or more recommendation cards not found in the DOM');
        return;
    }

    function createRecommendationHTML(track) {
        if (!track) {
            return '<p>No recommendation found</p>';
        }

        const artistName = track.artists?.[0]?.name || 'Unknown Artist';
        const trackName = track.name || 'Unknown Track';
        
        return `
            <div class="recommendation-card" onclick="searchForTrack('${trackName.replace(/'/g, "\\'")}', '${artistName.replace(/'/g, "\\'")}')" style="cursor: pointer;">
                <div class="recommendation-content">
                    <p class="track-title"><strong>${trackName}</strong></p>
                    <p class="artist-name">${artistName}</p>
                    ${track.features ? `
                        <p class="track-features">
                            Energy: ${Math.round(track.features.energy * 100)}%
                        </p>
                    ` : ''}
                </div>
            </div>
        `;
    }

    try {
        // Update Same Energy card
        if (recommendations.sameEnergy?.[0]) {
            sameBPMCard.innerHTML = createRecommendationHTML(recommendations.sameEnergy[0]);
        } else {
            console.log('No same energy recommendations found');
            sameBPMCard.innerHTML = '<p>Finding similar tracks...</p>';
        }

        // Update Higher Energy card
        if (recommendations.higherEnergy?.[0]) {
            increaseBPMCard.innerHTML = createRecommendationHTML(recommendations.higherEnergy[0]);
        } else {
            console.log('No higher energy recommendations found');
            increaseBPMCard.innerHTML = '<p>Finding energetic tracks...</p>';
        }

        // Update Lower Energy card
        if (recommendations.lowerEnergy?.[0]) {
            decreaseBPMCard.innerHTML = createRecommendationHTML(recommendations.lowerEnergy[0]);
        } else {
            console.log('No lower energy recommendations found');
            decreaseBPMCard.innerHTML = '<p>Finding calmer tracks...</p>';
        }
    } catch (error) {
        console.error('Error updating recommendation cards:', error);
        // More informative error messages
        const errorMessage = '<p>Temporarily unavailable. Please try again.</p>';
        sameBPMCard.innerHTML = errorMessage;
        increaseBPMCard.innerHTML = errorMessage;
        decreaseBPMCard.innerHTML = errorMessage;
    }
}

// Update the getRecommendations function
async function getRecommendations(trackId, features) {
    try {
        console.log('Getting recommendations for track:', trackId);
        console.log('Track features:', features);
        
        const accessToken = localStorage.getItem('spotify_access_token');
        if (!accessToken) {
            throw new Error('No access token available');
        }

        // Get the seed track info
        const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!trackResponse.ok) {
            throw new Error(`Failed to get track: ${trackResponse.status}`);
        }

        const trackData = await trackResponse.json();
        console.log('Seed track data:', trackData);
        const artistId = trackData.artists[0].id;

        // Get recommendations with similar features
        const baseParams = {
            seed_tracks: trackId,
            seed_artists: artistId,
            limit: 50, // Get more tracks to sort through
            market: 'US',
            target_energy: features.energy,
            min_energy: Math.max(0, features.energy - 0.2),
            max_energy: Math.min(1, features.energy + 0.2),
            target_tempo: features.tempo,
            min_tempo: features.tempo - 20,
            max_tempo: features.tempo + 20
        };

        console.log('Requesting recommendations with params:', baseParams);

        // Get recommendations
        const recommendationsResponse = await fetch(`https://api.spotify.com/v1/recommendations?${new URLSearchParams(baseParams)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!recommendationsResponse.ok) {
            throw new Error(`Failed to get recommendations: ${recommendationsResponse.status}`);
        }

        const recommendationsData = await recommendationsResponse.json();
        console.log('Raw recommendations data:', recommendationsData);
        
        let tracks = recommendationsData.tracks.filter(track => track.id !== trackId);
        console.log('Filtered tracks count:', tracks.length);

        if (tracks.length === 0) {
            console.log('No recommendations returned from Spotify API');
            return {
                sameEnergy: [],
                higherEnergy: [],
                lowerEnergy: []
            };
        }

        // Get audio features for all recommended tracks
        const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features?ids=${tracks.map(t => t.id).join(',')}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const featuresData = await featuresResponse.json();
        console.log('Features data for recommended tracks:', featuresData);
        
        const trackFeatures = new Map(featuresData.audio_features.map(f => [f.id, f]));

        // Calculate a similarity score for each track based on multiple features
        tracks = tracks.map(track => {
            const tf = trackFeatures.get(track.id);
            if (!tf) {
                console.log(`No features found for track ${track.id}`);
                return null;
            }

            // Calculate differences in various features
            const tempoDiff = Math.abs(tf.tempo - features.tempo);
            const energyDiff = Math.abs(tf.energy - features.energy);
            const danceabilityDiff = Math.abs(tf.danceability - features.danceability);
            
            // Weighted score (lower is more similar)
            const similarityScore = (tempoDiff / 20) + (energyDiff * 2) + danceabilityDiff;

            return {
                ...track,
                features: tf,
                similarityScore,
                energyDiff: tf.energy - features.energy
            };
        }).filter(Boolean);

        console.log('Processed tracks count:', tracks.length);

        // Sort tracks by similarity score
        const similarTracks = [...tracks].sort((a, b) => a.similarityScore - b.similarityScore);
        
        // Get tracks with higher energy
        const higherEnergyTracks = [...tracks]
            .filter(t => t.features.energy > features.energy)
            .sort((a, b) => a.similarityScore - b.similarityScore);
        
        // Get tracks with lower energy
        const lowerEnergyTracks = [...tracks]
            .filter(t => t.features.energy < features.energy)
            .sort((a, b) => a.similarityScore - b.similarityScore);

        console.log('Recommendation counts:', {
            similar: similarTracks.length,
            higher: higherEnergyTracks.length,
            lower: lowerEnergyTracks.length
        });

        return {
            sameEnergy: similarTracks.slice(0, 1),
            higherEnergy: higherEnergyTracks.slice(0, 1),
            lowerEnergy: lowerEnergyTracks.slice(0, 1)
        };
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return {
            sameEnergy: [],
            higherEnergy: [],
            lowerEnergy: []
        };
    }
}

// Update the playSampleFromUrl function
function playSampleFromUrl(previewUrl) {
    // Stop any currently playing samples
    document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });

    // Create a new audio element
    const audio = new Audio(previewUrl);
    
    // Play the sample
    audio.play();
    
    // Stop after 10 seconds
    setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
    }, 10000);
}

// Update the getTrackFeatures function
async function getTrackFeatures(trackId) {
    try {
        const accessToken = localStorage.getItem('spotify_access_token');
        if (!accessToken) {
            throw new Error('No access token available');
        }

        // First verify the token is still valid
        const isValid = await verifyTokenValidity();
        if (!isValid) {
            // Try to refresh the token
            await refreshAccessToken();
        }

        // Get the current access token (might be refreshed)
        const currentToken = localStorage.getItem('spotify_access_token');
        
        const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 403) {
            console.error('Permission denied for audio features. Using default values.');
            // Return default features if we can't access the API
            return {
                tempo: 120,
                energy: 0.5,
                danceability: 0.5
            };
        }

        if (!response.ok) {
            throw new Error(`Failed to get track features: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting track features:', error);
        // Return default features on error
        return {
            tempo: 120,
            energy: 0.5,
            danceability: 0.5
        };
    }
}

// Add this new function for token refresh
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) {
        // No refresh token, need to reconnect
        await connectToSpotify();
        return;
    }

    try {
        console.log('Refreshing access token...');
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: SPOTIFY_CLIENT_ID,
                client_secret: SPOTIFY_CLIENT_SECRET
            })
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received new token data');

        if (!data.access_token) {
            throw new Error('No access token in refresh response');
        }

        localStorage.setItem('spotify_access_token', data.access_token);
        if (data.refresh_token) {
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
        }

        // Verify the new token works
        const testResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${data.access_token}`
            }
        });

        if (!testResponse.ok) {
            throw new Error('New token verification failed');
        }

        updateSpotifyConnectionState(true);
        return data.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error);
        // Clear tokens and initiate reconnection
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        updateSpotifyConnectionState(false);
        await connectToSpotify();
        return;
    }
}

// Add this new function to verify token validity
async function verifyTokenValidity() {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        console.log('No access token found during verification');
        return false;
    }

    try {
        console.log('Verifying token with Spotify API...');
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            console.log('Token verified successfully');
            return true;
        }
        
        if (response.status === 401) {
            console.log('Token expired, attempting refresh...');
            // Token expired, try refreshing
            try {
                await refreshAccessToken();
                // Verify the new token works
                const retryResponse = await fetch('https://api.spotify.com/v1/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('spotify_access_token')}`
                    }
                });
                return retryResponse.ok;
            } catch (error) {
                console.error('Token refresh failed:', error);
                return false;
            }
        }
        
        console.log('Token invalid - unexpected status:', response.status);
        return false;
    } catch (error) {
        console.error('Error verifying token:', error);
        return false;
    }
}

// Update the spotifyApiCall function
async function spotifyApiCall(url, options = {}) {
    let accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        throw new Error('No access token available');
    }

    // Verify token before making the call
    const isValid = await verifyTokenValidity();
    if (!isValid) {
        throw new Error('Session expired. Please reconnect to Spotify.');
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 401) {
            // Token expired, try refreshing
            try {
                await refreshAccessToken();
                accessToken = localStorage.getItem('spotify_access_token');
                const retryResponse = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                return retryResponse;
            } catch (refreshError) {
                throw new Error('Session expired. Please reconnect to Spotify.');
            }
        }

        return response;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Add this new function to get and activate a Spotify device
async function getAndActivateDevice() {
    const accessToken = localStorage.getItem('spotify_access_token');
    try {
        // Get available devices
        const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        console.log('Available devices:', data.devices);

        if (data.devices.length > 0) {
            // Activate the first available device
            await fetch('https://api.spotify.com/v1/me/player', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    device_ids: [data.devices[0].id],
                    play: false
                })
            });
            return true;
        } else {
            alert('No active Spotify devices found. Please open Spotify on your device.');
            return false;
        }
    } catch (error) {
        console.error('Error getting/activating device:', error);
        return false;
    }
}

// Update the playSong function to properly handle play/pause button state
async function playSong(uri) {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        alert('Please connect to Spotify first');
        return;
    }

    try {
        // First, check for available devices
        const deviceResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const deviceData = await deviceResponse.json();
        
        if (!deviceData.devices || deviceData.devices.length === 0) {
            const confirmOpen = confirm('No active Spotify devices found. Would you like to open Spotify Web Player?');
            if (confirmOpen) {
                window.open('https://open.spotify.com', '_blank');
            }
            return;
        }

        // Check and activate device
        const deviceReady = await getAndActivateDevice();
        if (!deviceReady) return;

        // Play the selected song
        const playResponse = await fetch('https://api.spotify.com/v1/me/player/play', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [uri]
            })
        });

        if (!playResponse.ok) {
            if (playResponse.status === 404) {
                const retryConfirm = confirm('Playback failed. Would you like to try opening Spotify and retry?');
                if (retryConfirm) {
                    window.open('https://open.spotify.com', '_blank');
                    // Wait a few seconds for Spotify to open
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    // Retry playing
                    await playSong(uri);
                }
                return;
            }
            throw new Error(`Playback failed: ${playResponse.status}`);
        }

        // Get track information to update the player
        const trackId = uri.split(':')[2];
        const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            currentTrack = {
                name: trackData.name,
                artists: trackData.artists
            };
            isPlaying = true;
            updatePlaybackUI();

            // Stop playback after 10 seconds
            setTimeout(async () => {
                try {
                    console.log('Stopping playback after 10 seconds');
                    await fetch('https://api.spotify.com/v1/me/player/pause', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    });
                    isPlaying = false;
                    updatePlaybackUI();
                } catch (error) {
                    console.error('Error stopping playback:', error);
                }
            }, 10000);
        }
    } catch (error) {
        console.error('Error playing song:', error);
        const errorMessage = error.message.includes('Failed to fetch') ? 
            'Please make sure Spotify is open and try again.' :
            'Error playing song. Please try again in a moment.';
        alert(errorMessage);
    }
}

async function setVolume(volume) {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) return;

    try {
        await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(volume * 100)}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
    } catch (error) {
        console.error('Error setting volume:', error);
    }
}

async function toggleMute() {
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    
    if (volumeSlider.value > 0) {
        volumeBtn.textContent = '🔇';
        volumeSlider.dataset.previousVolume = volumeSlider.value;
        volumeSlider.value = 0;
    } else {
        volumeBtn.textContent = '🔊';
        volumeSlider.value = volumeSlider.dataset.previousVolume || 50;
    }
    
    await setVolume(volumeSlider.value / 100);
}

async function playPreviousTrack() {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) return;

    try {
        await fetch('https://api.spotify.com/v1/me/player/previous', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
    } catch (error) {
        console.error('Error playing previous track:', error);
    }
}

async function playNextTrack() {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) return;

    try {
        await fetch('https://api.spotify.com/v1/me/player/next', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
    } catch (error) {
        console.error('Error playing next track:', error);
    }
}

// Add this function to handle searching for a track when clicking a recommendation
async function searchForTrack(trackName, artistName) {
    const searchInput = document.getElementById('songSearch');
    const searchButton = document.getElementById('searchButton');
    
    if (searchCount <= 0) {
        alert('You have used all your free searches. Please subscribe to continue!');
        return;
    }

    // Update the search input with the track name and artist
    searchInput.value = `${trackName} - ${artistName}`;
    
    // Trigger the search
    searchButton.click();
} 