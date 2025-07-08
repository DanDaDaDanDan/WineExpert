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
- `index.html` - Main HTML with Alpine.js app and wine type color coding
- `js/app.js` - Alpine.js state manager with markup calculation utilities
- `js/models.js` - AI provider implementations with updated vision model support
- `js/chat.js` - Chat messaging with hidden price conversion and clean formatting
- `js/settings.js` - Configuration and localStorage management  
- `js/debug.js` - API monitoring and logging
- `styles.css` - Dark wine cellar theme with consistent opacity and wine type colors
- `misc/background.jpg` - Tiling wine cellar background image

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
  - Use `var(--background-color)` for consistent opacity across all tabs
  - Wine type color coding via `data-wine-type` attributes
  - Pricing grid layout for menu/retail/markup display

### Configuration
- API keys stored in browser localStorage via settings panel
- Temperature control with automatic reasoning model detection  
- Multi-provider support for text generation and vision analysis
- **No Clear Functionality**: Simplified UX - users reload page to reset state
- **Unified Opacity**: All tabs use consistent dark backgrounds for professional appearance

## AI Provider Support

### Text Generation
- **OpenAI**: GPT-4o, O1, O3, O4-mini, GPT-4.1 series models
- **Google Gemini**: 2.5 Flash/Pro Preview, 2.0 Flash variants  
- **xAI Grok**: Grok 3, 3-mini, 3-fast variants
- **DeepSeek**: Chat, Reasoner, Coder, VL2 vision models

### Vision Model Support
- **OpenAI**: GPT-4o, O1, O3, O4-mini, GPT-4.1 series (✓ Vision)
- **Google**: All Gemini models support multimodal vision
- **xAI**: All Grok models with specialized vision API
- **DeepSeek**: VL2, VL2-small, Janus-Pro-7B (✓ Vision + Generation)

### Wine Analysis Features
- **Image Recognition**: Upload photos of wine bottles, wine lists, or menus
- **Detailed Information**: Get pricing, ratings, tasting notes, and food pairings
- **Batch Processing**: Analyze multiple wines from a single image
- **Follow-up Questions**: Wine list context maintained for conversational queries
- **Wine Type Classification**: Automatic detection and color-coding for red, white, rosé, sparkling wines
- **Pricing Analysis**: Menu vs retail price comparison with markup calculations
- **Smart Price Conversion**: Glass prices silently converted to bottle estimates (×5) behind the scenes

## User Interface Design

### Dark Wine Cellar Theme
- **Background**: Tiling wine cellar image (`misc/background.jpg`) with dark overlay
- **Color Scheme**: Wine-inspired palette with burgundy, gold, and olive accents
- **Opacity**: Consistent dark backgrounds (`var(--background-color)`) across all tabs for uniform appearance
- **Typography**: High contrast text for improved readability
- **Wine Type Color Coding**: Visual indicators using wine-specific colors:
  - Red wines: Deep burgundy (`#8b2635`)
  - White wines: Pale gold (`#f4e4c1`) 
  - Rosé wines: Soft pink (`#e4717a`)
  - Sparkling wines: Champagne gold (`#ffd700`)
  - Dessert wines: Amber (`#8b4513`)

### Layout and Navigation
- **Tab-based Interface**: Chat, Wines, Settings, Debug views
- **Bubble Design**: Rounded containers with wine cellar aesthetic
- **No Clear Functionality**: Simplified workflow - users reload page to reset
- **Responsive Design**: Optimized for desktop wine analysis workflows

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
- Wine details: name, producer, vintage, region, grape varieties, wine type
- **Hidden Price Conversion**: Glass prices silently converted to bottle estimates (×5) - conversion details not shown to users
- **Pricing Display**: Menu price, retail price, and markup percentage shown together
- Rating aggregation from critics and crowd sources (Vivino, Wine Spectator)
- Markdown formatting for chat display, structured grid for wines tab

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
        
        // Wine pricing utilities
        calculateMarkup: (menuPrice, retailPrice) => { /* Markup calculation logic */ },
        
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
  - `processExtractedWineData()`: Clean price processing with hidden glass conversion
  - `formatWineResponse()`: Chat display formatting without technical details
  - `buildConversationHistory()`: Maintains chat context for follow-up questions

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
// In processWithAI() when hasImage=true - Enhanced extraction with wine type detection
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
      "region": "wine region if obvious from name"
    }
  ]
}`;
```

#### Stage 2: Detailed Research
```javascript
// In processWinesInBatches() - parallel processing with comprehensive research
const researchPrompt = `Research detailed information for these wines. For each wine in the exact same order, provide complete details including both menu and retail pricing.

For each wine in the EXACT SAME ORDER, research and return:
1. **Current U.S. retail price** - Check Wine-Searcher, Wine.com, Total Wine
2. **Ratings** - Vivino crowd ratings, Wine Spectator scores, other critic reviews  
3. **Tasting notes** - Flavor profile from Vivino, winery notes
4. **Food pairing** - Recommended dishes and cuisines
5. **Wine details** - Producer, vintage, region, varietal, style

Return valid JSON with one wine object for each input wine. Maintain exact same order as input.`;
```

### Price Processing Logic

The `processExtractedWineData()` method implements smart price handling with hidden conversion:

1. **Priority**: Bottle price > Glass price converted to bottle > No price
2. **Silent Conversion**: Glass price × 5 = Estimated bottle price (conversion details hidden from users)
3. **Clean Display**: Only show final menu price, no conversion notes or technical details
4. **Markup Calculation**: Compare menu vs retail prices with percentage markup display

```javascript
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
            }
        }
        
        return processedWine;
    });
}

// Markup calculation utility
calculateMarkup(menuPrice, retailPrice) {
    const menu = extractPrice(menuPrice);
    const retail = extractPrice(retailPrice);
    if (!menu || !retail || retail === 0) return 'N/A';
    const markup = ((menu - retail) / retail) * 100;
    return markup > 0 ? `+${markup.toFixed(0)}%` : `${markup.toFixed(0)}%`;
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

The system silently maintains wine context for conversational queries without spam:

```javascript
// In processWithAI() for text queries - clean context passing
if (this.app.currentWineList && this.app.currentWineList.wines && this.app.currentWineList.wines.length > 0) {
    const wineContext = JSON.stringify(this.app.currentWineList, null, 2);
    console.log('=== Wine Context Being Passed to LLM ===');
    console.log('Wine count:', this.app.currentWineList.wines.length);
    // Context passed silently - no "Using context from X wines" messages shown to user
    systemPrompt += "\n\nCurrent wine list context (includes menu prices, retail prices, ratings, tasting notes, food pairings, producer, vintage, region, varietal, and sources):\n" + wineContext;
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

The application ensures atomic processing with clean user experience:

1. **Image Analysis**: Complete extraction + research before showing results
2. **Processing Indicator**: Shows "🔍 Analyzing wines and researching detailed information..." during processing
3. **State Management**: `processing` flag blocks user input during operations
4. **Clean Results**: Only updates wines tab when complete processing is finished
5. **No Spam Messages**: Technical details and conversion notes hidden from users
6. **Wine Type Recognition**: Automatic classification and color-coding in results
7. **Pricing Grid**: Menu price, retail price, and markup displayed in organized layout

## Privacy & Security
- Client-side only - no server data storage
- API keys stored locally in browser
- Debug logs remain local
- No analytics or external tracking
- Wine images processed locally before AI analysis

## Recent Implementation Updates

### User Experience Improvements (Current State)
- **Simplified Workflow**: Removed all clear/trash functionality - users simply reload page to reset
- **Professional Appearance**: Standardized opacity across all tabs using `var(--background-color)` for consistent dark theme
- **Clean Pricing Display**: Glass conversion happens silently behind scenes, users only see clean final prices
- **Visual Wine Classification**: Automatic wine type detection with color-coded left borders for easy identification
- **Contextual Intelligence**: Wine context passed to LLMs without showing technical "Using context" messages

### Design Evolution
- **Dark Wine Cellar Theme**: Rich, professional aesthetic with tiling wine cellar background
- **High Contrast Typography**: Improved readability with carefully chosen text colors
- **Bubble Interface**: Rounded containers with wine-inspired styling throughout
- **Pricing Grid**: Organized display showing menu price, retail price, and markup percentage
- **Color Psychology**: Wine type colors (burgundy, gold, pink, champagne) enhance user experience

### Technical Refinements
- **Hidden Complexity**: Technical details like price conversion notes removed from user-facing displays
- **Atomic Processing**: Complete wine analysis before showing any results to users
- **Enhanced Context**: Full wine details (ratings, tasting notes, pairings) available for chat follow-ups
- **Model Accuracy**: Updated all vision model labels to reflect actual capabilities
- **Consistent Styling**: Unified visual approach across Chat, Wines, Settings, and Debug tabs