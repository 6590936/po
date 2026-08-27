// 企业微信推送路由（自建应用）
import express from 'express';
import { authenticateToken } from './auth.js';
import { getConfig, setConfig, getAllConfig, getAccessToken, clearTokenCache, sendAppMessage, getGroupChats, pushOrdersToClient, getPushLogs, enqueuePush, dequeuePending, markSent, markFailed, chatReply, handleWeworkCallback, verifyWeworkUrl } from '../wechat.js';
import { getDb } from '../database.js';

const router = express.Router();

// ─── RPA接口（无需登录，供影刀等工具轮询） ───
const RPA_TOKEN = 'meiou-rpa-2024';

// 影刀拉取待发送消息
router.get('/rpa/pending', (req, res) => {
  try {
    const token = req.query.token || req.headers['x-rpa-token'];
    if (token !== RPA_TOKEN) return res.status(403).json({ error: '无效token' });
    const limit = parseInt(req.query.limit) || 10;
    const list = dequeuePending(limit);
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 影刀标记已发送
router.post('/rpa/sent/:id', (req, res) => {
  try {
    const token = req.query.token || req.headers['x-rpa-token'];
    if (token !== RPA_TOKEN) return res.status(403).json({ error: '无效token' });
    markSent(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 影刀标记失败
router.post('/rpa/failed/:id', (req, res) => {
  try {
    const token = req.query.token || req.headers['x-rpa-token'];
    if (token !== RPA_TOKEN) return res.status(403).json({ error: '无效token' });
    markFailed(parseInt(req.params.id), req.body.error);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 智能回复：影刀截获群聊@消息后调用此接口获取回复
router.post('/rpa/chat', async (req, res) => {
  try {
    const token = req.query.token || req.headers['x-rpa-token'];
    if (token !== RPA_TOKEN) return res.status(403).json({ error: '无效token' });
    const { message, group_name, sender_name } = req.body;
    if (!message) return res.json({ success: false, error: '消息内容为空' });
    const reply = await chatReply({ message, groupName: group_name, senderName: sender_name });
    res.json({ success: true, reply });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 查看队列状态（前端页面用）
router.get('/rpa/queue', (req, res) => {
  try {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as cnt FROM push_queue').get().cnt;
    const pending = db.prepare('SELECT COUNT(*) as cnt FROM push_queue WHERE status = ?').get('pending').cnt;
    const rows = db.prepare('SELECT * FROM push_queue ORDER BY created_at DESC LIMIT 50').all();
    res.json({ success: true, data: rows, total, pending });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 企业微信回调（接收客户群消息） ───
// 不使用 express.json()，需用 raw body

// GET：URL验证（不需要登录，企业微信服务器会直接访问）
router.get('/callback', (req, res) => {
  try {
    const echo = verifyWeworkUrl(req.query);
    console.log('[回调] URL验证成功');
    res.send(echo);
  } catch (err) {
    console.error('[回调] URL验证失败:', err.message);
    res.status(403).send('验证失败');
  }
});

// POST：接收消息（企业微信推送）
router.post('/callback', express.text({ type: 'text/xml' }), async (req, res) => {
  try {
    await handleWeworkCallback(req.query, req.body);
    res.send('');
  } catch (err) {
    console.error('[回调] 处理失败:', err.message);
    res.send('');
  }
});

// ─── 以下接口需要登录 ───
router.use(authenticateToken);

// 获取企业微信配置（含 corpid/agentid/secret/AI）
router.get('/config', (req, res) => {
  try {
    const configs = getAllConfig();
    const result = {};
    for (const c of configs) {
      if (c.key === 'ai_key' || c.key === 'secret') {
        result[c.key] = c.value ? '****' + c.value.slice(-4) : '';
      } else {
        result[c.key] = c.value;
      }
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 保存企业微信配置
router.put('/config', (req, res) => {
  try {
    const { corpid, agentid, secret, ai_endpoint, ai_key, ai_model } = req.body;
    if (corpid !== undefined) setConfig('corpid', corpid);
    if (agentid !== undefined) setConfig('agentid', agentid);
    if (secret !== undefined && !secret.startsWith('****')) setConfig('secret', secret);
    if (ai_endpoint !== undefined) setConfig('ai_endpoint', ai_endpoint);
    if (ai_key !== undefined && !ai_key.startsWith('****')) setConfig('ai_key', ai_key);
    if (ai_model !== undefined) setConfig('ai_model', ai_model);
    clearTokenCache();
    res.json({ success: true, message: '配置保存成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 测试连接（验证 corpid/secret 是否有效）
router.post('/test-connection', async (req, res) => {
  try {
    clearTokenCache();
    const token = await getAccessToken();
    res.json({ success: true, message: '企业微信连接成功', token_prefix: token.slice(0, 10) + '...' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 获取客户群列表
router.get('/groupchats', async (req, res) => {
  try {
    const list = await getGroupChats();
    res.json({ success: true, data: list.map(g => ({
      chat_id: g.chat_id,
      name: g.name,
      member_count: (g.member_list || []).length,
      owner: g.owner,
      create_time: g.create_time,
    })) });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 测试发送消息到指定群聊
router.post('/test-send', async (req, res) => {
  try {
    const { chatid } = req.body;
    if (!chatid) return res.json({ success: false, error: '请输入群聊 chatid' });
    await sendAppMessage(chatid,
      '【美鸥物流 · 测试消息】\n系统连接测试成功！\n时间：' + new Date().toLocaleString('zh-CN')
    );
    res.json({ success: true, message: '测试消息发送成功，请查看企业微信群' });
  } catch (err) {
    res.json({ success: false, error: '发送失败: ' + err.message });
  }
});

// 更新客户群聊配置（chatid + 群名称）
router.put('/customer-chatid/:id', (req, res) => {
  try {
    const db = getDb();
    const { wechat_chatid, wechat_group_name, wechat_webhook } = req.body;
    db.prepare(
      'UPDATE yunwuyun_customers SET wechat_chatid = ?, wechat_group_name = ?, wechat_webhook = ? WHERE client_id = ?'
    ).run(wechat_chatid || null, wechat_group_name || null, wechat_webhook || null, parseInt(req.params.id));
    res.json({ success: true, message: '群聊配置保存成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 推送订单到客户群
router.post('/push', async (req, res) => {
  try {
    const { client_id, order_ids } = req.body;
    if (!client_id) return res.json({ success: false, error: '请选择客户' });
    if (!order_ids || order_ids.length === 0) return res.json({ success: false, error: '请选择订单' });

    const result = await pushOrdersToClient(client_id, order_ids);
    res.json(result);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 推送日志列表
router.get('/logs', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 20;
    const result = getPushLogs(page, size);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;