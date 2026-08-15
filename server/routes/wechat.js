// 企业微信推送路由
import express from 'express';
import { authenticateToken } from './auth.js';
import { getConfig, setConfig, getAllConfig, pushOrdersToClient, getPushLogs, sendToWechat } from '../wechat.js';
import { getDb } from '../database.js';

const router = express.Router();
router.use(authenticateToken);

// 获取企业微信配置
router.get('/config', (req, res) => {
  try {
    const configs = getAllConfig();
    const result = {};
    for (const c of configs) {
      if (c.key === 'ai_key') {
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
    const { ai_endpoint, ai_key, ai_model } = req.body;
    if (ai_endpoint !== undefined) setConfig('ai_endpoint', ai_endpoint);
    if (ai_key !== undefined && !ai_key.startsWith('****')) setConfig('ai_key', ai_key);
    if (ai_model !== undefined) setConfig('ai_model', ai_model);
    res.json({ success: true, message: '配置保存成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 测试 Webhook
router.post('/test-webhook', async (req, res) => {
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) return res.json({ success: false, error: '请输入 Webhook 地址' });
    await sendToWechat(webhook_url,
      '## 🧪 测试消息\n> 美鸥物流系统连接测试成功！\n> 时间：' + new Date().toLocaleString('zh-CN')
    );
    res.json({ success: true, message: '测试消息发送成功，请查看企业微信群' });
  } catch (err) {
    res.json({ success: false, error: '发送失败: ' + err.message });
  }
});

// 更新客户 Webhook 配置
router.put('/customer-webhook/:id', (req, res) => {
  try {
    const db = getDb();
    const { wechat_webhook, wechat_group_name } = req.body;
    db.prepare(
      'UPDATE yunwuyun_customers SET wechat_webhook = ?, wechat_group_name = ? WHERE client_id = ?'
    ).run(wechat_webhook || null, wechat_group_name || null, parseInt(req.params.id));
    res.json({ success: true, message: 'Webhook 配置保存成功' });
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