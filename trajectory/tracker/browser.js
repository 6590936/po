/**
 * Playwright 浏览器管理器 - 跨平台支持
 * Windows: CDP 连接模式，连接真实 Chrome 绕过反爬
 * Linux:   headless 模式，使用 Playwright 内置 Chromium
 */
import { spawn, execSync } from 'child_process';
import os from 'os';
import path from 'path';

// Playwright 懒加载，避免 Node.js 16 启动时直接报错
let _chromium = null;
let _playwrightAvailable = null;

async function _getChromium() {
  if (!_chromium) {
    if (_playwrightAvailable === false) {
      throw new Error('轨迹抓取不可用：当前 Node.js 版本过低（v' + process.version + '），需要升级到 Node.js 20+');
    }
    try {
      const pw = await import('playwright');
      _chromium = pw.chromium;
      _playwrightAvailable = true;
    } catch (err) {
      _playwrightAvailable = false;
      throw new Error('轨迹抓取不可用：当前 Node.js 版本过低（v' + process.version + '），需要升级到 Node.js 20+');
    }
  }
  return _chromium;
}

export function isPlaywrightAvailable() {
  return _playwrightAvailable !== false;
}

const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const IS_WINDOWS = process.platform === 'win32';

// 仅 Windows CDP 模式使用
const CHROME_PATH = IS_WINDOWS
  ? path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
  : '/usr/bin/google-chrome';
const USER_DATA_DIR = IS_WINDOWS
  ? path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'DebugProfile_CRM')
  : path.join(os.tmpdir(), 'crm-chrome-debug');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.chromeProc = null;
    this.isConnecting = false;
    this.connectPromise = null;
  }

  // ==================== CDP 模式（Windows）====================

  /**
   * 检测 CDP 端口是否可用
   */
  async _checkCdpPort() {
    try {
      const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  /**
   * 杀掉占用端口的旧进程
   */
  async _killOldChrome() {
    try {
      if (IS_WINDOWS) {
        const output = execSync(`netstat -ano | findstr :${CDP_PORT}`, { encoding: 'utf8' });
        const pids = new Set();
        output.split('\n').forEach(line => {
          const match = line.match(/LISTENING\s+(\d+)/);
          if (match) pids.add(match[1]);
        });
        pids.forEach(pid => {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
        });
        if (pids.size > 0) console.log(`[浏览器管理器] 已杀掉占用端口的旧进程: ${[...pids].join(', ')}`);
      } else {
        try { execSync(`fuser -k ${CDP_PORT}/tcp`, { stdio: 'ignore' }); } catch (_) {}
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch (_) {}
  }

  /**
   * Windows: 启动调试模式 Chrome
   */
  async _launchChromeCDP() {
    const portOk = await this._checkCdpPort();
    if (portOk) {
      console.log('[浏览器管理器] CDP 端口已可用，无需启动 Chrome');
      return;
    }

    await this._killOldChrome();

    console.log('[浏览器管理器] 正在启动调试模式 Chrome...');
    this.chromeProc = spawn(CHROME_PATH, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-popup-blocking',
    ], { detached: true, stdio: 'ignore' });
    this.chromeProc.unref();
    console.log('[浏览器管理器] Chrome 已启动，PID:', this.chromeProc.pid);

    for (let i = 0; i < 20; i++) {
      const ok = await this._checkCdpPort();
      if (ok) {
        console.log('[浏览器管理器] CDP 端口就绪');
        return;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Chrome CDP 端口启动超时，请检查 Chrome 是否正常启动');
  }

  /**
   * Windows: 通过 CDP 连接 Chrome
   */
  async _connectCDP() {
    await this._launchChromeCDP();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[浏览器管理器] 正在连接 Chrome (尝试 ${attempt + 1}/3)...`);
        const c = await _getChromium();
        this.browser = await c.connectOverCDP(CDP_URL);
        console.log('[浏览器管理器] 已连接到 Chrome');
        return this.browser;
      } catch (err) {
        console.warn(`[浏览器管理器] 连接失败 (尝试 ${attempt + 1}/3):`, err.message);
        if (attempt < 2) {
          this.chromeProc = null;
          await this._launchChromeCDP();
          await new Promise(r => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
    }
  }

  // ==================== Headless 模式（Linux）====================

  /**
   * Linux: 使用 Playwright 内置 Chromium headless 模式
   */
  async _launchHeadless() {
    console.log('[浏览器管理器] 正在启动 headless Chromium...');
    const c = await _getChromium();
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-http2',
    ];
    const launchOpts = {
      headless: true,
      args,
    };
    const proxyServer = process.env.PLAYWRIGHT_PROXY_SERVER;
    if (proxyServer) {
      launchOpts.proxy = { server: proxyServer };
      if (process.env.PLAYWRIGHT_PROXY_USERNAME) {
        launchOpts.proxy.username = process.env.PLAYWRIGHT_PROXY_USERNAME;
        launchOpts.proxy.password = process.env.PLAYWRIGHT_PROXY_PASSWORD || '';
      }
      console.log('[浏览器管理器] 使用代理:', proxyServer);
    }
    this.browser = await c.launch(launchOpts);
    console.log('[浏览器管理器] Headless Chromium 已启动');
    return this.browser;
  }

  // ==================== 统一入口 ====================

  /**
   * 获取浏览器实例（懒加载，单例）
   */
  async getBrowser() {
    if (this.browser && this.browser.isConnected()) return this.browser;
    if (this.isConnecting) return this.connectPromise;

    this.isConnecting = true;
    this.connectPromise = (async () => {
      try {
        if (IS_WINDOWS) {
          return await this._connectCDP();
        } else {
          return await this._launchHeadless();
        }
      } catch (err) {
        console.error('[浏览器管理器] 启动失败:', err.message);
        this.isConnecting = false;
        this.connectPromise = null;
        throw err;
      }
    })();

    const browser = await this.connectPromise;
    this.isConnecting = false;
    return browser;
  }

  /**
   * 创建新页面
   */
  async newPage() {
    const browser = await this.getBrowser();
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    return page;
  }

  /**
   * 检查是否已连接
   */
  isConnected() {
    return this.browser && this.browser.isConnected();
  }

  /**
   * 断开连接
   */
  async disconnect() {
    if (this.browser) {
      try { await this.browser.close(); } catch (_) {}
      this.browser = null;
    }
    this.isConnecting = false;
    this.connectPromise = null;
  }
}

let instance = null;
export function getBrowserManager() {
  if (!instance) {
    instance = new BrowserManager();
  }
  return instance;
}

export default BrowserManager;