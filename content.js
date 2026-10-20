let protectTab = true;

// Strip UI artifacts (tooltips, hidden screen-reader labels, prompt buttons)
function cleanNode(node) {
    const clone = node.cloneNode(true);
    const junkSelectors = [
        '.cdk-visually-hidden',
        'gem-icon-button',
        'button',
        'sources-carousel-inline',
        'sources-list',
        '.elicitations-container',
        '.response-container-header',
        '.response-container-footer',
        '.model-response-label-announcer',
        '.file-preview-container',
        '.luminous-actions-container'
    ];
    junkSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
    });
    return clone;
}

function scrapeCurrentChat() {
    // Target strictly top-level turn containers to avoid duplicate scraping
    const nodes = document.querySelectorAll('user-query, model-response');
    const messages = [];

    nodes.forEach(node => {
        const isUser = node.tagName.toLowerCase() === 'user-query';
        const cleaned = cleanNode(node);

        let text = '';
        let html = '';

        if (isUser) {
            const queryBlock = cleaned.querySelector('.query-text') || cleaned;
            text = queryBlock.innerText.trim();
            html = `<p>${text}</p>`;
        } else {
            const mdBlock = cleaned.querySelector('.markdown') || cleaned;
            text = mdBlock.innerText.trim();
            html = mdBlock.innerHTML.trim();
        }

        if (text.length > 0) {
            messages.push({
                role: isUser ? 'USER' : 'GEMINI',
                text: text,
                html: html
            });
        }
    });

    return messages;
}

// Background auto-backup with 1-second debounce
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
    }, 1000);
});

observer.observe(document.body, { childList: true, subtree: true });

// Prevent accidental exit on temporary chats only
window.addEventListener('beforeunload', (e) => {
    const isTempChat = window.location.pathname === '/app' || window.location.pathname === '/app/';
    const hasMessages = document.querySelectorAll('user-query, model-response').length > 0;

    if (protectTab && isTempChat && hasMessages) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Runtime messaging for popup triggers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateSettings") {
        protectTab = request.protectTab;
        sendResponse({ status: "ok" });
    }
    if (request.action === "scrapeChat") {
        const msgs = scrapeCurrentChat();
        sendResponse({ 
            messages: msgs, 
            isTempChat: (window.location.pathname === '/app' || window.location.pathname === '/app/') 
        });
    }
});