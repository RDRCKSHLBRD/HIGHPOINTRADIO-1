const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware: General CORS setup
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

// Middleware: Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware: Dynamic rate limiting
const dynamicRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
        return req.headers['x-trusted-client'] ? 1000 : 100;
    },
    handler: (req, res) => {
        console.log(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
});

// Apply rate limiting middleware globally or per route
app.use('/metadata', dynamicRateLimit);
app.use('/proxy', dynamicRateLimit);

// Route: Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route: Metadata API
app.get('/metadata', async (req, res) => {
    const fileUrl = req.query.url;

    if (!fileUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const headResponse = await axios({
            method: 'head',
            url: fileUrl,
            timeout: 120 * 1000 // 120 seconds
        });

        const contentLength = headResponse.headers['content-length'];
        const contentType = headResponse.headers['content-type'];
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

// Route: Proxy API
app.get('/proxy', async (req, res) => {
    const fileUrl = req.query.url;

    if (!fileUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const headers = {};
        if (req.headers.range) {
            headers.Range = req.headers.range; // Pass Range header for partial content
        }

        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream',
            headers: headers,
            timeout: 120 * 1000 // 120 seconds
        });

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

        response.data.pipe(res);
    } catch (error) {
        console.error('Error in proxy:', error.message);
        res.status(500).json({ error: 'Error fetching file' });
    }
});

// Start server
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});

server.keepAliveTimeout = 120 * 1000; // 120 seconds
server.headersTimeout = 120 * 1000; // 120 seconds
