/**
 * 轨迹抓取器 - 管理器
 * 负责管理所有船公司抓取器，提供统一查询入口
 */
import { SeventeenTrackTracker } from './seventeen-track.js';
import { GenericBrowserTracker } from './generic-browser.js';
import { createErrorResult } from './types.js';

const FALLBACK_CARRIERS = ['YML', 'HMM', 'OOCL', 'WHL', 'SITC', 'KMTC'];

class TrackerManager {
  constructor() {
    this.trackers = new Map();
    this.fallbacks = new Map();
    this._registerDefaultTrackers();
  }

  _registerDefaultTrackers() {
    this.register(new SeventeenTrackTracker('MSK', '马士基航运'));
    this.register(new SeventeenTrackTracker('MSC', '地中海航运'));
    this.register(new SeventeenTrackTracker('COSCO', '中远海运'));
    this.register(new SeventeenTrackTracker('CMA', '达飞轮船'));
    this.register(new SeventeenTrackTracker('HPL', '赫伯罗特'));
    this.register(new SeventeenTrackTracker('ONE', '海洋网联'));
    this.register(new SeventeenTrackTracker('EMC', '长荣海运'));
    this.register(new SeventeenTrackTracker('YML', '阳明海运'));
    this.register(new SeventeenTrackTracker('HMM', '现代商船'));
    this.register(new SeventeenTrackTracker('ZIM', '以星轮船'));
    this.register(new SeventeenTrackTracker('OOCL', '东方海外'));
    this.register(new SeventeenTrackTracker('PIL', '太平船务'));
    this.register(new SeventeenTrackTracker('WHL', '万海航运'));
    this.register(new SeventeenTrackTracker('SITC', '海丰国际'));
    this.register(new SeventeenTrackTracker('KMTC', '高丽海运'));
    for (const code of FALLBACK_CARRIERS) {
      const t = this.getTracker(code);
      if (t) {
        this.fallbacks.set(code, new GenericBrowserTracker(code, t.carrierName));
      }
    }
  }

  /**
   * 注册抓取器
   */
  register(tracker) {
    this.trackers.set(tracker.carrierCode.toUpperCase(), tracker);
  }

  /**
   * 获取抓取器
   */
  getTracker(carrierCode) {
    return this.trackers.get(carrierCode?.toUpperCase());
  }

  /**
   * 检查是否支持该船公司
   */
  isSupported(carrierCode) {
    return this.trackers.has(carrierCode?.toUpperCase());
  }

  /**
   * 获取所有支持的船公司列表
   */
  getSupportedCarriers() {
    return Array.from(this.trackers.values()).map(t => ({
      code: t.carrierCode,
      name: t.carrierName,
    }));
  }

  /**
   * 查询轨迹
   * @param {string} trackingNo - 单号
   * @param {string} carrierCode - 船公司代码
   * @param {object} [options] - 选项
   * @returns {Promise<object>}
   */
  async track(trackingNo, carrierCode, options = {}) {
    const tracker = this.getTracker(carrierCode);
    if (!tracker) {
      return createErrorResult(trackingNo, carrierCode, '', `不支持的船公司: ${carrierCode}`);
    }

    try {
      const result = await tracker.track(trackingNo, options);
      if (result.success) return result;

      const fallback = this.fallbacks.get(carrierCode?.toUpperCase());
      if (fallback) {
        console.log(`[轨迹抓取] ${carrierCode} 17track失败，尝试浏览器抓取...`);
        return await fallback.track(trackingNo, options);
      }
      return result;
    } catch (err) {
      console.error(`[轨迹抓取] ${carrierCode} ${trackingNo} 失败:`, err.message);
      const fallback = this.fallbacks.get(carrierCode?.toUpperCase());
      if (fallback) {
        console.log(`[轨迹抓取] ${carrierCode} 异常，尝试浏览器抓取...`);
        return await fallback.track(trackingNo, options);
      }
      return createErrorResult(trackingNo, carrierCode, tracker.carrierName, err.message);
    }
  }
}

// 单例
let instance = null;
export function getTrackerManager() {
  if (!instance) {
    instance = new TrackerManager();
  }
  return instance;
}

export default TrackerManager;