class HTMLOptimizer {
    constructor() {
        this.urlInput = document.getElementById('url-input');
        this.fileInput = document.getElementById('file-input');
        this.urlInputGroup = document.getElementById('url-input-group');
        this.fileInputGroup = document.getElementById('file-input-group');
        this.inputModeRadios = document.querySelectorAll('input[name="input-mode"]');
        this.fileInputDisplay = document.querySelector('.file-input-display');
        this.fileInputText = document.querySelector('.file-input-text');
        this.fileInfo = document.getElementById('file-info');
        this.librarySelect = document.getElementById('library-select');
        this.optimizeBtn = document.getElementById('optimize-btn');
        this.statusMessage = document.getElementById('status-message');
        this.optimizedFrame = document.getElementById('optimized-frame');
        this.libraryDescription = document.getElementById('library-description');
        
        this.currentData = {
            originalContent: '',
            optimizedContent: '',
            url: '',
            library: '',
            inputMode: 'url',
            fileName: ''
        };
        
        this.initializeEventListeners();
        this.setupLibraryDescriptions();
        this.updateLibraryDescription(); // Show default description for Readability.js
    }

    initializeEventListeners() {
        // Input mode switching
        this.inputModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchInputMode(e.target.value);
            });
        });
        
        // File input handling
        this.fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files[0]);
        });
        
        // File input display click
        this.fileInputDisplay.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // Main optimization button
        this.optimizeBtn.addEventListener('click', () => this.optimizeContent());
        
        // Enter key in URL input
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.optimizeContent();
            }
        });
        
        // Library selection change
        this.librarySelect.addEventListener('change', () => {
            this.updateLibraryDescription();
        });
        
        // Action buttons
        document.getElementById('copy-optimized').addEventListener('click', () => {
            this.copyContent('optimized');
        });
        
        document.getElementById('print-optimized').addEventListener('click', () => {
            this.printContent('optimized');
        });
        
        document.getElementById('download-optimized').addEventListener('click', () => {
            this.downloadContent();
        });
    }

    setupLibraryDescriptions() {
        this.libraryDescriptions = {
            'mozilla-readability': {
                name: 'Mozilla Readability',
                description: 'Official Mozilla Readability.js library used in Firefox Reader Mode. Industry-standard content extraction with enhanced image handling.',
                features: ['Firefox Reader Mode algorithm', 'Official Mozilla library', 'Enhanced image preservation', 'Professional content extraction']
            },
            'readability.js': {
                name: 'Readability.js',
                description: 'Content extraction algorithm similar to Firefox Reader Mode. Scores elements to find the main article content.',
                features: ['Article detection', 'Content scoring', 'Clean layout', 'Reading optimization']
            },
            'cheerio': {
                name: 'Cheerio',
                description: 'Server-side HTML parsing and manipulation. Removes ads, extracts main content, and optimizes for reading with clean typography.',
                features: ['Ad removal', 'Content extraction', 'Typography optimization', 'Image sizing']
            },
            'puppeteer': {
                name: 'Puppeteer',
                description: 'Browser automation with Chrome/Chromium. Renders the page completely and applies optimization styles dynamically.',
                features: ['Full page rendering', 'JavaScript execution', 'Dynamic content', 'Real browser environment']
            },
            'playwright': {
                name: 'Playwright',
                description: 'Cross-browser automation tool. Similar to Puppeteer but supports Chrome, Firefox, and Safari rendering engines.',
                features: ['Multi-browser support', 'Modern web apps', 'Dynamic styling', 'Enhanced compatibility']
            },
            'prettier': {
                name: 'Prettier',
                description: 'Code formatter that beautifies HTML structure while adding reading-optimized styles and print-friendly layout.',
                features: ['Code formatting', 'HTML beautification', 'Consistent structure', 'Print optimization']
            },
            'js-beautify': {
                name: 'JS-Beautify',
                description: 'HTML beautifier that formats code structure and applies reading-friendly styles with proper indentation.',
                features: ['HTML formatting', 'Code indentation', 'Structure cleanup', 'Style enhancement']
            },
            'domparser': {
                name: 'DOMParser & Web APIs',
                description: 'Native browser APIs for parsing and manipulating HTML. Lightweight approach with basic content cleaning.',
                features: ['Native web APIs', 'Lightweight processing', 'Attribute cleaning', 'Basic optimization']
            }
        };
    }

    updateLibraryDescription() {
        const selectedLibrary = this.librarySelect.value;
        
        if (!selectedLibrary) {
            this.libraryDescription.innerHTML = '<p>Select a library above to see optimized content</p>';
            return;
        }
        
        const desc = this.libraryDescriptions[selectedLibrary];
        if (desc) {
            this.libraryDescription.innerHTML = `
                <p><strong>${desc.name}</strong> - ${desc.description}</p>
                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                    ${desc.features.map(feature => `<li>${feature}</li>`).join('')}
                </ul>
            `;
        }
    }

    switchInputMode(mode) {
        this.currentData.inputMode = mode;
        
        if (mode === 'url') {
            this.urlInputGroup.style.display = 'block';
            this.fileInputGroup.style.display = 'none';
            this.urlInput.required = true;
            this.fileInput.required = false;
        } else {
            this.urlInputGroup.style.display = 'none';
            this.fileInputGroup.style.display = 'block';
            this.urlInput.required = false;
            this.fileInput.required = true;
        }
        
        // Clear previous content
        this.clearContent();
    }

    handleFileSelection(file) {
        if (!file) {
            this.fileInputText.textContent = 'Choose HTML file...';
            this.fileInfo.style.display = 'none';
            this.currentData.fileName = '';
            return;
        }
        
        // Validate file type
        const validTypes = ['text/html', 'application/xhtml+xml', 'text/plain'];
        const validExtensions = ['.html', '.htm', '.xhtml'];
        const hasValidExtension = validExtensions.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );
        
        if (!validTypes.includes(file.type) && !hasValidExtension) {
            this.showStatus('Please select a valid HTML file (.html, .htm, .xhtml)', 'error');
            this.fileInput.value = '';
            return;
        }
        
        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showStatus('File size too large. Please select a file smaller than 10MB.', 'error');
            this.fileInput.value = '';
            return;
        }
        
        // Update UI
        this.fileInputText.textContent = file.name;
        this.currentData.fileName = file.name;
        
        // Show file info
        const fileSize = this.formatFileSize(file.size);
        this.fileInfo.querySelector('.file-name').textContent = file.name;
        this.fileInfo.querySelector('.file-size').textContent = fileSize;
        this.fileInfo.style.display = 'block';
        
        this.showStatus(`File "${file.name}" selected successfully`, 'success');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file, 'UTF-8');
        });
    }

    clearContent() {
        this.optimizedFrame.src = '';
        this.currentData.originalContent = '';
        this.currentData.optimizedContent = '';
        this.showStatus('', '');
    }

    async optimizeContent() {
        const library = this.librarySelect.value;
        
        // Validation
        if (!library) {
            this.showStatus('Please select an optimization library', 'error');
            return;
        }
        
        let requestData;
        let url;
        
        if (this.currentData.inputMode === 'url') {
            url = this.urlInput.value.trim();
            
            if (!url) {
                this.showStatus('Please enter a valid URL', 'error');
                return;
            }
            
            // Validate URL format
            try {
                new URL(url);
            } catch (e) {
                this.showStatus('Please enter a valid URL (include http:// or https://)', 'error');
                return;
            }
            
            requestData = { url, library };
            
        } else {
            // File mode
            const file = this.fileInput.files[0];
            
            if (!file) {
                this.showStatus('Please select an HTML file', 'error');
                return;
            }
            
            // Read file content
            try {
                const fileContent = await this.readFileContent(file);
                requestData = { 
                    htmlContent: fileContent,
                    library,
                    fileName: file.name 
                };
                url = `Local file: ${file.name}`;
            } catch (error) {
                this.showStatus(`Error reading file: ${error.message}`, 'error');
                return;
            }
        }
        
        // Start optimization process
        this.setLoadingState(true);
        this.showStatus(`Optimizing ${url} with ${library}...`, 'info');
        
        try {
            const endpoint = this.currentData.inputMode === 'url' ? '/api/optimize' : '/api/optimize-file';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Optimization failed');
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.currentData = {
                    originalContent: data.originalContent,
                    optimizedContent: data.optimizedContent,
                    url: data.url,
                    library: data.library
                };
                
                this.displayContent();
                this.showStatus(`Successfully optimized with ${library}`, 'success');
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
            
        } catch (error) {
            console.error('Optimization error:', error);
            let errorMessage = error.message;
            
            // Provide helpful suggestions based on error type
            if (error.message.includes('redirect')) {
                errorMessage += '\n\n💡 Suggestion: Try using Cheerio or Readability.js libraries which handle redirects better, or check if the URL redirects to a different domain.';
            } else if (error.message.includes('timeout')) {
                errorMessage += '\n\n💡 Suggestion: The website might be slow. Try again or use a faster loading website for testing.';
            } else if (error.message.includes('Cannot reach')) {
                errorMessage += '\n\n💡 Suggestion: Please verify the URL is correct and the website is online.';
            }
            
            this.showStatus(`Error: ${errorMessage}`, 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    displayContent() {
        // Display optimized content only
        const optimizedDoc = this.optimizedFrame.contentDocument || this.optimizedFrame.contentWindow.document;
        optimizedDoc.open();
        optimizedDoc.write(this.currentData.optimizedContent);
        optimizedDoc.close();
        
        // Update library description if not already shown
        if (this.librarySelect.value) {
            this.updateLibraryDescription();
        }
    }

    setLoadingState(loading) {
        const btnText = this.optimizeBtn.querySelector('.btn-text');
        const btnLoader = this.optimizeBtn.querySelector('.btn-loader');
        
        if (loading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'flex';
            this.optimizeBtn.disabled = true;
            
            // Add loading class to frame
            this.optimizedFrame.classList.add('loading');
        } else {
            btnText.style.display = 'block';
            btnLoader.style.display = 'none';
            this.optimizeBtn.disabled = false;
            
            // Remove loading class
            this.optimizedFrame.classList.remove('loading');
        }
    }

    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';
        
        // Auto-hide success and info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                this.statusMessage.style.display = 'none';
            }, 5000);
        }
    }

    async copyContent(type) {
        const content = this.currentData.optimizedContent;
        
        if (!content) {
            this.showStatus('No content to copy', 'error');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(content);
            this.showStatus('Optimized content copied to clipboard', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showStatus('Failed to copy content', 'error');
        }
    }

    printContent(type) {
        const frame = this.optimizedFrame;
        
        if (!frame.contentWindow) {
            this.showStatus('No content to print', 'error');
            return;
        }
        
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } catch (error) {
            console.error('Print failed:', error);
            this.showStatus('Failed to print content', 'error');
        }
    }

    downloadContent() {
        if (!this.currentData.optimizedContent) {
            this.showStatus('No optimized content to download', 'error');
            return;
        }
        
        try {
            const blob = new Blob([this.currentData.optimizedContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            // Generate filename from URL
            const urlObj = new URL(this.currentData.url);
            const filename = `optimized-${urlObj.hostname}-${this.currentData.library}-${Date.now()}.html`;
            
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus('Optimized content downloaded', 'success');
        } catch (error) {
            console.error('Download failed:', error);
            this.showStatus('Failed to download content', 'error');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HTMLOptimizer();
    
    // Add some reliable test URLs
    const testUrls = [
        'http://localhost:3001/api/test-content',
        'http://localhost:3001/test.html',
        'https://httpbin.org/html',
        'https://example.com',
        'https://www.w3.org/TR/html52/'
    ];
    
    // Add placeholder with examples
    const urlInput = document.getElementById('url-input');
    urlInput.placeholder = 'https://example.com (try the test URLs below)';
    
    // Add quick test buttons
    const urlSection = document.querySelector('.url-input-section');
    const quickTestDiv = document.createElement('div');
    quickTestDiv.className = 'quick-test-section';
    quickTestDiv.innerHTML = `
        <label>Quick Test URLs:</label>
        <div class="quick-test-buttons">
            ${testUrls.map(url => `
                <button type="button" class="quick-test-btn" data-url="${url}">
                    ${url.includes('test-content') ? 'Rich Test Content' :
                      url.includes('localhost') ? 'Local Test' : 
                      url.includes('httpbin') ? 'HTTP Test' :
                      url.includes('example.com') ? 'Example.com' :
                      url.includes('w3.org') ? 'W3C Docs' : 'Other Test'}
                </button>
            `).join('')}
        </div>
    `;
    
    urlSection.appendChild(quickTestDiv);
    
    // Add event listeners for quick test buttons
    document.querySelectorAll('.quick-test-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            document.getElementById('url-input').value = url;
        });
    });
    
    console.log('HTML Optimization Tool initialized');
    console.log('Supported libraries:', [
        'Cheerio', 'Readability.js', 'Puppeteer', 
        'Playwright', 'Prettier', 'JS-Beautify', 'DOMParser'
    ]);
    console.log('Quick test URLs available:', testUrls);
});
