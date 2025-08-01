const axios = require('axios');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const puppeteer = require('puppeteer');
const playwright = require('playwright');
const beautify = require('js-beautify');
const prettier = require('prettier');

class OptimizationService {
    
    async fetchHTML(url) {
        try {
            console.log(`Fetching URL: ${url}`);
            
            // Try with different configurations to handle redirects
            const configurations = [
                {
                    maxRedirects: 5,
                    validateStatus: (status) => status >= 200 && status < 400,
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    }
                },
                {
                    maxRedirects: 10, // More redirects allowed
                    validateStatus: (status) => status >= 200 && status < 500,
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
                    headers: {
                        'User-Agent': 'curl/7.68.0',
                        'Accept': '*/*'
                    }
                },
                {
                    maxRedirects: 15, // Even more redirects
                    validateStatus: (status) => status >= 200 && status < 600,
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
                    headers: {
                        'User-Agent': 'HTMLOptimizationBot/1.0',
                        'Accept': 'text/html'
                    }
                }
            ];
            
            let lastError;
            
            for (const [index, config] of configurations.entries()) {
                try {
                    console.log(`Trying configuration ${index + 1}/${configurations.length} for ${url}`);
                    
                    const response = await axios.get(url, {
                        ...config,
                        timeout: 30000,
                        decompress: true,
                        maxContentLength: 50 * 1024 * 1024, // 50MB limit
                        maxBodyLength: 50 * 1024 * 1024
                    });
                    
                    // Validate content length and type - more flexible validation
                    if (response.data && response.data.length > 200 && 
                        (typeof response.data === 'string' && 
                         (response.data.includes('<html') || 
                          response.data.includes('<body') || 
                          response.data.includes('<head') ||
                          response.data.includes('<!DOCTYPE')))) {
                        console.log(`Successfully fetched ${url} with config ${index + 1}, content length: ${response.data.length}`);
                        return response.data;
                    } else {
                        console.log(`Content too small or invalid HTML (${response.data?.length || 0} chars), trying next config...`);
                        throw new Error('Content too small or not HTML');
                    }
                    
                } catch (error) {
                    console.log(`Configuration ${index + 1} failed: ${error.message}`);
                    lastError = error;
                    
                    // If it's a redirect issue, try next configuration
                    if (error.message.includes('redirect') || error.code === 'ERR_FR_TOO_MANY_REDIRECTS') {
                        continue;
                    }
                    
                    // If it's a status error but we got data, try to use it
                    if (error.response && error.response.data && typeof error.response.data === 'string') {
                        console.log(`Got data despite error, using it. Status: ${error.response.status}`);
                        return error.response.data;
                    }
                }
            }
            
            // All configurations failed, try a simple fetch as last resort
            console.log('All axios configurations failed, trying simple fetch...');
            try {
                const { default: fetch } = await import('node-fetch');
                const https = require('https');
                
                const agent = new https.Agent({
                    rejectUnauthorized: false
                });
                
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 30000,
                    redirect: 'follow',
                    follow: 10,
                    agent: url.startsWith('https:') ? agent : undefined
                });
                
                if (response.ok) {
                    const content = await response.text();
                    if (content.length > 200 && (content.includes('<html') || content.includes('<body') || content.includes('<!DOCTYPE'))) {
                        console.log(`Simple fetch succeeded, content length: ${content.length}`);
                        return content;
                    }
                }
            } catch (fetchError) {
                console.log('Simple fetch also failed:', fetchError.message);
            }
            
            // All methods failed, throw the last error with better message
            throw lastError;
            
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error.message);
            
            if (error.code === 'ENOTFOUND') {
                throw new Error(`Cannot reach the website. Please check the URL: ${url}`);
            } else if (error.code === 'ECONNREFUSED') {
                throw new Error(`Connection refused by the server: ${url}`);
            } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
                throw new Error(`Request timed out. The website might be slow or unreachable: ${url}`);
            } else if (error.message.includes('redirect') || error.code === 'ERR_FR_TOO_MANY_REDIRECTS') {
                throw new Error(`Too many redirects detected. The website might have a redirect loop: ${url}`);
            } else if (error.response) {
                throw new Error(`Server responded with status ${error.response.status}: ${error.response.statusText} for ${url}`);
            } else {
                throw new Error(`Failed to fetch URL: ${error.message}. Please try a different URL or check if the website is accessible.`);
            }
        }
    }

    async optimizeHTML(url, library) {
        console.log(`Starting optimization for ${url} using ${library}`);
        
        // Validate URL format
        try {
            new URL(url);
        } catch (e) {
            throw new Error('Invalid URL format. Please include http:// or https://');
        }
        
        let originalContent = '';
        let optimizedContent;
        
        // For browser-based tools (Puppeteer, Playwright), skip fetchHTML as they handle URLs directly
        if (library.toLowerCase() === 'puppeteer' || library.toLowerCase() === 'playwright') {
            console.log(`Using browser automation with ${library}, skipping initial HTML fetch...`);
            // These tools will navigate to the URL directly and don't need pre-fetched content
        } else {
            // For other libraries, fetch HTML content first
            originalContent = await this.fetchHTML(url);
            console.log(`Fetched content, length: ${originalContent.length} characters`);
            
            // Validate content - more flexible validation
            if (!originalContent || originalContent.length < 200) {
                throw new Error(`Retrieved content is too small (${originalContent?.length || 0} characters). The website might be blocking requests or redirecting to an error page. Try using the test content or a different URL.`);
            }
            
            if (!originalContent.includes('<html') && !originalContent.includes('<body') && !originalContent.includes('<!DOCTYPE')) {
                throw new Error('Retrieved content does not appear to be valid HTML. The website might be returning an error page or blocking the request. Try using the test content or a different URL.');
            }
        }

        try {
            switch (library.toLowerCase()) {
                case 'cheerio':
                    console.log('Optimizing with Cheerio...');
                    optimizedContent = await this.optimizeWithCheerio(originalContent, url);
                    break;
                case 'readability.js':
                    console.log('Optimizing with Readability.js...');
                    optimizedContent = await this.optimizeWithReadability(originalContent, url);
                    break;
                case 'mozilla-readability':
                    console.log('Optimizing with Mozilla Readability...');
                    optimizedContent = await this.optimizeWithMozillaReadability(originalContent, url);
                    break;
                case 'puppeteer':
                    console.log('Optimizing with Puppeteer...');
                    const puppeteerResult = await this.optimizeWithPuppeteer(url);
                    originalContent = puppeteerResult.originalContent;
                    optimizedContent = puppeteerResult.optimizedContent;
                    break;
                case 'playwright':
                    console.log('Optimizing with Playwright...');
                    const playwrightResult = await this.optimizeWithPlaywright(url);
                    originalContent = playwrightResult.originalContent;
                    optimizedContent = playwrightResult.optimizedContent;
                    break;
                case 'prettier':
                    console.log('Optimizing with Prettier...');
                    optimizedContent = await this.optimizeWithPrettier(originalContent);
                    break;
                case 'js-beautify':
                    console.log('Optimizing with JS-Beautify...');
                    optimizedContent = await this.optimizeWithJSBeautify(originalContent);
                    break;
                case 'domparser':
                    console.log('Optimizing with DOMParser...');
                    optimizedContent = await this.optimizeWithDOMParser(originalContent);
                    break;
                default:
                    throw new Error(`Unsupported library: ${library}`);
            }
            
            console.log(`Optimization completed with ${library}, result length: ${optimizedContent.length} characters`);
            
        } catch (error) {
            console.error(`Optimization error with ${library}:`, error.message);
            throw new Error(`Optimization failed with ${library}: ${error.message}`);
        }

        return {
            originalContent,
            optimizedContent
        };
    }

    async optimizeHTMLContent(htmlContent, library, fileName = 'uploaded file') {
        console.log(`Starting optimization for ${fileName} using ${library}`);
        
        // Validate HTML content
        if (!htmlContent || typeof htmlContent !== 'string') {
            throw new Error('Invalid HTML content provided');
        }
        
        if (htmlContent.length < 10) {
            throw new Error('HTML content is too short to be valid');
        }
        
        // Basic HTML validation
        if (!htmlContent.includes('<html') && !htmlContent.includes('<body') && !htmlContent.includes('<!DOCTYPE')) {
            throw new Error('Content does not appear to be valid HTML');
        }
        
        let originalContent = htmlContent;
        let optimizedContent;
        
        try {
            switch (library.toLowerCase()) {
                case 'cheerio':
                    console.log('Optimizing with Cheerio...');
                    optimizedContent = await this.optimizeWithCheerio(originalContent, fileName);
                    break;
                case 'readability.js':
                    console.log('Optimizing with Readability.js...');
                    optimizedContent = await this.optimizeWithReadability(originalContent, fileName);
                    break;
                case 'mozilla-readability':
                    console.log('Optimizing with Mozilla Readability...');
                    optimizedContent = await this.optimizeWithMozillaReadability(originalContent, fileName);
                    break;
                case 'puppeteer':
                    // For file content, we need to create a temporary URL or use data: URL
                    console.log('Optimizing with Puppeteer...');
                    optimizedContent = await this.optimizeWithPuppeteerContent(originalContent);
                    break;
                case 'playwright':
                    // For file content, we need to create a temporary URL or use data: URL
                    console.log('Optimizing with Playwright...');
                    optimizedContent = await this.optimizeWithPlaywrightContent(originalContent);
                    break;
                case 'prettier':
                    console.log('Optimizing with Prettier...');
                    optimizedContent = await this.optimizeWithPrettier(originalContent);
                    break;
                case 'js-beautify':
                    console.log('Optimizing with JS-Beautify...');
                    optimizedContent = await this.optimizeWithJSBeautify(originalContent);
                    break;
                case 'domparser':
                    console.log('Optimizing with DOMParser...');
                    optimizedContent = await this.optimizeWithDOMParser(originalContent);
                    break;
                default:
                    throw new Error(`Unsupported library: ${library}`);
            }
            
            console.log(`Optimization completed with ${library}, result length: ${optimizedContent.length} characters`);
            
        } catch (error) {
            console.error(`Optimization error with ${library}:`, error.message);
            throw new Error(`Optimization failed with ${library}: ${error.message}`);
        }

        return {
            originalContent,
            optimizedContent
        };
    }

    async optimizeWithCheerio(html, url) {
        const $ = cheerio.load(html);
        
        console.log(`Cheerio: Initial image count: ${$('img').length}`);
        
        // Remove ads and unwanted elements, but preserve images
        $('script, noscript, nav, header, footer, aside, .popup, .modal').remove();
        
        // More careful ad removal - avoid removing elements that contain images
        $('.ad, .advertisement, .sidebar').each(function() {
            const $elem = $(this);
            if ($elem.find('img').length === 0) {
                $elem.remove();
            } else {
                // If it contains images, just remove the text content but keep images
                console.log('Cheerio: Preserving images in ad container');
                $elem.find('*:not(img)').remove();
                $elem.contents().filter(function() {
                    return this.nodeType === 3; // Text nodes
                }).remove();
            }
        });
        
        // Remove banner elements that don't contain images
        $('[class*="ad"], [id*="ad"], [class*="banner"], [id*="banner"]').each(function() {
            const $elem = $(this);
            if ($elem.find('img').length === 0) {
                $elem.remove();
            }
        });
        
        console.log(`Cheerio: After ad removal image count: ${$('img').length}`);
        
        // Extract main content
        let mainContent = $('main, article, .content, .post, .entry, #content, #main').first();
        if (mainContent.length === 0) {
            mainContent = $('body');
        }
        
        console.log(`Cheerio: Found main content element: ${mainContent.length > 0 ? mainContent.prop('tagName') : 'none'}`);
        console.log(`Cheerio: Images in main content: ${mainContent.find('img').length}`);
        
        // Optimize for reading - be more careful about removing elements
        mainContent.find('*').each((i, elem) => {
            const $elem = $(elem);
            
            // Don't remove elements that contain images or have meaningful content
            const hasImages = $elem.find('img').length > 0;
            const hasText = $elem.text().trim() !== '';
            const hasLinks = $elem.find('a').length > 0;
            const isImportantElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'article', 'section'].includes(elem.tagName?.toLowerCase());
            
            // Only remove if it's truly empty and not important
            if (!hasImages && !hasText && !hasLinks && !isImportantElement) {
                $elem.remove();
                return;
            }
            
            // Clean up attributes but keep essential ones for images and other elements
            const allowedAttrs = ['src', 'alt', 'href', 'title', 'class', 'style', 'width', 'height', 'data-src', 'srcset'];
            Object.keys(elem.attribs || {}).forEach(attr => {
                if (!allowedAttrs.includes(attr)) {
                    $elem.removeAttr(attr);
                }
            });
        });
        
        // Handle lazy loaded images and fix image sources
        mainContent.find('img').each((i, img) => {
            const $img = $(img);
            
            // Handle various lazy loading attributes
            const dataSrc = $img.attr('data-src');
            const dataOriginal = $img.attr('data-original');
            const dataLazySrc = $img.attr('data-lazy-src');
            const dataActual = $img.attr('data-actual');
            const currentSrc = $img.attr('src');
            
            // Convert lazy-loaded src attributes
            if (!currentSrc || currentSrc.includes('data:') || currentSrc.includes('placeholder') || currentSrc.includes('blank')) {
                if (dataSrc) {
                    $img.attr('src', dataSrc);
                    console.log('Cheerio: Converted data-src to src');
                } else if (dataOriginal) {
                    $img.attr('src', dataOriginal);
                    console.log('Cheerio: Converted data-original to src');
                } else if (dataLazySrc) {
                    $img.attr('src', dataLazySrc);
                    console.log('Cheerio: Converted data-lazy-src to src');
                } else if (dataActual) {
                    $img.attr('src', dataActual);
                    console.log('Cheerio: Converted data-actual to src');
                }
            }
            
            // Convert relative URLs to absolute URLs
            const imgSrc = $img.attr('src');
            if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('data:')) {
                try {
                    if (url && url.startsWith('http')) {
                        const baseURL = new URL(url).origin;
                        if (imgSrc.startsWith('/')) {
                            $img.attr('src', baseURL + imgSrc);
                        } else if (imgSrc.startsWith('./')) {
                            $img.attr('src', baseURL + '/' + imgSrc.substring(2));
                        } else if (!imgSrc.startsWith('../')) {
                            $img.attr('src', baseURL + '/' + imgSrc);
                        }
                        console.log('Cheerio: Converted relative URL to absolute');
                    }
                } catch (e) {
                    console.log('Cheerio: Could not convert relative URL');
                }
            }
        });
        
        // Optimize images
        mainContent.find('img').each((i, img) => {
            const $img = $(img);
            console.log(`Cheerio: Processing image ${i + 1}: ${$img.attr('src')?.substring(0, 50)}...`);
            
            // Remove constraining attributes and classes
            $img.removeAttr('width').removeAttr('height').removeAttr('style');
            const className = $img.attr('class') || '';
            if (className.includes('lazy') || className.includes('loading')) {
                $img.attr('class', className.replace(/\b(lazy|loading|placeholder)\b/g, '').trim());
            }
            
            $img.css({
                'max-width': '100%',
                'height': 'auto',
                'display': 'block',
                'margin': '1em auto',
                'opacity': '1',
                'visibility': 'visible'
            });
        });
        
        // Get the content HTML and validate it
        const contentHtml = mainContent.html();
        console.log(`Cheerio: Content HTML length: ${contentHtml ? contentHtml.length : 'null/undefined'}`);
        console.log(`Cheerio: Final image count in content: ${$(contentHtml).find('img').length}`);
        
        if (!contentHtml || contentHtml.trim() === '') {
            console.warn('Cheerio: No content found, using full body');
            // Fallback to full document if no main content found
            const bodyContent = $('body').html() || html;
            console.log(`Cheerio: Fallback body image count: ${$(bodyContent).find('img').length}`);
            
            const fallbackHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optimized Content</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
            background: white;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        p {
            margin-bottom: 1rem;
            text-align: justify;
        }
        img {
            max-width: 100% !important;
            height: auto !important;
            display: block;
            margin: 1em auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            opacity: 1 !important;
            visibility: visible !important;
        }
        /* Ensure lazy-loaded images are visible */
        img.lazy, img.loading, img[data-src], img[data-original] {
            opacity: 1 !important;
            visibility: visible !important;
            display: block !important;
        }
        @media print {
            body { font-size: 12pt; }
            h1 { font-size: 18pt; }
            h2 { font-size: 16pt; }
            h3 { font-size: 14pt; }
        }
    </style>
</head>
<body>
    ${bodyContent}
</body>
</html>`;
            return fallbackHTML;
        }
        
        // Add print-friendly styles
        const optimizedHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Optimized Content</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
            background: white;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        p {
            margin-bottom: 1rem;
            text-align: justify;
        }
        img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 1em auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            opacity: 1 !important;
            visibility: visible !important;
        }
        /* Ensure lazy-loaded images are visible */
        img.lazy, img.loading, img[data-src], img[data-original] {
            opacity: 1 !important;
            visibility: visible !important;
            display: block !important;
        }
        @media print {
            body { font-size: 12pt; }
            h1 { font-size: 18pt; }
            h2 { font-size: 16pt; }
            h3 { font-size: 14pt; }
        }
    </style>
</head>
<body>
    ${contentHtml}
</body>
</html>`;
        
        console.log(`Cheerio: Final optimized HTML length: ${optimizedHTML.length}`);
        console.log(`Cheerio: Final optimized HTML image count: ${$(optimizedHTML).find('img').length}`);
        return optimizedHTML;
    }

    async optimizeWithReadability(html, url) {
        // Using JSDOM with Readability-like logic
        // Handle both URL and filename cases
        const baseURL = url && url.startsWith('http') ? url : 'http://localhost/';
        const dom = new JSDOM(html, { url: baseURL });
        const document = dom.window.document;
        
        console.log(`Readability: Starting with document, body length: ${document.body?.innerHTML?.length || 0}`);
        console.log(`Readability: Initial element counts - divs: ${document.querySelectorAll('div').length}, articles: ${document.querySelectorAll('article').length}, sections: ${document.querySelectorAll('section').length}`);
        
        // Remove unwanted elements with improved ad and video removal
        const unwantedSelectors = [
            'script', 'noscript', 'style', 'nav', 'header', 'footer',
            // Video and media elements
            'video', 'iframe[src*="youtube"]', 'iframe[src*="vimeo"]', 'iframe[src*="dailymotion"]',
            'iframe[src*="twitch"]', 'iframe[src*="tiktok"]', 'embed[type*="video"]',
            'object[type*="video"]', 'object[data*="youtube"]', 'object[data*="vimeo"]',
            // Ad-related elements - comprehensive removal
            '.ad', '.ads', '.advertisement', '.advertising', '.advert', '.adblock',
            '.popup', '.modal', '.banner', '.promo', '.promotion', '.sponsored',
            '.google-ads', '.adsense', '.doubleclick', '.outbrain', '.taboola',
            '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]', '[id*="ads-"]',
            '[class*="banner"]', '[id*="banner"]', '[class*="promo"]', '[id*="promo"]',
            '[class*="sponsor"]', '[id*="sponsor"]', '[class*="commercial"]',
            // Social media widgets and share buttons (often contain ads)
            '.social-share', '.share-buttons', '.social-widget', '.twitter-widget',
            '.facebook-widget', '.linkedin-widget', '.pinterest-widget',
            // Newsletter signups and popups
            '.newsletter', '.subscribe', '.signup', '.email-signup',
            // Comments sections (often have ads)
            '.comments:not(:has(img))', '.comment-section:not(:has(img))', '#comments:not(:has(img))',
            // Sidebar elements that don't contain main content
            'aside:not(:has(article)):not(:has(p)):not(:has(img))',
            '.sidebar:not(:has(img))', '.widget:not(:has(img))'
        ];
        
        unwantedSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                console.log(`Readability: Removing ${elements.length} elements matching: ${selector}`);
                elements.forEach(el => el.remove());
            } catch (e) {
                // Skip invalid selectors
                console.log(`Readability: Skipping invalid selector: ${selector}`);
            }
        });
        
        // Additional ad removal by text content and attributes
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
            const text = element.textContent || '';
            const className = element.className || '';
            const id = element.id || '';
            const src = element.src || '';
            const href = element.href || '';
            
            // Remove elements with ad-related text content (but preserve if they contain images)
            const hasImages = element.querySelector('img') !== null;
            if (!hasImages) {
                const adKeywords = /advertisement|sponsored|promo|banner|popup|subscribe|newsletter/i;
                if (adKeywords.test(text) || adKeywords.test(className) || adKeywords.test(id)) {
                    element.remove();
                    return;
                }
                
                // Remove elements with ad-related URLs
                if (src && (src.includes('ads') || src.includes('doubleclick') || src.includes('googlesyndication'))) {
                    element.remove();
                    return;
                }
                
                if (href && (href.includes('ads') || href.includes('sponsor') || href.includes('promo'))) {
                    element.remove();
                    return;
                }
            }
        });
        
        // Find main content using improved Readability-style scoring
        const contentElements = document.querySelectorAll('div, article, section, main, [role="main"]');
        let bestElement = null;
        let bestScore = 0;
        
        console.log(`Readability: Evaluating ${contentElements.length} potential content containers`);
        
        contentElements.forEach((element, index) => {
            let score = 0;
            const text = element.textContent || '';
            const innerHTML = element.innerHTML || '';
            
            // Basic text metrics
            const commas = (text.match(/,/g) || []).length;
            const periods = (text.match(/\./g) || []).length;
            const paragraphs = element.querySelectorAll('p').length;
            const wordCount = text.split(/\s+/).length;
            const imageCount = element.querySelectorAll('img').length;
            
            // Content scoring
            score += Math.min(Math.floor(wordCount / 50), 10); // Word count bonus
            score += Math.min(commas * 2, 10); // Punctuation indicates content
            score += Math.min(periods * 2, 10);
            score += paragraphs * 5; // Paragraphs are strong indicators
            
            // Look for content-indicating elements
            if (element.querySelector('p')) score += 10;
            if (element.querySelectorAll('p').length > 2) score += 15;
            if (element.querySelector('h1, h2, h3')) score += 5;
            // Give higher score for images since we want to preserve them
            if (element.querySelector('img')) score += 10;
            if (imageCount > 1) score += imageCount * 5; // Bonus for multiple images
            if (element.querySelector('blockquote')) score += 5;
            if (element.querySelector('ul, ol')) score += 3;
            
            // Class and ID bonuses
            const className = element.className || '';
            const id = element.id || '';
            
            if (className.match(/(content|article|post|story|main|entry|blog)/i)) score += 25;
            if (id.match(/(content|article|post|story|main|entry|blog)/i)) score += 25;
            if (className.match(/(body|text|copy)/i)) score += 15;
            if (id.match(/(body|text|copy)/i)) score += 15;
            
            // Negative scoring for likely non-content and ad-related elements
            if (className.match(/(comment|sidebar|widget|footer|header|nav|menu|ads?|banner|promo|sponsor)/i)) score -= 20;
            if (id.match(/(comment|sidebar|widget|footer|header|nav|menu|ads?|banner|promo|sponsor)/i)) score -= 20;
            if (element.querySelectorAll('a').length > element.querySelectorAll('p').length * 2) score -= 10; // Too many links
            
            // Penalize very short content
            if (wordCount < 50) score -= 10;
            
            console.log(`Readability: Element ${index + 1} (${element.tagName}.${className}#${id}): score=${score}, words=${wordCount}, paragraphs=${paragraphs}, images=${imageCount}`);
            
            if (score > bestScore && wordCount > 20) { // Minimum word requirement
                bestScore = score;
                bestElement = element;
            }
        });
        
        console.log(`Readability: Best element found with score: ${bestScore}`);
        
        // Fallback strategy if no good content found
        let content = bestElement;
        if (!content || bestScore < 10) {
            console.log('Readability: No good content found, trying fallback strategies...');
            
            // Try to find main content areas
            content = document.querySelector('main') || 
                     document.querySelector('article') || 
                     document.querySelector('[role="main"]') ||
                     document.querySelector('.content') ||
                     document.querySelector('#content') ||
                     document.querySelector('.post') ||
                     document.querySelector('.entry');
            
            if (!content) {
                console.log('Readability: No semantic content found, using body');
                content = document.body;
            }
        }
        
        // Clean up the selected content while preserving images
        if (content) {
            // Remove any remaining unwanted elements within the content, but preserve images
            const remainingUnwanted = content.querySelectorAll('script, style, noscript');
            remainingUnwanted.forEach(el => el.remove());
            
            // More aggressive ad removal within content - but preserve elements with images
            const potentialAds = content.querySelectorAll('.ad, .ads, .advertisement, .advertising, .banner, .promo, .sponsored, [class*="ad-"], [id*="ad-"], [class*="banner"], [id*="banner"]');
            potentialAds.forEach(el => {
                // Only remove if it doesn't contain images
                if (!el.querySelector('img')) {
                    el.remove();
                }
            });
            
            // Remove video elements that might have been missed
            const videos = content.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="dailymotion"], iframe[src*="twitch"], embed[type*="video"], object[type*="video"]');
            videos.forEach(el => el.remove());
            
            // Handle lazy-loaded images and fix image sources
            const allImages = content.querySelectorAll('img');
            allImages.forEach(img => {
                // Handle various lazy loading attributes
                const dataSrc = img.getAttribute('data-src');
                const dataSrcset = img.getAttribute('data-srcset');
                const dataOriginal = img.getAttribute('data-original');
                const dataLazySrc = img.getAttribute('data-lazy-src');
                const dataActual = img.getAttribute('data-actual');
                
                // Convert lazy-loaded src attributes
                if (!img.src || img.src.includes('data:') || img.src.includes('placeholder') || img.src.includes('blank')) {
                    if (dataSrc) {
                        img.src = dataSrc;
                        console.log('Readability: Converted data-src to src');
                    } else if (dataOriginal) {
                        img.src = dataOriginal;
                        console.log('Readability: Converted data-original to src');
                    } else if (dataLazySrc) {
                        img.src = dataLazySrc;
                        console.log('Readability: Converted data-lazy-src to src');
                    } else if (dataActual) {
                        img.src = dataActual;
                        console.log('Readability: Converted data-actual to src');
                    }
                }
                
                // Handle srcset for responsive images
                if (!img.srcset && dataSrcset) {
                    img.srcset = dataSrcset;
                    console.log('Readability: Converted data-srcset to srcset');
                }
                
                // Convert relative URLs to absolute URLs
                if (img.src && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
                    try {
                        const baseURL = url && url.startsWith('http') ? new URL(url).origin : '';
                        if (baseURL) {
                            if (img.src.startsWith('/')) {
                                img.src = baseURL + img.src;
                            } else if (img.src.startsWith('./')) {
                                img.src = baseURL + '/' + img.src.substring(2);
                            } else if (!img.src.startsWith('../')) {
                                img.src = baseURL + '/' + img.src;
                            }
                            console.log('Readability: Converted relative URL to absolute');
                        }
                    } catch (e) {
                        console.log('Readability: Could not convert relative URL');
                    }
                }
                
                // Remove constraining attributes
                img.removeAttribute('width');
                img.removeAttribute('height');
                img.removeAttribute('style'); // Remove inline styles that might hide images
                
                // Ensure images have alt text for accessibility
                if (!img.alt) {
                    img.alt = 'Image';
                }
                
                // Remove lazy loading classes that might hide images
                const className = img.className || '';
                if (className.includes('lazy') || className.includes('loading')) {
                    img.className = className.replace(/\b(lazy|loading|placeholder)\b/g, '').trim();
                }
            });
            
            console.log(`Readability: Final content length: ${content.innerHTML?.length || 0}`);
            console.log(`Readability: Final content has ${content.querySelectorAll('p').length} paragraphs, ${content.querySelectorAll('img').length} images`);
            console.log(`Readability: Removed ${videos.length} video elements`);
        }
        
        const finalContent = content || document.body;
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Readability Optimized Content</title>
    <style>
        body {
            font-family: Georgia, 'Times New Roman', serif;
            line-height: 1.8;
            max-width: 700px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
            font-size: 18px;
        }
        h1, h2, h3 { color: #2c3e50; margin-top: 2rem; margin-bottom: 1rem; }
        p { margin-bottom: 1.5rem; text-align: justify; }
        img { 
            max-width: 100% !important; 
            height: auto !important; 
            margin: 2rem auto !important; 
            display: block !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 4px;
            opacity: 1 !important;
            visibility: visible !important;
        }
        /* Ensure lazy-loaded images are visible */
        img.lazy, img.loading, img[data-src], img[data-original] {
            opacity: 1 !important;
            visibility: visible !important;
            display: block !important;
        }
        /* Hide any remaining video elements */
        video, iframe[src*="youtube"], iframe[src*="vimeo"], 
        iframe[src*="dailymotion"], iframe[src*="twitch"],
        embed[type*="video"], object[type*="video"] {
            display: none !important;
        }
        /* Hide ad-related elements that might have been missed */
        .ad, .ads, .advertisement, .advertising, .banner, 
        .promo, .sponsored, .popup, .modal {
            display: none !important;
        }
        blockquote { 
            border-left: 4px solid #3498db; 
            padding-left: 1rem; 
            margin: 1.5rem 0; 
            font-style: italic;
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
        }
        ul, ol {
            margin-bottom: 1.5rem;
            padding-left: 2rem;
        }
        li {
            margin-bottom: 0.5rem;
        }
        @media print {
            body { font-size: 14pt; }
            * { color: black !important; }
            img { 
                max-width: 100% !important;
                box-shadow: none !important;
            }
        }
    </style>
</head>
<body>
    ${finalContent.innerHTML}
</body>
</html>`;
    }

    async optimizeWithMozillaReadability(html, url) {
        try {
            console.log('Mozilla Readability: Starting content extraction...');
            
            // Handle both URL and filename cases
            const baseURL = url && url.startsWith('http') ? url : 'http://localhost/';
            const originalDom = new JSDOM(html, { url: baseURL });
            const originalDocument = originalDom.window.document;
            
            console.log(`Mozilla Readability: Document loaded, body length: ${originalDocument.body?.innerHTML?.length || 0}`);
            console.log(`Mozilla Readability: Title: ${originalDocument.title}`);
            
            // Extract all images from the original document before Readability processing
            const originalImages = Array.from(originalDocument.querySelectorAll('img')).map(img => {
                return {
                    src: img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src'),
                    alt: img.alt || '',
                    title: img.title || '',
                    className: img.className || '',
                    width: img.width || '',
                    height: img.height || '',
                    dataSrc: img.getAttribute('data-src'),
                    dataOriginal: img.getAttribute('data-original'),
                    dataLazySrc: img.getAttribute('data-lazy-src'),
                    dataActual: img.getAttribute('data-actual'),
                    srcset: img.srcset || img.getAttribute('data-srcset'),
                    parentText: img.parentElement?.textContent?.substring(0, 100) || ''
                };
            });
            
            console.log(`Mozilla Readability: Found ${originalImages.length} total images in original document`);
            
            // Clone the document for Readability processing
            const dom = new JSDOM(html, { url: baseURL });
            const document = dom.window.document;
            
            // Use Mozilla's Readability library to extract content with enhanced image preservation
            const reader = new Readability(document, {
                debug: false,
                maxElemsToParse: 0, // No limit
                nbTopCandidates: 5,
                charThreshold: 300, // Lower threshold to capture more content
                classesToPreserve: ['img', 'figure', 'picture', 'image', 'photo', 'gallery', 'media'], // More image-related classes
                keepClasses: true // Keep classes that might be important for images
            });
            
            const article = reader.parse();
            
            if (!article) {
                console.log('Mozilla Readability: No article content found, falling back to manual extraction');
                throw new Error('No readable content found');
            }
            
            console.log(`Mozilla Readability: Successfully extracted article`);
            console.log(`Mozilla Readability: Title: ${article.title}`);
            console.log(`Mozilla Readability: Content length: ${article.content?.length || 0}`);
            console.log(`Mozilla Readability: Text length: ${article.textContent?.length || 0}`);
            console.log(`Mozilla Readability: Excerpt: ${article.excerpt?.substring(0, 100)}...`);
            
            // Process the extracted content to enhance images
            const contentDom = new JSDOM(article.content);
            const contentDocument = contentDom.window.document;
            
            // Get images that made it through Readability
            const extractedImages = Array.from(contentDocument.querySelectorAll('img'));
            console.log(`Mozilla Readability: Found ${extractedImages.length} images in extracted content`);
            
            // Process existing images in the extracted content
            extractedImages.forEach((img, index) => {
                console.log(`Mozilla Readability: Processing extracted image ${index + 1}: ${img.src?.substring(0, 50)}...`);
                this.processImageAttributes(img, url);
            });
            
            // Find images that were lost during Readability extraction
            const extractedImageSrcs = new Set(extractedImages.map(img => 
                img.src || img.getAttribute('data-src') || img.getAttribute('data-original')
            ).filter(Boolean));
            
            const missingImages = originalImages.filter(originalImg => {
                const imgSrc = originalImg.src || originalImg.dataSrc || originalImg.dataOriginal;
                return imgSrc && !extractedImageSrcs.has(imgSrc) && 
                       imgSrc.length > 10 && // Filter out tiny/placeholder images
                       !imgSrc.includes('data:image') &&
                       !imgSrc.includes('placeholder') &&
                       !imgSrc.includes('blank.gif') &&
                       !imgSrc.includes('spacer.gif') &&
                       !imgSrc.includes('loading.gif');
            });
            
            console.log(`Mozilla Readability: Found ${missingImages.length} images that were filtered out by Readability`);
            
            // Add missing images back to the content in appropriate locations
            if (missingImages.length > 0) {
                const paragraphs = contentDocument.querySelectorAll('p');
                let imageIndex = 0;
                
                missingImages.forEach((missingImg, index) => {
                    if (imageIndex < paragraphs.length) {
                        const imgElement = contentDocument.createElement('img');
                        imgElement.src = missingImg.src || missingImg.dataSrc || missingImg.dataOriginal;
                        imgElement.alt = missingImg.alt || `Image ${index + 1}`;
                        if (missingImg.title) imgElement.title = missingImg.title;
                        if (missingImg.srcset) imgElement.srcset = missingImg.srcset;
                        
                        // Process the recreated image
                        this.processImageAttributes(imgElement, url);
                        
                        // Create a wrapper div for the image
                        const imageWrapper = contentDocument.createElement('div');
                        imageWrapper.style.cssText = 'margin: 2rem 0; text-align: center;';
                        imageWrapper.appendChild(imgElement);
                        
                        // Insert after every 2-3 paragraphs
                        const targetParagraph = paragraphs[Math.min(imageIndex, paragraphs.length - 1)];
                        if (targetParagraph && targetParagraph.parentNode) {
                            targetParagraph.parentNode.insertBefore(imageWrapper, targetParagraph.nextSibling);
                            imageIndex += 2; // Skip 2 paragraphs for next image
                        }
                        
                        console.log(`Mozilla Readability: Re-added missing image: ${imgElement.src?.substring(0, 50)}...`);
                    }
                });
            }
            
            // Final count of images
            const finalImages = contentDocument.querySelectorAll('img');
            console.log(`Mozilla Readability: Final content has ${finalImages.length} images total`);
            console.log(`Mozilla Readability: Final processed content length: ${contentDocument.body.innerHTML.length}`);
            
            // Create the optimized HTML with enhanced styling
            const optimizedHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${article.title || 'Mozilla Readability Optimized Content'}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Georgia, 'Times New Roman', serif;
            line-height: 1.8;
            max-width: 1000px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
            font-size: 18px;
            background: #fff;
        }
        h1, h2, h3, h4, h5, h6 { 
            color: #2c3e50; 
            margin-top: 2rem; 
            margin-bottom: 1rem;
            line-height: 1.2;
        }
        h1 { font-size: 2.2em; border-bottom: 2px solid #3498db; padding-bottom: 0.5rem; }
        h2 { font-size: 1.8em; color: #34495e; }
        h3 { font-size: 1.4em; }
        p { 
            margin-bottom: 1.5rem; 
            text-align: justify;
            text-indent: 1.5em;
        }
        p:first-of-type { text-indent: 0; }
        img { 
            max-width: 100% !important; 
            height: auto !important; 
            margin: 2rem auto !important; 
            display: block !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 6px;
            opacity: 1 !important;
            visibility: visible !important;
        }
        /* Ensure lazy-loaded images are visible */
        img.lazy, img.loading, img[data-src], img[data-original] {
            opacity: 1 !important;
            visibility: visible !important;
            display: block !important;
        }
        blockquote { 
            border-left: 4px solid #3498db; 
            padding-left: 1.5rem; 
            margin: 2rem 0; 
            font-style: italic;
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 6px;
            color: #555;
        }
        ul, ol {
            margin-bottom: 1.5rem;
            padding-left: 2.5rem;
        }
        li {
            margin-bottom: 0.8rem;
            line-height: 1.6;
        }
        a {
            color: #3498db;
            text-decoration: none;
            border-bottom: 1px dotted #3498db;
        }
        a:hover {
            color: #2980b9;
            border-bottom: 1px solid #2980b9;
        }
        figure {
            margin: 2rem 0;
            text-align: center;
        }
        figcaption {
            font-style: italic;
            color: #666;
            margin-top: 0.5rem;
            font-size: 0.9em;
        }
        .article-meta {
            background: #ecf0f1;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 2rem;
            font-size: 0.9em;
            color: #555;
        }
        @media print {
            body { 
                font-size: 14pt; 
                max-width: none;
                margin: 0;
                padding: 1cm;
            }
            h1 { font-size: 20pt; }
            h2 { font-size: 18pt; }
            h3 { font-size: 16pt; }
            img { 
                max-width: 100% !important;
                box-shadow: none !important;
                page-break-inside: avoid;
            }
            .article-meta { display: none; }
        }
        @media (max-width: 768px) {
            body {
                padding: 1rem;
                font-size: 16px;
            }
            h1 { font-size: 1.8em; }
            h2 { font-size: 1.5em; }
        }
    </style>
</head>
<body>
    ${article.byline ? `<div class="article-meta"><strong>By:</strong> ${article.byline}</div>` : ''}
    ${article.excerpt ? `<div class="article-meta"><strong>Summary:</strong> ${article.excerpt}</div>` : ''}
    <h1>${article.title || 'Optimized Content'}</h1>
    ${contentDocument.body.innerHTML}
</body>
</html>`;
            
            console.log(`Mozilla Readability: Generated optimized HTML, length: ${optimizedHTML.length}`);
            return optimizedHTML;
            
        } catch (error) {
            console.error('Mozilla Readability error:', error.message);
            console.log('Mozilla Readability: Falling back to custom readability method...');
            
            // Fallback to the custom readability method if Mozilla Readability fails
            return await this.optimizeWithReadability(html, url);
        }
    }

    async optimizeWithPuppeteer(url) {
        let browser;
        try {
            console.log('Launching Puppeteer browser...');
            browser = await puppeteer.launch({ 
                headless: 'new',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                timeout: 30000
            });
            
            const page = await browser.newPage();
            
            // Set longer timeout for navigation
            await page.setDefaultNavigationTimeout(30000);
            await page.setDefaultTimeout(30000);
            
            // Set extra headers to avoid blocking
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
            });
            
            console.log(`Navigating to ${url} with Puppeteer...`);
            
            try {
                await page.goto(url, { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
            } catch (navError) {
                console.log('Network idle failed, trying with different wait condition...');
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
            }
            
            console.log('Applying Puppeteer optimizations...');
            
            // First get the original content
            const originalContent = await page.content();
            console.log(`Original content fetched via Puppeteer, length: ${originalContent.length} characters`);
            
            // Remove unwanted elements for optimization
            await page.evaluate(() => {
                const unwantedSelectors = [
                    'script', 'noscript', 'nav', 'header', 'footer', 'aside',
                    '.ad', '.advertisement', '.sidebar', '.popup', '.modal',
                    '[class*="ad"]', '[id*="ad"]', '[class*="banner"]'
                ];
                
                unwantedSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
                
                // Add reading styles
                const style = document.createElement('style');
                style.textContent = `
                    body {
                        font-family: Georgia, serif !important;
                        line-height: 1.7 !important;
                        max-width: 800px !important;
                        margin: 0 auto !important;
                        padding: 2rem !important;
                        background: white !important;
                        color: #333 !important;
                    }
                    img { max-width: 100% !important; height: auto !important; }
                    * { animation: none !important; transition: none !important; }
                `;
                document.head.appendChild(style);
            });
            
            const optimizedContent = await page.content();
            console.log('Puppeteer optimization completed');
            
            return {
                originalContent,
                optimizedContent
            };
            
        } catch (error) {
            console.error('Puppeteer error:', error.message);
            if (error.message.includes('net::ERR_TOO_MANY_REDIRECTS')) {
                throw new Error(`Too many redirects detected when loading ${url}. Try using a different optimization library like Cheerio or Readability.js.`);
            }
            throw new Error(`Puppeteer optimization failed: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async optimizeWithPlaywright(url) {
        let browser;
        try {
            console.log('Launching Playwright browser...');
            browser = await playwright.chromium.launch({
                timeout: 30000,
                args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
            });
            
            const page = await browser.newPage();
            
            // Set longer timeouts
            page.setDefaultNavigationTimeout(30000);
            page.setDefaultTimeout(30000);
            
            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
            });
            
            console.log(`Navigating to ${url} with Playwright...`);
            
            try {
                await page.goto(url, { 
                    waitUntil: 'networkidle',
                    timeout: 30000
                });
            } catch (navError) {
                console.log('Network idle failed, trying with different wait condition...');
                await page.goto(url, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
            }
            
            console.log('Applying Playwright optimizations...');
            
            // First get the original content
            const originalContent = await page.content();
            console.log(`Original content fetched via Playwright, length: ${originalContent.length} characters`);
            
            await page.evaluate(() => {
                // Remove unwanted elements
                const unwantedSelectors = [
                    'script', 'noscript', 'nav', 'header', 'footer', 'aside',
                    '.ad', '.advertisement', '.sidebar', '.popup', '.modal'
                ];
                
                unwantedSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
                
                // Apply reading styles
                document.body.style.cssText = `
                    font-family: 'Times New Roman', serif !important;
                    line-height: 1.6 !important;
                    max-width: 750px !important;
                    margin: 0 auto !important;
                    padding: 2rem !important;
                    background: white !important;
                    color: #222 !important;
                `;
                
                // Style images
                document.querySelectorAll('img').forEach(img => {
                    img.style.cssText = `
                        max-width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        margin: 1.5rem auto !important;
                    `;
                });
            });
            
            const optimizedContent = await page.content();
            console.log('Playwright optimization completed');
            
            return {
                originalContent,
                optimizedContent
            };
            
        } catch (error) {
            console.error('Playwright error:', error.message);
            if (error.message.includes('net::ERR_TOO_MANY_REDIRECTS')) {
                throw new Error(`Too many redirects detected when loading ${url}. Try using a different optimization library like Cheerio or Readability.js.`);
            }
            throw new Error(`Playwright optimization failed: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async optimizeWithPuppeteerContent(htmlContent) {
        let browser;
        try {
            console.log('Launching Puppeteer browser for content optimization...');
            browser = await puppeteer.launch({ 
                headless: 'new',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                timeout: 30000
            });
            
            const page = await browser.newPage();
            
            // Set content directly
            console.log('Setting HTML content...');
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            
            console.log('Applying Puppeteer optimizations to content...');
            
            // Remove unwanted elements for optimization
            await page.evaluate(() => {
                const unwantedSelectors = [
                    'script', 'noscript', 'nav', 'header', 'footer', 'aside',
                    '.ad', '.advertisement', '.sidebar', '.popup', '.modal',
                    '[class*="ad"]', '[id*="ad"]', '[class*="banner"]'
                ];
                
                unwantedSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
                
                // Add reading styles
                const style = document.createElement('style');
                style.textContent = `
                    body {
                        font-family: Georgia, serif !important;
                        line-height: 1.7 !important;
                        max-width: 800px !important;
                        margin: 0 auto !important;
                        padding: 2rem !important;
                        background: white !important;
                        color: #333 !important;
                    }
                    img { max-width: 100% !important; height: auto !important; }
                    * { animation: none !important; transition: none !important; }
                `;
                document.head.appendChild(style);
            });
            
            const optimizedContent = await page.content();
            console.log('Puppeteer content optimization completed');
            
            return optimizedContent;
            
        } catch (error) {
            console.error('Puppeteer content error:', error.message);
            throw new Error(`Puppeteer content optimization failed: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async optimizeWithPlaywrightContent(htmlContent) {
        let browser;
        try {
            console.log('Launching Playwright browser for content optimization...');
            browser = await playwright.chromium.launch({
                timeout: 30000,
                args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
            });
            
            const page = await browser.newPage();
            
            // Set content directly
            console.log('Setting HTML content...');
            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            
            console.log('Applying Playwright optimizations to content...');
            
            await page.evaluate(() => {
                // Remove unwanted elements
                const unwantedSelectors = [
                    'script', 'noscript', 'nav', 'header', 'footer', 'aside',
                    '.ad', '.advertisement', '.sidebar', '.popup', '.modal'
                ];
                
                unwantedSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
                
                // Apply reading styles
                document.body.style.cssText = `
                    font-family: 'Times New Roman', serif !important;
                    line-height: 1.6 !important;
                    max-width: 750px !important;
                    margin: 0 auto !important;
                    padding: 2rem !important;
                    background: white !important;
                    color: #222 !important;
                `;
                
                // Style images
                document.querySelectorAll('img').forEach(img => {
                    img.style.cssText = `
                        max-width: 100% !important;
                        height: auto !important;
                        display: block !important;
                        margin: 1.5rem auto !important;
                    `;
                });
            });
            
            const optimizedContent = await page.content();
            console.log('Playwright content optimization completed');
            
            return optimizedContent;
            
        } catch (error) {
            console.error('Playwright content error:', error.message);
            throw new Error(`Playwright content optimization failed: ${error.message}`);
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    async optimizeWithPrettier(html) {
        try {
            const formatted = await prettier.format(html, {
                parser: 'html',
                printWidth: 100,
                tabWidth: 2,
                useTabs: false,
                singleQuote: true,
                htmlWhitespaceSensitivity: 'ignore'
            });
            
            return this.addReadingStyles(formatted);
        } catch (error) {
            console.warn('Prettier formatting failed, using original HTML');
            return this.addReadingStyles(html);
        }
    }

    async optimizeWithJSBeautify(html) {
        const formatted = beautify.html(html, {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 2,
            preserve_newlines: true,
            keep_array_indentation: false,
            break_chained_methods: false,
            indent_scripts: 'normal',
            brace_style: 'collapse',
            space_before_conditional: true,
            unescape_strings: false,
            jslint_happy: false,
            end_with_newline: true,
            wrap_line_length: 100,
            indent_inner_html: false,
            comma_first: false,
            e4x: false,
            indent_empty_lines: false
        });
        
        return this.addReadingStyles(formatted);
    }

    async optimizeWithDOMParser(html) {
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        // Remove unwanted elements
        const unwantedElements = document.querySelectorAll(
            'script, noscript, style, nav, header, footer, aside, .ad, .advertisement, .sidebar'
        );
        unwantedElements.forEach(el => el.remove());
        
        // Clean attributes
        document.querySelectorAll('*').forEach(element => {
            const allowedAttrs = ['src', 'alt', 'href', 'title'];
            Array.from(element.attributes).forEach(attr => {
                if (!allowedAttrs.includes(attr.name)) {
                    element.removeAttribute(attr.name);
                }
            });
        });
        
        return this.addReadingStyles(document.documentElement.outerHTML);
    }

    addReadingStyles(html) {
        const styledHTML = html.replace(
            /<head>/i,
            `<head>
            <style>
                body {
                    font-family: Georgia, 'Times New Roman', serif;
                    line-height: 1.7;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 2rem;
                    color: #333;
                    background: white;
                    font-size: 16px;
                }
                h1, h2, h3, h4, h5, h6 {
                    color: #2c3e50;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                    font-weight: bold;
                }
                p {
                    margin-bottom: 1.2rem;
                    text-align: justify;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    display: block;
                    margin: 1.5rem auto;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                a {
                    color: #3498db;
                    text-decoration: underline;
                }
                blockquote {
                    border-left: 4px solid #3498db;
                    padding-left: 1rem;
                    margin: 1.5rem 0;
                    font-style: italic;
                    background: #f8f9fa;
                    padding: 1rem;
                }
                @media print {
                    body { font-size: 12pt; color: black; }
                    h1 { font-size: 18pt; }
                    h2 { font-size: 16pt; }
                    h3 { font-size: 14pt; }
                    a { color: black; }
                    img { max-width: 100%; }
                }
            </style>`
        );
        
        return styledHTML;
    }
    
    // Helper method to process image attributes for Mozilla Readability
    processImageAttributes(img, url) {
        // Handle various lazy loading attributes
        const dataSrc = img.getAttribute('data-src');
        const dataSrcset = img.getAttribute('data-srcset');
        const dataOriginal = img.getAttribute('data-original');
        const dataLazySrc = img.getAttribute('data-lazy-src');
        const dataActual = img.getAttribute('data-actual');
        
        // Convert lazy-loaded src attributes
        if (!img.src || img.src.includes('data:') || img.src.includes('placeholder') || img.src.includes('blank')) {
            if (dataSrc) {
                img.src = dataSrc;
                console.log('Mozilla Readability: Converted data-src to src');
            } else if (dataOriginal) {
                img.src = dataOriginal;
                console.log('Mozilla Readability: Converted data-original to src');
            } else if (dataLazySrc) {
                img.src = dataLazySrc;
                console.log('Mozilla Readability: Converted data-lazy-src to src');
            } else if (dataActual) {
                img.src = dataActual;
                console.log('Mozilla Readability: Converted data-actual to src');
            }
        }
        
        // Handle srcset for responsive images
        if (!img.srcset && dataSrcset) {
            img.srcset = dataSrcset;
            console.log('Mozilla Readability: Converted data-srcset to srcset');
        }
        
        // Convert relative URLs to absolute URLs
        if (img.src && !img.src.startsWith('http') && !img.src.startsWith('data:')) {
            try {
                const baseURL = url && url.startsWith('http') ? new URL(url).origin : '';
                if (baseURL) {
                    if (img.src.startsWith('/')) {
                        img.src = baseURL + img.src;
                    } else if (img.src.startsWith('./')) {
                        img.src = baseURL + '/' + img.src.substring(2);
                    } else if (!img.src.startsWith('../')) {
                        img.src = baseURL + '/' + img.src;
                    }
                    console.log('Mozilla Readability: Converted relative URL to absolute');
                }
            } catch (e) {
                console.log('Mozilla Readability: Could not convert relative URL');
            }
        }
        
        // Remove constraining attributes
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.removeAttribute('style'); // Remove inline styles that might hide images
        
        // Ensure images have alt text for accessibility
        if (!img.alt) {
            img.alt = 'Image';
        }
        
        // Remove lazy loading classes that might hide images
        const className = img.className || '';
        if (className.includes('lazy') || className.includes('loading')) {
            img.className = className.replace(/\b(lazy|loading|placeholder)\b/g, '').trim();
        }
    }
}

module.exports = new OptimizationService();
