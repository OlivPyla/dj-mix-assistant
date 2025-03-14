# DJ Mix Assistant

A web application that helps DJs find the perfect next track based on energy levels and musical features. Built with HTML, CSS, and JavaScript, integrating with the Spotify API.

## Features

- Search for tracks using Spotify's database
- Get track recommendations based on energy levels
- Preview tracks before playing
- Automatic 10-second preview playback
- Volume control and playback controls
- Responsive design for all devices

## Setup

1. Clone the repository:
```bash
git clone https://github.com/OlivPyla/dj-mix-assistant.git
cd dj-mix-assistant
```

2. Create a Spotify Developer account and set up your application:
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new application
   - Get your Client ID and Client Secret
   - Add `http://localhost:5500` to your Redirect URIs

3. Create a `.env` file in the root directory with your Spotify credentials:
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5500
```

4. Open the project in your preferred code editor and serve it using a local server (e.g., Live Server in VS Code)

## Usage

1. Connect to your Spotify account
2. Search for a track
3. View recommendations based on energy levels
4. Preview tracks by clicking the play button
5. Click on recommendations to search for those tracks

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- Spotify Web API
- Spotify Web Playback SDK

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 