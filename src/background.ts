import { GoogleGenAI } from '@google/genai';

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: "explain-text", title: "Explain (Gemini)", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "explain-text" && tab?.id) {
        const selectedText = info.selectionText || "";

        try {
            // 1. Показываем загрузку
            await chrome.tabs.sendMessage(tab.id, { type: "SHOW_LOADING" });

            // ИСПРАВЛЕНИЕ №1: Даем браузеру 50мс, чтобы он успел нарисовать окно "Думаю..."
            await new Promise(resolve => setTimeout(resolve, 20));

            const storage = await chrome.storage.local.get(['geminiApiKey']);
            const apiKey = storage.geminiApiKey;

            if (!apiKey || typeof apiKey != "string") {
                await chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESULT", text: "Ошибка: Введите ключ." });
                return;
            }

            // Теперь собираем контекст
            const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_CONTEXT" });
            const pageContext = response?.context || "";
            const truncatedContext = pageContext.substring(0, 50000);

            const ai = new GoogleGenAI({ apiKey: apiKey });
            // const prompt = `Контекст:\n"${truncatedContext}"\n\nОбъясни:\n"${selectedText}"`;

            const prompt = `Контекст:\n"${truncatedContext}"\n\nОбъясни смысл выделенного текста. 
            ВАЖНО: Твой ответ должен быть не длиннее 300-400 токенов. 
            Текст для объяснения:\n"${selectedText}"`;

            const stream = await ai.models.generateContentStream({
                model: 'gemini-3.1-flash-lite-preview',
                contents: prompt,
            });

            await chrome.tabs.sendMessage(tab.id, { type: "START_STREAM" });
            
            for await (const chunk of stream) {
                if (chunk.text) {
                    await chrome.tabs.sendMessage(tab.id, { type: "CHUNK_STREAM", text: chunk.text });
                }
            }

        } catch (error: any) {
            console.error("Ошибка:", error);
            if (error.message && error.message.includes("Receiving end does not exist")) {
                console.warn("Обновите страницу (F5).");
            } else {
                chrome.tabs.sendMessage(tab.id, { type: "SHOW_RESULT", text: `Ошибка: ${error.message}` }).catch(()=>{});
            }
        }
    }
});