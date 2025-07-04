# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wine Expert** is an AI-powered wine analysis tool that uses image recognition to identify wines and provide detailed information including pricing, ratings, tasting notes, and food pairings. This is a client-side web application built with vanilla JavaScript and Alpine.js - no backend, build system, or package management.

## Architecture

### Core Structure
- **Frontend**: Pure HTML/CSS/JavaScript with Alpine.js for reactivity
- **No Build System**: Static files served directly 
- **Modular Design**: ES6 classes in `/js/` directory with Alpine.js state management
- **Client-Side Only**: All processing happens in browser, API keys stored in localStorage

### Key Files
- `index.html` - Main HTML with Alpine.js app
- `js/app.js` - Alpine.js state manager and main orchestration
- `js/models.js` - AI provider implementations (OpenAI, Anthropic, Google, xAI, DeepSeek)
- `js/chat.js` - Chat messaging and conversation logic  
- `js/settings.js` - Configuration and localStorage
- `js/debug.js` - API monitoring and logging

### Module Dependencies
```
index.html
    ↓ loads Alpine.js and app.js
app.js (Alpine.js component)
    ↓ instantiates managers with dependency injection
    ├── AIModels (models.js)
    ├── ChatManager (chat.js)
    ├── DebugManager (debug.js)
    └── SettingsManager (settings.js)
```

### Image Processing
- Client-side image upload via FileReader API
- Vision model integration (GPT-4o, Gemini 2.5, xAI Grok, DeepSeek)
- Structured prompt for JSON extraction of wine details
- Special handling: glass prices automatically multiplied by 5 for bottle estimate
- Wine list context persisted for follow-up questions

## Development Workflow

### Running the Application
- Open `index.html` in browser directly
- No build or compilation needed
- Use browser dev tools for debugging

### Testing
- Manual testing only - no automated test framework
- Use debug panel in app for API monitoring
- Check browser console for errors

### Adding New Features
- **New AI Provider**: Add implementation in `js/models.js` following existing patterns
  - Add provider to `AIModels` class constructor
  - Implement `call[Provider]API()` and `call[Provider]VisionAPI()` methods
  - Use `makeAPICall()` wrapper for consistent logging
- **Vision Models**: Update prompt in `analyzeWineImage()` method
- **UI Changes**: Edit `index.html` (Alpine.js directives) and `styles.css`

### Configuration
- API keys stored in browser localStorage via settings panel
- Temperature control with automatic reasoning model detection
- Multi-provider support for both text generation and TTS

## AI Provider Support

### Text Generation
- OpenAI (GPT-4o, O1, O3 models)
- Anthropic Claude (Opus 4, Sonnet 4, 3.5 variants)
- Google Gemini (2.5 Flash, 2.5 Pro, 2.0 Flash variants)
- xAI Grok (Grok 3 variants)
- DeepSeek (Chat, Reasoner, Coder)

### Wine Analysis Features
- **Image Recognition**: Upload photos of wine bottles, wine lists, or menus
- **Detailed Information**: Get pricing, ratings, tasting notes, and food pairings
- **Batch Processing**: Analyze multiple wines from a single image
- **Follow-up Questions**: Wine list context maintained for conversational queries

## Code Patterns

### State Management
- Alpine.js reactive data in `js/app.js`
- Persistent settings via localStorage
- Modular class instantiation with dependency injection

### API Integration
- Generic `makeAPICall()` wrapper with request/response logging
- Provider-specific authentication handling
- Temperature control with reasoning model exceptions (O1, O3, DeepSeek Reasoner)
- JSON parsing with error recovery (`safeJSONParse()`)
- Comprehensive error handling and user-friendly messages

### Wine Data Processing
- Structured JSON prompt for consistent extraction
- Wine details: name, producer, vintage, region, grape varieties
- Price data with glass-to-bottle conversion (glass × 5)
- Rating aggregation from critics and crowd sources
- Markdown formatting for display

## Detailed Code Architecture

### Alpine.js Application Structure (`js/app.js`)

The application uses Alpine.js as the main reactive framework with a single global component:

```javascript
window.wineExpertApp = function() {
    const app = {
        // State properties
        currentView: 'chat',
        processing: false,
        messages: [],
        currentWineList: null,
        
        // Provider settings with localStorage persistence
        selectedProvider: localStorage.getItem('selected_provider') || 'openai',
        
        // Computed properties
        get apiKey() { /* Returns current provider's API key */ },
        get selectedModel() { /* Returns current provider's model */ },
        get supportsTemperature() { /* Checks if model supports temperature */ },
        
        // Initialization
        async init() {
            // Instantiate managers
            // Bind methods to Alpine instance
            // Setup watchers for auto-scroll
        }
    };
    return app;
};
```

### Manager Classes Pattern

All functionality is split into manager classes with dependency injection:

#### AIModels Class (`js/models.js`)
- **Purpose**: Handles all AI provider API calls
- **Key Methods**:
  - `makeAPICall()`: Generic wrapper for all API calls with logging
  - `call[Provider]API()`: Text generation methods
  - `call[Provider]VisionAPI()`: Image analysis methods
  - `safeJSONParse()`: Robust JSON parsing with error recovery

#### ChatManager Class (`js/chat.js`)
- **Purpose**: Manages conversations and wine processing
- **Key Methods**:
  - `sendMessage()`: Handles text input and context passing
  - `processWithAI()`: Main orchestration for AI processing
  - `processWinesInBatches()`: Parallel batch processing for detailed research
  - `processPricing()`: Glass-to-bottle price conversion logic
  - `mergeWineData()`: Combines extraction and research data

#### DebugManager Class (`js/debug.js`)
- **Purpose**: API monitoring and logging
- **Functionality**: Request/response logging, JSON formatting

#### SettingsManager Class (`js/settings.js`)
- **Purpose**: Configuration persistence
- **Functionality**: localStorage management

### Two-Stage Wine Processing

The application uses a sophisticated two-stage processing system:

#### Stage 1: Fast Extraction
```javascript
// In processWithAI() when hasImage=true
const winePrompt = `FAST TEXT EXTRACTION: List each wine line from the image as simple JSON.
Don't parse or analyze - just transcribe what you see.

For each wine line, return:
{"name": "wine text", "glass_price": "$XX", "bottle_price": "$XX"}`;
```

#### Stage 2: Detailed Research
```javascript
// In processWinesInBatches() - parallel processing
const researchPrompt = `Research detailed information for these wines. Use web resources to find current data.

For each wine, find:
1. **Average U.S. retail price** - Check Wine-Searcher, Wine.com, Total Wine
2. **Ratings** - Vivino crowd ratings, Wine Spectator scores
3. **Tasting notes** - Flavor profile, characteristics
4. **Food pairing** - Recommended dishes and cuisines`;
```

### Price Processing Logic

The `processPricing()` method implements smart price handling:

1. **Priority**: Bottle price > Glass price converted > Glass price only
2. **Conversion**: Glass price × 5 = Estimated bottle price
3. **Display**: Only show bottle prices, hide glass prices
4. **Notes**: Show conversion notes when glass price was converted

```javascript
processPricing(wines) {
    return wines.map(wine => {
        let processedWine = { ...wine };
        
        // If both glass and bottle prices exist, prioritize bottle price
        if (wine.bottle_price && wine.bottle_price !== null) {
            processedWine.final_price = wine.bottle_price;
            processedWine.price_source = 'bottle';
        }
        // If only glass price exists, convert to bottle price (multiply by 5)
        else if (wine.glass_price && wine.glass_price !== null) {
            const glassPrice = this.extractNumericPrice(wine.glass_price);
            if (glassPrice) {
                const bottlePrice = glassPrice * 5;
                processedWine.final_price = `$${bottlePrice}`;
                processedWine.price_source = 'glass_converted';
                processedWine.conversion_note = `Estimated from glass price (${wine.glass_price} × 5)`;
            }
        }
        return processedWine;
    });
}
```

### Batch Processing Implementation

Wine research uses parallel processing for performance:

```javascript
async processWinesInBatches(wines) {
    // Split wines into batches of 10
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < wines.length; i += batchSize) {
        batches.push(wines.slice(i, i + batchSize));
    }

    // Process all batches in parallel
    const batchPromises = batches.map((batch, batchIndex) => 
        this.researchWineBatch(batch).catch(error => {
            console.error(`Error processing batch ${batchIndex + 1}:`, error);
            return { wines: [] }; // Return empty result on error
        })
    );

    const batchResults = await Promise.all(batchPromises);
    
    // Flatten and merge results
    const processedWines = batchResults.flatMap(result => 
        result && result.wines ? result.wines : []
    );
}
```

### Context Passing for Follow-up Questions

The system maintains wine context for conversational queries:

```javascript
// In processWithAI() for text queries
if (this.app.currentWineList && this.app.currentWineList.wines.length > 0) {
    const wineContext = JSON.stringify(this.app.currentWineList, null, 2);
    console.log('Passing wine context to LLM:', wineContext);
    systemPrompt += "\n\nCurrent wine list context (includes menu prices, retail prices, ratings, tasting notes, food pairings, producer, vintage, region, varietal, and sources):\n" + wineContext;
    userInput = `Based on the detailed wine information provided in the system context, ${userInput}`;
}
```

### Error Handling and Recovery

The application includes comprehensive error handling:

1. **API Errors**: Structured error responses with retry suggestions
2. **JSON Parsing**: Multi-stage parsing with error recovery
3. **Vision API Fallbacks**: Provider-specific error handling
4. **Batch Processing**: Individual batch error isolation
5. **Debug Logging**: Complete request/response logging for troubleshooting

### Temperature Control for Reasoning Models

The system automatically detects reasoning models and adjusts temperature:

```javascript
// Models that don't support temperature
reasoningModels: [
    'o1', 'o1-pro', 'o3', 'o3-mini', 'o4-mini',  // OpenAI reasoning models
    'gemini-2.0-flash-thinking-exp-1219', 'gemini-2.0-flash-thinking-exp-01-21', // Google thinking models
    'deepseek-reasoner' // DeepSeek reasoning model
],

// Check if current model supports temperature
get supportsTemperature() {
    const model = this.selectedModel;
    return !this.reasoningModels.some(rm => model.includes(rm));
},

// Get effective temperature (1.0 for reasoning models)
get effectiveTemperature() {
    return this.supportsTemperature ? this.temperature : 1.0;
}
```

### Atomic Processing Design

The application ensures atomic processing - no partial results are shown:

1. **Image Analysis**: Complete extraction + research before showing results
2. **Processing Indicator**: Shows "Analyzing wines and researching..." during processing
3. **State Management**: `processing` flag blocks user input during operations
4. **Result Display**: Only updates wines tab when complete processing is finished

## Privacy & Security
- Client-side only - no server data storage
- API keys stored locally in browser
- Debug logs remain local
- No analytics or external tracking
- Wine images processed locally before AI analysis