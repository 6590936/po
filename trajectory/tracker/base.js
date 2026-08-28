/**
 * 轨迹抓取器 - 基础类
 * 所有船公司抓取器继承此类
 */
import { createErrorResult } from './types.js';

export class BaseTracker {
  constructor(carrierCode, carrierName) {
    this.carrierCode = carrierCode;
    this.carrierName = carrierName;
    this.timeout = 30000; // 30秒超时
  }

  /**
   * 抓取轨迹信息（子类必须实现）
   * @param {string} trackingNo - 查询单号
   * @param {object} [options] - 选项
   * @returns {Promise<object>} 统一格式的轨迹结果
   */
  async track(trackingNo, options = {}) {
    throw new Error('子类必须实现 track 方法');
  }

  /**
   * 创建错误结果
   */
  error(trackingNo, message) {
    return createErrorResult(trackingNo, this.carrierCode, this.carrierName, message);
  }

  /**
   * 延迟
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理文本（去除多余空格、换行）
   */
  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * 标准化日期格式
   */
  normalizeDate(dateStr) {
    if (!dateStr) return '';
    // 尝试解析各种日期格式
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace('T', ' ').substring(0, 16);
    }
    return dateStr.trim();
  }
}
