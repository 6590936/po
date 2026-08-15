// 客户管理路由
import express from 'express';
import { CustomerOps } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
router.use(authenticateToken);

// 获取客户列表
router.get('/', (req, res) => {
  const {
    page = 1, pageSize = 20, keyword, grade, status, customerType,
    ownerId, sortBy = 'updated_at', sortOrder = 'DESC', overdue,
  } = req.query;

  const where = {};
  if (keyword) where.keyword = keyword;
  if (grade) where.grade = grade;
  if (status) where.status = status;
  if (customerType) where.customerType = customerType;

  // 销售只能看自己的客户
  if (req.user.role !== 'admin') {
    where.owner_id = req.user.id;
  } else if (ownerId) {
    where.owner_id = parseInt(ownerId);
  }

  const result = CustomerOps.findAll({
    where,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    sortBy,
    sortOrder: sortOrder.toUpperCase(),
    overdue: overdue === 'true',
  });

  res.json({ ...result, page: parseInt(page), pageSize: parseInt(pageSize) });
});

// ===== 固定路径路由（必须在 /:id 前面，否则会被拦截） =====

// 超期未跟进提醒
router.get('/reminders/overdue', (req, res) => {
  const customers = CustomerOps.getOverdue(req.user.id, req.user.role === 'admin');
  res.json(customers);
});

// 今日待跟进
router.get('/reminders/today', (req, res) => {
  const customers = CustomerOps.getToday(req.user.id, req.user.role === 'admin');
  res.json(customers);
});

// 导出客户列表
router.get('/export/list', (req, res) => {
  const data = CustomerOps.exportList(req.user.id, req.user.role === 'admin');
  res.json(data);
});

// 导出跟进记录
router.get('/export/followups', (req, res) => {
  const data = CustomerOps.exportFollowups(req.user.id, req.user.role === 'admin');
  res.json(data);
});

// 获取销售人员列表
router.get('/meta/sales', (req, res) => {
  res.json(CustomerOps.getSalesList());
});

// 等级智能建议
router.get('/grade-suggestions', (req, res) => {
  try {
    const suggestions = CustomerOps.getGradeSuggestions(req.user.id, req.user.role === 'admin');
    res.json(suggestions);
  } catch (err) {
    console.error('grade-suggestions error:', err);
    res.json([]);
  }
});

// ===== 动态参数路由（放在固定路径后面） =====

// 获取单个客户详情
router.get('/:id', (req, res) => {
  const customer = CustomerOps.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: '客户不存在' });
  if (req.user.role !== 'admin' && customer.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权查看该客户' });
  }
  res.json(customer);
});

// 创建客户
router.post('/', (req, res) => {
  const { company_name } = req.body;
  if (!company_name) return res.status(400).json({ error: '公司名称不能为空' });

  const result = CustomerOps.create({ ...req.body, owner_id: req.user.id });
  res.json({ ...result, message: '客户创建成功' });
});

// 更新客户
router.put('/:id', (req, res) => {
  const customer = CustomerOps.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: '客户不存在' });
  if (req.user.role !== 'admin' && customer.owner_id !== req.user.id) {
    return res.status(403).json({ error: '无权修改该客户' });
  }

  const data = { ...req.body, _userId: req.user.id };
  // 管理员可以转移客户
  if (req.user.role !== 'admin') delete data.owner_id;

  CustomerOps.update(req.params.id, data);
  res.json({ message: '客户更新成功' });
});

// 删除客户（仅管理员）
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以删除客户' });
  }
  const customer = CustomerOps.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: '客户不存在' });

  const success = CustomerOps.delete(req.params.id);
  if (success) {
    res.json({ message: '客户删除成功' });
  } else {
    res.status(500).json({ error: '删除失败' });
  }
});

// 添加跟进记录
router.post('/:id/followups', (req, res) => {
  const customer = CustomerOps.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: '客户不存在' });

  const { followup_date, method, content, next_plan, next_time } = req.body;
  if (!followup_date || !content) return res.status(400).json({ error: '跟进日期和内容不能为空' });

  const result = CustomerOps.addFollowup(req.params.id, {
    user_id: req.user.id,
    followup_date, method, content, next_plan, next_time,
  });
  res.json({ ...result, message: '跟进记录添加成功' });
});

export default router;
