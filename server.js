const express = require('express');
const cors = require('cors');
const path = require('path');
const optimizationService = require('./services/optimizationService');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test endpoint for reliable testing
app.get('/api/test-content', (req, res) => {
    const testHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Article - Sample Content for Optimization</title>
    <style>
        .advertisement { background: red; color: white; padding: 10px; margin: 10px 0; }
        .sidebar { background: #ccc; padding: 10px; float: right; width: 200px; }
        nav { background: #333; color: white; padding: 10px; }
    </style>
</head>
<body>
    <nav>
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
    </nav>
    
    <div class="advertisement">
        🚫 This is an advertisement that should be removed during optimization
    </div>
    
    <header>
        <h1>Test Article: The Benefits of HTML Optimization</h1>
        <p>Published on January 15, 2025 by Test Author</p>
    </header>
    
    <div class="sidebar">
        <h3>Related Articles</h3>
        <ul>
            <li><a href="#">Link 1</a></li>
            <li><a href="#">Link 2</a></li>
            <li><a href="#">Link 3</a></li>
        </ul>
        <div class="advertisement">Another ad to remove</div>
    </div>
    
    <main>
        <article>
            <h2>Introduction</h2>
            <p>This is a comprehensive test article designed to evaluate the effectiveness of various HTML optimization libraries. The content includes multiple paragraphs, images, and various HTML elements that should be preserved while removing unwanted content like advertisements and navigation elements.</p>
            
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
            
            <h2>Main Content Section</h2>
            <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
            
            <div class="advertisement">
                🚫 Inline advertisement that should be removed
            </div>
            
            <h3>Subsection with Image</h3>
            <p>Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.</p>
            
            <img src="https://via.placeholder.com/600x300/4CAF50/white?text=Test+Image" alt="Test image for optimization" style="width: 100%; height: auto;">
            
            <p>Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.</p>
            
            <blockquote>
                "This is a blockquote that should be preserved with proper styling in the optimized version. It contains important information that adds value to the article."
            </blockquote>
            
            <h2>Lists and Formatting</h2>
            <p>The optimization process should preserve various HTML elements:</p>
            
            <ul>
                <li>Unordered list item with <strong>bold text</strong></li>
                <li>List item with <em>italic text</em></li>
                <li>List item with <a href="#test">internal links</a></li>
                <li>List item with normal text content</li>
            </ul>
            
            <ol>
                <li>First numbered item explaining the process</li>
                <li>Second numbered item with detailed information</li>
                <li>Third numbered item summarizing key points</li>
            </ol>
            
            <h2>Conclusion</h2>
            <p>This test content provides a comprehensive example for evaluating HTML optimization libraries. The main article content should be preserved and styled for optimal readability, while advertisements, navigation, and sidebar content should be removed. Images should be preserved and properly sized for both screen and print media.</p>
            
            <p>The optimization should result in clean, readable content that focuses on the main article while removing distractions and improving the overall reading experience.</p>
        </article>
    </main>
    
    <aside class="sidebar-bottom">
        <h3>Newsletter Signup</h3>
        <p>Subscribe to our newsletter for more articles like this one.</p>
        <div class="advertisement">Newsletter signup ad</div>
    </aside>
    
    <footer>
        <p>&copy; 2025 Test Website. All rights reserved.</p>
        <nav>
            <a href="#privacy">Privacy</a> | 
            <a href="#terms">Terms</a> | 
            <a href="#contact">Contact</a>
        </nav>
    </footer>
    
    <script>
        // This script should be removed during optimization
        console.log('This script should not appear in optimized content');
        
        // Simulate some dynamic content
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Page loaded');
        });
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(testHTML);
});

// API endpoint for HTML optimization
app.post('/api/optimize', async (req, res) => {
    try {
        const { url, library, additionalProcessing = false } = req.body;
        
        if (!url || !library) {
            return res.status(400).json({ 
                error: 'URL and library are required' 
            });
        }

        console.log(`Optimizing ${url} with ${library} (additional processing: ${additionalProcessing})`);
        
        const result = await optimizationService.optimizeHTML(url, library, additionalProcessing);
        
        res.json({
            success: true,
            originalContent: result.originalContent,
            optimizedContent: result.optimizedContent,
            library: library,
            url: url,
            additionalProcessing: additionalProcessing
        });
        
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ 
            error: error.message || 'An error occurred during optimization' 
        });
    }
});

// API endpoint for file-based HTML optimization
app.post('/api/optimize-file', async (req, res) => {
    try {
        const { htmlContent, library, fileName, additionalProcessing = false } = req.body;
        
        if (!htmlContent || !library) {
            return res.status(400).json({ 
                error: 'HTML content and library are required' 
            });
        }

        console.log(`Optimizing file "${fileName || 'uploaded file'}" with ${library} (additional processing: ${additionalProcessing})`);
        
        const result = await optimizationService.optimizeHTMLContent(htmlContent, library, fileName, additionalProcessing);
        
        res.json({
            success: true,
            originalContent: result.originalContent,
            optimizedContent: result.optimizedContent,
            library: library,
            fileName: fileName || 'uploaded file',
            additionalProcessing: additionalProcessing
        });
        
    } catch (error) {
        console.error('File optimization error:', error);
        res.status(500).json({ 
            error: error.message || 'An error occurred during file optimization' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Available optimization libraries: Cheerio, Readability.js, Puppeteer, Playwright, Prettier, DOMParser`);
});

module.exports = app;
