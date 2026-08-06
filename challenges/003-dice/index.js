const express = require('express');
const path = require('path');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const unorm = require('unorm');

const app = express();
const PORT = 3000;

// Create a DOM window for DOMPurify (XSS protection)
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Roll a single dice
app.get('/api/roll-dice', (req, res) => {
    const result = Math.floor(Math.random() * 6) + 1;
    res.json({ result });
});

// Roll multiple dices
app.post('/api/roll-dices', (req, res) => {
    const count = parseInt(req.body.count) || 1;
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(Math.floor(Math.random() * 6) + 1);
    }
    res.json({ results, count });
});

// Helper function to process words
function processWords(words) {
    if (!words || !Array.isArray(words) || words.length === 0) {
        return null;
    }

    const sanitizedWords = words.map(word => {
        let sanitized = DOMPurify.sanitize(word, { ALLOWED_TAGS: [] });
        sanitized = unorm.nfkc(sanitized);
        return sanitized;
    });

    const randomIndex = Math.floor(Math.random() * sanitizedWords.length);
    const selectedWord = sanitizedWords[randomIndex];

    return {
        selectedWord,
        allWords: sanitizedWords,
        originalCount: words.length
    };
}

// Select random word from list (GET with query parameters)
app.get('/api/random-word', (req, res) => {
    const wordsParam = req.query.words;
    
    if (!wordsParam) {
        return res.status(400).json({ error: 'Please provide words as a query parameter (comma-separated)' });
    }

    // Parse comma-separated words from query parameter
    const words = wordsParam.split(',')
        .map(w => decodeURIComponent(w.trim()))
        .filter(w => w.length > 0);

    const result = processWords(words);
    if (!result) {
        return res.status(400).json({ error: 'Please provide at least one word' });
    }

    res.json(result);
});

// Select random word from list (POST with JSON body)
app.post('/api/random-word', (req, res) => {
    const words = req.body.words;
    
    const result = processWords(words);
    if (!result) {
        return res.status(400).json({ error: 'Please provide a non-empty array of words' });
    }

    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Dice application running on http://localhost:${PORT}`);
});

