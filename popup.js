document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const backupStatus = document.getElementById('backup-status');

    // 1. Check if we have an auto-saved chat in storage
    chrome.storage.local.get(['last_saved_chat'], (result) => {
        if (result.last_saved_chat && result.last_saved_chat.messages.length > 0) {
            const chat = result.last_saved_chat;
            backupStatus.innerText = `Saved: ${chat.messages.length} msgs (${chat.date} at ${chat.timestamp})`;
        } else {
            backupStatus.innerText = "No chat recorded yet.";
        }
    });

    // 2. Open Offline Viewer
    document.getElementById('btn-open-offline').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
    });

    // 3. Tab Protection toggle
    document.getElementById('protect-toggle').addEventListener('change', (e) => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "updateSettings", protectTab: e.target.checked });
            }
        });
    });

    // 4. Export Buttons Handlers
    document.getElementById('btn-txt').addEventListener('click', () => handleExport('txt'));
    document.getElementById('btn-md').addEventListener('click', () => handleExport('md'));
    document.getElementById('btn-html').addEventListener('click', () => handleExport('html'));

    function handleExport(format) {
        statusDiv.innerText = "Processing...";
        const scope = document.getElementById('export-scope').value;

        // Try getting live chat from active tab first
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const currentTab = tabs[0];
            
            if (currentTab && currentTab.url && currentTab.url.includes("gemini.google.com")) {
                chrome.tabs.sendMessage(currentTab.id, {action: "scrapeChat"}, (response) => {
                    if (response && response.messages && response.messages.length > 0) {
                        triggerDownload(response.messages, format, scope, response.isTempChat);
                    } else {
                        fallbackToStorage(format, scope);
                    }
                });
            } else {
                // If not on Gemini tab, fall back to storage
                fallbackToStorage(format, scope);
            }
        });
    }

    function fallbackToStorage(format, scope) {
        chrome.storage.local.get(['last_saved_chat'], (result) => {
            if (result.last_saved_chat && result.last_saved_chat.messages.length > 0) {
                triggerDownload(result.last_saved_chat.messages, format, scope, true);
            } else {
                statusDiv.innerText = "No chat messages found.";
            }
        });
    }
});

// Trigger file download using Chrome's native download manager (Never hangs)
function triggerDownload(allMessages, format, scope, isTemp) {
    const statusDiv = document.getElementById('status');
    
    let messages = allMessages.filter(msg => {
        if (scope === 'user' && msg.role !== 'USER') return false;
        if (scope === 'ai' && msg.role !== 'GEMINI') return false;
        return true;
    });

    if (messages.length === 0) {
        statusDiv.innerText = "No matching messages to export.";
        return;
    }

    let content = "";
    let mimeType = "text/plain";

    if (format === 'txt') {
        content = `GEMINI TRANSCRIPT\n=========================\n\n`;
        messages.forEach(m => { content += `[${m.role}]:\n${m.text}\n\n-------------------------\n\n`; });
    } else if (format === 'md') {
        content = `# Gemini Transcript\n\n---\n\n`;
        messages.forEach(m => { content += `### **${m.role}**\n\n${m.text}\n\n---\n\n`; });
    } else if (format === 'html') {
        mimeType = "text/html";
        content = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;background:#1e1e1e;color:#e0e0e0;line-height:1.6;}.msg{margin-bottom:20px;padding:15px;border-radius:8px;}.user{background:#2d2d30;border-left:4px solid #4a90e2;}.gemini{background:#252526;border-left:4px solid #b388ff;}.role{font-weight:bold;margin-bottom:10px;opacity:0.8;}pre{background:#000;padding:10px;overflow-x:auto;}</style></head><body><h2>Gemini Transcript</h2>`;
        messages.forEach(m => { content += `<div class="msg ${m.role.toLowerCase()}"><div class="role">${m.role}</div><div>${m.html}</div></div>\n`; });
        content += `</body></html>`;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    let filename = `Gemini_${isTemp ? 'Temp' : 'Chat'}_${dateStr}`;
    if (scope === 'user') filename += '_PromptsOnly';
    filename += `.${format}`;

    // Convert to Data URL and download via Chrome Downloads API
    const base64Data = btoa(unescape(encodeURIComponent(content)));
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false
    }, () => {
        statusDiv.innerText = "Downloaded successfully!";
        setTimeout(() => window.close(), 1200);
    });
}