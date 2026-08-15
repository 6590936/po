# 美鸥国际物流 - 客户管理系统 (CRM)

> 基于美鸥物流客户开发SOP打造的智能CRM系统，帮助销售团队高效管理客户、追踪跟进进度、分析转化漏斗。

## 🚀 功能特性

### 核心功能
- **用户认证**：JWT Token 认证，管理员/销售双角色权限
- **客户管理**：完整的客户CRUD，支持搜索、筛选、排序、标签
- **客户分级**：A/B/C/D 四级分类，自动升降级记录
- **跟进记录**：时间线展示，多种跟进方式标记
- **转化漏斗**：6阶段可视化（潜在→触达→沟通→报价→试单→成交）
- **数据看板**：ECharts 图表，多维度数据分析
- **跟进提醒**：超期预警，按紧急程度排序
- **数据导出**：客户列表/跟进记录导出 Excel
- **响应式设计**：PC端 + 移动端适配

### 🆕 SOP增强功能
- **📊 每日活动记录**：录入每日电话/微信/邮件/有效沟通/报价/CRM更新数据，对比SOP基准线（20通电话/10微信/5邮件/5有效沟通/2报价/5CRM更新），14天趋势图和统计汇总
- **🏆 个人KPI月度看板**：8项KPI指标进度展示（新客户≥15/月、报价≥30/月、转化率≥15%、成交≥3/月、复购率≥60%、日均电话≥20、有效沟通率≥30%、跟进及时率≥95%），管理员可见团队KPI对比
- **⚡ 客户升降级智能提醒**：基于SOP规则自动诊断（A级24h/B级3天/C级7天/D级30天跟进提醒，连续2次有效跟进建议升级，长期无互动建议降级），支持一键执行调整
- **💰 报价记录管理**：创建/管理报价，按状态筛选（待回复/已接受/已拒绝/已过期），响应时间统计（≤30分钟达标率），客户详情页展示历史报价
- **📋 周报模块**：自动汇总本周活动数据对比SOP目标，填写TOP3客户、遇到的问题、下周计划，历史周报可展开查看
- **🔍 漏斗异常诊断**：5段转化漏斗对比目标（50%/50%/60%/30%/50%），红黄绿三色达标状态，未达标项提供具体改进建议
- **👤 客户画像扩展**：新增货物类型、月均货量、决策人、当前货代、痛点、切入策略等字段，根据客户类型（跨境电商/传统外贸/储能电池/同行货代）智能预填提示

### 客户分级规则（源自SOP文档）
| 等级 | 跟进频率 | 提醒阈值 | 升级条件 |
|------|---------|---------|---------|
| A级 | 每天跟进 | 24小时 | 客户给出具体发货时间或要求报价 |
| B级 | 每周2-3次 | 3天 | 有需求但时间未定 |
| C级 | 每周1次 | 7天 | 潜在需求需培育 |
| D级 | 每月1-2次 | 30天 | 暂无需求长期储备 |

### 转化漏斗目标（源自SOP文档）
```
潜在客户(200+) → 已触达(100+) → 有效沟通(50+) → 报价(30+) → 试单(10+) → 成交(5+)
```

## 🛠 技术栈

- **前端**：React 18 + Ant Design 5 + ECharts + React Router 6
- **后端**：Node.js + Express 4
- **数据库**：JSON 文件存储（零依赖，即开即用）
- **构建**：Vite 6
- **认证**：JWT
- **导出**：xlsx

## 📦 安装与运行

### 1. 安装依赖
```bash
cd meiou-crm
npm install
```

### 2. 开发模式（前后端同时启动）
```bash
npm run dev
```
- 前端：http://localhost:5173
- 后端 API：http://localhost:3001

### 3. 生产模式
```bash
# 构建前端
npm run build

# 启动生产服务
npm start
```
访问：http://localhost:3001

### 4. 手机端访问
启动服务后，确保手机与电脑在同一局域网，用手机浏览器访问：
```
http://<电脑局域网IP>:5173
```
- 移动端自动切换为抽屉式导航菜单
- 所有功能均适配移动端布局，可正常管理客户、添加跟进

### 5. 单独启动
```bash
# 仅启动后端
npm run dev:server

# 仅启动前端
npm run dev:client
```

## 🔑 演示账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | admin123 | 可查看所有数据、管理用户 |
| 销售 | sales1 | 123456 | 只能看自己的客户和数据 |

## 📁 项目结构

```
meiou-crm/
├── package.json              # 项目配置与依赖
├── vite.config.js            # Vite 构建配置（含API代理）
├── index.html                # 入口HTML
├── server/
│   ├── index.js              # Express 服务器入口
│   ├── database.js           # JSON数据库（含所有Ops操作）
│   └── routes/
│       ├── auth.js           # 认证API（登录/用户管理）
│       ├── customers.js      # 客户API（CRUD/跟进/提醒/导出/等级建议）
│       ├── dashboard.js      # 数据看板API（含KPI/漏斗诊断）
│       ├── activity.js       # 每日活动记录API
│       ├── quotes.js         # 报价管理API
│       └── reports.js        # 周报API
├── src/
│   ├── main.jsx              # React 入口
│   ├── App.jsx               # 路由与认证守卫
│   ├── api/
│   │   └── index.js          # API 请求封装（自动携带JWT）
│   ├── components/
│   │   └── Layout.jsx        # 布局（侧边栏+响应式菜单）
│   ├── pages/
│   │   ├── Login.jsx         # 登录页
│   │   ├── Dashboard.jsx     # 数据看板（KPI+漏斗诊断+图表）
│   │   ├── Customers.jsx     # 客户列表（含画像字段）
│   │   ├── CustomerDetail.jsx# 客户详情（画像+报价）
│   │   ├── Reminders.jsx     # 跟进提醒（升降级建议）
│   │   ├── DailyReport.jsx   # 每日活动记录
│   │   ├── Quotes.jsx        # 报价管理
│   │   ├── WeeklyReport.jsx  # 周报
│   │   └── Admin.jsx         # 管理员页面
│   └── utils/
│       └── constants.js      # 状态/等级/类型常量
├── public/
│   └── favicon.svg           # 网站图标
├── data/                     # 数据目录（自动创建）
│   └── meiou-crm.json        # 数据库文件
└── README.md
```

## 📊 API 接口

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| GET | /api/auth/me | 获取当前用户 |
| GET | /api/auth/users | 用户列表（管理员） |
| POST | /api/auth/users | 创建用户（管理员） |
| DELETE | /api/auth/users/:id | 删除用户（管理员，不可删自己） |
| PUT | /api/auth/users/:id/reset-password | 重置密码（管理员） |

### 客户管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/customers | 客户列表（分页/搜索/筛选） |
| GET | /api/customers/:id | 客户详情 |
| POST | /api/customers | 创建客户 |
| PUT | /api/customers/:id | 更新客户 |
| DELETE | /api/customers/:id | 删除客户（管理员） |
| POST | /api/customers/:id/followups | 添加跟进记录 |
| GET | /api/customers/reminders/overdue | 超期未跟进 |
| GET | /api/customers/reminders/today | 今日待跟进 |
| GET | /api/customers/grade-suggestions | 等级智能建议 |
| GET | /api/customers/export/list | 导出客户列表 |
| GET | /api/customers/export/followups | 导出跟进记录 |
| GET | /api/customers/meta/sales | 销售人员列表 |

### 数据看板
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/dashboard?period=month | 看板数据 |
| GET | /api/dashboard/kpi?month=2024-01 | 月度KPI |
| GET | /api/dashboard/diagnostics | 漏斗异常诊断 |

### 每日活动
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/activities | 创建/更新今日记录 |
| GET | /api/activities/today | 获取今日记录 |
| GET | /api/activities/range?start=&end= | 日期范围记录 |
| GET | /api/activities/stats?period=week | 统计汇总 |

### 报价管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/quotes | 报价列表 |
| POST | /api/quotes | 创建报价 |
| PUT | /api/quotes/:id | 更新报价 |
| DELETE | /api/quotes/:id | 删除报价 |
| GET | /api/quotes/stats | 报价统计 |

### 周报
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reports/weekly | 周报列表 |
| POST | /api/reports/weekly | 创建/更新周报 |
| GET | /api/reports/weekly/stats | 本周自动统计 |

## 🔐 权限说明

| 功能 | 管理员 | 销售 |
|------|--------|------|
| 查看所有客户 | ✅ | ❌（仅自己的） |
| 数据看板 | ✅ 全团队 | ✅ 仅个人 |
| 团队KPI对比 | ✅ | ❌ |
| 团队排名 | ✅ | ❌ |
| 等级智能建议 | ✅ 全团队 | ✅ 仅自己的 |
| 创建用户 | ✅ | ❌ |
| 删除用户 | ✅（不可删自己） | ❌ |
| 重置密码 | ✅ | ❌ |
| 删除客户 | ✅（级联删除） | ❌ |
| 客户转移 | ✅ | ❌ |
| 导出功能 | ✅ 全部 | ✅ 仅自己的 |

## 🎨 界面风格

- 主色调：深蓝色 `#1B4F72`
- 辅助色：蓝色 `#2E86C1`
- 风格：专业商务，简洁大气
- 响应式：PC端侧边栏 + 移动端抽屉菜单

---

> **美鸥国际物流** · 日积跬步，量变到质变 🚢
