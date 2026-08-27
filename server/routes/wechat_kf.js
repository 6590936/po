// 微信客服路由
import express from 'express';
import {
  verifyKfCallbackUrl,
  handleKfCallback,
  decryptKfMessage,
  sendKfMessage,
  syncKfMessages,
  getKfAccountList,
  getKfAddContactWay,
} from '../wechat_kf.js';
import { handleWeworkCallback } from '../wechat.js';

const router = express.Router();

// ========== 微信客服回调（不需要登录）==========

// GET: URL验证（企微服务器访问）
router.get('/kf/callback', (req, res) => {
  try {
    const echo = verifyKfCallbackUrl(req.query);
    console.log('[客服回调] URL验证成功');
    res.send(echo);
  } catch (err) {
    console.error('[客服回调] URL验证失败:', err.message);
    res.status(403).send('验证失败');
  }
});

// POST: 接收消息（企微推送）—— 同时处理微信客服和客户群消息
router.post('/kf/callback', express.text({ type: 'text/xml' }), async (req, res) => {
  try {
    // 解密消息
    const xml = decryptKfMessage(req.query, req.body);
    // 判断消息类型：微信客服有 kf_msg_or_event，客户群有 text/event
    if (xml.includes('kf_msg_or_event')) {
      await handleKfCallback(req.query, req.body);
    } else {
      // 客户群消息（@机器人等）
      await handleWeworkCallback(req.query, req.body);
    }
    res.send('');
  } catch (err) {
    console.error('[回调] 处理失败:', err.message);
    res.send('');
  }
});

// ========== 以下接口需要登录 ==========
// 注意：这些管理接口需要在 router.use(authenticateToken) 之后注册
// 但由于这个 router 会在 authenticateToken 中间件之前挂载，
// 所以管理接口需要单独处理鉴权

// 获取客服账号列表
router.get('/kf/accounts', async (req, res) => {
  try {
    const accounts = await getKfAccountList();
    res.json({ success: true, data: accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取客服联系人链接
router.get('/kf/contact-way/:openKfId', async (req, res) => {
  try {
    const result = await getKfAddContactWay(req.params.openKfId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 手动发送客服消息
router.post('/kf/send', async (req, res) => {
  try {
    const { open_kfid, external_userid, content, msgtype } = req.body;
    if (!open_kfid || !external_userid || !content) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const result = await sendKfMessage(open_kfid, external_userid, msgtype || 'text', content);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 同步客服消息（手动触发）
router.post('/kf/sync', async (req, res) => {
  try {
    const cursor = req.body.cursor || '';
    const result = await syncKfMessages(cursor);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 测试客服回复（直接调用AI+CRM查询）
router.post('/kf/test-reply', async (req, res) => {
  try {
    const { message, sender_name } = req.body;
    if (!message) return res.status(400).json({ error: '消息内容为空' });
    const reply = await chatReply({
      message,
      groupName: '测试',
      senderName: sender_name || '测试用户',
    });
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;