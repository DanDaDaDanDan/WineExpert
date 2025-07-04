// Settings management functionality
export class SettingsManager {
    constructor(app) {
        this.app = app;
    }

    saveSettings() {
        localStorage.setItem('selected_provider', this.app.selectedProvider);
        localStorage.setItem('openai_api_key', this.app.openaiKey);
        localStorage.setItem('openai_model', this.app.openaiModel);
        localStorage.setItem('google_api_key', this.app.googleKey);
        localStorage.setItem('google_model', this.app.googleModel);
        localStorage.setItem('xai_api_key', this.app.xaiKey);
        localStorage.setItem('xai_model', this.app.xaiModel);
        localStorage.setItem('deepseek_api_key', this.app.deepseekKey);
        localStorage.setItem('deepseek_model', this.app.deepseekModel);
        localStorage.setItem('temperature', this.app.temperature.toString());
        localStorage.setItem('debug_enabled', this.app.debugEnabled.toString());
        localStorage.setItem('debug_pretty_mode', this.app.debugPrettyMode.toString());
    }
} 