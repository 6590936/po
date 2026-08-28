/**
 * 轨迹查验 - 后端路由模块
 * 提供轨迹查询、查询历史记录等API
 */
import express from 'express';
import { authenticateToken } from '../server/routes/auth.js';
import { getDb } from '../server/database.js';
import { CARRIER_LIST, getCarrierTrackUrl, getCarrierInfo, STATUS_LABELS, matchCarrierCode } from './constants.js';
import { getBrowserManager, isPlaywrightAvailable } from './tracker/browser.js';
import { getTrackerManager } from './tracker/index.js';

const router = express.Router();

// 所有接口需要JWT鉴权
router.use(authenticateToken);

/**
 * GET /api/tracking/status
 * 检测轨迹抓取功能是否可用
 */
router.get('/status', async (req, res) => {
  try {
    if (isPlaywrightAvailable()) {
      return res.json({ success: true, data: { available: true, message: '轨迹抓取功能正常' } });
    }
    res.json({ success: true, data: { available: false, message: '轨迹抓取不可用：当前 Node.js 版本过低，需要升级到 Node.js 20+', nodeVersion: process.version } });
  } catch (err) {
    res.json({ success: true, data: { available: false, message: err.message } });
  }
});

/**
 * GET /api/tracking/carriers
 * 获取支持的船公司列表
 */
router.get('/carriers', (req, res) => {
  try {
    const carriers = CARRIER_LIST.map(c => ({
      code: c.code,
      name: c.name,
      enName: c.enName,
      supportContainer: c.supportContainer,
    }));
    res.json({ success: true, data: carriers });
  } catch (err) {
    console.error('[轨迹查验] 获取船公司列表失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tracking/query
 * 轨迹查询 - 记录查询历史并返回船公司官网跟踪URL
 * Body: { trackingNo, carrierCode }
 */
router.post('/query', (req, res) => {
  try {
    const { trackingNo, carrierCode } = req.body;
    const userId = req.user.id;

    // 参数校验
    if (!trackingNo || !trackingNo.trim()) {
      return res.json({ success: false, error: '请输入单号（提单号/订舱号/箱号）' });
    }
    if (!carrierCode || !carrierCode.trim()) {
      return res.json({ success: false, error: '请选择船公司' });
    }

    const trackingNoTrim = trackingNo.trim().toUpperCase();
    const carrierCodeTrim = carrierCode.trim().toUpperCase();

    // 获取船公司信息
    const carrier = getCarrierInfo(carrierCodeTrim);
    if (!carrier) {
      return res.json({ success: false, error: `不支持的船公司代码: ${carrierCodeTrim}` });
    }

    // 生成跟踪URL
    const trackUrl = getCarrierTrackUrl(carrierCodeTrim, trackingNoTrim);
    if (!trackUrl) {
      return res.json({ success: false, error: '生成跟踪链接失败' });
    }

    // 记录查询历史
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tracking_queries (user_id, tracking_no, carrier_code, carrier_name, query_time, success)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(userId, trackingNoTrim, carrierCodeTrim, carrier.name, now);

    // 返回结果
    res.json({
      success: true,
      data: {
        trackingNo: trackingNoTrim,
        carrierCode: carrierCodeTrim,
        carrierName: carrier.name,
        carrierEnName: carrier.enName,
        trackUrl: trackUrl,
        queryTime: now,
      },
    });
  } catch (err) {
    console.error('[轨迹查验] 查询失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracking/history
 * 获取当前用户的查询历史记录
 * Query: page, pageSize
 */
router.get('/history', (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const db = getDb();

    // 查询总数
    const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM tracking_queries WHERE user_id = ?').get(userId);
    const total = totalRow.cnt;

    // 查询列表（按时间倒序，去重单号，取最近一次查询）
    const list = db.prepare(`
      SELECT id, tracking_no, carrier_code, carrier_name, query_time, success
      FROM tracking_queries
      WHERE user_id = ?
      ORDER BY query_time DESC
      LIMIT ? OFFSET ?
    `).all(userId, pageSize, offset);

    // 格式化返回
    const formattedList = list.map(item => ({
      id: item.id,
      trackingNo: item.tracking_no,
      carrierCode: item.carrier_code,
      carrierName: item.carrier_name,
      queryTime: item.query_time,
      success: item.success === 1,
      trackUrl: getCarrierTrackUrl(item.carrier_code, item.tracking_no),
    }));

    res.json({
      success: true,
      data: {
        list: formattedList,
        total,
        page,
        pageSize,
      },
    });
  } catch (err) {
    console.error('[轨迹查验] 获取历史记录失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/tracking/history/:id
 * 删除单条查询历史记录
 */
router.delete('/history/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id);

    const db = getDb();
    const result = db.prepare('DELETE FROM tracking_queries WHERE id = ? AND user_id = ?').run(id, userId);

    if (result.changes === 0) {
      return res.json({ success: false, error: '记录不存在或无权限删除' });
    }

    res.json({ success: true, data: { message: '删除成功' } });
  } catch (err) {
    console.error('[轨迹查验] 删除历史记录失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/tracking/history
 * 清空当前用户的所有查询历史
 */
router.delete('/history', (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDb();
    db.prepare('DELETE FROM tracking_queries WHERE user_id = ?').run(userId);
    res.json({ success: true, data: { message: '历史记录已清空' } });
  } catch (err) {
    console.error('[轨迹查验] 清空历史记录失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracking/stats
 * 获取查询统计（查询次数、常用船公司）
 */
router.get('/stats', (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDb();

    // 总查询次数
    const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM tracking_queries WHERE user_id = ?').get(userId);

    // 今日查询次数
    const today = new Date().toISOString().split('T')[0];
    const todayRow = db.prepare(
      "SELECT COUNT(*) as cnt FROM tracking_queries WHERE user_id = ? AND DATE(query_time) = ?"
    ).get(userId, today);

    // 常用船公司TOP5
    const topCarriers = db.prepare(`
      SELECT carrier_code, carrier_name, COUNT(*) as count
      FROM tracking_queries
      WHERE user_id = ?
      GROUP BY carrier_code
      ORDER BY count DESC
      LIMIT 5
    `).all(userId);

    res.json({
      success: true,
      data: {
        totalQueries: totalRow.cnt,
        todayQueries: todayRow.cnt,
        topCarriers,
      },
    });
  } catch (err) {
    console.error('[轨迹查验] 获取统计失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== 订单轨迹抓取（FMS订单联动）=====

/**
 * 从FMS订单中提取查询用的单号
 * 优先级：海外提单号 > 国内提单号 > 船东单号 > 订舱号
 */
function extractTrackingNo(order) {
  return order.bl_no_overseas || order.bl_no_domestic || order.carrier_jobno || order.so_no || '';
}

/**
 * 保存轨迹数据到数据库
 */
function saveOrderTracking(jobId, result) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO order_tracking (job_id, tracking_no, carrier_code, carrier_name, origin, destination, vessel, voyage, container_no, etd, atd, eta, ata, status, status_label, timeline, raw_data, queried_at, success, error_msg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      tracking_no=excluded.tracking_no,
      carrier_code=excluded.carrier_code,
      carrier_name=excluded.carrier_name,
      origin=excluded.origin,
      destination=excluded.destination,
      vessel=excluded.vessel,
      voyage=excluded.voyage,
      container_no=excluded.container_no,
      etd=excluded.etd,
      atd=excluded.atd,
      eta=excluded.eta,
      ata=excluded.ata,
      status=excluded.status,
      status_label=excluded.status_label,
      timeline=excluded.timeline,
      raw_data=excluded.raw_data,
      queried_at=excluded.queried_at,
      success=excluded.success,
      error_msg=excluded.error_msg
  `).run(
    jobId,
    result.trackingNo || '',
    result.carrierCode || '',
    result.carrierName || '',
    result.origin || '',
    result.destination || '',
    result.vessel || '',
    result.voyage || '',
    result.containerNo || '',
    result.etd || '',
    result.atd || '',
    result.eta || '',
    result.ata || '',
    result.status || '',
    result.statusLabel || '',
    JSON.stringify(result.timeline || []),
    result.rawData ? JSON.stringify(result.rawData) : null,
    now,
    result.success ? 1 : 0,
    result.error || ''
  );
}

/**
 * GET /api/tracking/order/:jobId
 * 获取订单轨迹数据
 */
router.get('/order/:jobId', (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId);
    const db = getDb();
    const tracking = db.prepare('SELECT * FROM order_tracking WHERE job_id = ?').get(jobId);
    if (!tracking) {
      return res.json({ success: true, data: null });
    }
    // 解析 JSON 字段
    tracking.timeline = tracking.timeline ? JSON.parse(tracking.timeline) : [];
    tracking.raw_data = tracking.raw_data ? JSON.parse(tracking.raw_data) : null;
    res.json({ success: true, data: tracking });
  } catch (err) {
    console.error('[轨迹查验] 获取订单轨迹失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tracking/order/:jobId
 * 抓取单个订单轨迹
 */
router.post('/order/:jobId', async (req, res) => {
  try {
    // 检查 Playwright 是否可用
    if (!isPlaywrightAvailable()) {
      return res.json({ success: false, error: '轨迹抓取不可用：当前 Node.js 版本过低（v' + process.version + '），需要升级到 Node.js 20+ 才能使用此功能' });
    }

    const jobId = parseInt(req.params.jobId);
    const db = getDb();

    // 从FMS订单表获取订单信息
    const order = db.prepare('SELECT * FROM yunwuyun_orders WHERE job_id = ?').get(jobId);
    if (!order) {
      return res.json({ success: false, error: '订单不存在' });
    }

    // 提取单号和船公司
    const trackingNo = extractTrackingNo(order);
    if (!trackingNo) {
      return res.json({ success: false, error: '订单没有可用的查询单号（订舱号/提单号）' });
    }

    const carrierCode = matchCarrierCode(order.carrier_name);
    if (!carrierCode) {
      return res.json({ success: false, error: `无法识别船公司: ${order.carrier_name || '未知'}` });
    }

    // 检查抓取器是否支持
    const trackerManager = getTrackerManager();
    if (!trackerManager.isSupported(carrierCode)) {
      return res.json({ success: false, error: `暂不支持抓取该船公司: ${order.carrier_name}（${carrierCode}）` });
    }

    // 使用浏览器管理器创建页面
    const browserMgr = getBrowserManager();
    const page = await browserMgr.newPage();

    try {
      // 调用抓取器
      const result = await trackerManager.track(trackingNo, carrierCode, { page });

      // 保存到数据库
      saveOrderTracking(jobId, result);

      if (result.success) {
        res.json({ success: true, data: result, message: '轨迹抓取成功' });
      } else {
        res.json({ success: false, error: result.error || '抓取失败', data: result });
      }
    } finally {
      // 关闭页面
      try { await page.close(); } catch (_) {}
    }
  } catch (err) {
    console.error('[轨迹查验] 抓取订单轨迹失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tracking/order/batch
 * 批量抓取订单轨迹
 * Body: { jobIds: [1,2,3] } 或不传则抓取所有有订舱号的订单
 */
router.post('/order/batch', async (req, res) => {
  try {
    // 检查 Playwright 是否可用
    if (!isPlaywrightAvailable()) {
      return res.json({ success: false, error: '轨迹抓取不可用：当前 Node.js 版本过低（v' + process.version + '），需要升级到 Node.js 20+ 才能使用此功能' });
    }

    const { jobIds } = req.body || {};
    const db = getDb();

    // 查询需要抓取的订单
    let orders;
    if (jobIds && jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(',');
      orders = db.prepare(`SELECT * FROM yunwuyun_orders WHERE job_id IN (${placeholders})`).all(...jobIds);
    } else {
      // 默认抓取所有有订舱号且状态在运输中的订单
      orders = db.prepare(`
        SELECT * FROM yunwuyun_orders
        WHERE so_no IS NOT NULL AND so_no != ''
        AND order_status >= 40
        ORDER BY job_date DESC
        LIMIT 50
      `).all();
    }

    if (orders.length === 0) {
      return res.json({ success: true, data: { total: 0, success: 0, failed: 0, results: [] } });
    }

    const browserMgr = getBrowserManager();
    const trackerManager = getTrackerManager();
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    // 逐个抓取（避免并发过高被封）
    for (const order of orders) {
      const trackingNo = extractTrackingNo(order);
      const carrierCode = matchCarrierCode(order.carrier_name);

      if (!trackingNo || !carrierCode || !trackerManager.isSupported(carrierCode)) {
        failedCount++;
        results.push({ jobId: order.job_id, success: false, error: '单号或船公司不支持' });
        continue;
      }

      try {
        const page = await browserMgr.newPage();
        try {
          const result = await trackerManager.track(trackingNo, carrierCode, { page });
          saveOrderTracking(order.job_id, result);
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
          results.push({ jobId: order.job_id, success: result.success, status: result.statusLabel, error: result.error });
        } finally {
          try { await page.close(); } catch (_) {}
        }
      } catch (err) {
        failedCount++;
        results.push({ jobId: order.job_id, success: false, error: err.message });
      }

      // 间隔2秒，避免请求过快
      await new Promise(r => setTimeout(r, 2000));
    }

    res.json({
      success: true,
      data: {
        total: orders.length,
        success: successCount,
        failed: failedCount,
        results,
      },
    });
  } catch (err) {
    console.error('[轨迹查验] 批量抓取失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tracking/orders
 * 获取有轨迹数据的订单列表（带轨迹状态）
 */
router.get('/orders', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const list = db.prepare(`
      SELECT o.job_id, o.job_no, o.client_name, o.carrier_name, o.vessel, o.voyage,
             o.etd, o.eta, o.so_no, o.bl_no_overseas, o.order_status,
             t.status, t.status_label, t.queried_at, t.success
      FROM yunwuyun_orders o
      LEFT JOIN order_tracking t ON o.job_id = t.job_id
      ORDER BY t.queried_at DESC NULLS LAST, o.job_date DESC
      LIMIT ? OFFSET ?
    `).all(pageSize, offset);

    const total = db.prepare('SELECT COUNT(*) as cnt FROM yunwuyun_orders').get().cnt;

    res.json({
      success: true,
      data: { list, total, page, pageSize },
    });
  } catch (err) {
    console.error('[轨迹查验] 获取订单轨迹列表失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;