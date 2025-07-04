// AI Models and API Provider implementations
export class AIModels {
    constructor(app) {
        this.app = app;
    }

    // Safe JSON parser that handles malformed JSON responses
    safeJSONParse(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            console.error('Invalid JSON string received:', jsonString);
            return { error: 'Invalid response format' };
        }

        try {
            // First attempt: direct parse
            return JSON.parse(jsonString);
        } catch (firstError) {
            console.warn('First JSON parse failed:', firstError.message);
            console.log('Attempting to fix JSON...');

            try {
                // Second attempt: fix common JSON issues
                let fixedJson = jsonString.trim();
                
                // Fix unescaped quotes in strings
                fixedJson = this.fixUnescapedQuotes(fixedJson);
                
                // Fix incomplete JSON (add missing closing braces/brackets)
                fixedJson = this.fixIncompleteJSON(fixedJson);
                
                return JSON.parse(fixedJson);
            } catch (secondError) {
                console.warn('Second JSON parse failed:', secondError.message);
                
                try {
                    // Third attempt: extract JSON from response if it's embedded in text
                    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const extractedJson = this.fixUnescapedQuotes(jsonMatch[0]);
                        return JSON.parse(extractedJson);
                    }
                } catch (thirdError) {
                    console.error('All JSON parse attempts failed');
                }
                
                // Return a structured error response
                return {
                    error: 'Failed to parse JSON response',
                    originalError: firstError.message,
                    rawResponse: jsonString
                };
            }
        }
    }

    // Fix unescaped quotes in JSON strings
    fixUnescapedQuotes(jsonString) {
        // This is a simple heuristic - look for quotes inside string values and escape them
        let inString = false;
        let result = '';
        let i = 0;

        while (i < jsonString.length) {
            const char = jsonString[i];
            const nextChar = jsonString[i + 1];
            const prevChar = i > 0 ? jsonString[i - 1] : '';

            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
                result += char;
            } else if (inString && char === '"' && prevChar !== '\\') {
                // This is an unescaped quote inside a string
                result += '\\"';
            } else if (inString && char === '\n') {
                // Replace literal newlines with escaped newlines
                result += '\\n';
            } else if (inString && char === '\r') {
                // Replace literal carriage returns with escaped returns
                result += '\\r';
            } else if (inString && char === '\t') {
                // Replace literal tabs with escaped tabs
                result += '\\t';
            } else {
                result += char;
            }
            i++;
        }

        return result;
    }

    // Fix incomplete JSON by adding missing closing braces/brackets
    fixIncompleteJSON(jsonString) {
        let openBraces = 0;
        let openBrackets = 0;
        let inString = false;

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];
            const prevChar = i > 0 ? jsonString[i - 1] : '';

            if (char === '"' && prevChar !== '\\') {
                inString = !inString;
            } else if (!inString) {
                if (char === '{') openBraces++;
                else if (char === '}') openBraces--;
                else if (char === '[') openBrackets++;
                else if (char === ']') openBrackets--;
            }
        }

        // Add missing closing characters
        let result = jsonString;
        for (let i = 0; i < openBrackets; i++) {
            result += ']';
        }
        for (let i = 0; i < openBraces; i++) {
            result += '}';
        }

        return result;
    }

    // Generic API call handler
    async makeAPICall(provider, url, headers, body, responseParser) {
        const startTime = Date.now();
        const model = this.app[`${provider}Model`];
        const requestId = `${provider}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
        console.log(`=== API Call Start [${requestId}] ===`);
        console.log('Provider:', provider);
        console.log('Model:', model);
        console.log('URL:', url);
        console.log('Headers:', headers);
        console.log('Request body:', body);
        console.log('Timestamp:', new Date().toISOString());
        
        // Enhanced request logging
        this.app.logDebug('request', provider, model, {
            requestId: requestId,
            url: url,
            method: 'POST',
            headers: headers,
            requestBody: body,
            timestamp: new Date().toISOString(),
            requestBodySize: JSON.stringify(body).length
        });
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            
            const duration = Date.now() - startTime;
            
            console.log(`=== API Response Received [${requestId}] ===`);
            console.log('Status:', response.status);
            console.log('Status text:', response.statusText);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));
            console.log('Duration:', duration + 'ms');
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`=== API Error [${requestId}] ===`);
                console.error('Error response:', errorText);
                
                this.app.logDebug('error', provider, model, {
                    requestId: requestId,
                    url: url,
                    method: 'POST',
                    requestHeaders: headers,
                    requestBody: body,
                    error: `HTTP ${response.status}: ${errorText}`,
                    status: response.status,
                    statusText: response.statusText,
                    responseHeaders: Object.fromEntries(response.headers.entries()),
                    responseBody: errorText,
                    duration: duration,
                    timestamp: new Date().toISOString(),
                    requestBodySize: JSON.stringify(body).length,
                    responseBodySize: errorText.length
                });
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log(`=== API Response Data [${requestId}] ===`);
            console.log('Raw response:', data);
            
            // Log the content that will be parsed for debugging
            if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
                console.log('Content to parse:', data.choices[0].message.content);
                console.log('Content length:', data.choices[0].message.content.length);
                console.log('Full content:', data.choices[0].message.content);
            }
            
            const parsedResponse = responseParser(data);
            console.log('Parsed response:', parsedResponse);
            console.log(`=== API Call Complete [${requestId}] ===`);
            
            // Enhanced response logging
            this.app.logDebug('response', provider, model, {
                requestId: requestId,
                url: url,
                method: 'POST',
                requestHeaders: headers,
                requestBody: body,
                responseBody: data,
                parsedResponse: parsedResponse,
                status: response.status,
                statusText: response.statusText,
                responseHeaders: Object.fromEntries(response.headers.entries()),
                duration: duration,
                timestamp: new Date().toISOString(),
                requestBodySize: JSON.stringify(body).length,
                responseBodySize: JSON.stringify(data).length
            });
            
            return parsedResponse;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`=== API Call Failed [${requestId}] ===`);
            console.error('Error:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Duration:', duration + 'ms');
            
            this.app.logDebug('error', provider, model, {
                requestId: requestId,
                url: url,
                method: 'POST',
                requestHeaders: headers,
                requestBody: body,
                error: error.message,
                stack: error.stack,
                duration: duration,
                timestamp: new Date().toISOString(),
                requestBodySize: JSON.stringify(body).length
            });
            throw error;
        }
    }

    async callOpenAIAPI(systemPrompt, userPrompt) {
        // Build messages array
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: userPrompt
            }
        ];
        
        const body = {
            model: this.app.openaiModel,
            messages: messages,
            response_format: { type: "json_object" },
            max_tokens: 16384
        };
        
        // Only add temperature for non-reasoning models
        if (this.app.supportsTemperature) {
            body.temperature = this.app.temperature;
        }
        
        return this.makeAPICall(
            'openai',
            'https://api.openai.com/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.openaiKey}`
            },
            body,
            (data) => this.safeJSONParse(data.choices[0].message.content)
        );
    }
    
    async callOpenAIVisionAPI(prompt, imageDataUrl) {
        // Build messages array with image
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageDataUrl
                        }
                    }
                ]
            }
        ];
        
        const body = {
            model: 'gpt-4o', // Use GPT-4 Vision model
            messages: messages,
            response_format: { type: "json_object" },
            max_tokens: 16384
        };
        
        // Only add temperature for non-reasoning models
        if (this.app.supportsTemperature) {
            body.temperature = this.app.temperature;
        }
        
        return this.makeAPICall(
            'openai',
            'https://api.openai.com/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.openaiKey}`
            },
            body,
            (data) => this.safeJSONParse(data.choices[0].message.content)
        );
    }
    
    
    async callGoogleAPI(systemPrompt, userPrompt) {
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt + '\n\nUser request: ' + userPrompt }]
                }
            ],
            generationConfig: {
                temperature: this.app.effectiveTemperature,
                responseMimeType: "application/json",
                maxOutputTokens: 8192
            }
        };
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.app.googleModel}:generateContent?key=${this.app.googleKey}`;
        
        return this.makeAPICall(
            'google',
            url,
            {
                'Content-Type': 'application/json',
            },
            body,
            (data) => this.safeJSONParse(data.candidates[0].content.parts[0].text)
        );
    }
    
    async callGoogleVisionAPI(prompt, imageDataUrl) {
        // Convert data URL to base64 without the data:image/jpeg;base64, prefix
        const base64Data = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.split(';')[0].split(':')[1];
        
        const body = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: this.app.effectiveTemperature,
                responseMimeType: "application/json",
                maxOutputTokens: 8192
            }
        };
        
        // Use the same model but ensure it supports vision
        const model = this.app.googleModel.includes('flash') ? 'gemini-2.0-flash-exp' : this.app.googleModel;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.app.googleKey}`;
        
        return this.makeAPICall(
            'google',
            url,
            {
                'Content-Type': 'application/json',
            },
            body,
            (data) => this.safeJSONParse(data.candidates[0].content.parts[0].text)
        );
    }
    
    async callXAIAPI(systemPrompt, userPrompt) {
        const body = {
            model: this.app.xaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: this.app.effectiveTemperature,
            max_tokens: 131072
        };
        
        return this.makeAPICall(
            'xai',
            'https://api.x.ai/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.xaiKey}`
            },
            body,
            (data) => this.safeJSONParse(data.choices[0].message.content)
        );
    }
    
    async callXAIVisionAPI(prompt, imageDataUrl) {
        // Build messages array with image
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageDataUrl
                        }
                    }
                ]
            }
        ];
        
        const body = {
            model: 'grok-vision-beta', // Use Grok Vision model
            messages: messages,
            response_format: { type: "json_object" },
            max_tokens: 131072
        };
        
        return this.makeAPICall(
            'xai',
            'https://api.x.ai/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.xaiKey}`
            },
            body,
            (data) => this.safeJSONParse(data.choices[0].message.content)
        );
    }
    
    async callDeepSeekAPI(systemPrompt, userPrompt) {
        const body = {
            model: this.app.deepseekModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: this.app.effectiveTemperature,
            max_tokens: 8192
        };
        
        return this.makeAPICall(
            'deepseek',
            'https://api.deepseek.com/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.deepseekKey}`
            },
            body,
            (data) => this.safeJSONParse(data.choices[0].message.content)
        );
    }
    
    async callDeepSeekVisionAPI(prompt, imageDataUrl) {
        // DeepSeek may not support vision yet, but using OpenAI-compatible format
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageDataUrl
                        }
                    }
                ]
            }
        ];
        
        const body = {
            model: this.app.deepseekModel,
            messages: messages,
            response_format: { type: "json_object" },
            max_tokens: 8192
        };
        
        return this.makeAPICall(
            'deepseek',
            'https://api.deepseek.com/v1/chat/completions',
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.deepseekKey}`
            },
            body,
            (data) => this.safeJSONParse(data.choices[0].message.content)
        );
    }
} 