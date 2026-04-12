import { GoogleGenAI } from '@google/genai'; // Требуется npm install @google/genai и Webpack

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: "explain-text", title: "Explain (Gemini)", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log("start1")
    if (info.menuItemId === "explain-text" && tab?.id) {
        const selectedText = info.selectionText || "";
        chrome.tabs.sendMessage(tab.id, { type: "SHOW_LOADING" });

        try {
            // 1. Берем ключ из памяти расширения (введенный в popup)
            const storage = await chrome.storage.local.get(['geminiApiKey']);
            const apiKey = storage.geminiApiKey;

            if (!apiKey || typeof apiKey != "string") {
                chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESULT", text: "Ошибка: Введите ключ." });
                return;
            }

            // 2. Получаем контекст страницы
            const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" });
            const pageContext = response?.context || "";
            const truncatedContext = pageContext.substring(0, 15000);

            // 3. Инициализируем SDK
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const prompt = `Контекст:\n"${truncatedContext}"\n\Расскажи о :\n"${selectedText}"`;

            // 4. Делаем запрос через новую библиотеку
            const aiResponse = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite-preview',
                contents: prompt,
            });
            
            chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESULT", text: aiResponse.text });

        } catch (error: any) {
            chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESULT", text: `Ошибка: ${error.message}` });
        }
    }
});