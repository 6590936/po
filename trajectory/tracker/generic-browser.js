/**
 * 通用浏览器轨迹抓取器
 * 用于 17track 不支持的船公司，通过代理访问官网抓取
 */
import { BaseTracker } from './base.js';
import { createTrackingResult, createTimelineEvent, TRACKING_EVENT_STATUS } from './types.js';
import { getBrowserManager } from './browser.js';
import { getCarrierTrackUrl } from '../constants.js';

export class GenericBrowserTracker extends BaseTracker {
  constructor(carrierCode, carrierName) {
    super(carrierCode, carrierName);
  }

  async track(trackingNo, options = {}) {
    const url = getCarrierTrackUrl(this.carrierCode, trackingNo);
    if (!url) {
      return this.error(trackingNo, '无法生成跟踪链接');
    }

    let page = options.page || null;
    let ownPage = false;
    try {
      if (!page) {
        const browserMgr = getBrowserManager();
        page = await browserMgr.newPage();
        ownPage = true;
      }

      console.log(`[浏览器抓取] ${this.carrierCode} 访问: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.waitForTimeout(5000);

      const bodyText = await page.evaluate(() => document.body?.innerText || '');

      if (!bodyText || bodyText.length < 20) {
        return this.error(trackingNo, '页面无内容');
      }

      const result = this._parseBodyText(trackingNo, bodyText, url);
      return result;
    } catch (err) {
      console.error(`[浏览器抓取] ${this.carrierCode} 失败:`, err.message);
      return this.error(trackingNo, err.message);
    } finally {
      if (page && ownPage) {
        try { await page.close(); } catch (_) {}
      }
    }
  }

  _parseBodyText(trackingNo, bodyText, trackUrl) {
    const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);

    const commonStatusTerms = [
      { term: 'delivered', label: '已交付', status: TRACKING_EVENT_STATUS.DELIVERED },
      { term: 'arrived', label: '已到港', status: TRACKING_EVENT_STATUS.ARRIVED },
      { term: 'departure', label: '已离港', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'departed', label: '已离港', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'gate out', label: '已出闸', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'gate in', label: '已进闸', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'load on', label: '已装船', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'loaded', label: '已装船', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'in transit', label: '运输中', status: TRACKING_EVENT_STATUS.IN_TRANSIT },
      { term: 'discharge', label: '已卸货', status: TRACKING_EVENT_STATUS.ARRIVED },
      { term: 'booked', label: '已订舱', status: TRACKING_EVENT_STATUS.BOOKED },
      { term: 'booking', label: '已订舱', status: TRACKING_EVENT_STATUS.BOOKED },
    ];

    let statusLabel = '未知';
    let status = TRACKING_EVENT_STATUS.UNKNOWN;
    for (const st of commonStatusTerms) {
      if (bodyText.toLowerCase().includes(st.term)) {
        statusLabel = st.label;
        status = st.status;
        break;
      }
    }

    const timeline = [];
    const datePattern = /\d{4}[-/]\d{2}[-/]\d{2}/g;
    const dates = bodyText.match(datePattern) || [];
    for (const date of dates) {
      timeline.push(createTimelineEvent({
        time: date,
        description: `${this.carrierName} 轨迹节点`,
        location: '',
        status,
      }));
    }

    if (timeline.length === 0) {
      timeline.push(createTimelineEvent({
        time: new Date().toISOString().split('T')[0],
        description: `查看详情: ${trackUrl}`,
        location: '',
        status: TRACKING_EVENT_STATUS.UNKNOWN,
      }));
    }

    return createTrackingResult({
      trackingNo,
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      status,
      statusLabel,
      timeline,
      rawData: { pageText: bodyText.substring(0, 2000), trackUrl },
      success: true,
    });
  }
}