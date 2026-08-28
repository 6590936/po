/**
 * 轨迹抓取器 - 统一数据格式定义
 * 所有船公司抓取器都必须返回此格式
 */

/**
 * 轨迹节点状态枚举
 */
export const TRACKING_EVENT_STATUS = {
  BOOKED: 'booked',
  CONFIRMED: 'confirmed',
  RECEIVED: 'received',
  LOADED: 'loaded',
  DEPARTED: 'departed',
  IN_TRANSIT: 'in_transit',
  ARRIVED: 'arrived',
  DISCHARGED: 'discharged',
  CUSTOMS: 'customs',
  DELIVERED: 'delivered',
  RETURNED: 'returned',
  UNKNOWN: 'unknown',
};

export const STATUS_LABELS = {
  booked: '已订舱',
  confirmed: '已确认',
  received: '已收货',
  loaded: '已装船',
  departed: '已开船',
  in_transit: '在途',
  arrived: '已到港',
  discharged: '已卸船',
  customs: '清关中',
  delivered: '已交付',
  returned: '已还箱',
  unknown: '未知',
};

export const STATUS_COLORS = {
  booked: 'default',
  confirmed: 'default',
  received: 'processing',
  loaded: 'processing',
  departed: 'blue',
  in_transit: 'blue',
  arrived: 'cyan',
  discharged: 'cyan',
  customs: 'orange',
  delivered: 'success',
  returned: 'success',
  unknown: 'default',
};

export function createTrackingResult(params) {
  return {
    trackingNo: params.trackingNo,
    carrierCode: params.carrierCode,
    carrierName: params.carrierName,
    origin: params.origin || '',
    destination: params.destination || '',
    vessel: params.vessel || '',
    voyage: params.voyage || '',
    containerNo: params.containerNo || '',
    etd: params.etd || '',
    atd: params.atd || '',
    eta: params.eta || '',
    ata: params.ata || '',
    status: params.status || TRACKING_EVENT_STATUS.UNKNOWN,
    statusLabel: STATUS_LABELS[params.status] || params.status || '未知',
    timeline: Array.isArray(params.timeline) ? params.timeline : [],
    rawData: params.rawData || null,
    queriedAt: new Date().toISOString(),
    success: true,
  };
}

export function createTimelineEvent(params) {
  return {
    time: params.time,
    location: params.location || '',
    status: params.status,
    statusLabel: STATUS_LABELS[params.status] || params.status || '未知',
    description: params.description || '',
    isEstimated: params.isEstimated || false,
  };
}

export function createErrorResult(trackingNo, carrierCode, carrierName, error) {
  return {
    trackingNo,
    carrierCode,
    carrierName,
    status: TRACKING_EVENT_STATUS.UNKNOWN,
    statusLabel: '查询失败',
    timeline: [],
    error,
    success: false,
    queriedAt: new Date().toISOString(),
  };
}
