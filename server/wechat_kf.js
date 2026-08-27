// 微信客服（微信客服）回调处理
// 文档：https://developer.work.weixin.qq.com/document/path/94670
import crypto from 'crypto';
import https from 'https';
import { getConfig, setConfig, chatReply } from './wechat.js';
import { getDb } from './database.js';

// 缓存微信客服 access_token（客服接口用的 access_token 和应用的是同一个）
let kfAccessTokenCache = { token: null, expiresAt: 0 };

// 微信客服回调的 Token 和 EncodingAESKey（和应用回调共用）
function getKfConfig() {
  return {
    token: getConfig('wework_callback_token'),
    encodingAESKey: getConfig('wework_callback_aeskey'),
    corpId: getConfig('corpid'),
  };
}

// 签名验证
function getSignature(token, timestamp, nonce, encrypt) {
  const arr = [token, timestamp, nonce, encrypt].sort();
  return crypto.createHash('sha1').update(arr.join('')).digest('hex');
}

// AES解密
function decrypt(encodingAESKey, encrypt) {
  const key = Buffer.from(encodingAESKey + '=', 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, key.slice(0, 16));
  decipher.setAutoPadding(false);
  let decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypt, 'base64')),
    decipher.final(),
  ]);
  const pad = decrypted[decrypted.length - 1];
  decrypted = decrypted.slice(0, decrypted.length - pad);
  const msgLen = decrypted.readUInt32BE(16);
  const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');
  const corpId = decrypted.slice(20 + msgLen).toString('utf8');
  return { msg, corpId };
}

// AES加密（用于回复消息时的被动响应）
function encrypt(encodingAESKey, corpId, replyMsg) {
  const key = Buffer.from(encodingAESKey + '=', 'base64');
  const text = Buffer.from(replyMsg, 'utf8');
  // 16字节随机串 + 4字节msg_len + msg + corpId
  const randomBytes = crypto.randomBytes(16);
  const msgLenBuf = Buffer.alloc(4);
  msgLenBuf.writeUInt32BE(text.length, 0);
  const corpIdBuf = Buffer.from(corpId, 'utf8');
  const plaintext = Buffer.concat([randomBytes, msgLenBuf, text, corpIdBuf]);
  // PKCS7 padding
  const blockSize = 32;
  const padLen = blockSize - (plaintext.length % blockSize);
  const padBuf = Buffer.alloc(padLen, padLen);
  const padded = Buffer.concat([plaintext, padBuf]);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, key.slice(0, 16));
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  return encrypted.toString('base64');
}

// 生成签名
function genSignature(token, timestamp, nonce, encrypt) {
  return getSignature(token, timestamp, nonce, encrypt);
}

// ========== URL验证（GET请求）==========
export function verifyKfCallbackUrl(query) {
  const { token, encodingAESKey, corpId } = getKfConfig();
  if (!token || !encodingAESKey || !corpId) {
    throw new Error('客服回调未配置：请先设置Token和EncodingAESKey');
  }

  const { msg_signature, timestamp, nonce, echostr } = query;
  const signature = getSignature(token, timestamp, nonce, echostr);
  if (signature !== msg_signature) {
    throw new Error('客服回调签名验证失败');
  }
  const { msg } = decrypt(encodingAESKey, echostr);
  return msg;
}

// ========== 解析微信客服回调消息（POST请求）==========
export function decryptKfMessage(query, body) {
  const { token, encodingAESKey, corpId } = getKfConfig();
  if (!token || !encodingAESKey || !corpId) {
    throw new Error('客服回调未配置');
  }

  const { msg_signature, timestamp, nonce } = query;
  // 从XML中提取Encrypt字段
  const encryptMatch = body.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/);
  if (!encryptMatch) throw new Error('未找到Encrypt字段');
  const encrypt = encryptMatch[1];

  const signature = getSignature(token, timestamp, nonce, encrypt);
  if (signature !== msg_signature) {
    throw new Error('客服回调消息签名验证失败');
  }

  const { msg } = decrypt(encodingAESKey, encrypt);
  return msg;
}

// ========== 解析微信客服消息XML ==========
function parseKfXml(xml) {
  const extract = (tag) => {
    const m = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`));
    return m ? m[1] : '';
  };
  const extractNum = (tag) => {
    const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
    return m ? m[1] : '';
  };
  return {
    ToUserName: extract('ToUserName'),
    CreateTime: extractNum('CreateTime'),
    MsgType: extract('MsgType'),
    Event: extract('Event'),
    EventType: extract('EventType'),
    OpenKfId: extract('OpenKfId'),
    Token: extract('Token'),
    Content: (() => {
      const m = xml.match(/<Content><!\[CDATA\[(.*?)\]\]><\/Content>/);
      return m ? m[1] : '';
    })(),
    ExternalUserId: extract('ExternalUserId'),
    ServicerUserId: extract('ServicerUserId'),
    MsgId: extract('MsgId'),
    SendTime: extractNum('SendTime'),
    Origin: extractNum('Origin'),
    TextContent: (() => {
      const m = xml.match(/<Text><!\[CDATA\[(.*?)\]\]><\/Text>/);
      return m ? m[1] : '';
    })(),
  };
}

// ========== HTTP POST 辅助函数（替代 fetch，兼容低版本 Node.js）==========
function httpPostJson(url, bodyObj) {
  const method = bodyObj ? 'POST' : 'GET';
  const postData = bodyObj ? JSON.stringify(bodyObj) : null;

  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

function httpGetJson(url) {
  return httpPostJson(url, null);
}

// ========== 获取客服专用 access_token ==========
export async function getKfAccessToken() {
  const now = Date.now();
  if (kfAccessTokenCache.token && kfAccessTokenCache.expiresAt > now + 300000) {
    return kfAccessTokenCache.token;
  }

  const corpid = getConfig('corpid');
  const secret = getConfig('kf_secret') || getConfig('secret'); // 优先用客服专用secret
  if (!corpid || !secret) throw new Error('请配置corpid和客服secret');

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${secret}`;
  const data = await httpGetJson(url);
  if (data.errcode !== 0) throw new Error(`获取客服access_token失败: ${data.errmsg}`);

  kfAccessTokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}

// ========== 发送客服消息 ==========
export async function sendKfMessage(openKfId, externalUserId, msgtype, content) {
  const token = await getKfAccessToken();
  const body = {
    touser: externalUserId,
    open_kfid: openKfId,
    msgtype: msgtype,
  };

  if (msgtype === 'text') {
    body.text = { content };
  } else if (msgtype === 'markdown') {
    body.markdown = { content };
  } else {
    body.text = { content };
    body.msgtype = 'text';
  }

  console.log('[客服消息] 发送:', JSON.stringify(body).slice(0, 200));

  const data = await httpPostJson(
    `https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg?access_token=${token}`,
    body
  );
  if (data.errcode !== 0) {
    console.error('[客服消息] 发送失败:', data);
    throw new Error(`发送客服消息失败: ${data.errmsg} (${data.errcode})`);
  }
  console.log('[客服消息] 发送成功');
  return data;
}

// ========== 同步客服消息 ==========
export async function syncKfMessages(cursor = '', eventToken = '', limit = 100) {
  const token = await getKfAccessToken();
  const body = { cursor, limit };
  if (eventToken) body.token = eventToken; // 只在有事件Token时传入

  const data = await httpPostJson(
    `https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg?access_token=${token}`,
    body
  );
  if (data.errcode !== 0) throw new Error(`同步客服消息失败: ${data.errmsg}`);
  return data;
}

// ========== 查询本地数据库获取订单上下文 ==========
function queryOrderContext(message) {
  const db = getDb();
  if (!db) return '';
  try {
    // 提取可能的提单号、工作单号等关键词
    const blMatch = message.match(/[A-Z0-9]{8,20}/gi);
    let orders = [];

    if (blMatch) {
      for (const code of blMatch.slice(0, 3)) {
        const found = db.prepare(
          `SELECT job_no, client_name, carrier_name, vessel, voyage, etd, eta,
                  bl_no_domestic, bl_no_overseas, so_no, order_status,
                  dest_country, cnt_nos, goods_name
           FROM yunwuyun_orders
           WHERE bl_no_domestic LIKE ? OR bl_no_overseas LIKE ? OR job_no LIKE ? OR so_no LIKE ?
           LIMIT 3`
        ).all(`%${code}%`, `%${code}%`, `%${code}%`, `%${code}%`);
        orders.push(...found);
      }
    }

    // 如果没找到单号，尝试按客户名查最近订单
    if (orders.length === 0) {
      const recentOrders = db.prepare(
        `SELECT job_no, client_name, carrier_name, vessel, voyage, etd, eta,
                bl_no_domestic, order_status, dest_country
         FROM yunwuyun_orders
         ORDER BY job_date DESC LIMIT 5`
      ).all();
      if (recentOrders.length > 0) {
        return `最近订单: ${recentOrders.map(o =>
          `${o.job_no || '-'} | ${o.client_name || '-'} | ${o.carrier_name || '-'} | ${o.vessel || ''}/${o.voyage || ''} | ETD:${o.etd || '-'} | ETA:${o.eta || '-'} | 状态:${o.order_status}`
        ).join('\n')}`;
      }
    }

    if (orders.length > 0) {
      return `查到相关订单: ${orders.map(o =>
        `${o.job_no || '-'} | ${o.client_name || '-'} | ${o.carrier_name || '-'} ${o.vessel || ''}/${o.voyage || ''} | ETD:${o.etd || '-'} ETA:${o.eta || '-'} | 提单:${o.bl_no_domestic || o.bl_no_overseas || '-'} | SO:${o.so_no || '-'} | 目的港:${o.dest_country || '-'} | 状态:${o.order_status}`
      ).join('\n')}`;
    }

    return '未找到相关订单记录';
  } catch (err) {
    console.error('[客服回调] 查询订单数据失败:', err.message);
    return '';
  }
}

// ========== 处理微信客服回调 ==========
export async function handleKfCallback(query, body) {
  const xml = decryptKfMessage(query, body);
  const msg = parseKfXml(xml);

  console.log('[客服回调] MsgType:', msg.MsgType, 'Event:', msg.Event, 'EventType:', msg.EventType);
  console.log('[客服回调] OpenKfId:', msg.OpenKfId, 'ExternalUserId:', msg.ExternalUserId);
  console.log('[客服回调] Token:', msg.Token ? msg.Token.slice(0, 20) + '...' : '(无)');

  // 微信客服回调始终是 event 类型，消息内容需通过 sync_msg 拉取
  if (msg.MsgType === 'event' && (msg.Event === 'kf_msg_or_event' || msg.EventType === 'kf_msg_or_event')) {
    const eventToken = msg.Token || '';
    console.log('[客服回调] 收到kf_msg_or_event事件, Token:', eventToken ? eventToken.slice(0, 20) + '...' : '(空)');

    if (!eventToken) {
      console.error('[客服回调] 事件Token为空，无法同步消息');
      return '';
    }

    try {
      const cursor = getConfig('kf_sync_cursor') || '';
      const syncResult = await syncKfMessages(cursor, eventToken);
      console.log('[客服回调] sync结果: errcode=', syncResult.errcode, 'msg_count=', syncResult.msg_list?.length || 0);

      if (syncResult.errcode !== 0) {
        console.error('[客服回调] sync失败:', syncResult.errmsg);
        return '';
      }

      if (syncResult.msg_list?.length > 0) {
        for (const kfMsg of syncResult.msg_list) {
          if (kfMsg.origin !== 3) continue; // 只处理客户发的消息
          if (kfMsg.msgtype !== 'text') continue; // 只处理文本

          const textContent = kfMsg.text?.content || '';
          if (!textContent) continue;
          console.log('[客服回调] 客户消息:', textContent);

          const orderContext = queryOrderContext(textContent);
          console.log('[客服回调] 订单上下文:', orderContext ? orderContext.slice(0, 200) : '(无)');

          const fullMessage = orderContext
            ? `${textContent}\n\n[本地订单数据]\n${orderContext}`
            : textContent;

          try {
            const reply = await chatReply({
              message: fullMessage,
              groupName: kfMsg.open_kfid || '客服',
              senderName: kfMsg.external_userid || '客户',
            });

            if (reply && kfMsg.open_kfid && kfMsg.external_userid) {
              console.log('[客服回调] 发送回复:', reply.slice(0, 100));
              await sendKfMessage(kfMsg.open_kfid, kfMsg.external_userid, 'text', reply);
            }
          } catch (err) {
            console.error('[客服回调] chatReply失败:', err.message);
          }
        }
      } else {
        console.log('[客服回调] sync未拉取到新消息');
      }

      if (syncResult.next_cursor) {
        setConfig('kf_sync_cursor', syncResult.next_cursor);
      }
    } catch (err) {
      console.error('[客服回调] sync同步失败:', err.message);
    }
  } else {
    console.log('[客服回调] 未处理的消息类型 MsgType:', msg.MsgType, 'Event:', msg.Event, 'EventType:', msg.EventType);
  }

  return '';
}

// ========== 主动获取客服账号列表 ==========
export async function getKfAccountList() {
  const token = await getKfAccessToken();
  const data = await httpPostJson(
    `https://qyapi.weixin.qq.com/cgi-bin/kf/account/list?access_token=${token}`,
    { offset: 0, limit: 100 }
  );
  if (data.errcode !== 0) throw new Error(`获取客服账号列表失败: ${data.errmsg}`);
  return data.account_list || [];
}

// ========== 添加客服联系人链接（获取二维码）==========
export async function getKfAddContactWay(openKfId) {
  const token = await getKfAccessToken();
  const data = await httpPostJson(
    `https://qyapi.weixin.qq.com/cgi-bin/kf/add_contact_way?access_token=${token}`,
    { open_kfid: openKfId }
  );
  if (data.errcode !== 0) throw new Error(`获取客服链接失败: ${data.errmsg}`);
  return data;
}