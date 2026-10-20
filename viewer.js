// External script prevents inline script CSP violation
chrome.storage.local.get(['last_saved_chat'], (res) => {
    const chat = res.last_saved_chat;
    const container = document.getElementById('chat-container');
    const meta = document.getElementById('meta');

    if (!chat || !chat.messages || chat.messages.length === 0) {
        container.innerHTML = '<div class="empty">No saved session found in extension storage.</div>';
        meta.innerText = "";
        return;
    }

    meta.innerText = `${chat.messages.length} messages captured on ${chat.date} at ${chat.timestamp}`;

    chat.messages.forEach(msg => {
        const turnDiv = document.createElement('div');
        turnDiv.className = `turn ${msg.role.toLowerCase()}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'header';
        headerDiv.textContent = msg.role;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.innerHTML = msg.html;

        turnDiv.appendChild(headerDiv);
        turnDiv.appendChild(contentDiv);
        container.appendChild(turnDiv);
    });
});