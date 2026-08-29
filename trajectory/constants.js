/**
 * 轨迹查验 - 常量配置
 * 常用船公司列表及官网跟踪页面URL模板
 * URL模板中的 {number} 会被替换为实际查询的单号（提单号/订舱号/箱号）
 */

// 常用船公司列表
export const CARRIER_LIST = [
  {
    code: 'MSK',
    name: '马士基航运',
    enName: 'MAERSK',
    logo: 'https://www.maersk.com/etc.clientlibs/maersk/clientlibs/clientlib-site/resources/img/maersk-logo.svg',
    url: 'https://www.maersk.com/tracking/{number}',
    supportContainer: true,
  },
  {
    code: 'MSC',
    name: '地中海航运',
    enName: 'MSC',
    logo: '',
    url: 'https://www.msc.com/en/tracking/tracking-result?trackNumber={number}',
    supportContainer: true,
  },
  {
    code: 'COSCO',
    name: '中远海运',
    enName: 'COSCO SHIPPING',
    logo: '',
    url: 'https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingNumber={number}',
    supportContainer: true,
  },
  {
    code: 'CMA',
    name: '达飞轮船',
    enName: 'CMA CGM',
    logo: '',
    url: 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Reference&Reference={number}',
    supportContainer: true,
  },
  {
    code: 'HPL',
    name: '赫伯罗特',
    enName: 'HAPAG-LLOYD',
    logo: '',
    url: 'https://www.hapag-lloyd.com/en/online-business/tracing/tracing-by-booking.html?booking={number}',
    supportContainer: true,
  },
  {
    code: 'ONE',
    name: '海洋网联',
    enName: 'ONE',
    logo: '',
    url: 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?searchType=BL&searchNumber={number}',
    supportContainer: true,
  },
  {
    code: 'EMC',
    name: '长荣海运',
    enName: 'EVERGREEN',
    logo: '',
    url: 'https://www.evergreen-marine.com/ee/egu/servlet/EEGU0101?bl_no={number}',
    supportContainer: false,
  },
  {
    code: 'YML',
    name: '阳明海运',
    enName: 'YANG MING',
    logo: '',
    url: 'https://www.yangming.com/e-service/track_trace/track_trace_cargo.aspx?query_type=BL&query_number={number}',
    supportContainer: true,
  },
  {
    code: 'HMM',
    name: '现代商船',
    enName: 'HMM',
    logo: '',
    url: 'https://www.hmm21.com/cms/business/ebiz/trackTrace/trackTrace/index.do?searchType=BL&searchWord={number}',
    supportContainer: true,
  },
  {
    code: 'ZIM',
    name: '以星轮船',
    enName: 'ZIM',
    logo: '',
    url: 'https://www.zim.com/tools/track-a-shipment?query={number}',
    supportContainer: true,
  },
  {
    code: 'OOCL',
    name: '东方海外',
    enName: 'OOCL',
    logo: '',
    url: 'https://moc.oocl.com/party/cargotracking/cargotracking.jsf?blNo={number}',
    supportContainer: true,
  },
  {
    code: 'PIL',
    name: '太平船务',
    enName: 'PIL',
    logo: '',
    url: 'https://www.pilship.com/en/e-services/cargo-tracking?search={number}',
    supportContainer: true,
  },
  {
    code: 'WHL',
    name: '万海航运',
    enName: 'WAN HAI',
    logo: '',
    url: 'https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml?cargoNo={number}',
    supportContainer: true,
  },
  {
    code: 'SITC',
    name: '海丰国际',
    enName: 'SITC',
    logo: '',
    url: 'https://api.sitc.com/SITCWeb/trackTrace/toTrackTrace?searchType=BL&searchValue={number}',
    supportContainer: true,
  },
  {
    code: 'KMTC',
    name: '高丽海运',
    enName: 'KMTC',
    logo: '',
    url: 'https://www.ekmtc.com/eng/cargo/tracking/list?searchType=B/L&searchWord={number}',
    supportContainer: true,
  },
];

// 船公司代码映射（用于快速查找）
export const CARRIER_MAP = CARRIER_LIST.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {});

/**
 * 根据船公司代码和单号生成跟踪URL
 * @param {string} carrierCode - 船公司代码（如 MSK）
 * @param {string} trackingNo - 单号（提单号/订舱号/箱号）
 * @returns {string|null} 跟踪页面URL，找不到船公司返回null
 */
export function getCarrierTrackUrl(carrierCode, trackingNo) {
  const carrier = CARRIER_MAP[carrierCode?.toUpperCase()];
  if (!carrier) return null;
  return carrier.url.replace('{number}', encodeURIComponent(trackingNo?.trim() || ''));
}

/**
 * 获取船公司信息
 * @param {string} carrierCode - 船公司代码
 * @returns {object|null} 船公司信息对象
 */
export function getCarrierInfo(carrierCode) {
  return CARRIER_MAP[carrierCode?.toUpperCase()] || null;
}

/**
 * 根据船公司名称模糊匹配船公司代码
 * @param {string} carrierName - 船公司名称（如"马士基"、"MAERSK"）
 * @returns {string|null} 船公司代码，找不到返回null
 */
export function matchCarrierCode(carrierName) {
  if (!carrierName) return null;
  const name = carrierName.toLowerCase().trim();
  for (const carrier of CARRIER_LIST) {
    // 匹配代码、中文名、英文名
    if (carrier.code.toLowerCase() === name) return carrier.code;
    if (carrier.name.toLowerCase().includes(name) || name.includes(carrier.name.toLowerCase())) return carrier.code;
    if (carrier.enName.toLowerCase().includes(name) || name.includes(carrier.enName.toLowerCase())) return carrier.code;
  }
  // 常见别名匹配
  const aliases = {
    '马士基': 'MSK', '马士基航运': 'MSK', 'maersk': 'MSK', 'maersk line': 'MSK',
    '地中海': 'MSC', '地中海航运': 'MSC', 'msc': 'MSC', 'mediterranean': 'MSC',
    '中远': 'COSCO', '中远海运': 'COSCO', 'cosco': 'COSCO', 'cosco shipping': 'COSCO',
    '达飞': 'CMA', '达飞轮船': 'CMA', 'cma': 'CMA', 'cma cgm': 'CMA', 'cma-cgm': 'CMA',
    '赫伯罗特': 'HPL', 'hapag': 'HPL', 'hapag-lloyd': 'HPL', 'hpl': 'HPL',
    '海洋网联': 'ONE', 'one line': 'ONE', 'one ocean': 'ONE',
    '长荣': 'EMC', '长荣海运': 'EMC', 'evergreen': 'EMC', 'emc': 'EMC',
    '阳明': 'YML', '阳明海运': 'YML', 'yang ming': 'YML', 'yml': 'YML',
    '现代': 'HMM', '现代商船': 'HMM', 'hmm': 'HMM', 'hyundai': 'HMM',
    '以星': 'ZIM', '以星轮船': 'ZIM', 'zim': 'ZIM',
    '东方海外': 'OOCL', 'oocl': 'OOCL',
    '太平': 'PIL', '太平船务': 'PIL', 'pil': 'PIL', 'pacific': 'PIL',
    '万海': 'WHL', '万海航运': 'WHL', 'wan hai': 'WHL', 'whl': 'WHL',
    '海丰': 'SITC', '海丰国际': 'SITC', 'sitc': 'SITC',
    '高丽': 'KMTC', '高丽海运': 'KMTC', '韩国高丽': 'KMTC', 'kmtc': 'KMTC', 'korea': 'KMTC',
  };
  return aliases[name] || null;
}

// 轨迹状态枚举
export const TRACKING_STATUS = {
  PENDING: 'pending',       // 待查询
  IN_TRANSIT: 'in_transit', // 运输中
  ARRIVED: 'arrived',       // 已到港
  DELIVERED: 'delivered',   // 已交付
  FAILED: 'failed',         // 查询失败
};

// 状态中文映射
export const STATUS_LABELS = {
  pending: '待查询',
  in_transit: '运输中',
  arrived: '已到港',
  delivered: '已交付',
  failed: '查询失败',
};