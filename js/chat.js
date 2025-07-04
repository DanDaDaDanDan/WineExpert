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
        
        // Add context indicator if wine list is available
        if (this.app.currentWineList && this.app.currentWineList.wines && this.app.currentWineList.wines.length > 0) {
            this.app.messages.push({
                sender: 'System',
                content: `Using context from ${this.app.currentWineList.wines.length} wines in the current list`,
                type: 'system'
            });
        }
        
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
                const winePrompt = `FAST TEXT EXTRACTION: List each wine line from the image as simple JSON.
Don't parse or analyze - just transcribe what you see.

For each wine line, return:
{"name": "wine text", "glass_price": "$XX", "bottle_price": "$XX"}

Rules:
- ONE wine per line
- Capture glass price AND bottle price separately if visible
- Use null if a price type isn't shown
- If BOTH glass and bottle prices exist, capture both
- NO web search, NO added info
- SPEED is priority - raw text only

Return JSON:
{
  "wines": [
    {"name": "full wine text as shown", "glass_price": "$12", "bottle_price": "$48"}
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
                        type: 'system'
                    });
                    return;
                }
            } else {
                // Regular text processing using selected provider
                let systemPrompt = "You are a wine expert assistant. Help the user with their wine-related questions.";
                
                // Include wine list context if available
                if (this.app.currentWineList && this.app.currentWineList.wines && this.app.currentWineList.wines.length > 0) {
                    const wineContext = JSON.stringify(this.app.currentWineList, null, 2);
                    console.log('Passing wine context to LLM:', wineContext); // Debug log
                    systemPrompt += "\n\nCurrent wine list context (includes menu prices, retail prices, ratings, tasting notes, food pairings, producer, vintage, region, varietal, and sources):\n" + wineContext;
                    userInput = `Based on the detailed wine information provided in the system context, ${userInput}`;
                }
                
                switch(this.app.selectedProvider) {
                    case 'google':
                        response = await this.app.aiModels.callGoogleAPI(systemPrompt, userInput || "Hello");
                        break;
                    case 'xai':
                        response = await this.app.aiModels.callXAIAPI(systemPrompt, userInput || "Hello");
                        break;
                    case 'deepseek':
                        response = await this.app.aiModels.callDeepSeekAPI(systemPrompt, userInput || "Hello");
                        break;
                    default: // OpenAI
                        response = await this.app.aiModels.callOpenAIAPI(systemPrompt, userInput || "Hello");
                }
            }
            
            // Format and display response
            if (response.wines) {
                if (hasImage) {
                    // For images: Store extracted data and do research
                    const extractedWines = this.processExtractedPricing(response.wines);
                    
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
                        type: 'system'
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
                    type: 'system'
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
                this.app.messages.push({
                    sender: 'Wine Expert',
                    content: response.message || JSON.stringify(response, null, 2),
                    type: 'system'
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
                type: 'system'
            });
            return;
        }
        
        let formattedContent = `Found ${response.wines.length} wine${response.wines.length > 1 ? 's' : ''} in the image:\n\n`;
        
        response.wines.forEach((wine, index) => {
            formattedContent += `**${index + 1}. ${wine.name}**\n`;
            
            if (wine.menu_price) {
                formattedContent += `   Menu: ${wine.menu_price}`;
                if (wine.menu_price_note) {
                    formattedContent += ` (${wine.menu_price_note})`;
                }
                formattedContent += `\n`;
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
            type: 'system'
        });
    }

    // Helper function to process extracted pricing for research input
    processExtractedPricing(wines) {
        return wines.map(wine => {
            let processedWine = { ...wine };
            
            // If both glass and bottle prices exist, prioritize bottle price
            if (wine.bottle_price && wine.bottle_price !== null && wine.bottle_price !== 'null') {
                processedWine.final_price = wine.bottle_price;
                processedWine.price_source = 'bottle';
            }
            // If only glass price exists, convert to bottle price (multiply by 5)
            else if (wine.glass_price && wine.glass_price !== null && wine.glass_price !== 'null') {
                const glassPrice = this.extractNumericPrice(wine.glass_price);
                if (glassPrice) {
                    const bottlePrice = glassPrice * 5;
                    processedWine.final_price = `$${bottlePrice}`;
                    processedWine.price_source = 'glass_converted';
                    processedWine.conversion_note = `Estimated from glass price (${wine.glass_price} × 5)`;
                } else {
                    processedWine.final_price = wine.glass_price;
                    processedWine.price_source = 'glass';
                }
            }
            // No price available
            else {
                processedWine.final_price = null;
                processedWine.price_source = 'none';
            }
            
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

    // No longer needed - research results replace extracted data completely

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
            if (wine.final_price) {
                entry += ` (Menu: ${wine.final_price}`;
                if (wine.conversion_note) {
                    entry += ` - ${wine.conversion_note}`;
                }
                entry += ')';
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

IMPORTANT: Return wines in the EXACT same order as the input list. Include the menu pricing information provided.

Return valid JSON with one wine object for each input wine:
{
  "wines": [
    {
      "name": "exact wine name from list",
      "menu_price": "menu price from input if available",
      "menu_price_note": "note about glass conversion if applicable",
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

        const systemPrompt = "You are a wine research expert. Search the web for current, accurate wine information from reputable sources like Vivino, Wine-Searcher, Wine.com, and Wine Spectator. Include both the menu pricing information provided and the retail pricing you research.";

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
                result.wines = result.wines.map((researchedWine, index) => {
                    const extractedWine = extractedWines[index];
                    if (!extractedWine) return researchedWine;
                    
                    // Ensure menu pricing is preserved from extracted data
                    return {
                        ...researchedWine,
                        // Guarantee menu pricing fields are set from extracted data
                        menu_price: researchedWine.menu_price || extractedWine.final_price || null,
                        menu_price_note: researchedWine.menu_price_note || extractedWine.conversion_note || null,
                        // Ensure wine name matches extracted name if research name is missing/different
                        name: researchedWine.name || extractedWine.name
                    };
                });
                
                console.log('Enhanced research result:', result);
            } else {
                console.warn('Research result missing wines array, creating fallback');
                // Create fallback result with basic extracted data
                result = {
                    wines: extractedWines.map(wine => ({
                        name: wine.name,
                        menu_price: wine.final_price,
                        menu_price_note: wine.conversion_note,
                        retail_price: null,
                        ratings: null,
                        tasting_notes: null,
                        food_pairing: null,
                        sources: [],
                        producer: null,
                        vintage: null,
                        region: null,
                        varietal: null,
                        alcohol_content: null,
                        style: null
                    }))
                };
            }
            
            return result;
        } catch (error) {
            console.error('Research batch failed:', error);
            // Return fallback result with basic extracted data
            return {
                wines: extractedWines.map(wine => ({
                    name: wine.name,
                    menu_price: wine.final_price,
                    menu_price_note: wine.conversion_note,
                    retail_price: null,
                    ratings: null,
                    tasting_notes: null,
                    food_pairing: null,
                    sources: [],
                    producer: null,
                    vintage: null,
                    region: null,
                    varietal: null,
                    alcohol_content: null,
                    style: null
                }))
            };
        }
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