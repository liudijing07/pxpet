# pxpet 🎨

Pixel art desktop pet powered by [OpenClaw](https://github.com/openclaw/openclaw). A cute animated companion that lives on your desktop — walks around, does tricks, talks to you, and connects to OpenClaw for AI-powered conversations.

> **Why pxpet?** Most desktop pets are just eye candy. pxpet connects to your OpenClaw agent, so your pet actually *talks back* with the personality you've configured. It's your AI assistant in pixel form.

## ✨ Highlights

- 🤖 **OpenClaw Native** — Chat with your OpenClaw AI agent directly through the pet. Your agent's personality, memory, and skills all work here.
- 🎨 **Pixel Art Animations** — Smooth sprite animations: idle, walk, drag, and character-specific special moves
- 🔊 **Voice Effects** — Each character has unique voice clips triggered by actions
- 🎭 **5 Characters** — Switch between characters via system tray
- 🔌 **REST API + WebSocket** — Control the pet programmatically from OpenClaw skills or any external tool
- 🖥️ **Always On Top** — Transparent, frameless window that sits on your desktop. Drag anywhere, wraps around screen edges.

## 🚀 Quick Start

```bash
git clone https://github.com/liudijing07/pxpet.git
cd pxpet
npm install
npm start
```

The pet appears in the bottom-right corner. Right-click for the context menu.

## 🔗 Connect to OpenClaw

pxpet is designed to work with [OpenClaw](https://github.com/openclaw/openclaw) — an open-source AI agent platform. Once connected, you can double-click the pet to chat with your agent.

### Setup

1. Copy the config template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your OpenClaw Gateway credentials:
   ```
   OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789/v1/chat/completions
   OPENCLAW_GATEWAY_TOKEN=your-gateway-token-here
   ```

3. Restart pxpet. Double-click the pet to open the chat window.

### Config Auto-Discovery

pxpet tries to find your OpenClaw config automatically:

1. `.env` file in app directory (recommended)
2. Environment variables (`OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`)
3. OpenClaw config at `~/.openclaw/openclaw.json`

If you already have OpenClaw running locally, pxpet may just work out of the box.

### What Can It Do?

- 💬 **Chat** — Talk to your OpenClaw agent. Supports text and image input.
- 📡 **Receive Push Messages** — OpenClaw skills can send messages to the pet via local API
- 🎭 **Remote Control** — Trigger animations, switch characters, show notifications from OpenClaw

## 🎮 Controls

| Action | Input |
|--------|-------|
| Move | Click and drag |
| Chat | Double-click |
| Context menu | Right-click |
| System tray | Click tray icon for chat, right-click for full menu |

## 🔌 API (port 19190)

OpenClaw skills and external tools can control the pet via local HTTP API:

**Show a message bubble:**
```bash
curl -X POST http://127.0.0.1:19190/message \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello from OpenClaw!", "duration": 5000}'
```

**Trigger animation:**
```bash
curl -X POST http://127.0.0.1:19190/animation \
  -H 'Content-Type: application/json' \
  -d '{"animation": "walk_right"}'
```

**Switch character:**
```bash
curl -X POST http://127.0.0.1:19190/character \
  -H 'Content-Type: application/json' \
  -d '{"name": "Yui"}'
```

**Check status:**
```bash
curl http://127.0.0.1:19190/status
```

**WebSocket:**
```javascript
const ws = new WebSocket('ws://127.0.0.1:19190');
ws.send(JSON.stringify({ type: 'message', text: 'Hello!' }));
ws.send(JSON.stringify({ type: 'animation', animation: 'drag' }));
```

## 📁 Project Structure

```
pxpet/
├── main.js              # Electron main process
├── index.html           # Animation engine + pet renderer
├── chat.html            # Chat window (OpenClaw integration)
├── openclaw-bridge.js   # OpenClaw Gateway bridge + local HTTP API
├── .env.example         # Config template
├── frames/              # Sprite frames per character
│   └── MascotXxx/
│       ├── metadata.json
│       ├── idle_00.png
│       └── ...
└── sounds/              # Voice clips per character
    └── MascotXxx/
```

## 🎨 Sprite Format

The sprites were decoded from the EL01 binary format used by MascotTable (ELEMENTAL SOFT). The reverse-engineering work and frame extraction tools are in the companion `kon-extract` directory.

## 📄 License

Source code is licensed under the [MIT License](LICENSE).

### ⚠️ Asset Notice

The sprite art and voice clips in `frames/` and `sounds/` are **NOT** covered by the MIT license:

- **Sprites:** MascotTable by ELEMENTAL SOFT
- **Characters:** K-ON! (けいおん！) © Kakifly / Houbunsha / Kyoto Animation / TBS

These assets are included for personal/educational use only. **Do not use them commercially.** If you are the rights holder and want them removed, please open an issue.

## Credits

- EL01 format reverse-engineered by [liudijing07](https://github.com/liudijing07)
- Built with [Electron](https://www.electronjs.org/)
- AI integration via [OpenClaw](https://github.com/openclaw/openclaw)
