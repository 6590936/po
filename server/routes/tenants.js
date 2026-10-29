// 租户管理路由
import express from 'express';
import { TenantOps, RoleOps } from '../database.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
router.use(authenticateToken);

function requirePlatform(req, res, next) {
  if (!req.user.tenant_id && req.user.permissions?.includes('system:platform')) {
    return next();
  }
  return res.status(403).json({ error: '需要平台管理员权限' });
}

router.get('/', requirePlatform, (req, res) => {
  try {
    const tenants = TenantOps.findAll();
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePlatform, (req, res) => {
  try {
    const tenant = TenantOps.findById(parseInt(req.params.id));
    if (!tenant) return res.status(404).json({ error: '租户不存在' });
    res.json(tenant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePlatform, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '租户名称不能为空' });
  try {
    const tenant = TenantOps.create({ name });
    res.json({ id: tenant.id, message: '租户创建成功' });
  } catch (err) {
    if (err.message.includes('已存在')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requirePlatform, (req, res) => {
  const id = parseInt(req.params.id);
  const { name, status } = req.body;
  try {
    const success = TenantOps.update(id, { name, status });
    if (!success) return res.status(404).json({ error: '租户不存在' });
    res.json({ message: '租户更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/disable', requirePlatform, (req, res) => {
  const id = parseInt(req.params.id);
  try {
    TenantOps.disable(id);
    res.json({ message: '租户已停用' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/enable', requirePlatform, (req, res) => {
  const id = parseInt(req.params.id);
  try {
    TenantOps.enable(id);
    res.json({ message: '租户已启用' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/roles', requirePlatform, (req, res) => {
  const tenantId = parseInt(req.params.id);
  try {
    const roles = RoleOps.findAll(tenantId);
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;