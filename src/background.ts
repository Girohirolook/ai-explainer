// import { GoogleGenAI } from '@google/genai';
import { createGenApi } from 'ai-sdk-genapi';
import { generateText } from "ai"
 
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: "explain-text", title: "Explain (Gemini)", contexts: ["selection"] });
});

chrome.runtime.onMessage.addListener(async (message, sender) => {
    if ((message.type === "START_NEW_CHAT" || message.type === "CONTINUE_CHAT") && sender.tab?.id) {
        const tabId = sender.tab.id;
        try {
            const storage = await chrome.storage.local.get(['geminiApiKey']);
            const apiKey = storage.geminiApiKey;
            if (!apiKey || typeof apiKey != "string") return;

            // let text = "";
            // if (message.history) {
            //     for (const s of message.history) {
            //         text += s;
            //     }
            // }
            // console.log(text);

            // Воссоздаем сессию чата с переданной историей
            console.log("start-chat")
            console.log(message.history || [])
            console.log(message.history?.concat({role: "user", content: message.text}))
            console.log("send_message")

            const response = await fetch("https://api.gen-api.ru/api/v1/networks/gemini-2-5-flash-lite", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: message.history?.concat({role: "user", content: message.text}),
                    stream: true
                })
            });
            console.log("response received")
            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let text = getTextFromResponse(decoder.decode(value));
                    chrome.tabs.sendMessage(tabId, { type: "CHUNK_STREAM", text: text.text, cost: text.cost });
                }
            }


            // Отправляем сообщение (либо промпт с контекстом, либо просто вопрос)
            // console.log(message.text)
            // const result = await chat.sendMessageStream({"message": message.text});
            
            // console.log("start")
            // for await (const chunk of result) {
            //     const chunkText = chunk.text;
            //     console.log(chunkText)
            //     if (chunkText) {
            //         chrome.tabs.sendMessage(tabId, { type: "CHUNK_STREAM", text: chunkText });
            //     }
            // }
        } catch (error: any) {
            chrome.tabs.sendMessage(tabId, { type: "SHOW_RESULT", text: "Ошибка: " + error.message });
        }
    }
});


function getTextFromResponse(response: any): { text: string; cost: number } {
    const lines = response.split('\n');
    let result = '';
    let totalCost = 0;

    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr !== '[DONE]') {
                try {
                    const obj = JSON.parse(jsonStr);
                    const content = obj.choices?.[0]?.delta?.content;
                    if (content) result += content;
                    const cost = obj.usage?.cost;
                    if (typeof cost === 'number') totalCost += cost;
                } catch (e) {
                    // ignore parse errors
                }
            }
        }
    }
    
    totalCost = Math.round(totalCost * 10000) / 10000;

    return { text: result, cost: totalCost };
}


// Слушатель контекстного меню теперь просто дает команду контент-скрипту начать чат
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "explain-text" && tab?.id) {
        chrome.tabs.sendMessage(tab.id, { 
            type: "INIT_EXPLAIN", 
            selection: info.selectionText 
        });
    }
});