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
            // Initialize managers with the Alpine.js reactive proxy (this)
            this.aiModels = new AIModels(this);
            this.chatManager = new ChatManager(this);
            this.debugManager = new DebugManager(this);
            this.settingsManager = new SettingsManager(this);
            
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
            
            // Upload button click handler
            this.handleUploadClick = (event) => {
                console.log('Upload button clicked:', event);
                console.log('API Key available:', !!this.apiKey);
                console.log('Processing:', this.processing);
                console.log('Touch event:', event.type);
                
                // Prevent if disabled
                if (!this.apiKey || this.processing) {
                    console.log('Upload prevented - no API key or processing');
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
                    console.log('File input element:', fileInput);
                    console.log('User agent:', navigator.userAgent);
                    
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
                        tempInput.click();
                    } else {
                        // Desktop approach
                        try {
                            fileInput.click();
                        } catch (error) {
                            console.error('Error triggering file input click:', error);
                            // Fallback: try dispatching a click event
                            const clickEvent = new MouseEvent('click', {
                                view: window,
                                bubbles: true,
                                cancelable: true
                            });
                            fileInput.dispatchEvent(clickEvent);
                        }
                    }
                } else {
                    console.error('File input not found');
                }
                
                if (event.type !== 'touchend') {
                    event.preventDefault();
                }
                return false;
            };
            
            // Image handling methods
            this.handleImageUpload = async (event) => {
                console.log('handleImageUpload triggered:', event);
                console.log('Files:', event.target.files);
                console.log('File input value:', event.target.value);
                
                const file = event.target.files[0];
                if (!file) {
                    console.log('No file selected');
                    // No file selected, don't set processing flag
                    return;
                }
                if (file.type.startsWith('image/')) {
                    console.log('Image upload started:', {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type
                    });
                    
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