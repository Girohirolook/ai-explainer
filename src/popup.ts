document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
    const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    const statusDiv = document.getElementById('status') as HTMLDivElement;

    // Загружаем сохраненный ключ
    chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey && typeof result.geminiApiKey == "string") {
            apiKeyInput.value = result.geminiApiKey;
        }
    });

    // Сохраняем ключ
    saveBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        chrome.storage.local.set({ geminiApiKey: key }, () => {
            statusDiv.style.display = 'block';
            setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        });
    });
});