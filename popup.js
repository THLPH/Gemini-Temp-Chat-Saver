document.addEventListener('DOMContentLoaded', () => {
    const els = {
        protect: document.getElementById('cb-protect'),
        time: document.getElementById('cb-time'),
        div: document.getElementById('cb-div'),
        scope: document.getElementById('sel-scope'),
        userImg: document.getElementById('cb-user-img'),
        aiImg: document.getElementById('cb-ai-img')
    };

    chrome.storage.local.get([
        'protect_toggle', 'include_timestamps', 'include_dividers',
        'export_scope', 'include_user_img', 'include_ai_img', 'chat_history'
    ], (res) => {
        els.protect.checked = res.protect_toggle !== false;
        els.time.checked = res.include_timestamps !== false;
        els.div.checked = res.include_dividers !== false;
        els.userImg.checked = res.include_user_img !== false;
        els.aiImg.checked = res.include_ai_img !== false;
        if (res.export_scope) els.scope.value = res.export_scope;

        const meta = document.getElementById('cache-meta');
        meta.innerText = res.chat_history?.length ? `Stored Sessions: ${res.chat_history.length}` : "Stored Sessions: 0";
    });

    function saveState() {
        chrome.storage.local.set({
            protect_toggle: els.protect.checked,
            include_timestamps: els.time.checked,
            include_dividers: els.div.checked,
            export_scope: els.scope.value,
            include_user_img: els.userImg.checked,
            include_ai_img: els.aiImg.checked
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "updateSettings",
                    protectTab: els.protect.checked
                }).catch(() => {});
            }
        });
    }

    Object.values(els).forEach(el => el.addEventListener('change', saveState));

    document.getElementById('btn-offline').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
    });

    ['txt', 'md', 'html'].forEach(fmt => {
        document.getElementById(`btn-${fmt}`).addEventListener('click', () => handleExport(fmt));
    });

    document.getElementById('btn-imgs-only').addEventListener('click', () => handleExport('images_only'));

    function handleExport(format) {
        document.getElementById('status').innerText = "Exporting...";
        const opts = {
            scope: els.scope.value,
            timestamps: els.time.checked,
            dividers: els.div.checked,
            userImg: els.userImg.checked,
            aiImg: els.aiImg.checked
        };

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab?.url?.includes("gemini.google.com")) {
                chrome.tabs.sendMessage(tab.id, { action: "scrapeChat" }, (res) => {
                    if (res?.messages?.length > 0) {
                        dispatchExport(res.messages, format, opts, res.isTempChat);
                    } else fallbackToStorage(format, opts);
                });
            } else fallbackToStorage(format, opts);
        });
    }

    function fallbackToStorage(format, opts) {
        chrome.storage.local.get(['chat_history'], (res) => {
            if (res.chat_history && res.chat_history.length > 0) {
                dispatchExport(res.chat_history[0].messages, format, opts, true);
            } else {
                document.getElementById('status').innerText = "No data available.";
            }
        });
    }
});

function dispatchExport(allMsgs, format, opts, isTemp) {
    if (format === 'images_only') {
        downloadImagesOnly(allMsgs, opts);
        return;
    }
    triggerDownload(allMsgs, format, opts, isTemp);
}

function downloadImagesOnly(allMsgs, opts) {
    let images = [];
    allMsgs.forEach(m => {
        if (!m.images) return;
        m.images.forEach(img => {
            if (img.origin === 'user' && !opts.userImg) return;
            if (img.origin === 'ai' && !opts.aiImg) return;
            images.push(img);
        });
    });

    if (images.length === 0) {
        document.getElementById('status').innerText = "No images found.";
        return;
    }

    images.forEach((img, i) => {
        chrome.downloads.download({
            url: img.src,
            filename: `gemini_image_${i + 1}.${img.src.includes('jpeg') ? 'jpg' : 'png'}`,
            saveAs: false
        });
    });

    document.getElementById('status').innerText = `Saved ${images.length} images.`;
}

function triggerDownload(allMsgs, format, opts, isTemp) {
    const messages = allMsgs.filter(m => {
        if (opts.scope === 'user' && m.role !== 'USER') return false;
        if (opts.scope === 'ai' && m.role !== 'GEMINI') return false;
        return true;
    });

    messages.forEach(m => {
        const div = document.createElement('div');
        div.innerHTML = m.html;
        if ((m.role === 'USER' && !opts.userImg) || (m.role === 'GEMINI' && !opts.aiImg)) {
            div.querySelectorAll('img, .file-preview-container, .attachment-container').forEach(el => el.remove());
        }
        m.filteredHtml = div.innerHTML;
    });

    let content = "", mimeType = "text/plain";

    if (format === 'html') {
        mimeType = "text/html";
        content = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Gemini Transcript</title><style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.65; max-width: 820px; margin: 40px auto; padding: 0 24px; background: #111215; color: #e2e4e9; font-size: 15px; }
.turn { margin-bottom: 24px; border-radius: 8px; border: 1px solid #282a32; overflow: hidden; background: #1b1c22; }
.turn.user { background: #181c24; border-color: #273042; }
.header { padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; font-family: ui-monospace, Menlo, monospace; }
.turn.user .header { color: #60a5fa; }
.turn.gemini .header { color: #c084fc; }
.content { padding: 18px 20px; overflow-wrap: break-word; }
p { margin-top: 0; margin-bottom: 14px; }
p:last-child { margin-bottom: 0; }
img { max-width: 100%; height: auto; border-radius: 6px; display: block; margin: 14px 0; border: 1px solid #282a32; }
.file-preview-container img { max-width: 320px; }
pre { background: #0c0d10; padding: 14px; border-radius: 6px; border: 1px solid #282a32; overflow-x: auto; font-family: ui-monospace, monospace; font-size: 13px; }
code { font-family: ui-monospace, monospace; font-size: 13px; background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 4px; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }
th, td { border: 1px solid #282a32; padding: 8px 12px; text-align: left; }
th { background: #131417; }
</style></head><body>
${messages.map(m => `<div class="turn ${m.role.toLowerCase()}"><div class="header"><span>${m.role}</span>${opts.timestamps?`<span>${m.timestamp}</span>`:''}</div><div class="content">${m.filteredHtml}</div></div>${opts.dividers?'<hr style="border:0;border-top:1px solid #282a32;margin:24px 0;">':''}`).join('')}</body></html>`;
    } else if (format === 'md') {
        messages.forEach(m => content += `### ${m.role}${opts.timestamps ? ` (${m.timestamp})` : ''}\n\n${m.text}\n\n${opts.dividers ? '---\n\n' : ''}`);
    } else {
        messages.forEach(m => content += `[${m.role}${opts.timestamps ? ` ${m.timestamp}` : ''}]\n${m.text}\n\n${opts.dividers ? '----------------------------------------\n\n' : ''}`);
    }

    let baseName = allMsgs[0].text.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').substring(0, 40).replace(/_+$/, '');
    const filename = `${baseName || 'gemini_transcript'}${opts.scope === 'user' ? '_prompts' : ''}.${format}`;
    const blobUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));

    chrome.downloads.download({ url: blobUrl, filename: filename, saveAs: false }, () => {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        document.getElementById('status').innerText = "Complete.";
        setTimeout(() => window.close(), 800);
    });
}