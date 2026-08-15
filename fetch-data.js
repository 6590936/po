// 拉取云无云订单和客户数据
import { query } from './server/yunwuyun.js';
import fs from 'fs';

console.log('=== 拉取云无云数据 ===\n');

// 1. 订单列表
console.log('1. 拉取订单列表...');
const orderBody = {
  currentPage: 1,
  total: null,
  conditionDtos: [],
  pageSize: 5,
  fields: [
    "jobId", "jobNo", "jobType", "jobDate", "orderStatus", "clientId", "clientName",
    "clientCode", "clientAbbr", "clientNameEng", "carrierName", "vessel", "voyage",
    "etd", "eta", "atd", "soNo", "blNoDomestic", "blNoOverseas", "carrierJobno",
    "arAmt", "apAmt", "grOss", "freighttons", "clientQuoteFreighttons",
    "clientTotalVolume", "clientTotalPieces", "clientTotalWeight",
    "boxTotalQty", "boxTotalWeight", "boxTotalVolume",
    "goodsname", "grosskgs", "goodscbm", "netkgs", "pieces", "goodsvalue",
    "datacodeTransportType", "datacodeLoadtype", "transportTypeCode",
    "deliveryCtryName", "portofdestinationCtryName",
    "insertedBy", "jobRemarks", "clientSettlerType",
    "cntNos", "chargingCodes", "chargingType",
    "orderChangeType", "closeStatus", "clientReturnStatus",
    "supplyChannelCode", "supplyChannelName", "channelReceiveCode", "channelReceiveName",
    "warehouseDeliveryCode", "stowType", "collectType",
    "goodsCycode", "baseCyCode", "clientBillingWeight", "estimateQuantityTotal",
    "commentCount", "replyCommentUnReadCount", "latestProblemId", "problemLevelColor",
    "deliveryFeeCc"
  ]
};

const orderData = await query('/api/fbx/fbxOrder/queryFbxOrderList', {
  method: 'POST',
  body: orderBody,
  headers: { 'Content-Type': 'application/json' },
});
console.log('订单拉取结果:', orderData?.success ? '成功' : '失败', '| 条数:', orderData?.result?.records?.length || 0);

// 2. 客户列表
console.log('\n2. 拉取客户列表...');
const custBody = {
  currentPage: 1,
  pageSize: 5,
  total: 0,
  queryCondition: null
};

const custData = await query('/api/csm/unicsmclient/queryClientAll', {
  method: 'POST',
  body: custBody,
  headers: { 'Content-Type': 'application/json' },
});
console.log('客户拉取结果:', custData?.success ? '成功' : '失败', '| 条数:', custData?.result?.records?.length || 0);

// 保存完整数据
const output = {
  orderApi: '/api/fbx/fbxOrder/queryFbxOrderList',
  orderSample: orderData,
  customerApi: '/api/csm/unicsmclient/queryClientAll',
  customerSample: custData,
};

fs.writeFileSync('yunwuyun-data.json', JSON.stringify(output, null, 2));
console.log('\n=== 数据已保存到 yunwuyun-data.json ===');
console.log('订单字段数:', orderData?.result?.records?.[0] ? Object.keys(orderData.result.records[0]).length : 0);
console.log('客户字段数:', custData?.result?.records?.[0] ? Object.keys(custData.result.records[0]).length : 0);