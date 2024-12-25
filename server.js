const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Root Route: Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy Route
app.get('/proxy', async (req, res) => {
    const fileUrl = req.query.url;

    if (!fileUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream', // Stream the audio file
        });

        // Set response headers
        res.set('Content-Type', 'audio/mpeg');
        response.data.pipe(res); // Stream the data to the client
    } catch (error) {
        console.error('Error in proxy:', error.message);
        res.status(500).json({ error: 'Error fetching file' });
    }
});

// Server Configuration
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
