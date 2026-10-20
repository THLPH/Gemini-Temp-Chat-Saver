let protectTab = true;

// Helper: Scrape all messages currently on screen
function scrapeCurrentChat() {
    // Robust selector targeting Gemini's message elements
    const nodes = document.querySelectorAll('user-query, model-response, message-content');
    let messages = [];

    nodes.forEach(node => {
        const isUser = node.tagName.toLowerCase() === 'user-query' || node.classList.contains('user-query');
        const role = isUser ? 'USER' : 'GEMINI';

        let text = node.innerText || '';
        let html = node.innerHTML || '';

        // Strip Gemini UI action buttons
        text = text.replace(/volume_up/g, '').replace(/content_copy/g, '').replace(/good_response/g, '').replace(/bad_response/g, '').trim();

        if (text.length > 0) {
            messages.push({ role, text, html });
        }
    });

    return messages;
}

// 1. Silent Auto-Saver (Saves to chrome.storage every time the chat changes)
let saveTimeout = null;
const observer = new MutationObserver(() => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        const msgs = scrapeCurrentChat();
        if (msgs.length > 0) {
            chrome.storage.local.set({
                'last_saved_chat': {
                    timestamp: new Date().toLocaleTimeString(),
                    date: new Date().toLocaleDateString(),
                    messages: msgs,
                    url: window.location.href
                }
            });
        }
    }, 1000); // 1-second debounce
});

observer.observe(document.body, { childList: true, subtree: true });

// 2. Prevent Accidental Exit on Temp Chats
window.addEventListener('beforeunload', (e) => {
    const isTempChat = window.location.pathname === '/app' || window.location.pathname === '/app/';
    const hasMessages = document.querySelectorAll('user-query, model-response').length > 0;
    
    if (protectTab && isTempChat && hasMessages) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// 3. Listen for requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateSettings") {
        protectTab = request.protectTab;
        sendResponse({ status: "ok" });
    }
    if (request.action === "scrapeChat") {
        const msgs = scrapeCurrentChat();
        sendResponse({ messages: msgs, isTempChat: (window.location.pathname === '/app') });
    }
});