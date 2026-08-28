/**
 * 17TRACK API 轨迹查询器
 * 使用 17track API 替代浏览器抓取，解决国内服务器无法访问国外网站的问题
 */
import { BaseTracker } from './base.js';
import { createTrackingResult, createTimelineEvent, TRACKING_EVENT_STATUS } from './types.js';

const API_BASE = 'https://api.17track.net/track/v2.4';

const CARRIER_NUMBERS = {
  'MSK': 100768,
  'MSC': null,
  'COSCO': null,
  'CMA': null,
  'HPL': null,
  'ONE': null,
  'EMC': null,
  'YML': null,
  'HMM': null,
  'ZIM': null,
  'OOCL': null,
  'PIL': null,
  'WHL': null,
  'SITC': null,
  'KMTC': null,
};

function formatTime(isoStr) {
  if (!isoStr) return '';
  return isoStr.replace('T', ' ').replace(/[+-]\d{2}:\d{2}$/, '').replace('Z', '');
}

const STATUS_MAP = {
  'InfoReceived': TRACKING_EVENT_STATUS.BOOKED,
  'InTransit': TRACKING_EVENT_STATUS.IN_TRANSIT,
  'OutForDelivery': TRACKING_EVENT_STATUS.IN_TRANSIT,
  'AttemptFail': TRACKING_EVENT_STATUS.IN_TRANSIT,
  'Delivered': TRACKING_EVENT_STATUS.DELIVERED,
  'AvailableForPickup': TRACKING_EVENT_STATUS.ARRIVED,
  'Exception': TRACKING_EVENT_STATUS.UNKNOWN,
  'Expired': TRACKING_EVENT_STATUS.UNKNOWN,
  'Pending': TRACKING_EVENT_STATUS.BOOKED,
  'Undelivered': TRACKING_EVENT_STATUS.IN_TRANSIT,
};

export class SeventeenTrackTracker extends BaseTracker {
  constructor(carrierCode, carrierName) {
    super(carrierCode, carrierName);
    this.apiKey = process.env.SEVENTEEN_TRACK_API_KEY || '';
    this.carrierNumber = CARRIER_NUMBERS[carrierCode] || null;
  }

  async track(trackingNo, options = {}) {
    if (!this.apiKey) {
      return this.error(trackingNo, '17TRACK API Key 未配置');
    }

    try {
      const data = await this._registerAndGet(trackingNo);
      if (!data) {
        return this.error(trackingNo, '未查询到轨迹数据');
      }
      return this._parseResult(trackingNo, data);
    } catch (err) {
      console.error(`[17TRACK] ${trackingNo} 查询失败:`, err.message);
      return this.error(trackingNo, err.message);
    }
  }

  async _registerAndGet(trackingNo) {
    const body = this.carrierNumber
      ? [{ number: trackingNo, carrier: this.carrierNumber }]
      : [{ number: trackingNo }];

    console.log('[17TRACK] 注册单号:', trackingNo, '船公司编号:', this.carrierNumber);
    let res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    let json = await res.json();
    console.log('[17TRACK] 注册响应:', JSON.stringify(json).substring(0, 500));

    if (json.code !== 0 && json.code !== 200) {
      throw new Error(json.message || '注册失败');
    }

    const regAccepted = json.data?.accepted;
    const regRejected = json.data?.rejected;
    const isAlreadyRegistered = regRejected?.[0]?.error?.code === -18019901;

    if (!isAlreadyRegistered && (!regAccepted || regAccepted.length === 0)) {
      throw new Error(`单号被拒绝: ${regRejected?.[0]?.error?.message || '未知原因'}`);
    }

    console.log('[17TRACK] 等待5秒后获取轨迹...');
    await this.sleep(5000);

    console.log('[17TRACK] 获取轨迹:', trackingNo);
    const result = await fetch(`${API_BASE}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const resultJson = await result.json();
    console.log('[17TRACK] 轨迹响应:', JSON.stringify(resultJson).substring(0, 500));

    if (resultJson.code !== 0 && resultJson.code !== 200) {
      throw new Error(resultJson.message || '查询失败');
    }

    const trackData = resultJson.data?.accepted?.[0];
    if (trackData) {
      return trackData;
    }

    const trackRejected = resultJson.data?.rejected?.[0];
    if (trackRejected?.error?.code === -18019909) {
      console.log('[17TRACK] 暂无数据，等待10秒后重试...');
      await this.sleep(10000);
      const retryResult = await fetch(`${API_BASE}/gettrackinfo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': this.apiKey,
        },
        body: JSON.stringify(body),
      });
      const retryJson = await retryResult.json();
      console.log('[17TRACK] 重试响应:', JSON.stringify(retryJson).substring(0, 500));
      const retryData = retryJson.data?.accepted?.[0];
      if (retryData) {
        return retryData;
      }
      throw new Error('该单号暂无轨迹信息，请确认单号是否正确或稍后重试');
    }

    throw new Error(trackRejected?.error?.message || '未返回轨迹数据');
  }

  _parseResult(trackingNo, data) {
    const trackInfo = data.trackInfo || data.track_info || {};
    const events = trackInfo.tracking?.providers?.[0]?.events || [];
    const shippingInfo = trackInfo.shipping_info || {};
    const latestStatus = trackInfo.latest_status || {};
    const latestEvent = trackInfo.latest_event || {};
    const timeMetrics = trackInfo.time_metrics || {};

    const timeline = [...events].reverse().map(evt => {
      const stage = evt.sub_status || evt.stage || '';
      const status = STATUS_MAP[stage] || TRACKING_EVENT_STATUS.UNKNOWN;
      const timeStr = formatTime(evt.time_iso || evt.time_utc)
        || (evt.time_raw ? `${evt.time_raw.date || ''} ${evt.time_raw.time || ''}`.trim() : '');
      return createTimelineEvent({
        time: timeStr,
        location: evt.location || '',
        status,
        description: evt.description || stage,
        isEstimated: false,
      });
    });

    const currentStatus = STATUS_MAP[latestStatus.status]
      || STATUS_MAP[latestStatus.sub_status]
      || TRACKING_EVENT_STATUS.UNKNOWN;

    const originInfo = shippingInfo.shipper_address || {};
    const destinationInfo = shippingInfo.recipient_address || {};
    const eta = timeMetrics.estimated_delivery_date?.to || timeMetrics.estimated_delivery_date?.from || '';

    return createTrackingResult({
      trackingNo: data.number || trackingNo,
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      origin: originInfo.city ? `${originInfo.city}, ${originInfo.country || ''}` : originInfo.country || '',
      destination: destinationInfo.city ? `${destinationInfo.city}, ${destinationInfo.country || ''}` : destinationInfo.country || '',
      eta,
      status: currentStatus,
      timeline,
      rawData: data,
    });
  }
}