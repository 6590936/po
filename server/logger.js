import { getDb } from './database.js';

export function logAudit({ user_id = null, username = null, action, target_type = null, target_id = null, details = null, ip_address = null }) {
  try {
    const db = getDb();
    if (!db) return;
    const stmt = db.prepare(
      `INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(user_id, username, action, target_type, target_id, details ? JSON.stringify(details) : null, ip_address, new Date().toISOString());
  } catch (err) {
    console.error('审计日志写入失败:', err.message);
  }
}

export function auditMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user || {};
    logAudit({
      user_id: user.id || null,
      username: user.username || null,
      action: `${req.method} ${req.path}`,
      target_type: 'api_request',
      details: { status: res.statusCode, duration: `${duration}ms`, query: req.query, body: req.method !== 'GET' ? req.body : undefined },
      ip_address: req.ip || req.connection?.remoteAddress || null,
    });
  });
  next();
}