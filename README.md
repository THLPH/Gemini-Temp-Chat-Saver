# Gemini Temp Saver & Restorer

A lightweight Chrome Extension (Manifest V3) designed to prevent data loss in Google Gemini temporary chats. It silently auto-saves active conversations to local browser storage, prevents accidental tab closures, provides offline viewing, and enables one-click transcript exports to TXT, Markdown, and HTML.

---

## Features

- **Silent Auto-Saving:** Continuously monitors Gemini chats using a debounced DOM mutation observer and syncs changes to chrome.storage.local.
- **Tab Protection:** Prevents accidental navigation, reload, or closing when unsaved messages are present in a Gemini temp chat (/app).
- **Flexible Exports:** Export full chats, prompt-only, or model responses only into:
  - Markdown (.md)
  - Plain Text (.txt)
  - Standalone Styled HTML (.html)
- **Offline Recovery Viewer:** Access and review your last cached conversation even if Gemini is down or the tab was closed.
- **Privacy-First:** Operates strictly on-device using local Chrome APIs. No third-party servers, analytics, or external network requests.

---

## File Structure

```text
├── manifest.json      # Extension metadata and Manifest V3 permissions
├── content.js         # Chat scraper, autosave observer, and beforeunload guard
├── popup.html         # Toolbar popup interface
├── popup.js           # Export handlers and settings controller
├── viewer.html        # Standalone offline chat recovery viewer
└── icons/             # App icons (16x16, 48x48, 128x128)
```

---

## Installation (Developer Mode)

1. Clone or download this repository to your local machine:
   ```bash
   git clone [https://github.com/your-username/gemini-temp-saver.git](https://github.com/your-username/gemini-temp-saver.git)
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the folder containing the project files (the directory with manifest.json).
6. Pin **Gemini Saver** to your Chrome toolbar for quick access.

---

## Permissions Used

- `storage`: Caches your latest conversation data locally in Chrome's sandboxed storage.
- `downloads`: Saves generated .txt, .md, and .html transcripts directly to your default download location.
- `activeTab`: Allows interaction with the active Gemini tab when opening the extension popup.

---

## License

MIT License. Feel free to modify and adapt for personal use.
