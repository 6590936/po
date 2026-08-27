// 云无云 FMS 系统对接模块
import https from 'https';
import querystring from 'querystring';

const BASE_URL = 'https://fms.yunwuyun.com';
const TENANT_CODE = 'MOGJ';

let cachedToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJlYXN5ZnJlaWdodC1zcnYtdXNlciIsImlhdCI6MTc4Njg3MDE5NiwiZXhwIjoxNzg2OTEzMzk2LCJ0ZW5hbnRJZCI6NTc4MzA0NzAwOSwic3RhZmZJZCI6MTgxNTc3ODg4NzAwOCwidXNlckNvZGUiOiJhZG1pbiIsInJvd29yZ2lkIjoxODE1Nzc4ODc5MDA4LCJ1c2VyVHlwZSI6MTAsInByb2R1Y3RJZCI6MjI2MTIzMDAwOSwidmlydHVhbFN0YXR1cyI6MTB9.YU47cCMgPo9IWKcjy-AqIb-Wkd7bT-Iik0a2qf0BQKs';
let cachedJSESSIONID = 'B0E0EE73D36E372BE6322232D7E6ACB0';
// 解析JWT真实过期时间，避免用过期token请求
let tokenExpiry = (() => {
  try {
    const payload = JSON.parse(Buffer.from(cachedToken.split('.')[1], 'base64').toString('utf8'));
    return payload.exp * 1000;
  } catch { return 0; }
})();
let loggedIn = Date.now() < tokenExpiry - 60000;

function request(method, path, { body, params, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let urlPath = path;
    if (params) {
      urlPath += '?' + querystring.stringify(params);
    }

    const url = new URL(urlPath, BASE_URL);
    const defaultHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json, text/plain, */*',
      'devicetype': 'PC',
      'txlang': 'zh-CN',
      'userid': '1815778887008',
      'roworgid': '1815778879008',
      ...headers,
    };

    if (cachedToken) {
      defaultHeaders['token'] = cachedToken;
    }
    if (cachedJSESSIONID) {
      defaultHeaders['Cookie'] = 'JSESSIONID=' + cachedJSESSIONID;
    }
    // 清理无效header
    Object.keys(defaultHeaders).forEach(k => {
      if (defaultHeaders[k] === undefined || defaultHeaders[k] === null) delete defaultHeaders[k];
    });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: defaultHeaders,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          const match = setCookie.find(c => c.includes('JSESSIONID='));
          if (match) {
            cachedJSESSIONID = match.match(/JSESSIONID=([^;]+)/)?.[1] || cachedJSESSIONID;
          }
        }
        // 日志：非查询接口打印响应
        if (!path.includes('queryFbxOrderList')) {
          const preview = typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
          console.log(`[云无云] ${method} ${path} → HTTP ${res.statusCode}`, preview);
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error('云无云请求失败: ' + err.message));
    });

    if (body) {
      let bodyStr;
      if (typeof body === 'string') {
        bodyStr = body;
      } else if (defaultHeaders['Content-Type'] === 'application/json') {
        bodyStr = JSON.stringify(body);
      } else {
        bodyStr = querystring.stringify(body);
      }
      req.write(bodyStr);
    }
    req.end();
  });
}

async function login(username = 'admin', password = 'MO1234') {
  console.log('[云无云] 正在登录...');
  // 登录时清掉所有旧会话信息，也不带 userid/roworgid
  const oldToken = cachedToken;
  const oldSession = cachedJSESSIONID;
  cachedToken = null;
  cachedJSESSIONID = null;
  const body = querystring.stringify({ username, password, tenantCode: TENANT_CODE });
  const result = await request('POST', '/api/getToken', {
    body,
    headers: { 'userid': undefined, 'roworgid': undefined },
  });
  if (result && result.token) {
    cachedToken = result.token;
    try {
      const payload = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64').toString('utf8'));
      tokenExpiry = payload.exp * 1000;
      console.log('[云无云] Token过期时间:', new Date(tokenExpiry).toLocaleString());
    } catch {
      tokenExpiry = Date.now() + 86400000;
    }
    loggedIn = true;
    console.log('[云无云] 登录成功, token:', result.token.slice(0, 20) + '...');
  } else {
    cachedToken = oldToken;
    cachedJSESSIONID = oldSession;
    console.log('[云无云] 登录失败:', JSON.stringify(result));
  }
  return result;
}

async function ensureLogin() {
  if (loggedIn && cachedToken && Date.now() < tokenExpiry - 60000) {
    return true;
  }
  console.log('[云无云] Token已过期或未登录，重新登录...');
  await login();
  return !!cachedToken;
}

function setToken(token) {
  cachedToken = token;
  tokenExpiry = Date.now() + 86400000;
  loggedIn = true;
}

async function queryBizStateType() {
  await ensureLogin();
  return request('GET', '/api/fms/bizOrder/queryBizStateType', { params: { _t: Date.now() } });
}

async function cntProfitTotal(params = {}) {
  await ensureLogin();
  return request('POST', '/api/report/unirepproject/cntProfitTotal', {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function query(apiPath, opts = {}) {
  await ensureLogin();
  return request(opts.method || 'GET', apiPath, opts);
}

async function testConnection() {
  try {
    await ensureLogin();
    const result = await queryBizStateType();
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 同步订单数据
async function syncOrders(progressCallback) {
  await ensureLogin();
  const pageSize = 100;
  let currentPage = 1;
  let totalSynced = 0;
  let allData = [];
  const allFields = [
    "jobId", "jobNo", "jobType", "jobDate", "orderStatus", "closeStatus",
    "clientId", "clientName", "clientNameEng", "clientCode", "clientAbbr",
    "carrierName", "vessel", "voyage", "etd", "eta", "atd",
    "soNo", "blNoDomestic", "blNoOverseas", "carrierJobno",
    "arAmt", "apAmt", "grOss", "freighttons", "clientQuoteFreighttons",
    "datacodeTransportType", "datacodeLoadtype", "stowType", "collectType", "chargingType",
    "deliveryCtryName", "portofdestinationCtryName", "warehouseDeliveryCode",
    "supplyChannelCode", "supplyChannelName", "channelReceiveCode", "channelReceiveName",
    "cntNos", "chargingCodes", "goodsname", "goodsvalue",
    "pieces", "grosskgs", "goodscbm", "netkgs",
    "clientTotalVolume", "clientTotalPieces", "clientTotalWeight", "clientBillingWeight",
    "boxTotalQty", "boxTotalWeight", "boxTotalVolume",
    "estimateQuantityTotal", "goodsCycode", "baseCyCode",
    "insertedBy", "jobRemarks", "orderChangeType", "deliveryFeeCc",
    "clientSettlerType", "arCount", "apCount", "latestProblemCount", "commentCount",
    "orderStatusMap", "fmsBizBookingAheads"
  ];

  while (true) {
    const body = {
      currentPage,
      total: null,
      conditionDtos: [],
      pageSize,
      fields: allFields,
    };
    const data = await request('POST', '/api/fbx/fbxOrder/queryFbxOrderList', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`[云无云] 第${currentPage}页 API响应: success=${data?.success}, total=${data?.result?.total}, records=${data?.result?.records?.length || 0}`);

    if (!data?.success) {
      console.log('[云无云] 同步失败，完整响应:', JSON.stringify(data).slice(0, 500));
      break;
    }
    if (!data?.result?.records?.length) break;

    const records = data.result.records;
    totalSynced += records.length;

    if (progressCallback) {
      progressCallback({ page: currentPage, synced: totalSynced, total: data.result.total });
    }

    const now = new Date().toISOString();
    const mapped = records.map(r => ({
      job_id: r.jobId,
      job_no: r.jobNo || '',
      job_type: r.jobType || '',
      job_date: r.jobDate || '',
      order_status: r.orderStatus ?? null,
      close_status: r.closeStatus ?? null,
      client_id: r.clientId ?? null,
      client_name: r.clientName || '',
      client_name_eng: r.clientNameEng || '',
      client_code: r.clientCode || '',
      client_abbr: r.clientAbbr || '',
      carrier_name: r.carrierName || '',
      vessel: r.vessel || '',
      voyage: r.voyage || '',
      etd: r.etd || '',
      eta: r.eta || '',
      atd: r.atd || '',
      so_no: r.soNo || '',
      bl_no_domestic: r.blNoDomestic || '',
      bl_no_overseas: r.blNoOverseas || '',
      carrier_jobno: r.carrierJobno || '',
      ar_amt: r.arAmt ?? 0,
      ap_amt: r.apAmt ?? 0,
      gr_oss: r.grOss ?? 0,
      freighttons: r.freighttons ?? 0,
      client_quote_freighttons: r.clientQuoteFreighttons ?? 0,
      transport_type: r.datacodeTransportType || '',
      loadtype: r.datacodeLoadtype || '',
      stow_type: r.stowType ?? null,
      collect_type: r.collectType ?? null,
      charging_type: r.chargingType || '',
      delivery_country: r.deliveryCtryName || '',
      dest_country: r.portofdestinationCtryName || '',
      warehouse_code: r.warehouseDeliveryCode || '',
      supply_channel_code: r.supplyChannelCode || '',
      supply_channel_name: r.supplyChannelName || '',
      channel_receive_code: r.channelReceiveCode || '',
      channel_receive_name: r.channelReceiveName || '',
      cnt_nos: r.cntNos || '',
      charging_codes: r.chargingCodes || '',
      goods_name: r.goodsname || '',
      goods_value: r.goodsvalue ?? 0,
      pieces: r.pieces ?? 0,
      gross_kgs: r.grosskgs ?? 0,
      goods_cbm: r.goodscbm ?? 0,
      net_kgs: r.netkgs ?? 0,
      client_total_volume: r.clientTotalVolume ?? 0,
      client_total_pieces: r.clientTotalPieces ?? 0,
      client_total_weight: r.clientTotalWeight ?? 0,
      client_billing_weight: r.clientBillingWeight ?? 0,
      box_total_qty: r.boxTotalQty ?? 0,
      box_total_weight: r.boxTotalWeight ?? 0,
      box_total_volume: r.boxTotalVolume ?? 0,
      estimate_quantity_total: r.estimateQuantityTotal ?? 0,
      goods_cycode: r.goodsCycode || '',
      base_cy_code: r.baseCyCode || '',
      order_status_map: JSON.stringify(r.orderStatusMap || {}),
      booking_aheads: JSON.stringify(r.fmsBizBookingAheads || []),
      inserted_by: r.insertedBy || '',
      job_remarks: r.jobRemarks || '',
      order_change_type: r.orderChangeType ?? null,
      delivery_fee_cc: r.deliveryFeeCc ?? null,
      client_settler_type: r.clientSettlerType ?? null,
      ar_count: r.arCount ?? 0,
      ap_count: r.apCount ?? 0,
      latest_problem_count: r.latestProblemCount ?? 0,
      comment_count: r.commentCount ?? 0,
      synced_at: now,
    }));

    allData.push(...mapped);

    if (totalSynced >= data.result.total) break;
    currentPage++;
  }

  return { success: true, totalSynced, total: totalSynced, data: allData };
}

// 同步客户数据
async function syncCustomers(progressCallback) {
  await ensureLogin();
  const pageSize = 100;
  let currentPage = 1;
  let totalSynced = 0;
  let allData = [];

  while (true) {
    const body = {
      currentPage,
      pageSize,
      total: 0,
      queryCondition: null,
    };
    const data = await request('POST', '/api/csm/unicsmclient/queryClientAll', {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!data?.success || !data?.result?.records?.length) break;

    const records = data.result.records;
    totalSynced += records.length;

    if (progressCallback) {
      progressCallback({ page: currentPage, synced: totalSynced, total: data.result.total });
    }

    const now = new Date().toISOString();
    const mapped = records.map(r => ({
      client_id: r.id || r.clientid,
      client_code: r.clientcode || '',
      client_name: r.clientname || '',
      client_name_eng: r.clientnameeng || '',
      client_abbr: r.clientabbr || '',
      client_type: r.clientype || '',
      client_class: r.clientclass || '',
      client_class_eng: r.clientclassEng || '',
      client_property: r.clientProperty ?? null,
      client_same_industry: r.clientSameindustry ?? null,
      country_id: r.ctryid ?? null,
      country_code: r.ctrycode || '',
      country_name: r.counanre || '',
      country_name_eng: r.counanreEng || '',
      province_state: r.provinceState || '',
      client_addr: r.clientaddr || '',
      addr_postcode: r.addrPostcode || '',
      mobile_no: r.mobileno || '',
      office_tel: r.officeTel || '',
      uni_credit_code: r.uniCreditCode || '',
      contact_name: r.contactname || '',
      sales_name: r.staname || '',
      op_name: r.opname || '',
      cs_name: r.scsname || '',
      staff_name_biz: r.staffNameBiz || '',
      insert_time: r.insertTime || '',
      update_time: r.updateTime || '',
      inserted_by: r.insertedBy || '',
      updated_by: r.updatedBy || '',
      inuse: r.inuse ?? 1,
      catalog_name: r.catalogName || '',
      catalog_name_eng: r.catalogNameEng || '',
      org_code: r.orgcode || '',
      org_name: r.orgname || '',
      org_name_eng: r.orgnameEng || '',
      client_source_name: r.clientsourceName || '',
      client_source_name_eng: r.clientsourceNameEng || '',
      settler_type: r.settlerType ?? null,
      csm_staff: JSON.stringify(r.csmStaffVos || []),
      synced_at: now,
    }));

    allData.push(...mapped);

    if (totalSynced >= data.result.total) break;
    currentPage++;
  }

  return { success: true, totalSynced, total: totalSynced, data: allData };
}

export { login, setToken, ensureLogin, queryBizStateType, cntProfitTotal, query, testConnection, syncOrders, syncCustomers };