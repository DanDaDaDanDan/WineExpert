// Import all modules
import { AIModels } from './models.js';
import { ChatManager } from './chat.js';
import { DebugManager } from './debug.js';
import { SettingsManager } from './settings.js';

window.wineExpertApp = function() {
    const app = {
        // View state
        currentView: 'chat',
        processing: false,
        imageUploaded: false,
        
        // Provider settings
        selectedProvider: localStorage.getItem('selected_provider') || 'openai',
        
        // OpenAI settings
        openaiKey: localStorage.getItem('openai_api_key') || '',
        openaiModel: localStorage.getItem('openai_model') || 'gpt-4o',
        
        
        // Google settings
        googleKey: localStorage.getItem('google_api_key') || '',
        googleModel: localStorage.getItem('google_model') || 'gemini-2.5-flash-preview-05-20',
        
        // xAI settings
        xaiKey: localStorage.getItem('xai_api_key') || '',
        xaiModel: localStorage.getItem('xai_model') || 'grok-3',
        
        // DeepSeek settings
        deepseekKey: localStorage.getItem('deepseek_api_key') || '',
        deepseekModel: localStorage.getItem('deepseek_model') || 'deepseek-vl2',
        
        // Temperature settings
        temperature: parseFloat(localStorage.getItem('temperature') || '0.8'),
        
        // Debug settings
        debugEnabled: localStorage.getItem('debug_enabled') === 'true' || localStorage.getItem('debug_enabled') === null,
        debugLog: [],
        debugPrettyMode: localStorage.getItem('debug_pretty_mode') !== 'false', // Default to true
        mobileDebugEnabled: localStorage.getItem('mobile_debug_enabled') === 'true', // Default to false
        
        // Models that don't support temperature (reasoning models)
        reasoningModels: [
            'o1', 'o1-pro', 'o3', 'o3-mini', 'o4-mini',  // OpenAI reasoning models
            'gemini-2.0-flash-thinking-exp-1219', 'gemini-2.0-flash-thinking-exp-01-21', // Google thinking models
            'deepseek-reasoner' // DeepSeek reasoning model
        ],
        
        // Check if current model supports temperature
        get supportsTemperature() {
            const model = this.selectedModel;
            // Check if it's a reasoning model
            return !this.reasoningModels.some(rm => model.includes(rm));
        },
        
        // Get effective temperature (1.0 for reasoning models)
        get effectiveTemperature() {
            return this.supportsTemperature ? this.temperature : 1.0;
        },
        
        // Get current API key based on provider
        get apiKey() {
            switch(this.selectedProvider) {
                case 'openai': return this.openaiKey;
                case 'google': return this.googleKey;
                case 'xai': return this.xaiKey;
                case 'deepseek': return this.deepseekKey;
                default: return '';
            }
        },
        
        // Get current model based on provider
        get selectedModel() {
            switch(this.selectedProvider) {
                case 'openai': return this.openaiModel;
                case 'google': return this.googleModel;
                case 'xai': return this.xaiModel;
                case 'deepseek': return this.deepseekModel;
                default: return '';
            }
        },
        
        // Chat state
        messages: [],
        currentInput: '',
        currentWineList: null, // Store the researched wine list (for display and chat context)
        extractedWineList: null, // Store the raw extracted wine list (for research input only)
        
        async init() {
            // Ensure arrays are properly initialized
            if (!Array.isArray(this.debugLog)) {
                console.log('Initializing debugLog as empty array');
                this.debugLog = [];
            }
            if (!Array.isArray(this.messages)) {
                console.log('Initializing messages as empty array');
                this.messages = [];
            }
            
            // Initialize managers with the Alpine.js reactive proxy (this)
            this.aiModels = new AIModels(this);
            this.chatManager = new ChatManager(this);
            this.debugManager = new DebugManager(this);
            this.settingsManager = new SettingsManager(this);
            
            // Add welcome message if no API key is set
            if (!this.apiKey) {
                // Ensure messages is an array before pushing
                if (!Array.isArray(this.messages)) {
                    this.messages = [];
                }
                this.messages.push({
                    sender: 'Wine Expert',
                    content: '🍷 **Welcome to Wine Expert!**\n\nTo get started:\n1. Go to **Settings** and add your AI API key\n2. Return to **Chat** and upload a wine image\n3. Ask me anything about your wines!\n\nI can analyze wine lists, menus, and bottle photos.',
                    type: 'npc-left'
                });
            }
            
            // Bind methods to this Alpine instance
            // Chat methods
            this.getMessageClass = (message) => this.chatManager.getMessageClass(message);
            this.sendMessage = () => this.chatManager.sendMessage();
            this.handleInputKeydown = (event) => this.chatManager.handleInputKeydown(event);
            
            // Debug methods
            this.logDebug = (type, provider, model, data) => this.debugManager.logDebug(type, provider, model, data);
            this.formatDebugJSON = (obj) => this.debugManager.formatDebugJSON(obj);
            
            // Settings methods
            this.saveSettings = () => this.settingsManager.saveSettings();
            
            // Debug log function for mobile
            this.debugLog = (message) => {
                console.log(message);
                // Also show debug messages in chat for mobile debugging (when enabled)
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile && this.mobileDebugEnabled) {
                    // Ensure messages is an array before pushing
                    if (!Array.isArray(this.messages)) {
                        this.messages = [];
                    }
                    this.messages.push({
                        sender: 'Debug',
                        content: `🔧 ${message}`,
                        type: 'system'
                    });
                }
            };

            // Upload button click handler
            this.handleUploadClick = (event) => {
                console.log('Upload button clicked:', event.type);
                console.log('API Key available:', !!this.apiKey);
                console.log('Processing:', this.processing);
                
                // Prevent if disabled
                if (!this.apiKey || this.processing) {
                    if (!this.apiKey) {
                        // Ensure messages is an array before pushing
                        if (!Array.isArray(this.messages)) {
                            this.messages = [];
                        }
                        // Show clear error message for missing API key
                        this.messages.push({
                            sender: 'System',
                            content: '⚠️ **API Key Required**\n\nPlease set your API key in the Settings tab before uploading images.',
                            type: 'system'
                        });
                        console.log('Upload prevented - no API key');
                    } else {
                        console.log('Upload prevented - processing in progress');
                    }
                    event.preventDefault();
                    return false;
                }
                
                // Prevent double-triggering from both click and touchend
                if (event.type === 'touchend') {
                    event.preventDefault();
                }
                
                // Trigger the file input
                const fileInput = this.$refs.imageInput;
                if (fileInput) {
                    console.log('Triggering file input click');
                    console.log('User agent:', navigator.userAgent.substring(0, 50));
                    
                    // Reset the input value to ensure change event fires even for same file
                    fileInput.value = '';
                    
                    // For mobile browsers, try multiple approaches
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    
                    if (isMobile) {
                        console.log('Mobile browser detected, using mobile-specific approach');
                        
                        // Create a temporary file input for mobile
                        const tempInput = document.createElement('input');
                        tempInput.type = 'file';
                        tempInput.accept = 'image/*';
                        tempInput.style.position = 'absolute';
                        tempInput.style.left = '-9999px';
                        
                        tempInput.onchange = (e) => {
                            console.log('Temp input change triggered');
                            this.handleImageUpload(e);
                            document.body.removeChild(tempInput);
                        };
                        
                        document.body.appendChild(tempInput);
                        console.log('About to trigger temp input click');
                        tempInput.click();
                        console.log('Temp input click triggered');
                    } else {
                        // Desktop approach
                        try {
                            fileInput.click();
                            console.log('Desktop file input click successful');
                        } catch (error) {
                            console.log('Error triggering file input click:', error.message);
                            // Fallback: try dispatching a click event
                            const clickEvent = new MouseEvent('click', {
                                view: window,
                                bubbles: true,
                                cancelable: true
                            });
                            fileInput.dispatchEvent(clickEvent);
                            console.log('Fallback click event dispatched');
                        }
                    }
                } else {
                    console.log('File input not found');
                }
                
                if (event.type !== 'touchend') {
                    event.preventDefault();
                }
                return false;
            };
            
            // Image handling methods
            this.handleImageUpload = async (event) => {
                console.log('handleImageUpload triggered');
                console.log('Files count:', event.target.files ? event.target.files.length : 0);
                
                const file = event.target.files[0];
                if (!file) {
                    console.log('No file selected');
                    // No file selected, don't set processing flag
                    return;
                }
                if (file.type.startsWith('image/')) {
                    console.log('Image upload started:', file.name, '(' + file.size + ' bytes)');
                    
                    // Set processing flag immediately to disable chat input
                    this.processing = true;
                    
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        try {
                            const imageDataUrl = e.target.result;
                            console.log('Image converted to data URL, length:', imageDataUrl.length);
                            
                            // Add a message showing the image was uploaded
                            this.messages.push({
                                sender: 'User',
                                content: 'Uploaded wine image for analysis',
                                type: 'user',
                                image: imageDataUrl
                            });
                            
                            // Set flag to indicate image has been uploaded
                            this.imageUploaded = true;
                            
                            // Immediately process with AI
                            await this.chatManager.processWithAI('Analyze this wine image', true, imageDataUrl);
                            
                            // Clear the file input
                            if (this.$refs.imageInput) {
                                this.$refs.imageInput.value = '';
                            }
                        } catch (error) {
                            console.error('Error processing uploaded image:', error);
                            this.messages.push({
                                sender: 'System',
                                content: `Error processing image: ${error.message}`,
                                type: 'system'
                            });
                            // Reset processing flag on error
                            this.processing = false;
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    console.warn('Invalid file type selected:', file?.type);
                    // Reset processing flag if invalid file type
                    this.processing = false;
                }
            };
            
            // Auto-scroll chat
            this.$watch('messages', () => {
                this.$nextTick(() => {
                    if (this.$refs.chatMessages) {
                        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
                    }
                });
            });
            
            // Also scroll when processing state changes
            this.$watch('processing', () => {
                this.$nextTick(() => {
                    if (this.$refs.chatMessages) {
                        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
                    }
                });
            });
            
            
            // Wine pricing utilities
            this.calculateMarkup = (menuPrice, retailPrice) => {
                if (!menuPrice || !retailPrice) return 'N/A';
                
                // Extract numeric values from price strings
                const extractPrice = (priceStr) => {
                    if (typeof priceStr !== 'string') return null;
                    const match = priceStr.match(/[\d,]+\.?\d*/);
                    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
                };
                
                const menu = extractPrice(menuPrice);
                const retail = extractPrice(retailPrice);
                
                if (!menu || !retail || retail === 0) return 'N/A';
                
                const markup = ((menu - retail) / retail) * 100;
                return markup > 0 ? `+${markup.toFixed(0)}%` : `${markup.toFixed(0)}%`;
            };

            // Wine analytics generator
            this.generateWineAnalytics = () => {
                console.log('generateWineAnalytics called');
                console.log('currentWineList:', this.currentWineList);
                if (!this.currentWineList?.wines?.length) {
                    console.log('No wines found for analytics');
                    return null;
                }

                const wines = this.currentWineList.wines;
                console.log('Sample wine for analytics:', wines[0]);
                const extractPrice = (priceStr) => {
                    if (typeof priceStr !== 'string') return null;
                    const match = priceStr.match(/[\d,]+\.?\d*/);
                    return match ? parseFloat(match[0].replace(/,/g, '')) : null;
                };

                // Calculate markups for wines with both prices
                const winesWithMarkup = wines.filter(wine => {
                    const menu = extractPrice(wine.menu_price);
                    const retail = extractPrice(wine.retail_price);
                    console.log(`Wine: ${wine.name}, menu: ${wine.menu_price} (${menu}), retail: ${wine.retail_price} (${retail})`);
                    return menu && retail && retail > 0;
                }).map(wine => {
                    const menu = extractPrice(wine.menu_price);
                    const retail = extractPrice(wine.retail_price);
                    const markup = ((menu - retail) / retail) * 100;
                    return { ...wine, markupPercent: markup };
                });
                
                console.log('Wines with markup:', winesWithMarkup.length);

                // Median markup
                let medianMarkup = null;
                if (winesWithMarkup.length > 0) {
                    const markups = winesWithMarkup.map(w => w.markupPercent).sort((a, b) => a - b);
                    const mid = Math.floor(markups.length / 2);
                    medianMarkup = markups.length % 2 === 0 
                        ? (markups[mid - 1] + markups[mid]) / 2 
                        : markups[mid];
                }

                // Best value by wine type (lowest markup)
                const wineTypes = ['red', 'white', 'rosé', 'sparkling', 'dessert'];
                const bestValueByType = {};
                
                wineTypes.forEach(type => {
                    const typeWines = winesWithMarkup.filter(wine => 
                        wine.wine_type && wine.wine_type.toLowerCase().includes(type.toLowerCase())
                    );
                    if (typeWines.length > 0) {
                        bestValueByType[type] = typeWines.reduce((best, current) => 
                            current.markupPercent < best.markupPercent ? current : best
                        );
                    }
                });

                // Highest rated wine
                let highestRated = null;
                const winesWithRatings = wines.filter(wine => wine.ratings?.vivino);
                if (winesWithRatings.length > 0) {
                    highestRated = winesWithRatings.reduce((best, current) => {
                        const currentRating = parseFloat(current.ratings.vivino.match(/[\d.]+/)?.[0] || 0);
                        const bestRating = parseFloat(best.ratings.vivino.match(/[\d.]+/)?.[0] || 0);
                        return currentRating > bestRating ? current : best;
                    });
                }

                const result = {
                    medianMarkup,
                    bestValueByType,
                    highestRated,
                    totalWines: wines.length,
                    winesWithPricing: winesWithMarkup.length
                };
                console.log('Analytics result:', result);
                return result;
            };
            
            // Utility methods
            this.copyToClipboard = async (text) => {
                try {
                    await navigator.clipboard.writeText(text);
                    // Show brief success feedback
                    const originalText = event.target.textContent;
                    event.target.textContent = '✓';
                    event.target.style.color = 'var(--secondary-color)';
                    setTimeout(() => {
                        event.target.textContent = originalText;
                        event.target.style.color = '';
                    }, 1000);
                } catch (err) {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        console.log('Text copied to clipboard using fallback method');
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                    }
                    document.body.removeChild(textArea);
                }
            };
        }
    };
    
    return app;
};

// Dynamically load Alpine.js after wineExpertApp is defined
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js';
script.defer = true;
document.head.appendChild(script);