chrome.storage.local.get(['chat_history'], (res) => {
    const history = res.chat_history || [];
    const listEl = document.getElementById('session-list');
    const chatEl = document.getElementById('chat-container');
    const toolbar = document.getElementById('toolbar');
    let activeSession = null;

    if (history.length === 0) {
        listEl.innerHTML = '<div style="padding:16px; color:#777; font-size:12px;">No saved history found.</div>';
        return;
    }

    history.forEach((session, index) => {
        const item = document.createElement('div');
        item.className = 'session-item';
        item.innerHTML = `
            <div class="session-title">${session.id}</div>
            <div class="session-meta">${session.messages.length} messages • ${session.date}</div>
        `;
        
        item.addEventListener('click', () => {
            document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            activeSession = session;
            toolbar.style.display = 'flex';
            renderActiveChat();
        });

        listEl.appendChild(item);
        if (index === 0) item.click();
    });

    const vScope = document.getElementById('v-scope');
    const vUserImg = document.getElementById('v-user-img');
    const vAiImg = document.getElementById('v-ai-img');
    const vTime = document.getElementById('v-time');
    const vDiv = document.getElementById('v-div');

    [vScope, vUserImg, vAiImg, vTime, vDiv].forEach(el => el.addEventListener('change', renderActiveChat));

    function getActiveOptions() {
        return {
            scope: vScope.value,
            userImg: vUserImg.checked,
            aiImg: vAiImg.checked,
            timestamps: vTime.checked,
            dividers: vDiv.checked
        };
    }

    function renderActiveChat() {
        if (!activeSession) return;
        const opts = getActiveOptions();
        chatEl.innerHTML = '';

        const messages = activeSession.messages.filter(m => {
            if (opts.scope === 'user' && m.role !== 'USER') return false;
            if (opts.scope === 'ai' && m.role !== 'GEMINI') return false;
            return true;
        });

        messages.forEach(msg => {
            const turn = document.createElement('div');
            turn.className = `turn ${msg.role.toLowerCase()}`;

            const div = document.createElement('div');
            div.innerHTML = msg.html;
            if ((msg.role === 'USER' && !opts.userImg) || (msg.role === 'GEMINI' && !opts.aiImg)) {
                div.querySelectorAll('img, .file-preview-container, .attachment-container').forEach(el => el.remove());
            }

            turn.innerHTML = `
                <div class="turn-head">
                    <span>${msg.role}</span>
                    ${opts.timestamps ? `<span class="turn-time">${msg.timestamp}</span>` : ''}
                </div>
                <div class="turn-body">${div.innerHTML}</div>
            `;
            chatEl.appendChild(turn);
        });
    }

    function exportSession(format) {
        if (!activeSession) return;
        const opts = getActiveOptions();
        const allMsgs = activeSession.messages;

        if (format === 'images_only') {
            let images = [];
            allMsgs.forEach(m => {
                m.images?.forEach(img => {
                    if (img.origin === 'user' && !opts.userImg) return;
                    if (img.origin === 'ai' && !opts.aiImg) return;
                    images.push(img);
                });
            });

            images.forEach((img, i) => {
                chrome.downloads.download({
                    url: img.src,
                    filename: `image_${i + 1}.${img.src.includes('jpeg') ? 'jpg' : 'png'}`,
                    saveAs: false
                });
            });
            return;
        }

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

        const filename = `${activeSession.id.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}.${format}`;
        const blobUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));

        chrome.downloads.download({ url: blobUrl, filename: filename, saveAs: false }, () => {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        });
    }

    document.getElementById('v-dl-txt').addEventListener('click', () => exportSession('txt'));
    document.getElementById('v-dl-md').addEventListener('click', () => exportSession('md'));
    document.getElementById('v-dl-html').addEventListener('click', () => exportSession('html'));
    document.getElementById('v-dl-imgs').addEventListener('click', () => exportSession('images_only'));
});