// Spotify API Configuration
const SPOTIFY_CLIENT_ID = 'cf3c642153c14448b83d54e867b1fdfd';
const SPOTIFY_CLIENT_SECRET = '4904943b490040209733d1535e73122e';
const SPOTIFY_REDIRECT_URI = window.location.hostname === 'localhost' 
    ? 'http://localhost:5500'
    : 'http://127.0.0.1:5500';
const SPOTIFY_SCOPES = 'user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-library-read user-library-modify user-read-playback-state user-modify-playback-state streaming user-read-currently-playing app-remote-control user-read-recently-played user-top-read'; 