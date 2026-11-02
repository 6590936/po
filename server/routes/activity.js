// 每日活动记录路由
import express from 'express';
import { DailyActivityOps } from '../database.js';
import { authenticateToken } from './auth.js';
import { isAdminUser, tenantScope } from '../utils/scope.js';

const router = express.Router();
router.use(authenticateToken);

// 创建/更新今日记录
router.post('/', (req, res) => {
  const result = DailyActivityOps.createOrUpdate(req.user.id, req.body, req.user.tenant_id);
  res.json(result);
});

// 获取今日记录
router.get('/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const result = DailyActivityOps.findByDate(req.user.id, today);
  res.json(result || { date: today, calls: 0, wechat_adds: 0, emails: 0, effective_comms: 0, quotes_sent: 0, crm_updates: 0 });
});

// 获取日期范围记录
router.get('/range', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: '请提供start和end参数' });
  const result = DailyActivityOps.findByRange(req.user.id, isAdminUser(req.user), start, end, tenantScope(req.user));
  res.json(result);
});

// 获取统计汇总
router.get('/stats', (req, res) => {
  const { period = 'week' } = req.query;
  const result = DailyActivityOps.getStats(req.user.id, isAdminUser(req.user), period, tenantScope(req.user));
  res.json(result);
});

export default router;