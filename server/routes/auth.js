// 认证路由
import express from 'express';
import jwt from 'jsonwebtoken';
import { UserOps, RoleOps } from '../database.js';
import { logAudit } from '../logger.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'meiou-crm-secret-key-2024';
const TOKEN_EXPIRY = '7d';

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

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
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
      menus: RoleOps.getUserMenus(user.role),
      permissions: RoleOps.getUserPermissions(user.role),
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
    created_at: user.created_at,
    menus: RoleOps.getUserMenus(user.role),
    permissions: RoleOps.getUserPermissions(user.role),
  });
});

// 获取所有用户列表（管理员）
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  res.json(UserOps.findAll());
});

// 创建用户（管理员）
router.post('/users', authenticateToken, requireAdmin, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  try {
    const user = UserOps.create({ username, password, name, role });
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'CREATE_USER',
      target_type: 'user',
      target_id: user.id,
      details: { username, name, role },
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
  const user = UserOps.findById(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const success = UserOps.delete(userId);
  if (success) {
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'DELETE_USER',
      target_type: 'user',
      target_id: userId,
      details: { username: user.username },
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
  const user = UserOps.findById(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const success = UserOps.resetPassword(userId, newPassword);
  if (success) {
    logAudit({
      user_id: req.user.id,
      username: req.user.username,
      action: 'RESET_PASSWORD',
      target_type: 'user',
      target_id: userId,
      details: { username: user.username },
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });
    res.json({ message: '密码重置成功' });
  } else {
    res.status(500).json({ error: '重置失败' });
  }
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

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
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
        menus: RoleOps.getUserMenus(user.role),
        permissions: RoleOps.getUserPermissions(user.role),
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
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}

export default router;