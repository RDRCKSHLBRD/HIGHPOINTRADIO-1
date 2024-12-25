const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

app.get('/proxy', async (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl) {
      return res.status(400).send('URL is required');
  }

  try {
      const response = await axios({
          method: 'get',
          url: fileUrl,
          responseType: 'stream', // Stream data directly
      });

      res.set('Content-Type', 'audio/mpeg');
      response.data.pipe(res); // Pipe the response directly to the client
  } catch (error) {
      console.error('Error in proxy:', error.message);
      res.status(500).send('Error fetching file');
  }
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
