// 测试云无云对接
import { testConnection, cntProfitTotal, queryBizStateType } from './server/yunwuyun.js';

async function run() {
  console.log('=== 测试云无云连接 ===\n');

  // 测试1: 连接测试
  console.log('1. 测试连接...');
  const conn = await testConnection();
  console.log(JSON.stringify(conn, null, 2));

  if (conn.success) {
    // 测试2: 业务状态
    console.log('\n2. 业务订单状态...');
    const state = await queryBizStateType();
    console.log(JSON.stringify(state, null, 2).slice(0, 500));

    // 测试3: 利润汇总
    console.log('\n3. 利润汇总...');
    const profit = await cntProfitTotal();
    console.log(JSON.stringify(profit, null, 2).slice(0, 500));
  }
}

run().catch(err => console.error('测试失败:', err.message));