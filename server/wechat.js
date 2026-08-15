// 企业微信群机器人 + AI 消息生成
import { getDb } from './database.js';

// 获取配置
function getConfig(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM wechat_config WHERE key = ?').get(key);
  return row ? row.value : null;
}

// 设置配置
function setConfig(key, value) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO wechat_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?'
  ).run(key, value, now, value, now);
}

// 获取所有配置
function getAllConfig() {
  const db = getDb();
  return db.prepare('SELECT key, value, updated_at FROM wechat_config ORDER BY key').all();
}

// 通过 Webhook 发送消息到企业微信群
async function sendToWechat(webhookUrl, content) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { content },
    }),
  });
  const result = await response.json();
  if (result.errcode !== 0) {
    throw new Error(result.errmsg || '企业微信推送失败');
  }
  return result;
}

// 调用 AI 生成订单摘要
async function generateOrderSummary(orders, clientName) {
  const aiEndpoint = getConfig('ai_endpoint');
  const aiKey = getConfig('ai_key');
  const aiModel = getConfig('ai_model') || 'gpt-3.5-turbo';

  if (!aiEndpoint || !aiKey) {
    // 没有配置 AI，用模板生成
    return formatOrderTemplate(orders, clientName);
  }

  const orderList = orders.map((o, i) =>
    `${i + 1}. 工作号: ${o.job_no}, 日期: ${o.job_date?.slice(0, 10)}, 船名: ${o.vessel || '-'}, 航次: ${o.voyage || '-'}, ETD: ${o.etd?.slice(0, 10) || '-'}, ETA: ${o.eta?.slice(0, 10) || '-'}, 目的国: ${o.dest_country || '-'}, 品名: ${o.goods_name || '-'}, 件数: ${o.pieces || 0}, 方数: ${o.goods_cbm || 0}, 状态: ${o.order_status || '-'}`
  ).join('\n');

  const prompt = `你是美鸥物流的智能助手。请根据以下订单信息，为客户"${clientName}"生成一段简洁友好的订单推送消息，使用markdown格式，包含：
- 标题和问候语
- 订单汇总表格（工作号、船名航次、ETD/ETA、品名、件数/方数、状态）
- 温馨提示（如有需要请联系客服）
- 落款"美鸥物流"

订单信息：
${orderList}`;

  try {
    const res = await fetch(aiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          { role: 'system', content: '你是一个专业的物流客服助手，帮客户生成简洁清晰的订单推送消息。使用markdown格式。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });
    const data = await res.json();
    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }
    throw new Error(data.error?.message || 'AI 返回异常');
  } catch (err) {
    console.error('AI 生成失败，使用模板:', err.message);
    return formatOrderTemplate(orders, clientName);
  }
}

// 模板方式生成推送消息
function formatOrderTemplate(orders, clientName) {
  const now = new Date().toLocaleString('zh-CN');
  let msg = `## 📦 美鸥物流 · 订单更新\n`;
  msg += `> 客户：<font color="info">${clientName}</font>\n`;
  msg += `> 时间：${now}\n\n`;

  msg += `| 工作号 | 船名/航次 | ETD | ETA | 目的国 | 品名 | 件数 | 方数 | 状态 |\n`;
  msg += `|--------|----------|-----|-----|--------|------|------|------|------|\n`;

  for (const o of orders) {
    msg += `| ${o.job_no || '-'} | ${o.vessel || '-'}/${o.voyage || '-'} | ${o.etd?.slice(0, 10) || '-'} | ${o.eta?.slice(0, 10) || '-'} | ${o.dest_country || '-'} | ${(o.goods_name || '-').slice(0, 10)} | ${o.pieces || 0} | ${o.goods_cbm || 0} | <font color="${o.order_status === '已完成' ? 'info' : 'warning'}">${o.order_status || '-'}</font> |\n`;
  }

  msg += `\n> 如有疑问请联系客服，感谢您的信任与支持！\n`;
  msg += `> 美鸥物流 · 用心服务每一票`;

  return msg;
}

// 记录推送日志
function logPush({ clientId, clientName, orderId, orderNo, pushType, content, status, errorMsg }) {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(
    `INSERT INTO push_logs (client_id, client_name, order_id, order_no, push_type, content, status, error_msg, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(clientId || null, clientName || null, orderId || null, orderNo || null, pushType, content, status, errorMsg || null, now);
  return result.lastInsertRowid;
}

// 获取推送日志
function getPushLogs(page = 1, size = 20) {
  const db = getDb();
  const offset = (page - 1) * size;
  const total = db.prepare('SELECT COUNT(*) as cnt FROM push_logs').get().cnt;
  const rows = db.prepare(
    'SELECT * FROM push_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(size, offset);
  return { data: rows, total, page, size };
}

// 推送订单到客户群
async function pushOrdersToClient(clientId, orderIds) {
  const db = getDb();
  const customer = db.prepare(
    'SELECT client_id, client_code, client_name, wechat_webhook, wechat_group_name FROM yunwuyun_customers WHERE client_id = ?'
  ).get(clientId);

  if (!customer) throw new Error('客户不存在');
  if (!customer.wechat_webhook) throw new Error('该客户未配置企业微信群机器人');

  const placeholders = orderIds.map(() => '?').join(',');
  const orders = db.prepare(
    `SELECT job_id, job_no, job_date, vessel, voyage, etd, eta, dest_country, goods_name, pieces, goods_cbm, order_status
     FROM yunwuyun_orders WHERE job_id IN (${placeholders})`
  ).all(...orderIds);

  if (orders.length === 0) throw new Error('未找到订单');

  const content = await generateOrderSummary(orders, customer.client_name);

  try {
    await sendToWechat(customer.wechat_webhook, content);
    for (const o of orders) {
      logPush({
        clientId: customer.client_id,
        clientName: customer.client_name,
        orderId: o.job_id,
        orderNo: o.job_no,
        pushType: 'order_update',
        content: content.slice(0, 500),
        status: 'success',
      });
    }
    return { success: true, message: `已推送到 ${customer.wechat_group_name || customer.client_name} 群`, orderCount: orders.length };
  } catch (err) {
    for (const o of orders) {
      logPush({
        clientId: customer.client_id,
        clientName: customer.client_name,
        orderId: o.job_id,
        orderNo: o.job_no,
        pushType: 'order_update',
        content: content.slice(0, 500),
        status: 'failed',
        errorMsg: err.message,
      });
    }
    throw err;
  }
}

export { getConfig, setConfig, getAllConfig, sendToWechat, generateOrderSummary, pushOrdersToClient, getPushLogs, logPush };