# HTML Optimization Tool

A powerful JavaScript web application for optimizing HTML content for readability and print using various optimization libraries.

## Features

- **Multi-Library Support**: Choose from 7 different optimization libraries
- **Side-by-Side Comparison**: View original and optimized content simultaneously
- **Ad Removal**: Automatically removes advertisements and unwanted content
- **Text Extraction**: Preserves important content while removing clutter
- **Image Optimization**: Retains images with optimized sizing
- **Print Optimization**: Layouts optimized for printing
- **Download & Copy**: Save or copy optimized content
- **Responsive Design**: Works on desktop and mobile devices

## Supported Libraries

1. **Cheerio** - Server-side HTML parsing and manipulation
2. **Readability.js** - Content extraction similar to Firefox Reader Mode
3. **Puppeteer** - Browser automation with Chrome/Chromium
4. **Playwright** - Cross-browser automation (Chrome, Firefox, Safari)
5. **Prettier** - Code formatter with reading optimization
6. **JS-Beautify** - HTML beautifier with style enhancement
7. **DOMParser** - Native browser APIs for lightweight processing

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd HTMLOptimization
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. Enter a website URL in the input field
2. Select an optimization library from the dropdown
3. Click "Optimize Content" to process the webpage
4. Compare the original and optimized content side-by-side
5. Use the action buttons to copy, print, or download the content

## API Endpoints

### POST /api/optimize
Optimizes HTML content using the specified library.

**Request Body:**
```json
{
  "url": "https://example.com",
  "library": "cheerio"
}
```

**Response:**
```json
{
  "success": true,
  "originalContent": "<html>...",
  "optimizedContent": "<html>...",
  "library": "cheerio",
  "url": "https://example.com"
}
```

### GET /api/health
Health check endpoint.

## Library Comparison

| Library | Strength | Use Case |
|---------|----------|----------|
| Cheerio | Fast server-side parsing | Basic content extraction |
| Readability.js | Article detection | News articles, blogs |
| Puppeteer | Full browser rendering | JavaScript-heavy sites |
| Playwright | Cross-browser compatibility | Modern web applications |
| Prettier | Code formatting | Clean HTML structure |
| JS-Beautify | HTML beautification | Code readability |
| DOMParser | Lightweight processing | Simple optimizations |

## Development

### Scripts
- `npm start` - Start the production server
- `npm run dev` - Start development server with auto-restart
- `npm run build` - Install dependencies

### Project Structure
```
HTMLOptimization/
├── public/
│   ├── index.html      # Main UI
│   ├── styles.css      # Styling
│   └── script.js       # Frontend logic
├── services/
│   └── optimizationService.js  # Backend optimization logic
├── server.js           # Express server
├── package.json        # Dependencies
└── README.md          # Documentation
```

## Optimization Features

### Ad Removal
- Removes common ad selectors
- Eliminates promotional content
- Cleans navigation and sidebar elements

### Content Extraction
- Identifies main article content
- Preserves important text formatting
- Maintains semantic HTML structure

### Image Optimization
- Responsive image sizing
- Proper alt text preservation
- Print-friendly image placement

### Print Layout
- Optimized typography for print
- Proper page breaks
- High contrast for readability

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Dependencies

### Production
- express: Web server framework
- cors: Cross-origin resource sharing
- cheerio: Server-side HTML parsing
- jsdom: DOM implementation
- puppeteer: Browser automation
- playwright: Cross-browser automation
- js-beautify: HTML beautification
- prettier: Code formatting
- axios: HTTP client

### Development
- nodemon: Development server with auto-restart

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the console for error messages
2. Verify the URL is accessible
3. Try different optimization libraries
4. Check network connectivity

## Future Enhancements

- Custom optimization rules
- Batch URL processing
- PDF export functionality
- More output formats
- API rate limiting
- Content caching
- User preferences storage
