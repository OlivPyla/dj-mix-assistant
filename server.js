const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
let port = 3000;

// Add logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Configure CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'https://sdk.scdn.co'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Add config route BEFORE the static files middleware
app.get('/config.js', (req, res) => {
    const config = `
        const SPOTIFY_CLIENT_ID = '${process.env.SPOTIFY_CLIENT_ID}';
        const SPOTIFY_CLIENT_SECRET = '${process.env.SPOTIFY_CLIENT_SECRET}';
        const SPOTIFY_REDIRECT_URI = 'http://localhost:${port}';
        const SPOTIFY_SCOPES = [
            'user-read-private',
            'user-read-email',
            'user-read-playback-state',
            'user-modify-playback-state',
            'streaming',
            'app-remote-control'
        ].join(' ');
    `;
    res.type('application/javascript').send(config);
});

// Serve static files
app.use(express.static(__dirname));

// Handle all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

function startServer(port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port)
            .on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`Port ${port} is busy, trying ${port + 1}...`);
                    resolve(startServer(port + 1));
                } else {
                    reject(err);
                }
            })
            .on('listening', () => {
                console.log(`Server running at http://localhost:${port}`);
                resolve(port);
            });
    });
}

// Start server
startServer(port).then(finalPort => {
    port = finalPort;
}); 