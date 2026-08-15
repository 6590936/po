// 报价管理路由
import express from 'express';
import { QuoteOps } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
router.use(authenticateToken);

// 报价列表
router.get('/', (req, res) => {
  const { status, page = 1, pageSize = 20 } = req.query;
  const result = QuoteOps.findAll({
    userId: req.user.id,
    isAdmin: req.user.role === 'admin',
    status: status || null,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
  });
  res.json(result);
});

// 创建报价
router.post('/', (req, res) => {
  const { customer_id, route, container_type, amount, currency, valid_until, notes } = req.body;
  if (!customer_id) return res.status(400).json({ error: '请选择客户' });

  const result = QuoteOps.create({
    customer_id,
    user_id: req.user.id,
    route, container_type, amount, currency: currency || 'CNY',
    valid_until, notes,
  });
  res.json({ ...result, message: '报价创建成功' });
});

// 更新报价
router.put('/:id', (req, res) => {
  const result = QuoteOps.update(req.params.id, req.body);
  if (!result) return res.status(404).json({ error: '报价不存在' });
  res.json(result);
});

// 删除报价
router.delete('/:id', (req, res) => {
  const success = QuoteOps.delete(req.params.id);
  if (!success) return res.status(404).json({ error: '报价不存在' });
  res.json({ message: '删除成功' });
});

// 报价统计
router.get('/stats', (req, res) => {
  const result = QuoteOps.getStats(req.user.id, req.user.role === 'admin');
  res.json(result);
});

export default router;
