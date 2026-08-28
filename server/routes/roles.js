import express from 'express';
import { RoleOps } from '../database.js';
import { authenticateToken, requireAdmin } from './auth.js';

const router = express.Router();

const ALL_MENUS = [
  { key: '/', label: '数据看板' },
  { key: '/customers', label: '客户管理' },
  { key: '/reminders', label: '跟进提醒' },
  { key: '/daily-report', label: '每日活动' },
  { key: '/quotes', label: '报价管理' },
  { key: '/weekly-report', label: '周报' },
  { key: '/yunwuyun', label: 'FMS数据同步' },
  { key: '/tracking', label: '轨迹查验' },
  { key: '/wechat', label: '企业微信推送' },
  { key: '/sales', label: '销售管理' },
  { key: '/admin', label: '系统管理' },
];

const ALL_PERMISSIONS = [
  { key: 'data:all', label: '查看所有数据' },
  { key: 'data:own', label: '仅查看自己数据' },
  { key: 'data:dept', label: '查看部门数据' },
];

// 所有角色接口需要管理员权限
router.use(authenticateToken, requireAdmin);

// 获取所有角色
router.get('/', (req, res) => {
  try {
    const roles = RoleOps.findAll();
    const result = roles.map(r => ({
      ...r,
      menus: RoleOps.getMenus(r.id),
      permissions: RoleOps.getPermissions(r.id),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取菜单列表
router.get('/menus', (req, res) => {
  res.json(ALL_MENUS);
});

// 获取权限列表
router.get('/permissions', (req, res) => {
  res.json(ALL_PERMISSIONS);
});

// 创建角色
router.post('/', (req, res) => {
  const { name, description, menus, permissions } = req.body;
  if (!name) return res.status(400).json({ error: '角色名称不能为空' });
  try {
    const role = RoleOps.create({ name, description });
    if (menus && menus.length > 0) RoleOps.setMenus(role.id, menus);
    if (permissions && permissions.length > 0) RoleOps.setPermissions(role.id, permissions);
    res.json({ id: role.id, message: '角色创建成功' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '角色名称已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 更新角色
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, menus, permissions } = req.body;
  try {
    const success = RoleOps.update(id, { name, description });
    if (!success) return res.status(404).json({ error: '角色不存在' });
    if (menus !== undefined) RoleOps.setMenus(id, menus);
    if (permissions !== undefined) RoleOps.setPermissions(id, permissions);
    res.json({ message: '角色更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除角色
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const success = RoleOps.delete(id);
    if (!success) return res.status(404).json({ error: '角色不存在' });
    res.json({ message: '角色删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取角色菜单
router.get('/:id/menus', (req, res) => {
  const id = parseInt(req.params.id);
  const menus = RoleOps.getMenus(id);
  res.json(menus);
});

// 获取角色权限
router.get('/:id/permissions', (req, res) => {
  const id = parseInt(req.params.id);
  const perms = RoleOps.getPermissions(id);
  res.json(perms);
});

export default router;