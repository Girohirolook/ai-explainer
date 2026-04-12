let lastMouseX = 0;
let lastMouseY = 0;
let popupElement: HTMLDivElement | null = null;

// Переменные для замедления текста
let currentStreamText = ""; // То, что уже на экране
let pendingText = "";       // То, что прислал ИИ, но мы еще не вывели
let typewriterInterval: number | null = null;

document.addEventListener('contextmenu', (event) => {
    lastMouseX = event.pageX;
    lastMouseY = event.pageY;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_CONTEXT") {
        sendResponse({ context: document.body.innerText });
        return true; 
    }

    if (request.type === "SHOW_LOADING") {
        resetTypewriter();
        createOrUpdatePopup("Думаю... 🤖");
    }

    if (request.type === "START_STREAM") {
        resetTypewriter();
        createOrUpdatePopup(""); 
        startTypewriter(); // Запускаем эффект печати
    }

    if (request.type === "CHUNK_STREAM") {
        // ИСПРАВЛЕНИЕ №2: Не выводим текст сразу, а добавляем в "очередь"
        pendingText += request.text;
    }

    if (request.type === "SHOW_RESULT") {
        resetTypewriter();
        const formattedText = request.text.replace(/\n/g, '<br>');
        createOrUpdatePopup(formattedText);
    }
});

// --- ЛОГИКА ЭФФЕКТА ПЕЧАТНОЙ МАШИНКИ ---
function startTypewriter() {
    if (typewriterInterval) clearInterval(typewriterInterval);
    
    // Каждые 15 миллисекунд берем по одной букве из очереди (можете изменить скорость)
    typewriterInterval = window.setInterval(() => {
        if (pendingText.length > 0) {
            // Берем первую букву из очереди и убираем ее оттуда
            const char = pendingText.charAt(0);
            pendingText = pendingText.substring(1);
            
            // Добавляем на экран
            currentStreamText += char;
            
            // ИСПРАВЛЕНИЕ №3: Скролл убран, окно просто обновляет текст
            const formattedText = currentStreamText.replace(/\n/g, '<br>');
            createOrUpdatePopup(formattedText);
        }
    }, 5); // Чем больше число, тем медленнее печатает (15-20 обычно идеально)
}

function resetTypewriter() {
    if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
    }
    currentStreamText = "";
    pendingText = "";
}
// ----------------------------------------

function createOrUpdatePopup(htmlContent: string) {
    if (!popupElement) {
        popupElement = document.createElement('div');
        popupElement.className = 'gemini-explainer-popup';
        
        const closeBtn = document.createElement('div');
        closeBtn.className = 'gemini-explainer-close';
        closeBtn.innerHTML = '✖';
        closeBtn.onclick = removePopup;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'gemini-explainer-content';
        contentDiv.innerHTML = htmlContent;

        popupElement.appendChild(closeBtn);
        popupElement.appendChild(contentDiv);
        document.body.appendChild(popupElement);
        
        popupElement.style.left = `${lastMouseX}px`;
        popupElement.style.top = `${lastMouseY + 15}px`;
    } else {
        const contentDiv = popupElement.querySelector('.gemini-explainer-content');
        if (contentDiv) {
            contentDiv.innerHTML = htmlContent;
        }
    }
}

function removePopup() {
    if (popupElement) {
        popupElement.remove();
        popupElement = null;
    }
    resetTypewriter(); // Останавливаем печать, если закрыли окно
}