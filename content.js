let protectTab = true;

chrome.storage.local.get(['protect_toggle'], (res) => {
    if (res.protect_toggle !== undefined) protectTab = res.protect_toggle;
});

const isTempChat = () => window.location.pathname === '/app' || window.location.pathname === '/app/';

function cleanNode(node) {
    const clone = node.cloneNode(true);
    const junkSelectors = [
        '.cdk-visually-hidden',
        'gem-icon-button',
        '.luminous-actions-container',
        '.response-container-header-controls',
        '.response-container-footer',
        '.model-response-label-announcer'
    ];
    junkSelectors.forEach(sel => clone.querySelectorAll(sel).forEach(el => el.remove()));
    return clone;
}

// Convert ephemeral user-upload blob URLs to inline Base64 data URLs
function inlineBlobImages(liveNode, cleanNode) {
    const liveImgs = liveNode.querySelectorAll('img');
    const cleanImgs = cleanNode.querySelectorAll('img');

    liveImgs.forEach((liveImg, i) => {
        if (!cleanImgs[i]) return;
        const src = liveImg.src || '';

        if (src.startsWith('blob:')) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = liveImg.naturalWidth || 300;
                canvas.height = liveImg.naturalHeight || 300;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(liveImg, 0, 0);
                cleanImgs[i].src = canvas.toDataURL('image/jpeg', 0.85);
            } catch (err) {
                // Tainted canvas fallback
            }
        }
    });
}

function scrapeCurrentChat() {
    const nodes = document.querySelectorAll('user-query, model-response');
    const messages = [];
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    nodes.forEach(node => {
        const isUser = node.tagName.toLowerCase() === 'user-query';
        const cleaned = cleanNode(node);

        inlineBlobImages(node, cleaned);

        const extractedImages = [];
        cleaned.querySelectorAll('img').forEach(img => {
            if (img.closest('user-avatar, [class*="avatar"]')) return;
            const src = img.src;
            if (src && !src.startsWith('data:image/svg')) {
                extractedImages.push({
                    src: src,
                    alt: img.alt || (isUser ? 'User Upload' : 'AI Image'),
                    origin: isUser ? 'user' : 'ai'
                });
            }
        });

        const text = cleaned.innerText.trim();
        const html = cleaned.innerHTML.trim();

        if (text.length > 0 || extractedImages.length > 0) {
            messages.push({
                role: isUser ? 'USER' : 'GEMINI',
                timestamp: currentTime,
                text: text,
                html: html,
                images: extractedImages
            });
        }
    });

    return messages;
}

function persistToCache() {
    const msgs = scrapeCurrentChat();
    if (msgs.length === 0) return;

    const firstUserMsg = msgs.find(m => m.role === 'USER');
    const sessionId = firstUserMsg ? firstUserMsg.text.substring(0, 30) : 'untitled_session';

    chrome.storage.local.get(['chat_history'], (res) => {
        let history = res.chat_history || [];
        const existingIdx = history.findIndex(h => h.id === sessionId);

        const sessionObj = {
            id: sessionId,
            timestamp: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            unix: Date.now(),
            messages: msgs
        };

        if (existingIdx !== -1) {
            history[existingIdx] = sessionObj;
        } else {
            history.unshift(sessionObj);
            if (history.length > 10) history.pop();
        }
        chrome.storage.local.set({ chat_history: history });
    });
}

let saveTimeout = null;
const observer = new MutationObserver(() => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(persistToCache, 1200);
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('beforeunload', (e) => {
    if (protectTab && isTempChat() && document.querySelectorAll('user-query').length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "updateSettings") {
        protectTab = req.protectTab;
        sendResponse({ status: "ok" });
    }
    if (req.action === "scrapeChat") {
        sendResponse({ messages: scrapeCurrentChat(), isTempChat: isTempChat() });
    }
});