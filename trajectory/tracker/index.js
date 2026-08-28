/**
 * 轨迹抓取器 - 管理器
 * 负责管理所有船公司抓取器，提供统一查询入口
 */
import { SeventeenTrackTracker } from './seventeen-track.js';
import { createErrorResult } from './types.js';

class TrackerManager {
  constructor() {
    this.trackers = new Map();
    this._registerDefaultTrackers();
  }

  _registerDefaultTrackers() {
    this.register(new SeventeenTrackTracker('MSK', '马士基航运'));
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
      return await tracker.track(trackingNo, options);
    } catch (err) {
      console.error(`[轨迹抓取] ${carrierCode} ${trackingNo} 失败:`, err.message);
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