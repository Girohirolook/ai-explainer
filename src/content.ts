import { marked } from 'marked';

let lastMouseX = 0;
let lastMouseY = 0;
let popupElement: HTMLDivElement | null = null;

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

let currentStreamText = ""; 
let pendingText = "";       
let typewriterInterval: number | null = null;

// Запоминаем координаты относительно ЭКРАНА (clientX/Y)
document.addEventListener('contextmenu', (event) => {
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

// Логика перемещения для FIXED позиционирования
document.addEventListener('mousemove', (e) => {
    if (isDragging && popupElement) {
        // Для position: fixed координаты вычисляются просто по clientX/Y
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        popupElement.style.left = `${x}px`;
        popupElement.style.top = `${y}px`;
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
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
        
        // Начальная позиция относительно вьюпорта
        popupElement.style.left = `${lastMouseX}px`;
        popupElement.style.top = `${lastMouseY + 15}px`;

        const header = document.createElement('div');
        header.className = 'gemini-explainer-header';
        
        const title = document.createElement('span');
        title.innerText = 'Gemini Explainer';
        
        const closeBtn = document.createElement('div');
        closeBtn.className = 'gemini-explainer-close';
        closeBtn.innerHTML = '✖';
        closeBtn.onclick = removePopup;

        header.appendChild(title);
        header.appendChild(closeBtn);
        
        header.addEventListener('mousedown', (e) => {
            if (popupElement) {
                isDragging = true;
                const rect = popupElement.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                e.preventDefault();
            }
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'gemini-explainer-content';
        contentDiv.innerHTML = htmlContent;

        popupElement.appendChild(header);
        popupElement.appendChild(contentDiv);
        document.body.appendChild(popupElement);
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