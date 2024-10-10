const express = require('express');
const path = require('path');
const { extractReviews } = require('../reviewExtractor');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/reviews', async (req, res) => {
  const { page } = req.query;
  if (!page) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const reviews = await extractReviews(page);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
