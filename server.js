const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Rate limiter for Render
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
});

app.use(limiter);
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Metadata endpoint using Axios
app.get('/metadata', async (req, res) => {
    const fileUrl = req.query.url;
    
    if (!fileUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Get headers only first
        const headResponse = await axios({
            method: 'head',
            url: fileUrl
        });

        // Get content length and type
        const contentLength = headResponse.headers['content-length'];
        const contentType = headResponse.headers['content-type'];

        // Calculate duration using 320 kbps
        const bitrate = 320 * 1024 / 8; // 320 kbps in bytes per second
        const durationEstimate = contentLength / bitrate;

        res.json({
            duration: durationEstimate,
            size: contentLength,
            type: contentType
        });

    } catch (error) {
        console.error('Error fetching metadata:', error.message);
        res.status(500).json({ error: 'Error fetching metadata' });
    }
});


// Proxy route for streaming
app.get('/proxy', async (req, res) => {
    const fileUrl = req.query.url;

    if (!fileUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Forward the range header if it exists
        const headers = {};
        if (req.headers.range) {
            headers.Range = req.headers.range; // Pass Range header for partial content
        }

        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream',
            headers: headers, // Include forwarded headers
        });

        // Set response headers
        if (req.headers.range) {
            res.status(206); // Partial Content
        }
        res.set('Content-Type', response.headers['content-type']);
        res.set('Accept-Ranges', 'bytes');

        if (response.headers['content-length']) {
            res.set('Content-Length', response.headers['content-length']);
        }
        if (response.headers['content-range']) {
            res.set('Content-Range', response.headers['content-range']);
        }

        // Stream the response
        response.data.pipe(res);
    } catch (error) {
        console.error('Error in proxy:', error.message);
        res.status(500).json({ error: 'Error fetching file' });
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});