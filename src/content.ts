import { marked } from 'marked';

let lastMouseX = 0;
let lastMouseY = 0;
let popupElement: HTMLDivElement | null = null;

let currentStreamText = ""; 
let pendingText = "";       
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
        createOrUpdatePopup("<i>Думаю... 🤖</i>");
    }

    if (request.type === "START_STREAM") {
        resetTypewriter();
        createOrUpdatePopup(""); 
        startTypewriter();
    }

    if (request.type === "CHUNK_STREAM") {
        pendingText += request.text;
    }

    if (request.type === "SHOW_RESULT") {
        resetTypewriter();
        // Используем синхронный парсинг для финального результата
        const html = marked.parse(request.text) as string;
        createOrUpdatePopup(html);
    }
});

function startTypewriter() {
    if (typewriterInterval) clearInterval(typewriterInterval);
    
    typewriterInterval = window.setInterval(() => {
        if (pendingText.length > 0) {
            const char = pendingText.charAt(0);
            pendingText = pendingText.substring(1);
            currentStreamText += char;
            
            // Парсим Markdown "на лету"
            // marked.parseSync — самый быстрый способ для стриминга
            const htmlContent = marked.parse(currentStreamText, { async: false }) as string;
            createOrUpdatePopup(htmlContent);
        }
    }, 5); 
}

function resetTypewriter() {
    if (typewriterInterval) {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
    }
    currentStreamText = "";
    pendingText = "";
}

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
    resetTypewriter();
}