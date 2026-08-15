// 周报路由
import express from 'express';
import { WeeklyReportOps } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
router.use(authenticateToken);

// 周报列表
router.get('/weekly', (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const result = WeeklyReportOps.findAll(req.user.id, req.user.role === 'admin', parseInt(page), parseInt(pageSize));
  res.json(result);
});

// 创建/更新周报
router.post('/weekly', (req, res) => {
  const result = WeeklyReportOps.createOrUpdate(req.user.id, req.body);
  res.json(result);
});

// 本周自动统计数据
router.get('/weekly/stats', (req, res) => {
  const result = WeeklyReportOps.getWeekStats(req.user.id, req.user.role === 'admin');
  res.json(result);
});

export default router;
