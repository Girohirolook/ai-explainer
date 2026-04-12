let lastMouseX = 0;
let lastMouseY = 0;
let popupElement: HTMLDivElement | null = null;

// Запоминаем координаты мыши при правом клике, чтобы знать, где открыть окно
document.addEventListener('contextmenu', (event) => {
    lastMouseX = event.pageX;
    lastMouseY = event.pageY;
});

// Закрытие окна при клике вне его области
// document.addEventListener('mousedown', (event) => {
//     if (popupElement && !popupElement.contains(event.target as Node)) {
//         removePopup();
//     }
// });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_CONTEXT") {
        // Отправляем текст всей страницы для контекста
        sendResponse({ context: document.body.innerText });
        return true; 
    }

    if (request.type === "SHOW_LOADING") {
        createOrUpdatePopup("Думаю... 🤖");
    }

    if (request.type === "SHOW_RESULT") {
        // Форматируем текст (заменяем переносы строк на <br> для читаемости)
        const formattedText = request.text.replace(/\n/g, '<br>');
        createOrUpdatePopup(formattedText);
    }
});

function createOrUpdatePopup(htmlContent: string) {
    if (!popupElement) {
        popupElement = document.createElement('div');
        popupElement.className = 'gemini-explainer-popup';
        
        // Позиционируем окно рядом с мышью
        popupElement.style.left = `${lastMouseX}px`;
        popupElement.style.top = `${lastMouseY + 15}px`;

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
}