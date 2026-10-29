// 数据看板路由
import express from 'express';
import { DashboardOps } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
router.use(authenticateToken);

const isPlatform = (req) => {
  const perms = req.user.permissions || [];
  return !req.user.tenant_id && perms.includes('system:platform');
};
const isAdmin = (req) => {
  const perms = req.user.permissions || [];
  return req.user.role === 'admin' || perms.includes('data:all') || perms.includes('system:platform');
};

// 获取看板数据
router.get('/', (req, res) => {
  const { period = 'month' } = req.query;
  const data = DashboardOps.getData(req.user.id, isAdmin(req), period, isPlatform(req) ? undefined : req.user.tenant_id);
  res.json(data);
});

// KPI月度看板
router.get('/kpi', (req, res) => {
  const { month } = req.query;
  const data = DashboardOps.getKPI(req.user.id, isAdmin(req), month || null, isPlatform(req) ? undefined : req.user.tenant_id);
  res.json(data);
});

// 漏斗异常诊断
router.get('/diagnostics', (req, res) => {
  const data = DashboardOps.getFunnelDiagnostics(req.user.id, isAdmin(req), isPlatform(req) ? undefined : req.user.tenant_id);
  res.json(data);
});

export default router;