/**
 * OpenClaw integration for pxpet Desktop Pet
 * 
 * Two modes:
 * 1. Local HTTP API (port 19190) - OpenClaw can push messages/commands to the pet
 * 2. Gateway Chat API - Pet sends user messages to OpenClaw Gateway for AI responses
 * 
 * Configuration priority:
 * 1. .env file in app directory (recommended)
 * 2. Environment variables: OPENCLAW_GATEWAY_URL, OPENCLAW_GATEWAY_TOKEN
 * 3. OpenClaw config files (~/.openclaw/openclaw.json)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

class OpenClawBridge {
  constructor(mainWindow, options = {}) {
    this.mainWindow = mainWindow;
    this.port = options.port || 19190;
    this.server = null;
    
    // Gateway config - for sending messages TO OpenClaw
    this.gatewayUrl = options.gatewayUrl || null;
    this.gatewayToken = options.gatewayToken || null;
    this.sessionUser = 'pxpet-user'; // stable session key

    this._loadConfig();
  }

  /**
   * Parse a .env file into key-value pairs
   */
  _parseEnvFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const vars = {};
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
      }
      return vars;
    } catch (e) {
      return null;
    }
  }

  _loadConfig() {
    // 1. Try user data config (saved via settings UI) — works in packaged app
    try {
      const { app } = require('electron');
      const userConfigPath = path.join(app.getPath('userData'), 'openclaw-config.json');
      const raw = fs.readFileSync(userConfigPath, 'utf-8');
      const config = JSON.parse(raw);
      if (config.gatewayUrl && config.gatewayToken) {
        this.gatewayUrl = config.gatewayUrl;
        this.gatewayToken = config.gatewayToken;
        console.log(`[OpenClaw] Gateway (user config): ${this.gatewayUrl}`);
        return;
      }
    } catch (e) { /* continue */ }

    // 2. Try .env file in app directory (dev mode)
    const envPath = path.join(__dirname, '.env');
    const envVars = this._parseEnvFile(envPath);
    if (envVars && envVars.OPENCLAW_GATEWAY_URL && envVars.OPENCLAW_GATEWAY_TOKEN) {
      this.gatewayUrl = envVars.OPENCLAW_GATEWAY_URL;
      this.gatewayToken = envVars.OPENCLAW_GATEWAY_TOKEN;
      console.log(`[OpenClaw] Gateway (.env): ${this.gatewayUrl}`);
      return;
    }

    // 3. Try environment variables
    if (process.env.OPENCLAW_GATEWAY_URL && process.env.OPENCLAW_GATEWAY_TOKEN) {
      this.gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
      this.gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
      console.log(`[OpenClaw] Gateway (env vars): ${this.gatewayUrl}`);
      return;
    }

    // 4. Try OpenClaw config files
    const home = process.env.HOME || process.env.USERPROFILE;
    if (home) {
      const configPaths = [
        path.join(home, '.openclaw', 'openclaw.json'),
        path.join(home, '.openclaw', 'config.json'),
      ];

      for (const cfgPath of configPaths) {
        try {
          const raw = fs.readFileSync(cfgPath, 'utf-8');
          const config = JSON.parse(raw);
          const gw = config.gateway || {};
          const port = gw.port || 18789;
          const bind = gw.bind || '127.0.0.1';
          const auth = gw.auth || {};
          
          this.gatewayUrl = `http://${bind}:${port}/v1/chat/completions`;
          this.gatewayToken = auth.token || null;
          
          if (this.gatewayUrl && this.gatewayToken) {
            console.log(`[OpenClaw] Gateway (${cfgPath}): ${this.gatewayUrl}`);
            return;
          }
        } catch (e) {
          // try next
        }
      }
    }

    console.warn('[OpenClaw] No gateway config found. Chat will not work.');
    console.warn('[OpenClaw] Create a .env file from .env.example, or set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN env vars.');
  }

  start() {
    // Local HTTP server for OpenClaw → Pet push commands
    this.server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          this.handleRequest(req, res, body);
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[OpenClaw] Local API on http://127.0.0.1:${this.port}`);
    });
  }

  handleRequest(req, res, body) {
    const url = new URL(req.url, `http://localhost:${this.port}`);
    const pathname = url.pathname;
    
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && pathname === '/status') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, app: 'pxpet', version: '1.0.0' }));
      return;
    }

    if (req.method === 'POST' && pathname === '/message') {
      const data = JSON.parse(body);
      this.mainWindow.webContents.send('push-openclaw-message', data.text || data.message || '');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && pathname === '/animation') {
      const data = JSON.parse(body);
      this.mainWindow.webContents.send('play-animation', data.animation || data.anim || 'idle');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'POST' && pathname === '/character') {
      const data = JSON.parse(body);
      this.mainWindow.webContents.send('switch-character', `Mascot${data.character || data.name}`);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Send a user message to OpenClaw Gateway and get AI response
   * Supports text + optional image (base64 data URL)
   */
  async sendToOpenClaw(message, imageDataUrl) {
    if (!this.gatewayUrl || !this.gatewayToken) {
      return { error: 'OpenClaw Gateway not configured. Create a .env file from .env.example' };
    }

    try {
      // Build message content (text or multimodal)
      let content;
      if (imageDataUrl) {
        // Multimodal: text + image (OpenAI vision format)
        content = [];
        if (message) {
          content.push({ type: 'text', text: message });
        }
        content.push({
          type: 'image_url',
          image_url: { url: imageDataUrl },
        });
      } else {
        content = message;
      }

      const payload = JSON.stringify({
        model: 'openclaw',
        user: this.sessionUser,
        messages: [{ role: 'user', content }],
      });

      const response = await this._httpPost(this.gatewayUrl, payload, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.gatewayToken}`,
        'x-openclaw-agent-id': 'main',
      });

      const data = JSON.parse(response);
      
      if (data.error) {
        return { error: data.error.message || 'Gateway error' };
      }

      const choice = data.choices && data.choices[0];
      if (choice && choice.message) {
        return { text: choice.message.content };
      }

      return { error: 'Empty response' };
    } catch (e) {
      console.error('[OpenClaw] Chat error:', e.message);
      return { error: `Connection failed: ${e.message}` };
    }
  }

  _httpPost(url, body, headers) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const mod = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = mod.request(parsedUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 120000, // 2 min timeout for AI responses
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(body);
      req.end();
    });
  }

  stop() {
    if (this.server) this.server.close();
  }
}

module.exports = OpenClawBridge;
