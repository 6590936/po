// 企业微信自建应用 + AI 消息生成
import { getDb } from './database.js';

// 缓存 access_token
let accessTokenCache = { token: null, expiresAt: 0 };

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

// 获取企业微信 access_token（自动缓存）
async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt > now + 300000) {
    return accessTokenCache.token;
  }

  const corpid = getConfig('corpid');
  const secret = getConfig('secret');
  if (!corpid || !secret) throw new Error('请先配置企业微信 corpid 和 secret');

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${secret}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(`获取 access_token 失败: ${data.errmsg}`);

  accessTokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}

// 清除 access_token 缓存
function clearTokenCache() {
  accessTokenCache = { token: null, expiresAt: 0 };
}

// 发送到外部客户群（externalcontact/message/send）
async function sendExternalGroupMessage(chatid, content) {
  const token = await getAccessToken();
  const body = {
    chat_type: 'group',
    chat_id: chatid,
    msgtype: 'text',
    text: { content },
  };
  const res = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/externalcontact/message/send?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(`external send 失败: ${data.errmsg} (errcode=${data.errcode})`);
  return data;
}

// 发送到企业内部群聊（appchat/send）
async function sendAppChatMessage(chatid, content) {
  const token = await getAccessToken();
  const body = {
    chatid,
    msgtype: 'text',
    text: { content },
  };
  const res = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(`appchat send 失败: ${data.errmsg} (errcode=${data.errcode})`);
  return data;
}

// 通用入口：根据 chatType 选择发送通道（chatType 可由回调提供）
async function sendAppMessage(chatid, content, msgtype = 'text', chatType = '') {
  // chatType: 'single' | 'group' | 'external' etc. 对内部群使用 appchat/send，外部客户群使用 externalcontact
  try {
    if (chatType === 'group' || chatType === 'single') {
      return await sendAppChatMessage(chatid, content);
    }
    // 默认尝试外部群发
    return await sendExternalGroupMessage(chatid, content);
  } catch (err) {
    // 如果首选通道失败，尝试另一条通道以提高成功率
    try {
      if (chatType === 'group' || chatType === 'single') {
        // 已尝试 appchat，回退到 external
        return await sendExternalGroupMessage(chatid, content);
      } else {
        return await sendAppChatMessage(chatid, content);
      }
    } catch (err2) {
      throw new Error(`${err.message}; fallback error: ${err2.message}`);
    }
  }
}

// 获取企业微信客户群列表
async function getGroupChats(statusFilter = 0) {
  const token = await getAccessToken();
  const params = new URLSearchParams({
    status_filter: statusFilter,
    limit: 1000,
  });
  const res = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/list?access_token=${token}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status_filter: statusFilter, limit: 1000 }) }
  );
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(`获取客户群列表失败: ${data.errmsg}`);
  return data.group_chat_list || [];
}

// 调用 AI 生成订单摘要
async function generateOrderSummary(orders, clientName) {
  const aiEndpoint = getConfig('ai_endpoint');
  const aiKey = getConfig('ai_key');
  const aiModel = getConfig('ai_model') || 'gpt-3.5-turbo';

  if (!aiEndpoint || !aiKey) {
    return formatOrderTemplate(orders, clientName);
  }

  const orderList = orders.map((o, i) =>
    `${i + 1}. 工作号: ${o.job_no}, 日期: ${o.job_date?.slice(0, 10)}, 船名: ${o.vessel || '-'}, 航次: ${o.voyage || '-'}, ETD: ${o.etd?.slice(0, 10) || '-'}, ETA: ${o.eta?.slice(0, 10) || '-'}, 目的国: ${o.dest_country || '-'}, 品名: ${o.goods_name || '-'}, 件数: ${o.pieces || 0}, 方数: ${o.goods_cbm || 0}, 状态: ${o.order_status || '-'}`
  ).join('\n');

  const prompt = `你是美鸥物流的智能助手。请根据以下订单信息，为客户"${clientName}"生成一段简洁友好的订单推送消息，使用纯文本格式（不要用markdown），包含：
- 标题和问候语
- 每条订单的详细信息（工作号、船名航次、ETD/ETA、目的国、品名、件数、方数、状态）
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
          { role: 'system', content: '你是一个专业的物流客服助手，帮客户生成简洁清晰的订单推送消息。使用纯文本格式，不要用markdown。' },
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

// 模板方式生成推送消息（纯文本，客户群消息不支持markdown）
function formatOrderTemplate(orders, clientName) {
  const now = new Date().toLocaleString('zh-CN');
  let msg = `【美鸥物流 · 订单更新】\n`;
  msg += `客户：${clientName}\n`;
  msg += `时间：${now}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    msg += `\n${i + 1}. 工作号：${o.job_no || '-'}\n`;
    msg += `   船名/航次：${o.vessel || '-'} / ${o.voyage || '-'}\n`;
    msg += `   ETD：${o.etd?.slice(0, 10) || '-'}  ETA：${o.eta?.slice(0, 10) || '-'}\n`;
    msg += `   目的国：${o.dest_country || '-'}\n`;
    msg += `   品名：${o.goods_name || '-'}  件数：${o.pieces || 0}  方数：${o.goods_cbm || 0}\n`;
    msg += `   状态：${o.order_status || '-'}\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `如有疑问请联系客服，感谢您的信任与支持！\n`;
  msg += `美鸥物流 · 用心服务每一票`;

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

// 推送订单到客户群 → 写入RPA队列
async function pushOrdersToClient(clientId, orderIds) {
  const db = getDb();
  const customer = db.prepare(
    'SELECT client_id, client_code, client_name, wechat_chatid, wechat_group_name, wechat_webhook FROM yunwuyun_customers WHERE client_id = ?'
  ).get(clientId);

  if (!customer) throw new Error('客户不存在');

  const placeholders = orderIds.map(() => '?').join(',');
  const orders = db.prepare(
    `SELECT job_id, job_no, job_date, vessel, voyage, etd, eta, dest_country, goods_name, pieces, goods_cbm, order_status
     FROM yunwuyun_orders WHERE job_id IN (${placeholders})`
  ).all(...orderIds);

  if (orders.length === 0) throw new Error('未找到订单');

  const content = await generateOrderSummary(orders, customer.client_name);

  let pushed = false;

  // 通道1：内部群 Webhook（如果有配置）
  if (customer.wechat_webhook) {
    try {
      await sendWebhookMessage(customer.wechat_webhook, content);
      pushed = true;
    } catch (err) {
      console.error('Webhook 推送失败:', err.message);
    }
  }

  // 通道2：写入RPA队列（供影刀等工具消费，支持外部群）
  if (customer.wechat_group_name || customer.wechat_chatid || !pushed) {
    enqueuePush({
      clientId: customer.client_id,
      clientName: customer.client_name,
      groupName: customer.wechat_group_name || customer.client_name,
      orderIds: orderIds.join(','),
      content,
    });
    pushed = true;
  }

  if (!pushed) throw new Error('该客户未配置任何推送通道（Webhook 或群名称）');

  // 记录日志
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

  return { success: true, message: `已推送 ${customer.wechat_group_name || customer.client_name}（${orders.length} 条订单）` };
}

// 通过 Webhook 发消息（内部群保留）
async function sendWebhookMessage(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { content },
    }),
  });
  const data = await res.json();
  if (data.errcode !== 0) throw new Error(`Webhook 发送失败: ${data.errmsg}`);
  return data;
}

// 写入RPA消息队列
function enqueuePush({ clientId, clientName, groupName, orderIds, content }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO push_queue (client_id, client_name, group_name, order_ids, content, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  ).run(clientId || null, clientName || null, groupName || null, orderIds || null, content, now);
}

// RPA拉取待发送消息
function dequeuePending(limit = 10) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM push_queue WHERE status = ? ORDER BY created_at ASC LIMIT ?'
  ).all('pending', limit);
}

// RPA标记已发送
function markSent(id) {
  const db = getDb();
  db.prepare('UPDATE push_queue SET status = ?, sent_at = ? WHERE id = ?')
    .run('sent', new Date().toISOString(), id);
}

// RPA标记失败
function markFailed(id, errorMsg) {
  const db = getDb();
  db.prepare('UPDATE push_queue SET status = ?, error_msg = ? WHERE id = ?')
    .run('failed', errorMsg || '未知错误', id);
}

// ─── 智能回复：处理客户群里的@消息 ───

// 关键词匹配 + 数据库查询
function handleLocalQuery(message, clientName) {
  const db = getDb();
  const msg = (message || '').trim();

  // 1. 查询订单：按工作号
  const jobNoMatch = msg.match(/[A-Z]{2,}\d{4,}/i);
  if (jobNoMatch || /查询.*订单|订单.*查询|工作号|帮我查/.test(msg)) {
    const jobNo = jobNoMatch ? jobNoMatch[0] : msg.replace(/查询.*订单|订单.*查询|工作号|帮我查|查一下|帮我查一下/g, '').trim();
    if (jobNo) {
      const order = db.prepare(
        `SELECT job_no, job_date, vessel, voyage, etd, eta, dest_country, goods_name, pieces, goods_cbm, order_status,
                container_no, seal_no, bl_no, mbl_no
         FROM yunwuyun_orders WHERE job_no LIKE ?`
      ).get(`%${jobNo}%`);

      if (order) {
        return `【订单查询结果】\n━━━━━━━━━━━━━━━━\n工作号：${order.job_no}\n日期：${order.job_date?.slice(0, 10)}\n船名/航次：${order.vessel || '-'} / ${order.voyage || '-'}\nETD：${order.etd?.slice(0, 10) || '-'}\nETA：${order.eta?.slice(0, 10) || '-'}\n目的国：${order.dest_country || '-'}\n品名：${order.goods_name || '-'}\n件数：${order.pieces || 0}  方数：${order.goods_cbm || 0}\n柜号：${order.container_no || '-'}\n封号：${order.seal_no || '-'}\n提单号：${order.bl_no || '-'}\n状态：${order.order_status || '-'}\n━━━━━━━━━━━━━━━━\n如有疑问请联系客服`;
      }
      return `未找到工作号 "${jobNo}" 对应的订单，请确认工作号是否正确。`;
    }
  }

  // 2. 查询最近订单
  if (/最近.*订单|最新.*订单|我的订单|订单列表/.test(msg)) {
    if (!clientName) return '请提供客户名称以便查询。';
    const customer = db.prepare(
      'SELECT client_id, client_name FROM yunwuyun_customers WHERE client_name LIKE ?'
    ).get(`%${clientName}%`);
    if (!customer) return `未找到客户 "${clientName}"，请确认客户名称。`;

    const orders = db.prepare(
      `SELECT job_no, job_date, vessel, voyage, etd, eta, dest_country, goods_name, pieces, goods_cbm, order_status
       FROM yunwuyun_orders WHERE client_id = ? ORDER BY job_date DESC LIMIT 5`
    ).all(customer.client_id);

    if (orders.length === 0) return `${clientName} 暂无订单记录。`;

    let reply = `【${clientName} · 最近订单】\n━━━━━━━━━━━━━━━━\n`;
    orders.forEach((o, i) => {
      reply += `${i + 1}. ${o.job_no}  ${o.vessel || '-'}/${o.voyage || '-'}  ${o.dest_country || '-'}  ${o.order_status || '-'}\n`;
    });
    reply += `━━━━━━━━━━━━━━━━\n共 ${orders.length} 条，回复"查询+工作号"查看详情`;
    return reply;
  }

  // 3. 帮助/打招呼
  if (/帮助|你好|hello|hi|怎么用|能做什么/.test(msg.toLowerCase())) {
    return `【美鸥助手 · 使用说明】\n━━━━━━━━━━━━━━━━\n我可以帮你：\n1. 查询订单" + 工作号\n   例：查询订单 ABC123456\n2. 查看最近订单\n   例：最近订单\n3. 查询物流状态\n   例：查询状态 ABC123456\n━━━━━━━━━━━━━━━━\n直接 @我 提问即可`;
  }

  return null;
}

// 智能回复入口
async function chatReply({ message, groupName, senderName }) {
  const msg = (message || '').trim();
  if (!msg) return '请说些什么吧~';

  // 先尝试本地查询
  const localReply = handleLocalQuery(msg, groupName);
  if (localReply) return localReply;

  // 尝试 AI 回复
  const aiEndpoint = getConfig('ai_endpoint');
  const aiKey = getConfig('ai_key');
  const aiModel = getConfig('ai_model') || 'gpt-3.5-turbo';

  if (aiEndpoint && aiKey) {
    try {
      const res = await fetch(aiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: '你是美鸥物流的智能客服助手"美鸥助手"。回答简洁专业，用纯文本格式。关于订单查询，请引导用户提供工作号。' },
            { role: 'user', content: `客户群"${groupName}"中${senderName || '用户'}问：${msg}` },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (err) {
      console.error('AI回复失败:', err.message);
    }
  }

  return `您好！我是美鸥助手 🤖\n\n您可以：\n• 回复"查询订单 + 工作号"查看订单详情\n• 回复"最近订单"查看最新动态\n• 回复"帮助"查看更多功能\n\n如有紧急问题，请联系人工客服。`;
}

// ─── 企业微信回调：接收客户群消息 ───
import crypto from 'crypto';

class WXBizMsgCrypt {
  constructor(token, encodingAESKey, corpId) {
    this.token = token;
    this.encodingAESKey = encodingAESKey;
    this.corpId = corpId;
    this.key = Buffer.from(encodingAESKey + '=', 'base64');
  }

  decrypt(encrypt) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.key.slice(0, 16));
    decipher.setAutoPadding(false);
    let decrypted = Buffer.concat([decipher.update(Buffer.from(encrypt, 'base64')), decipher.final()]);
    // 去掉尾部 padding
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, decrypted.length - pad);
    // 前16字节是随机串，接着4字节是msg_len，后面是msg，最后是corpid
    const msgLen = decrypted.readUInt32BE(16);
    const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');
    const corpId = decrypted.slice(20 + msgLen).toString('utf8');
    if (corpId !== this.corpId) throw new Error('CorpID不匹配');
    return msg;
  }

  verifyUrl(msgSignature, timestamp, nonce, echostr) {
    const signature = this.getSignature(timestamp, nonce, echostr);
    if (signature !== msgSignature) throw new Error('签名验证失败');
    return this.decrypt(echostr);
  }

  getSignature(timestamp, nonce, encrypt) {
    const arr = [this.token, timestamp, nonce, encrypt].sort();
    return crypto.createHash('sha1').update(arr.join('')).digest('hex');
  }

  decryptMsg(msgSignature, timestamp, nonce, postData) {
    // 从XML中提取Encrypt
    const encryptMatch = postData.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/);
    if (!encryptMatch) throw new Error('未找到Encrypt');
    const encrypt = encryptMatch[1];
    const signature = this.getSignature(timestamp, nonce, encrypt);
    if (signature !== msgSignature) throw new Error('签名验证失败');
    return this.decrypt(encrypt);
  }
}

function parseXmlMsg(xml) {
  const extract = (tag) => {
    const m = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`));
    return m ? m[1] : '';
  };
  return {
    ToUserName: extract('ToUserName'),
    FromUserName: extract('FromUserName'),
    CreateTime: extract('CreateTime'),
    MsgType: extract('MsgType'),
    Content: extract('Content'),
    MsgId: extract('MsgId'),
    AgentID: extract('AgentID'),
    Event: extract('Event'),
    ChatId: extract('ChatId'),
    ChatType: extract('ChatType'),
    GetChatInfoUrl: extract('GetChatInfoUrl'),
  };
}

async function handleWeworkCallback(query, body) {
  const token = getConfig('wework_callback_token');
  const aesKey = getConfig('wework_callback_aeskey');
  const corpId = getConfig('corpid');
  if (!token || !aesKey || !corpId) {
    throw new Error('回调未配置：请在"企业微信推送→回调配置"中设置Token和EncodingAESKey');
  }

  const crypt = new WXBizMsgCrypt(token, aesKey, corpId);
  const { msg_signature, timestamp, nonce } = query;

  // 解密消息
  const xml = crypt.decryptMsg(msg_signature, timestamp, nonce, body);
  const msg = parseXmlMsg(xml);

  console.log('[企微回调]', msg.MsgType, msg.Content?.slice(0, 100), 'from', msg.FromUserName);

  // 只处理文本消息
  if (msg.MsgType !== 'text' || !msg.Content) {
    return '';
  }

  const content = msg.Content.trim();
  const chatId = msg.ChatId;
  const chatType = msg.ChatType || '';

  // 检查是否 @了机器人
  const botName = getConfig('bot_name') || '机器人暖宝';
  if (!content.includes(`@${botName}`) && !content.includes('@' + botName)) {
    return ''; // 不是 @机器人，忽略
  }

  // 提取问题
  const question = content.replace(new RegExp(`@${botName}\\s*`, 'g'), '').replace(new RegExp(`@${botName}\\s*`, 'g'), '').trim() || '你好';

  console.log('[企微回调] 💬 问题:', question);

  // 调用智能回复
  const reply = await chatReply({ message: question, groupName: chatId, senderName: msg.FromUserName });

  if (reply) {
    // 通过API发送回复
    try {
      await sendAppMessage(chatId, reply, 'text', chatType);
      console.log('[企微回调] ✅ 已回复');
    } catch (err) {
      console.error('[企微回调] 回复失败:', err.message);
    }
  }

  return '';
}

function verifyWeworkUrl(query) {
  const token = getConfig('wework_callback_token');
  const aesKey = getConfig('wework_callback_aeskey');
  const corpId = getConfig('corpid');
  if (!token || !aesKey || !corpId) {
    throw new Error('回调未配置');
  }

  const crypt = new WXBizMsgCrypt(token, aesKey, corpId);
  const { msg_signature, timestamp, nonce, echostr } = query;
  return crypt.verifyUrl(msg_signature, timestamp, nonce, echostr);
}

export { getConfig, setConfig, getAllConfig, getAccessToken, clearTokenCache, sendAppMessage, getGroupChats, generateOrderSummary, pushOrdersToClient, getPushLogs, logPush, enqueuePush, dequeuePending, markSent, markFailed, chatReply, handleWeworkCallback, verifyWeworkUrl };