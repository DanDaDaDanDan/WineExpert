// Chat and messaging functionality
export class ChatManager {
    constructor(app) {
        this.app = app;
    }

    // Message handling
    getMessageClass(message) {
        if (message.type === 'system') return 'message-center';
        if (message.sender === 'User') return 'message-center user-input';
        if (message.type === 'npc-left') return 'message-left';
        if (message.type === 'npc-right') return 'message-right';
        return 'message-left';
    }
    
    async sendMessage() {
        if (!this.app.currentInput.trim() || !this.app.apiKey || this.app.processing || !this.app.imageUploaded) return;
        
        const userMessage = this.app.currentInput.trim();
        this.app.currentInput = '';
        
        console.log('Sending text message:', userMessage);
        
        // Add user message
        this.app.messages.push({
            sender: 'User',
            content: userMessage,
            type: 'user'
        });
        
        // Process with AI
        await this.processWithAI(userMessage, false);
    }
    
    
    async processWithAI(userInput, hasImage, imageDataUrl = null) {
        this.app.processing = true;
        
        const processingStartTime = Date.now();
        
        try {
            // Comprehensive logging
            console.log('=== AI Processing Started ===');
            console.log('Provider:', this.app.selectedProvider);
            console.log('Model:', this.app.selectedModel);
            console.log('User input:', userInput);
            console.log('Has image:', hasImage);
            console.log('Image data length:', imageDataUrl ? imageDataUrl.length : 'N/A');
            console.log('Processing start time:', new Date().toISOString());
            
            let response;
            
            if (hasImage && imageDataUrl) {
                // Use selected provider's Vision API for image analysis
                const winePrompt = `WINE MENU ANALYSIS: Analyze this wine menu/list image and extract detailed information for each wine.

TASK: For each wine shown, extract pricing and derive wine characteristics from visual context, wine names, and menu organization.

ANALYSIS GUIDELINES:
- Extract wine names exactly as shown
- Capture glass and bottle prices separately if visible
- Determine wine type (red, white, rosé, sparkling, dessert) from:
  * Menu section headings
  * Wine names (e.g., "Chianti" = red, "Sauvignon Blanc" = white)
  * Visual context clues
  * Typical wine knowledge
- Infer region/style from wine names when obvious
- Extract vintage years from wine names
- Note producer/winery names when visible

RESPONSE FORMAT: Return valid JSON with this structure:
{
  "wines": [
    {
      "name": "full wine text exactly as shown",
      "glass_price": "$XX or null",
      "bottle_price": "$XX or null", 
      "wine_type": "red/white/rosé/sparkling/dessert",
      "producer": "winery name if identifiable",
      "vintage": "year if shown",
      "region": "wine region if obvious from name",
      "style": "wine style if identifiable (e.g., Chianti, Bordeaux blend)"
    }
  ]
}`;

                console.log('Calling vision API for provider:', this.app.selectedProvider);
                
                try {
                    switch(this.app.selectedProvider) {
                        case 'google':
                            console.log('Using Google Vision API');
                            response = await this.app.aiModels.callGoogleVisionAPI(
                                winePrompt,
                                imageDataUrl
                            );
                            break;
                        case 'xai':
                            console.log('Using xAI Vision API');
                            response = await this.app.aiModels.callXAIVisionAPI(
                                winePrompt,
                                imageDataUrl
                            );
                            break;
                        case 'deepseek':
                            console.log('Using DeepSeek Vision API');
                            response = await this.app.aiModels.callDeepSeekVisionAPI(
                                winePrompt,
                                imageDataUrl
                            );
                            break;
                        default: // OpenAI
                            console.log('Using OpenAI Vision API');
                            response = await this.app.aiModels.callOpenAIVisionAPI(
                                winePrompt,
                                imageDataUrl
                            );
                    }
                    console.log('Vision API response received:', response);
                } catch (visionError) {
                    console.error(`Vision API failed for ${this.app.selectedProvider}:`, visionError);
                    console.error('Vision error stack:', visionError.stack);
                    
                    // Log the error to debug system
                    this.app.logDebug('error', this.app.selectedProvider, this.app.selectedModel, {
                        error: visionError.message,
                        stack: visionError.stack,
                        userInput: userInput,
                        hasImage: hasImage,
                        duration: Date.now() - processingStartTime
                    });
                    
                    // Fallback to text-only response
                    this.app.messages.push({
                        sender: 'Wine Expert',
                        content: `Image analysis failed for ${this.app.selectedProvider}: ${visionError.message}. Please try uploading the image again or switch to OpenAI which has reliable vision support.`,
                        type: 'npc-left'
                    });
                    return;
                }
            } else {
                // Regular text processing using selected provider
                let systemPrompt = `You are a wine expert assistant. Help the user with their wine-related questions.

IMPORTANT: Always respond with valid JSON in this format:
{
  "message": "your detailed response here"
}`;
                
                // Include wine list context if available
                if (this.app.currentWineList && this.app.currentWineList.wines && this.app.currentWineList.wines.length > 0) {
                    const wineContext = JSON.stringify(this.app.currentWineList, null, 2);
                    console.log('=== Wine Context Being Passed to LLM ===');
                    console.log('Wine count:', this.app.currentWineList.wines.length);
                    console.log('Context length:', wineContext.length);
                    console.log('Wine context:', wineContext);
                    console.log('=== End Wine Context ===');
                    
                    // Check what data is actually available
                    const contextSummary = this.app.currentWineList.wines.map((wine, index) => {
                        return `Wine ${index + 1}: ${wine.name} - Menu: ${wine.menu_price || 'N/A'}, Retail: ${wine.retail_price || 'N/A'}, Ratings: ${wine.ratings ? 'Yes' : 'No'}, Notes: ${wine.tasting_notes ? 'Yes' : 'No'}`;
                    }).join('\n');
                    console.log('Context summary:', contextSummary);
                    
                    systemPrompt += "\n\nCurrent wine list context (includes menu prices, retail prices, ratings, tasting notes, food pairings, producer, vintage, region, varietal, and sources):\n" + wineContext;
                } else {
                    console.log('No wine context available for chat query');
                }
                
                // Build conversation history from messages
                const conversationHistory = this.buildConversationHistory();
                console.log('=== Conversation History ===');
                console.log('Message count:', conversationHistory.length);
                console.log('History:', conversationHistory);
                
                switch(this.app.selectedProvider) {
                    case 'google':
                        response = await this.app.aiModels.callGoogleAPIWithHistory(systemPrompt, userInput || "Hello", conversationHistory);
                        break;
                    case 'xai':
                        response = await this.app.aiModels.callXAIAPIWithHistory(systemPrompt, userInput || "Hello", conversationHistory);
                        break;
                    case 'deepseek':
                        response = await this.app.aiModels.callDeepSeekAPIWithHistory(systemPrompt, userInput || "Hello", conversationHistory);
                        break;
                    default: // OpenAI
                        response = await this.app.aiModels.callOpenAIAPIWithHistory(systemPrompt, userInput || "Hello", conversationHistory);
                }
            }
            
            // Format and display response
            if (response.wines) {
                if (hasImage) {
                    // For images: Store extracted data and do research
                    const extractedWines = this.processExtractedWineData(response.wines);
                    
                    this.app.messages.push({
                        sender: 'System',
                        content: `🍷 Found ${extractedWines.length} wines! Researching detailed information...`,
                        type: 'system'
                    });
                    
                    // Store extracted data for research use only
                    this.app.extractedWineList = { wines: extractedWines };
                    
                    // Clear current wine list during processing
                    this.app.currentWineList = null;
                    
                    // Do complete research - this will set currentWineList
                    await this.processWinesInBatches(extractedWines);
                    
                    // Only show results after everything is complete
                    this.formatWineResponse(this.app.currentWineList);
                } else {
                    // For text queries: this shouldn't happen as we don't do wine extraction from text
                    this.app.messages.push({
                        sender: 'Wine Expert',
                        content: response.message || 'I can help you with questions about wines, but I need an image to analyze wines.',
                        type: 'npc-left'
                    });
                }
            } else if (response.error) {
                // Handle structured error response
                let errorMessage = `Error: ${response.error}`;
                if (response.originalError) {
                    errorMessage += `\nOriginal error: ${response.originalError}`;
                }
                if (response.rawResponse) {
                    errorMessage += `\nRaw response: ${response.rawResponse}`;
                }
                
                this.app.messages.push({
                    sender: 'Wine Expert',
                    content: errorMessage,
                    type: 'npc-left'
                });
                
                // Also log to debug system
                this.app.logDebug('error', this.app.selectedProvider, this.app.selectedModel, {
                    parseError: response.error,
                    originalError: response.originalError,
                    rawResponse: response.rawResponse,
                    userInput: userInput,
                    hasImage: hasImage,
                    timestamp: new Date().toISOString()
                });
            } else {
                // Handle structured chat response
                this.app.messages.push({
                    sender: 'Wine Expert',
                    content: response.message || JSON.stringify(response, null, 2),
                    type: 'npc-left'
                });
            }
            
            
        } catch (error) {
            const processingDuration = Date.now() - processingStartTime;
            
            console.error('=== AI Processing Error ===');
            console.error('Error:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Processing duration:', processingDuration + 'ms');
            console.error('Provider:', this.app.selectedProvider);
            console.error('Model:', this.app.selectedModel);
            
            // Log comprehensive error details to debug system
            this.app.logDebug('error', this.app.selectedProvider, this.app.selectedModel, {
                error: error.message,
                stack: error.stack,
                userInput: userInput,
                hasImage: hasImage,
                imageDataLength: imageDataUrl ? imageDataUrl.length : 'N/A',
                duration: processingDuration,
                timestamp: new Date().toISOString()
            });
            
            // Provide more specific error message based on error type
            let errorMessage = 'Error processing response. ';
            if (error.message.includes('API error') || error.message.includes('401') || error.message.includes('403')) {
                errorMessage += 'Please check your API key and try again.';
            } else if (error.message.includes('JSON') || error.message.includes('parse')) {
                errorMessage += 'The AI returned invalid JSON format. This may be a provider compatibility issue.';
            } else if (error.message.includes('fetch') || error.message.includes('network')) {
                errorMessage += 'Network error. Please check your internet connection and try again.';
            } else {
                errorMessage += `Details: ${error.message}`;
            }
            
            this.app.messages.push({
                sender: 'System',
                content: errorMessage,
                type: 'system'
            });
        } finally {
            this.app.processing = false;
            
            // Refocus the chat input after AI response
            this.app.$nextTick(() => {
                const chatInput = document.querySelector('.chat-input textarea');
                if (chatInput) {
                    chatInput.focus();
                }
            });
        }
    }
    
    formatWineResponse(response) {
        if (!response.wines || response.wines.length === 0) {
            this.app.messages.push({
                sender: 'Wine Expert',
                content: response.error || 'No wines found in the image.',
                type: 'npc-left'
            });
            return;
        }
        
        let formattedContent = `Found ${response.wines.length} wine${response.wines.length > 1 ? 's' : ''} in the image:\n\n`;
        
        response.wines.forEach((wine, index) => {
            formattedContent += `**${index + 1}. ${wine.name}**\n`;
            
            if (wine.menu_price) {
                formattedContent += `   Menu: ${wine.menu_price}\n`;
            }
            
            if (wine.retail_price) {
                formattedContent += `   Retail: ${wine.retail_price}\n`;
            }
            
            formattedContent += '\n';
        });
        
        // Check if wines have detailed research data
        const hasDetailedInfo = response.wines.some(wine => 
            wine.retail_price || wine.ratings || wine.tasting_notes || wine.producer
        );
        
        if (hasDetailedInfo) {
            formattedContent += `✅ **Complete analysis finished!** All detailed information is available in the Wines tab.\n\n`;
            formattedContent += `*Ask me questions about these wines - I have full access to ratings, tasting notes, food pairings, and more!*`;
        } else {
            formattedContent += `*Ask me for detailed information about any of these wines!*`;
        }
        
        this.app.messages.push({
            sender: 'Wine Expert',
            content: formattedContent,
            type: 'npc-left'
        });
    }

    // Helper function to process extracted wine data for research input
    processExtractedWineData(wines) {
        return wines.map(wine => {
            let processedWine = { ...wine };
            
            // Process pricing - normalize everything to bottle prices
            if (wine.bottle_price && wine.bottle_price !== null && wine.bottle_price !== 'null') {
                // Use bottle price directly
                processedWine.menu_price = wine.bottle_price;
            }
            else if (wine.glass_price && wine.glass_price !== null && wine.glass_price !== 'null') {
                // Convert glass price to bottle price (multiply by 5) - hide conversion details
                const glassPrice = this.extractNumericPrice(wine.glass_price);
                if (glassPrice) {
                    const bottlePrice = glassPrice * 5;
                    processedWine.menu_price = `$${bottlePrice}`;
                } else {
                    // If we can't parse glass price, use it as-is
                    processedWine.menu_price = wine.glass_price;
                }
            }
            else {
                // No price available
                processedWine.menu_price = null;
            }
            
            // Clean up legacy pricing fields and use new structure
            delete processedWine.final_price;
            delete processedWine.conversion_note;
            
            return processedWine;
        });
    }

    extractNumericPrice(priceString) {
        if (!priceString || typeof priceString !== 'string') return null;
        
        // Remove currency symbols and extract number
        const match = priceString.match(/[\d,]+\.?\d*/);
        if (match) {
            return parseFloat(match[0].replace(/,/g, ''));
        }
        return null;
    }

    async processWinesInBatches(extractedWines) {
        // Split wines into batches of 10
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < extractedWines.length; i += batchSize) {
            batches.push(extractedWines.slice(i, i + batchSize));
        }

        let researchedWines = [];

        try {
            const batchPromises = batches.map((batch, batchIndex) => 
                this.researchWineBatch(batch).then(result => {
                    console.log(`Batch ${batchIndex + 1} research completed:`, result);
                    return result;
                }).catch(error => {
                    console.error(`Error processing batch ${batchIndex + 1}:`, error);
                    return { wines: [] }; // Return empty result on error
                })
            );

            const batchResults = await Promise.all(batchPromises);
            
            // Flatten all batch results into single array
            researchedWines = batchResults.flatMap(result => 
                result && result.wines ? result.wines : []
            );
            
            console.log('Research completed. Total researched wines:', researchedWines.length);
            
        } catch (error) {
            console.error('Error in parallel batch processing:', error);
            researchedWines = [];
        }

        // Store the researched results directly as current wine list
        if (researchedWines.length > 0) {
            console.log('Setting currentWineList with researched wines:', researchedWines.length);
            console.log('Sample researched wine:', researchedWines[0]);
            this.app.currentWineList = { wines: researchedWines };
        } else {
            console.log('Research failed, using extracted wines as fallback:', extractedWines.length);
            this.app.currentWineList = { wines: extractedWines };
        }
        
        console.log('Final wine list set with wines count:', this.app.currentWineList?.wines?.length);
        console.log('First wine in final list:', this.app.currentWineList?.wines?.[0]);
        
        // Verify data structure for UI
        if (this.app.currentWineList?.wines) {
            this.app.currentWineList.wines.forEach((wine, index) => {
                console.log(`Wine ${index + 1} data:`, {
                    name: wine.name,
                    hasMenuPrice: !!wine.menu_price,
                    hasRetailPrice: !!wine.retail_price,
                    hasRatings: !!wine.ratings,
                    hasTastingNotes: !!wine.tasting_notes,
                    hasProducer: !!wine.producer
                });
            });
        }
    }

    async researchWineBatch(extractedWines) {
        console.log('Starting research batch for wines:', extractedWines.map(w => w.name));
        
        const wineList = extractedWines.map((wine, index) => {
            let entry = `${index + 1}. ${wine.name}`;
            
            // Add extracted information
            if (wine.wine_type) entry += ` (${wine.wine_type})`;
            if (wine.producer) entry += ` - ${wine.producer}`;
            if (wine.vintage) entry += ` '${wine.vintage}`;
            if (wine.region) entry += ` from ${wine.region}`;
            
            // Add pricing
            if (wine.menu_price) {
                entry += ` - Menu: ${wine.menu_price}`;
            }
            
            return entry;
        }).join('\n');
        
        const researchPrompt = `Research detailed information for these wines. For each wine in the exact same order, provide complete details including both menu and retail pricing.

Wine List with Menu Pricing:
${wineList}

For each wine in the EXACT SAME ORDER, research and return:
1. **Current U.S. retail price** - Check Wine-Searcher, Wine.com, Total Wine
2. **Ratings** - Vivino crowd ratings, Wine Spectator scores, other critic reviews  
3. **Tasting notes** - Flavor profile from Vivino, winery notes
4. **Food pairing** - Recommended dishes and cuisines
5. **Wine details** - Producer, vintage, region, varietal, style

Return valid JSON with one wine object for each input wine. Maintain exact same order as input.`;

        const systemPrompt = `You are a wine research expert. Search the web for current, accurate wine information from reputable sources like Vivino, Wine-Searcher, Wine.com, and Wine Spectator. 

RESPONSE FORMAT: Return valid JSON with this exact structure:
{
  "wines": [
    {
      "name": "exact wine name from list",
      "menu_price": "menu price from input if available",
      "retail_price": "$XX average retail",
      "ratings": {
        "vivino": "X.X/5 (XXX reviews)",
        "wine_spectator": "XX points",
        "other": "additional scores"
      },
      "tasting_notes": "flavor profile summary",
      "food_pairing": "recommended pairings",
      "sources": ["source1", "source2"],
      "producer": "winery name",
      "vintage": "year",
      "region": "wine region",
      "varietal": "grape varieties", 
      "alcohol_content": "XX%",
      "style": "wine style description"
    }
  ]
}`;

        // Use the selected provider for research
        let result;
        try {
            switch(this.app.selectedProvider) {
                case 'google':
                    result = await this.app.aiModels.callGoogleAPI(systemPrompt, researchPrompt);
                    break;
                case 'xai':
                    result = await this.app.aiModels.callXAIAPI(systemPrompt, researchPrompt);
                    break;
                case 'deepseek':
                    result = await this.app.aiModels.callDeepSeekAPI(systemPrompt, researchPrompt);
                    break;
                default: // OpenAI
                    result = await this.app.aiModels.callOpenAIAPI(systemPrompt, researchPrompt);
            }
            
            console.log('Research batch result:', result);
            
            // Validate and enhance research results
            if (result && result.wines && Array.isArray(result.wines)) {
                console.log('Found valid wines array with', result.wines.length, 'wines');
                
                result.wines = result.wines.map((researchedWine, index) => {
                    const extractedWine = extractedWines[index];
                    if (!extractedWine) return researchedWine;
                    
                    // Merge extracted data with research results
                    return {
                        ...researchedWine,
                        // Preserve extracted wine information
                        name: researchedWine.name || extractedWine.name,
                        menu_price: researchedWine.menu_price || extractedWine.menu_price || null,
                        wine_type: researchedWine.wine_type || extractedWine.wine_type || null,
                        // Use research data if available, fallback to extracted data
                        producer: researchedWine.producer || extractedWine.producer || null,
                        vintage: researchedWine.vintage || extractedWine.vintage || null,
                        region: researchedWine.region || extractedWine.region || null,
                        style: researchedWine.style || extractedWine.style || null
                    };
                });
                
                console.log('Enhanced research result:', result);
            } else {
                console.warn('Research result missing wines array, creating fallback');
                console.warn('Result structure:', result);
                // Create fallback result with extracted data
                result = {
                    wines: extractedWines.map(wine => ({
                        name: wine.name,
                        menu_price: wine.menu_price,
                        wine_type: wine.wine_type,
                        producer: wine.producer,
                        vintage: wine.vintage,
                        region: wine.region,
                        style: wine.style,
                        retail_price: null,
                        ratings: null,
                        tasting_notes: null,
                        food_pairing: null,
                        sources: [],
                        varietal: null,
                        alcohol_content: null
                    }))
                };
            }
            
            return result;
        } catch (error) {
            console.error('Research batch failed:', error);
            // Return fallback result with extracted data
            return {
                wines: extractedWines.map(wine => ({
                    name: wine.name,
                    menu_price: wine.menu_price,
                    wine_type: wine.wine_type,
                    producer: wine.producer,
                    vintage: wine.vintage,
                    region: wine.region,
                    style: wine.style,
                    retail_price: null,
                    ratings: null,
                    tasting_notes: null,
                    food_pairing: null,
                    sources: [],
                    varietal: null,
                    alcohol_content: null
                }))
            };
        }
    }

    // Build conversation history from messages
    buildConversationHistory() {
        const history = [];
        
        // Extract user and assistant messages, excluding system messages
        this.app.messages.forEach(message => {
            if (message.sender === 'User') {
                history.push({
                    role: 'user',
                    content: message.content
                });
            } else if (message.sender === 'Wine Expert') {
                history.push({
                    role: 'assistant', 
                    content: message.content
                });
            }
            // Skip system messages as they're just UI notifications
        });
        
        return history;
    }

    // Handle keyboard input in chat textarea
    handleInputKeydown(event) {
        // Auto-resize textarea
        this.autoResizeTextarea(event.target);
        
        if (event.key === 'Enter') {
            if (event.shiftKey) {
                // Shift+Enter: Allow new line (default behavior)
                return;
            } else {
                // Enter: Send message
                event.preventDefault();
                this.sendMessage();
            }
        }
    }
    
    // Auto-resize textarea based on content
    autoResizeTextarea(textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        
        // Set height to scrollHeight with minimum of 1 row and maximum of 5 rows
        const lineHeight = 24; // Approximate line height in pixels
        const minHeight = lineHeight * 1; // 1 row minimum
        const maxHeight = lineHeight * 5; // 5 rows maximum
        
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
        
        textarea.style.height = newHeight + 'px';
        
        // Enable scrolling if content exceeds max height
        textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
} 