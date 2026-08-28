# 轨迹查验模块

美鸥 CRM 海运轨迹查询模块，支持 15 家主流船公司的货物轨迹快捷查询。

## 功能特性

- **快捷查询**：输入单号（提单号/订舱号/箱号）+ 选择船公司，一键跳转船公司官网跟踪页面
- **查询历史**：自动记录所有查询历史，支持一键重查、删除、清空
- **数据统计**：累计查询次数、今日查询次数、常用船公司 TOP5
- **FMS 联动**：FMS 订单列表每行增加"轨迹"按钮，自动带入单号跳转查询
- **权限控制**：支持角色菜单权限配置，admin 和 sales 角色默认开通

## 支持的船公司（15家）

| 代码 | 船公司 | 英文名 |
|------|--------|--------|
| MSK | 马士基航运 | MAERSK |
| MSC | 地中海航运 | MSC |
| COSCO | 中远海运 | COSCO SHIPPING |
| CMA | 达飞轮船 | CMA CGM |
| HPL | 赫伯罗特 | HAPAG-LLOYD |
| ONE | 海洋网联 | ONE |
| EMC | 长荣海运 | EVERGREEN |
| YML | 阳明海运 | YANG MING |
| HMM | 现代商船 | HMM |
| ZIM | 以星轮船 | ZIM |
| OOCL | 东方海外 | OOCL |
| PIL | 太平船务 | PIL |
| WHL | 万海航运 | WAN HAI |
| SITC | 海丰国际 | SITC |
| KMTC | 高丽海运 | KMTC |

## 文件结构

```
trajectory/
├── README.md          # 本说明文档
├── constants.js       # 船公司列表、URL模板、状态枚举等常量配置
├── tracking.js        # 后端 Express 路由模块（查询、历史、统计API）
└── Tracking.jsx       # 前端 React 页面组件
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tracking/carriers | 获取支持的船公司列表 |
| POST | /api/tracking/query | 轨迹查询（记录历史+返回跟踪URL） |
| GET | /api/tracking/history | 获取查询历史记录 |
| DELETE | /api/tracking/history/:id | 删除单条历史记录 |
| DELETE | /api/tracking/history | 清空所有历史记录 |
| GET | /api/tracking/stats | 获取查询统计数据 |

## 数据库表

### tracking_queries（轨迹查询历史）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键自增 |
| user_id | INTEGER | 操作用户ID |
| tracking_no | TEXT | 查询单号 |
| carrier_code | TEXT | 船公司代码 |
| carrier_name | TEXT | 船公司名称 |
| latest_status | TEXT | 最新状态（预留） |
| query_time | TEXT | 查询时间 |
| success | INTEGER | 是否成功（1=成功，0=失败） |
| error_msg | TEXT | 错误信息（预留） |

## 使用说明

1. **重启后端服务**：代码修改完成后，需要重启 Express 服务以创建数据库表和注册路由
2. **访问页面**：登录 CRM 后，点击左侧菜单"轨迹查验"进入页面
3. **查询轨迹**：输入单号，选择船公司，点击"查询轨迹"按钮，将在新窗口打开船公司官网跟踪页面
4. **FMS 联动**：在"FMS数据同步"页面的订单列表中，点击"轨迹"按钮可直接跳转查询

## 后续规划（第二期）

- 对接维运网订阅模式 API，在 CRM 内直接展示轨迹时间线数据（不跳转外部网站）
- 用 Playwright 无头浏览器模拟登录维运网，抓取订阅轨迹数据
- 轨迹数据本地缓存，减少重复查询
- 支持批量查询和自动刷新
- 异常状态预警（如长时间未更新、滞港等）
