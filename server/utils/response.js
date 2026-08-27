/**
 * 统一响应格式工具
 * 提供 succ / fail / handle 三个辅助函数
 */

export function succ(res, data = {}, extra = {}) {
  res.json({ success: true, data, ...extra });
}

export function fail(res, message = '操作失败', status = 400) {
  res.status(status).json({ success: false, error: message });
}

/**
 * 包装异步路由处理函数，自动捕获错误
 * @param {Function} fn - async handler(req, res)
 * @returns {Function} express middleware
 */
export function handle(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error('[API Error]', req.method, req.originalUrl, err.message);
      res.status(err.status || 500).json({ success: false, error: err.message || '服务器内部错误' });
    });
  };
}

/**
 * 动态 SQL 更新构建器
 * @param {Object} body - 请求体
 * @param {Object} fieldMap - { bodyKey: 'dbColumn' }
 * @returns {{ fields: string[], values: any[] }}
 */
export function buildUpdateFields(body, fieldMap) {
  const fields = [];
  const values = [];
  for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
    if (body[bodyKey] !== undefined) {
      fields.push(`${dbCol}=?`);
      values.push(body[bodyKey]);
    }
  }
  return { fields, values };
}

export default { succ, fail, handle, buildUpdateFields };