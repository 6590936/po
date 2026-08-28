/**
 * 马士基航运（MAERSK）轨迹抓取器
 * 跟踪页面: https://www.maersk.com/tracking/{number}
 * 使用 CDP 连接真实 Chrome，绕过 Akamai 反爬
 */
import { BaseTracker } from './base.js';
import { createTrackingResult, createTimelineEvent, TRACKING_EVENT_STATUS } from './types.js';
import { getBrowserManager } from './browser.js';

export class MaerskTracker extends BaseTracker {
  constructor() {
    super('MSK', '马士基航运');
    this.baseUrl = 'https://www.maersk.com/tracking';
  }

  async track(trackingNo, options = {}) {
    let page = null;
    try {
      // 使用浏览器管理器获取页面（CDP连接真实Chrome）
      const browserMgr = getBrowserManager();
      page = await browserMgr.newPage();

      // 访问跟踪页面
      const url = `${this.baseUrl}/${encodeURIComponent(trackingNo)}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 等待数据加载
      await this._waitForData(page);

      // 解析页面数据
      const data = await this._parsePage(page, trackingNo);

      return data;
    } catch (err) {
      console.error('[马士基抓取] 失败:', err.message);
      return this.error(trackingNo, err.message);
    } finally {
      if (page) {
        try { await page.close(); } catch (_) {}
      }
    }
  }

  /**
   * 等待数据加载
   */
  async _waitForData(page) {
    // 等待页面上出现轨迹相关文本
    for (let i = 0; i < 15; i++) {
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes('Bill of Lading') || text.includes('Container') || text.includes('Estimated arrival')) {
        await this.sleep(2000); // 再多等2秒确保完整加载
        return;
      }
      await this.sleep(1000);
    }
  }

  /**
   * 解析页面数据
   */
  async _parsePage(page, trackingNo) {
    const parsed = await page.evaluate(() => {
      const body = document.body.innerText;
      const lines = body.split('\n').map(l => l.trim()).filter(l => l);
      const result = {
        trackingNo: '',
        origin: '',
        destination: '',
        containerNo: '',
        containerType: '',
        eta: '',
        latestEvent: '',
        timeline: [],
      };

      // 提取起运港和目的港（限制只匹配纯大写字母和空格，到箱号前停止）
      const fromMatch = body.match(/From\s+([A-Z]+(?:\s+[A-Z]+)*)\s+To\s+([A-Z]+(?:\s+[A-Z]+)*)/);
      if (fromMatch) {
        result.origin = fromMatch[1].trim();
        result.destination = fromMatch[2].trim();
      }

      // 提取箱号和箱型
      const cntMatch = body.match(/([A-Z]{4}\d{7})\s+\|\s+([^\n]+)/);
      if (cntMatch) {
        result.containerNo = cntMatch[1];
        result.containerType = cntMatch[2].trim();
      }

      // 提取预计到港
      const etaMatch = body.match(/Estimated arrival date[\s\S]{0,30}?(\d{1,2}\s+\w+\s+\d{4}[\s\d:]*)/);
      if (etaMatch) result.eta = etaMatch[1].trim();

      // 提取最新事件
      const latestMatch = body.match(/Latest event[\s\S]{0,100}?([A-Z][^\n]{5,})/);
      if (latestMatch) result.latestEvent = latestMatch[1].trim();

      // 提取轨迹时间线节点
      const noteIdx = lines.findIndex(l => l.startsWith('Note: All times'));
      const startIdx = noteIdx >= 0 ? noteIdx + 1 : 0;

      const validEvents = ['Gate out', 'Gate in', 'Load on', 'Vessel departure', 'Vessel arrival',
                           'Loaded', 'Discharged', 'Delivered', 'Customs clearance', 'Empty return'];

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        const isValidEvent = validEvents.some(kw => line.startsWith(kw));

        if (isValidEvent && i + 1 < lines.length) {
          const timeLine = lines[i + 1];
          if (/\d{1,2}\s+\w+\s+\d{4}/.test(timeLine)) {
            result.timeline.push({ event: line, time: timeLine, location: '', company: '' });
            i++;
          }
        }
      }

      return result;
    });

    // 构建统一格式的时间线
    const timeline = parsed.timeline.map(evt => {
      let status = TRACKING_EVENT_STATUS.UNKNOWN;
      const eventLower = evt.event.toLowerCase();

      if (eventLower.includes('gate out empty')) status = TRACKING_EVENT_STATUS.RECEIVED;
      else if (eventLower.includes('gate in')) status = TRACKING_EVENT_STATUS.RECEIVED;
      else if (eventLower.includes('load on')) status = TRACKING_EVENT_STATUS.LOADED;
      else if (eventLower.includes('vessel departure')) status = TRACKING_EVENT_STATUS.DEPARTED;
      else if (eventLower.includes('vessel arrival')) status = TRACKING_EVENT_STATUS.ARRIVED;
      else if (eventLower.includes('discharged')) status = TRACKING_EVENT_STATUS.DISCHARGED;
      else if (eventLower.includes('delivered')) status = TRACKING_EVENT_STATUS.DELIVERED;
      else if (eventLower.includes('customs')) status = TRACKING_EVENT_STATUS.CUSTOMS;

      return createTimelineEvent({
        time: evt.time,
        location: '',
        status,
        description: evt.event,
        isEstimated: /\d{1,2}\s+\w+\s+\d{4}/.test(evt.time) && new Date() < new Date(evt.time.replace(/(\d{1,2})\s+(\w+)\s+(\d{4})/, '$2 $1, $3')),
      });
    });

    // 确定当前状态
    let currentStatus = TRACKING_EVENT_STATUS.UNKNOWN;
    if (timeline.length > 0) {
      const lastEvent = timeline[timeline.length - 1];
      currentStatus = lastEvent.status;
    }

    return createTrackingResult({
      trackingNo: parsed.trackingNo || trackingNo,
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      origin: parsed.origin,
      destination: parsed.destination,
      containerNo: parsed.containerNo,
      eta: parsed.eta,
      status: currentStatus,
      timeline,
      rawData: parsed,
    });
  }
}
