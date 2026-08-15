
// 美鸥国际物流 CRM - Express 服务器入口
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database.js';
import { auditMiddleware } from './logger.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import dashboardRoutes from './routes/dashboard.js';
import activityRoutes from './routes/activity.js';
import quoteRoutes from './routes/quotes.js';
import reportRoutes from './routes/reports.js';
import yunwuyunRoutes from './routes/yunwuyun.js';
import roleRoutes from './routes/roles.js';
import clientRoutes from './routes/client.js';
import wechatRoutes from './routes/wechat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// 初始化数据库
initDatabase();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(auditMiddleware);

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/yunwuyun', yunwuyunRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/wechat', wechatRoutes);

// 生产模式下提供前端静态文件
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 美鸥CRM服务器运行在 http://localhost:${PORT}`);
  console.log(`📱 局域网访问: http://0.0.0.0:${PORT}`);
});