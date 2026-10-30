// 认证路由
import express from 'express';
import jwt from 'jsonwebtoken';
import { UserOps, RoleOps, TenantOps, getDb } from '../database.js';
import { logAudit } from '../logger.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meiou-crm-secret-key-2024';
const TOKEN_EXPIRY = '7d';

function hasPerm(perms, key) { return (perms || []).includes(key); }
function isPlatform(req) { return !req.user.tenant_id && hasPerm(req.user.permissions, 'system:platform'); }

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const user = UserOps.findByCredentials(username, password);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (user.tenant_status === 'inactive') {
    return res.status(403).json({ error: '所属公司已被停用，无法登录' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: '账号已停用，请联系管理员' });
  }

  let permissions = RoleOps.getUserPermissions(user.role_id);
  let menus = RoleOps.getUserMenus(user.role_id);

  if (!menus.length && user.role === 'admin') {
    permissions = ['data:all', 'system:platform', 'shipping:active', 'shipping:batches', 'shipping:detail'];
    menus = ['/', '/customers', '/shipping-rates', '/fee-templates', '/wechat', '/sales', '/admin'];
  }

  const token = jwt.sign(
    {
      id: user.id, username: user.username, name: user.name,
      role: user.role, role_id: user.role_id,
      tenant_id: user.tenant_id, tenant_name: user.tenant_name,
      permissions,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  logAudit({
    user_id: user.id,
    username: user.username,
    action: 'LOGIN',
    target_type: 'user',
    target_id: user.id,
    ip_address: req.ip || req.connection?.remoteAddress || null,
  });

  res.json({
    token,
    user: {
      id: user.id, username: user.username, name: user.name, role: user.role,
      role_id: user.role_id,
      tenant_id: user.tenant_id, tenant_name: user.tenant_name,
      menus,
      permissions,
    },
  });
});

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
  const user = UserOps.findById(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    role_id: user.role_id,
    tenant_id: user.tenant_id,
    tenant_name: user.tenant_name,
    created_at: user.created_at,
    menus: (() => { const m = RoleOps.getUserMenus(user.role_id); return (!m.length && user.role === 'admin') ? ['/', '/customers', '/shipping-rates', '/fee-templates', '/wechat', '/sales', '/admin'] : m; })(),
    permissions: (() => { const p = RoleOps.getUserPermissions(user.role_id); return (!p.length && user.role === 'admin') ? ['data:all', 'system:platform', 'shipping:active', 'shipping:batches', 'shipping:detail'] : p; })(),
  });
});

// 获取所有用户列表（管理员，非平台管理员仅看自己租户）
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const platform = isPlatform(req);
  const tids = platform ? undefined : TenantOps.getDescendantIds(req.user.tenant_id);
  const users = UserOps.findAll(tids);
  res.json(users);
});

// 获取用户名称列表（所有登录用户可用，用于分配销售员等场景）
router.get('/users/names', authenticateToken, (req, res) => {
  const db = getDb();
  let users;
  if (req.user.tenant_id) {
    users = db.prepare('SELECT id, name, username FROM users WHERE tenant_id = ? AND status = ? ORDER BY name').all(req.user.tenant_id, 'active');
  } else {
    users = db.prepare('SELECT id, name, username FROM users WHERE status = ? ORDER BY name').all('active');
  }
  res.json(users);
});

// 创建用户（管理员，非平台管理员只能创建自己租户下的用户）
router.post('/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, name, role, tenant_id, role_id } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  const platform = isPlatform(req);
  const tid = platform ? tenant_id : req.user.tenant_id;
  if (!platform && tenant_id && Number(tenant_id) !== Number(req.user.tenant_id)) {
    return res.status(403).json({ error: '只能创建本公司的用户' });
  }
  let roleName = role;
  if (!roleName && role_id) {
    const r = RoleOps.findById(role_id);
    roleName = r ? r.name : 'sales';
  }
  try {
    const user = UserOps.create({ username, password, name, role: roleName, tenant_id: tid, role_id });
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'CREATE_USER',
      target_type: 'user',
      target_id: user.id,
      details: { username, name, role: roleName, tenant_id: tid, role_id },
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });
    res.json({ id: user.id, message: '用户创建成功' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 删除用户（管理员）
router.delete('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  // 不能删除自己
  if (userId === req.user.id) {
    return res.status(400).json({ error: '不能删除自己的账号' });
  }
  const target = UserOps.findById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  // 非平台管理员只能删除自己租户的用户
  if (!isPlatform(req) && target.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '只能删除本公司的用户' });
  }

  const success = UserOps.delete(userId);
  if (success) {
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'DELETE_USER',
      target_type: 'user',
      target_id: userId,
      details: { username: target.username },
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });
    res.json({ message: '用户删除成功' });
  } else {
    res.status(500).json({ error: '删除失败' });
  }
});

// 重置密码（管理员）
router.put('/users/:id/reset-password', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: '密码长度至少4位' });
  }
  const target = UserOps.findById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
if (!isPlatform(req) && target.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '只能操作本公司的用户' });
  }

  const success = UserOps.resetPassword(userId, newPassword);
  if (success) {
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'RESET_PASSWORD',
      target_type: 'user',
      target_id: userId,
      details: { username: target.username },
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });
    res.json({ message: '密码重置成功' });
  } else {
    res.status(500).json({ error: '重置失败' });
  }
});

// 更新用户（管理员）
router.put('/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const { role_id, tenant_id, name, status } = req.body;
  const target = UserOps.findById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
if (!isPlatform(req) && target.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '只能编辑本公司的用户' });
  }
  try {
    const success = UserOps.update(userId, { role_id, tenant_id, name, status });
    if (!success) return res.status(404).json({ error: '用户不存在' });
    res.json({ message: '用户更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 停用用户
router.put('/users/:id/disable', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const target = UserOps.findById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (!isPlatform(req) && target.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '只能操作本公司的用户' });
  }
  UserOps.disable(userId);
  res.json({ message: '用户已停用' });
});

// 启用用户
router.put('/users/:id/enable', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  const target = UserOps.findById(userId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (!isPlatform(req) && target.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ error: '只能操作本公司的用户' });
  }
  UserOps.enable(userId);
  res.json({ message: '用户已启用' });
});

// 微信小程序登录
router.post('/wechat-login', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: '缺少微信授权code' });
  }

  const appId = process.env.WECHAT_APP_ID || 'wx9b96062cc023ebc9';
  const appSecret = process.env.WECHAT_APP_SECRET || '0c72def863aa1b55f749387d02b4adf3';

  try {
    const https = await import('https');
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;

    const wxData = await new Promise((resolve, reject) => {
      https.get(wxUrl, (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    if (wxData.errcode) {
      console.error('微信登录失败:', wxData);
      return res.status(400).json({ error: `微信授权失败: ${wxData.errmsg || '未知错误'}` });
    }

    const openid = wxData.openid;
    const user = UserOps.findByWechatOpenid(openid);
    if (!user) {
      return res.json({
        needBind: true,
        openid,
        message: '该微信未绑定CRM账号，请先用账号密码登录后绑定',
      });
    }

    if (user.tenant_status === 'inactive') {
      return res.status(403).json({ error: '所属公司已被停用，无法登录' });
    }

    let permissions2 = RoleOps.getUserPermissions(user.role_id);
    let menus2 = RoleOps.getUserMenus(user.role_id);
    if (!menus2.length && user.role === 'admin') {
      permissions2 = ['data:all', 'system:platform', 'shipping:active', 'shipping:batches', 'shipping:detail'];
      menus2 = ['/', '/customers', '/shipping-rates', '/fee-templates', '/wechat', '/sales', '/admin'];
    }

    const token = jwt.sign(
      {
        id: user.id, username: user.username, name: user.name,
        role: user.role, role_id: user.role_id,
        tenant_id: user.tenant_id, tenant_name: user.tenant_name,
        permissions: permissions2,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    logAudit({
      user_id: user.id,
      username: user.username,
      action: 'WECHAT_LOGIN',
      target_type: 'user',
      target_id: user.id,
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });

    res.json({
      token,
      user: {
        id: user.id, username: user.username, name: user.name, role: user.role,
        role_id: user.role_id,
        tenant_id: user.tenant_id, tenant_name: user.tenant_name,
        menus: menus2,
        permissions: permissions2,
      },
    });
  } catch (err) {
    console.error('微信登录异常:', err);
    res.status(500).json({ error: '微信登录失败，请重试' });
  }
});

// 绑定微信openid（需要已登录）
router.post('/bind-wechat', authenticateToken, (req, res) => {
  const { openid } = req.body;
  if (!openid) {
    return res.status(400).json({ error: '缺少openid' });
  }
  const result = UserOps.bindWechatOpenid(req.user.id, openid);
  if (result.success) {
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'BIND_WECHAT',
      target_type: 'user',
      target_id: req.user.id,
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });
    res.json({ message: '微信绑定成功' });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// JWT 认证中间件
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(403).json({ error: '登录已过期，请重新登录' });
  }
}

// 管理员权限中间件
export function requireAdmin(req, res, next) {
  const perms = req.user.permissions || [];
  const isAdmin = req.user.role === 'admin' || perms.includes('data:all') || perms.includes('system:platform');
  if (!isAdmin) return res.status(403).json({ error: '需要管理员权限' });
  next();
}

export default router;