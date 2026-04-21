import { marked } from 'marked';

let popupElement: HTMLDivElement | null = null;
let lastMouseX = 0;
let lastMouseY = 0;

// История для SDK Gemini
let chatHistory: any[] = []; 
// Весь отрендеренный HTML предыдущих сообщений
let completedChatHTML = ""; 
// Текущий Markdown того, что печатается прямо сейчас
let currentResponseMarkdown = ""; 

let pendingText = "";
let cost = 0;  
let typewriterInterval: number | null = null;

document.addEventListener('contextmenu', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "INIT_EXPLAIN") {
        startInitialExplain(request.selection);
    }
    if (request.type === "CHUNK_STREAM") {
        console.log(request.text)
        pendingText += request.text;
        cost += request.cost;
    }
});

async function startInitialExplain(selection: string) {
    const range = window.getSelection()?.getRangeAt(0);
    if (!range) {
        console.warn("Нет активного выделения");
        return;
    }

    const dist = 1000;

    // 1. Получаем полный текст страницы с позициями
    const { fullText, selectionStart, selectionEnd } = extractTextWithPositions(range, selection);

    // 2. Вычисляем границы контекста
    const contextStart = Math.max(0, selectionStart - dist);
    const contextEnd = Math.min(fullText.length, selectionEnd + dist);
    const context = fullText.substring(contextStart, contextEnd);

    const initialPrompt = `Контекст страницы:\n"${context}"\n\nОбъясни выделенный текст:\n"${selection}"\nВажно: все твои ответы должны быть от 200 до 500 символов, но информативными. Используй markdown-разметку.`;

    // Сброс всего
    chatHistory = [{role: "user", content: initialPrompt}];
    completedChatHTML = "";
    currentResponseMarkdown = "";
    resetTypewriter();

    createOrUpdatePopup("<i>Думаю... 🤖</i>");
    startTypewriter();

    chrome.runtime.sendMessage({
        type: "START_NEW_CHAT",
        text: initialPrompt,
        history: []
    });

}
    
/**
 * Извлекает полный текст документа с отслеживанием позиций,
 * соответствующих реальному выделению через Range.
 */
function extractTextWithPositions(targetRange: Range, selection: string): {
    fullText: string;
    selectionStart: number;
    selectionEnd: number;
} {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Пропускаем пустые текстовые узлы и скрытые элементы
                if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent || parent.hidden || parent.style.display === 'none') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let fullText = '';
    let selectionStart = -1;
    let selectionEnd = -1;
    let node: Node | null = walker.nextNode();

    while (node) {
        const nodeText = node.textContent || '';
        const nodeStart = fullText.length;
        const nodeEnd = nodeStart + nodeText.length;

        // Проверяем, пересекается ли текущий узел с выделением
        if (targetRange.intersectsNode(node)) {
            // Вычисляем точные смещения внутри текстового узла
            const rangeStartOffset = targetRange.startContainer === node 
                ? targetRange.startOffset 
                : 0;
            const rangeEndOffset = targetRange.endContainer === node 
                ? targetRange.endOffset 
                : nodeText.length;

            const localStart = Math.max(0, rangeStartOffset);
            const localEnd = Math.min(nodeText.length, rangeEndOffset);

            // Если выделение ещё не началось — фиксируем старт
            if (selectionStart === -1 && localStart < localEnd) {
                selectionStart = nodeStart + localStart;
            }
            // Если выделение заканчивается в этом узле — фиксируем конец
            if (selectionEnd === -1 && localEnd > 0 && rangeEndOffset <= nodeText.length) {
                selectionEnd = nodeStart + localEnd;
            }
        }

        fullText += nodeText;
        node = walker.nextNode();
    }

    // Fallback: если выделение не найдено (редкий кейс), ищем по строке
    if (selectionStart === -1) {
        const idx = fullText.indexOf(selection);
        if (idx !== -1) {
            selectionStart = idx;
            selectionEnd = idx + selection.length;
        } else {
            // Крайний fallback — берём начало документа
            selectionStart = 0;
            selectionEnd = Math.min(selection.length, fullText.length);
        }
    }

    return { fullText, selectionStart, selectionEnd };
}



function startTypewriter() {
    if (typewriterInterval) clearInterval(typewriterInterval);
    typewriterInterval = window.setInterval(async () => {
        if (pendingText.length > 0) {
            const char = pendingText.charAt(0);
            pendingText = pendingText.substring(1);
            currentResponseMarkdown += char;
            
            const newChunkHTML = await marked.parse(currentResponseMarkdown);
            // Показываем старые сообщения + текущее печатающееся
            updateContentUI(completedChatHTML + `<div class="bot-msg">${newChunkHTML}</div>`);
        } else if (currentResponseMarkdown !== "" && pendingText.length === 0) {

            const newChunkHTML = await marked.parse(currentResponseMarkdown)
            updateContentUI(completedChatHTML + `<div class="bot-msg">${newChunkHTML}<div style="font-size: 11px; color: #888; margin-top: 2px;">Стоимость: ${cost}</div></div>`);

            finalizeResponse();
        }
    }, 5);
}

function finalizeResponse() {
    if (currentResponseMarkdown === "") return;
    
    // Добавляем в историю для SDK
    // chatHistory.push({ role: 'model', parts: [{ text: currentResponseMarkdown }] });
    
    chatHistory.push({role: "assistant", content: currentResponseMarkdown});
    // Добавляем в завершенный HTML

    const finalHTML = marked.parse(currentResponseMarkdown);
    // Добавляем цену маленьким серым шрифтом после сообщения
    console.log(currentResponseMarkdown);
    console.log(finalHTML);

    completedChatHTML += `<div class="bot-msg">${finalHTML}<div style="font-size: 11px; color: #888; margin-top: 2px;">Стоимость: ${cost}</div></div>`;
    
    cost = 0;
    currentResponseMarkdown = "";
    clearInterval(typewriterInterval!);
    typewriterInterval = null;
}

async function sendUserMessage(text: string) {
    if (!text.trim()) return;

    // 1. Добавляем вопрос в историю и в UI
    // chatHistory.push({ role: 'user', parts: [{ text: text }] });
    chatHistory.push({ role: 'user', content: text});

    completedChatHTML += `<div class="user-msg"><b>Вы:</b> ${text}</div>`;
    updateContentUI(completedChatHTML + `<div class="bot-loading">Gemini печатает...</div>`);

    // 2. Подготовка к стримингу ответа
    currentResponseMarkdown = "";
    pendingText = "";
    startTypewriter();

    // 3. Отправляем в фоновый скрипт
    chrome.runtime.sendMessage({
        type: "CONTINUE_CHAT",
        text: text,
        history: chatHistory.slice(0, -1) // Отправляем историю без последнего вопроса
    });
}

function updateContentUI(html: string) {
    const contentDiv = popupElement?.querySelector('.gemini-explainer-content');
    if (contentDiv) {
        contentDiv.innerHTML = html;
        contentDiv.scrollTop = contentDiv.scrollHeight;
    }
}

function createOrUpdatePopup(initialHTML: string) {
    if (!popupElement) {
        popupElement = document.createElement('div');
        popupElement.className = 'gemini-explainer-popup';
        popupElement.style.left = `${lastMouseX}px`;
        popupElement.style.top = `${lastMouseY + 15}px`;

        popupElement.innerHTML = `
            <div class="gemini-explainer-header">
                <span>Gemini Chat</span>
                <div class="gemini-explainer-close">✖</div>
            </div>
            <div class="gemini-explainer-content">${initialHTML}</div>
            <div class="gemini-explainer-footer">
                <input type="text" class="gemini-chat-input" placeholder="Спросить ещё...">
                <button class="gemini-chat-send">➜</button>
            </div>
        `;

        popupElement.querySelector('.gemini-explainer-close')!.addEventListener('click', () => {
            popupElement?.remove();
            popupElement = null;
            resetTypewriter();
        });

        const input = popupElement.querySelector('.gemini-chat-input') as HTMLInputElement;
        const sendBtn = popupElement.querySelector('.gemini-chat-send') as HTMLButtonElement;

        const onSend = () => {
            const val = input.value;
            input.value = "";
            sendUserMessage(val);
        };

        sendBtn.onclick = onSend;
        input.onkeydown = (e) => { if (e.key === 'Enter') onSend(); };

        // Drag and drop logic
        const header = popupElement.querySelector('.gemini-explainer-header') as HTMLElement;
        header.onmousedown = (e) => {
            const rect = popupElement!.getBoundingClientRect();
            const offX = e.clientX - rect.left;
            const offY = e.clientY - rect.top;

            const onMove = (me: MouseEvent) => {
                popupElement!.style.left = `${me.clientX - offX}px`;
                popupElement!.style.top = `${me.clientY - offY}px`;
            };
            document.onmousemove = onMove;
            document.onmouseup = () => { document.onmousemove = null; };
        };

        document.body.appendChild(popupElement);
    } else {
        updateContentUI(initialHTML);
    }
}

function resetTypewriter() {
    if (typewriterInterval) clearInterval(typewriterInterval);
    typewriterInterval = null;
    pendingText = "";
}