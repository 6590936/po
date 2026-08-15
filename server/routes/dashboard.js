// 数据看板路由
import express from 'express';
import { DashboardOps } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
router.use(authenticateToken);

// 获取看板数据
router.get('/', (req, res) => {
  const { period = 'month' } = req.query;
  const data = DashboardOps.getData(req.user.id, req.user.role === 'admin', period);
  res.json(data);
});

// KPI月度看板
router.get('/kpi', (req, res) => {
  const { month } = req.query;
  const data = DashboardOps.getKPI(req.user.id, req.user.role === 'admin', month || null);
  res.json(data);
});

// 漏斗异常诊断
router.get('/diagnostics', (req, res) => {
  const data = DashboardOps.getFunnelDiagnostics(req.user.id, req.user.role === 'admin');
  res.json(data);
});

export default router;
