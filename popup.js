document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const backupStatus = document.getElementById('backup-status');

    // Read cached state
    chrome.storage.local.get(['last_saved_chat'], (result) => {
        if (result.last_saved_chat && result.last_saved_chat.messages?.length > 0) {
            const chat = result.last_saved_chat;
            backupStatus.innerText = `Cached ${chat.messages.length} msgs (${chat.timestamp})`;
        } else {
            backupStatus.innerText = "No cached conversation.";
        }
    });

    document.getElementById('btn-open-offline').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
    });

    document.getElementById('protect-toggle').addEventListener('change', (e) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "updateSettings", protectTab: e.target.checked });
            }
        });
    });

    document.getElementById('btn-txt').addEventListener('click', () => handleExport('txt'));
    document.getElementById('btn-md').addEventListener('click', () => handleExport('md'));
    document.getElementById('btn-html').addEventListener('click', () => handleExport('html'));

    function handleExport(format) {
        statusDiv.innerText = "Processing...";
        const scope = document.getElementById('export-scope').value;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab?.url?.includes("gemini.google.com")) {
                chrome.tabs.sendMessage(tab.id, { action: "scrapeChat" }, (response) => {
                    if (response?.messages?.length > 0) {
                        triggerDownload(response.messages, format, scope, response.isTempChat);
                    } else {
                        fallbackToStorage(format, scope);
                    }
                });
            } else {
                fallbackToStorage(format, scope);
            }
        });
    }

    function fallbackToStorage(format, scope) {
        chrome.storage.local.get(['last_saved_chat'], (result) => {
            if (result.last_saved_chat?.messages?.length > 0) {
                triggerDownload(result.last_saved_chat.messages, format, scope, true);
            } else {
                statusDiv.innerText = "No messages available to export.";
            }
        });
    }
});

function triggerDownload(allMessages, format, scope, isTemp) {
    const statusDiv = document.getElementById('status');
    const messages = allMessages.filter(msg => {
        if (scope === 'user' && msg.role !== 'USER') return false;
        if (scope === 'ai' && msg.role !== 'GEMINI') return false;
        return true;
    });

    if (messages.length === 0) {
        statusDiv.innerText = "No messages matching selected scope.";
        return;
    }

    let content = "";
    let mimeType = "text/plain";

    if (format === 'txt') {
        content = `GEMINI TRANSCRIPT\nExported: ${new Date().toLocaleString()}\n${'='.repeat(40)}\n\n`;
        messages.forEach(m => {
            content += `[${m.role}]\n${m.text}\n\n${'-'.repeat(40)}\n\n`;
        });
    } else if (format === 'md') {
        content = `# Gemini Transcript\n*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
        messages.forEach(m => {
            content += `### ${m.role}\n\n${m.text}\n\n---\n\n`;
        });
    } else if (format === 'html') {
        mimeType = "text/html";
        content = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Gemini Transcript</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 760px; margin: 40px auto; padding: 0 20px; background: #0d1117; color: #c9d1d9; }
  h1 { font-size: 20px; border-bottom: 1px solid #21262d; padding-bottom: 10px; margin-bottom: 24px; color: #f0f6fc; }
  .turn { margin-bottom: 24px; border: 1px solid #30363d; border-radius: 6px; overflow: hidden; }
  .header { padding: 8px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .turn.user .header { background: #161b22; color: #58a6ff; border-bottom: 1px solid #30363d; }
  .turn.gemini .header { background: #161b22; color: #bc8cff; border-bottom: 1px solid #30363d; }
  .content { padding: 16px; font-size: 14px; overflow-wrap: break-word; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }
  th, td { border: 1px solid #30363d; padding: 8px 12px; text-align: left; }
  th { background: #161b22; }
  pre { background: #161b22; padding: 12px; border-radius: 6px; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace; font-size: 12px; }
</style>
</head>
<body>
<h1>Gemini Transcript <span style="font-size: 12px; font-weight: normal; color: #8b949e;">(${new Date().toLocaleString()})</span></h1>
${messages.map(m => `
<div class="turn ${m.role.toLowerCase()}">
  <div class="header">${m.role}</div>
  <div class="content">${m.html}</div>
</div>`).join('')}
</body>
</html>`;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    let filename = `Gemini_${isTemp ? 'Temp' : 'Chat'}_${dateStr}`;
    if (scope === 'user') filename += '_PromptsOnly';
    filename += `.${format}`;

    const base64Data = btoa(unescape(encodeURIComponent(content)));
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: false
    }, () => {
        statusDiv.innerText = "Export complete.";
        setTimeout(() => window.close(), 1000);
    });
}