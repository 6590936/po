import express from 'express';
import { RoleOps, TenantOps } from '../database.js';
import { authenticateToken } from './auth.js';
import { PLATFORM_ONLY_MENUS, PLATFORM_ONLY_PERMISSIONS } from '../utils/scope.js';

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
  { key: '/shipping-rates', label: '海运费报价' },
  { key: '/fee-templates', label: '费用模版' },
  { key: '/wechat', label: '企业微信推送' },
  { key: '/sales', label: '销售管理' },
  { key: '/admin', label: '平台管理' },
];

const ALL_PERMISSIONS = [
  { key: 'data:all', label: '查看所有数据' },
  { key: 'data:tenant', label: '查看本主体全部数据' },
  { key: 'data:own', label: '仅查看自己数据' },
  { key: 'data:dept', label: '查看部门数据' },
  { key: 'system:platform', label: '平台管理' },
  { key: 'system:tenant_admin', label: '主体管理员' },
  { key: 'shipping:active', label: '海运费-销售看板' },
  { key: 'shipping:batches', label: '海运费-批次管理' },
  { key: 'shipping:detail', label: '海运费-明细数据' },
];

// 权限校验：平台管理员 或 租户内管理员
function requireRoleAdmin(req, res, next) {
  const perms = req.user.permissions || [];
  if (req.user.role === 'admin' || perms.includes('system:tenant_admin') || perms.includes('system:platform')) {
    return next();
  }
  return res.status(403).json({ error: '需要管理员权限' });
}

// 租户角色（tenant_id 非空）不允许持有平台专属菜单/权限
function sanitizeForTenant(menus, permissions) {
  const m = Array.isArray(menus) ? menus.filter(x => !PLATFORM_ONLY_MENUS.includes(x)) : menus;
  const p = Array.isArray(permissions) ? permissions.filter(x => !PLATFORM_ONLY_PERMISSIONS.includes(x)) : permissions;
  return { menus: m, permissions: p };
}

// 所有角色接口需要鉴权
router.use(authenticateToken, requireRoleAdmin);

// 判断是否为平台管理员（tenant_id 为空 + system:platform 权限）
function isPlatform(req) {
  const perms = req.user.permissions || [];
  return !req.user.tenant_id && perms.includes('system:platform');
}

// 获取所有角色（平台管理员看全部，租户管理员只看自己租户的）
router.get('/', (req, res) => {
  try {
    const tids = isPlatform(req) ? undefined : TenantOps.getDescendantIds(req.user.tenant_id);
    const roles = RoleOps.findAll(tids);
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

// 获取菜单列表（非平台管理员不返回平台专属菜单）
router.get('/menus', (req, res) => {
  if (isPlatform(req)) return res.json(ALL_MENUS);
  res.json(ALL_MENUS.filter(m => !PLATFORM_ONLY_MENUS.includes(m.key)));
});

// 获取权限列表（非平台管理员不返回平台专属权限）
router.get('/permissions', (req, res) => {
  if (isPlatform(req)) return res.json(ALL_PERMISSIONS);
  res.json(ALL_PERMISSIONS.filter(p => !PLATFORM_ONLY_PERMISSIONS.includes(p.key)));
});

// 创建角色
router.post('/', (req, res) => {
  const { name, description, menus, permissions, tenant_id } = req.body;
  if (!name) return res.status(400).json({ error: '角色名称不能为空' });
  const tid = isPlatform(req) ? tenant_id : req.user.tenant_id;
  if (!tid) return res.status(400).json({ error: '缺少租户信息' });
  const clean = sanitizeForTenant(menus, permissions);
  try {
    const role = RoleOps.create({ name, description, tenant_id: tid });
    if (clean.menus && clean.menus.length > 0) RoleOps.setMenus(role.id, clean.menus);
    if (clean.permissions && clean.permissions.length > 0) RoleOps.setPermissions(role.id, clean.permissions);
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
    const role = RoleOps.findById(id);
    if (!role) return res.status(404).json({ error: '角色不存在' });
    if (!isPlatform(req) && role.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: '无权修改其他租户的角色' });
    }
    const success = RoleOps.update(id, { name, description });
    if (!success) return res.status(404).json({ error: '角色不存在' });
    // 平台自身角色（tenant_id 为空）不受限制，其余一律剔除平台专属项
    const clean = role.tenant_id ? sanitizeForTenant(menus, permissions) : { menus, permissions };
    if (clean.menus !== undefined) RoleOps.setMenus(id, clean.menus);
    if (clean.permissions !== undefined) RoleOps.setPermissions(id, clean.permissions);
    res.json({ message: '角色更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除角色
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const role = RoleOps.findById(id);
    if (!role) return res.status(404).json({ error: '角色不存在' });
    if (!isPlatform(req) && role.tenant_id !== req.user.tenant_id) {
      return res.status(403).json({ error: '无权删除其他租户的角色' });
    }
    if (role.is_system) return res.status(400).json({ error: '系统内置角色不可删除' });
    const userCount = RoleOps.countUsersByRole(id);
    if (userCount > 0) {
      return res.status(400).json({ error: '该角色已被用户使用，无法删除' });
    }
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
  const role = RoleOps.findById(id);
  if (!role) return res.status(404).json({ error: '角色不存在' });
  if (!isPlatform(req) && role.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '无权查看其他租户的角色' });
  }
  const menus = RoleOps.getMenus(id);
  res.json(menus);
});

// 获取角色权限
router.get('/:id/permissions', (req, res) => {
  const id = parseInt(req.params.id);
  const role = RoleOps.findById(id);
  if (!role) return res.status(404).json({ error: '角色不存在' });
  if (!isPlatform(req) && role.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '无权查看其他租户的角色' });
  }
  const perms = RoleOps.getPermissions(id);
  res.json(perms);
});

export default router;