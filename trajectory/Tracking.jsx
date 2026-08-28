/**
 * 轨迹查验 - 前端页面组件
 * 输入单号+选择船公司，查询后跳转船公司官网跟踪页面
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  message,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  EnvironmentOutlined,
  SearchOutlined,
  DeleteOutlined,
  ReloadOutlined,
  HistoryOutlined,
  ExportOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { CARRIER_LIST, getCarrierTrackUrl } from './constants.js';
import { trackingAPI } from '../src/api/index.js';

const { Title, Text } = Typography;
const { Option } = Select;

function Tracking() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ totalQueries: 0, todayQueries: 0, topCarriers: [] });
  const [carriers] = useState(CARRIER_LIST);

  // 读取URL参数（从FMS订单页跳转过来时自动填入）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const no = params.get('no');
    const carrier = params.get('carrier');
    if (no) {
      form.setFieldsValue({ trackingNo: no });
      if (carrier) {
        form.setFieldsValue({ carrierCode: carrier });
        // 自动触发查询
        setTimeout(() => handleQuery({ trackingNo: no, carrierCode: carrier }), 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载历史记录
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await trackingAPI.getHistory({ pageSize: 50 });
      setHistory(data.list || []);
    } catch (err) {
      console.error('加载历史记录失败:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 加载统计
  const loadStats = async () => {
    try {
      const data = await trackingAPI.getStats();
      setStats(data || { totalQueries: 0, todayQueries: 0, topCarriers: [] });
    } catch (err) {
      console.error('加载统计失败:', err);
    }
  };

  useEffect(() => {
    loadHistory();
    loadStats();
  }, []);

  // 查询轨迹
  const handleQuery = async (values) => {
    const { trackingNo, carrierCode } = values || form.getFieldsValue();
    if (!trackingNo || !trackingNo.trim()) {
      message.warning('请输入单号（提单号/订舱号/箱号）');
      return;
    }
    if (!carrierCode) {
      message.warning('请选择船公司');
      return;
    }

    setLoading(true);
    try {
      const data = await trackingAPI.query({
        trackingNo: trackingNo.trim(),
        carrierCode,
      });

      const { trackUrl, carrierName, trackingNo: no } = data;
      message.success(`正在跳转到 ${carrierName} 官网查询 ${no}...`);
      // 在新窗口打开船公司官网跟踪页面
      window.open(trackUrl, '_blank', 'noopener,noreferrer');
      // 刷新历史记录
      loadHistory();
      loadStats();
    } catch (err) {
      console.error('查询失败:', err);
      message.error('查询失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 从历史记录重新查询
  const handleRequery = (record) => {
    form.setFieldsValue({
      trackingNo: record.trackingNo,
      carrierCode: record.carrierCode,
    });
    handleQuery({
      trackingNo: record.trackingNo,
      carrierCode: record.carrierCode,
    });
  };

  // 删除单条历史
  const handleDelete = async (id) => {
    try {
      await trackingAPI.deleteHistory(id);
      message.success('删除成功');
      loadHistory();
      loadStats();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  // 清空历史
  const handleClearAll = async () => {
    try {
      await trackingAPI.clearHistory();
      message.success('历史记录已清空');
      loadHistory();
      loadStats();
    } catch (err) {
      message.error('清空失败: ' + err.message);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '单号',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 200,
      render: (text) => <Text strong copyable>{text}</Text>,
    },
    {
      title: '船公司',
      dataIndex: 'carrierName',
      key: 'carrierName',
      width: 150,
      render: (text, record) => (
        <Tag color="blue">{text || record.carrierCode}</Tag>
      ),
    },
    {
      title: '查询时间',
      dataIndex: 'queryTime',
      key: 'queryTime',
      width: 200,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="重新查询并跳转船公司官网">
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRequery(record)}
            >
              重查
            </Button>
          </Tooltip>
          <Tooltip title="直接打开跟踪页面">
            <Button
              type="link"
              size="small"
              icon={<ExportOutlined />}
              href={record.trackUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              打开
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定删除这条记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <EnvironmentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          轨迹查验
        </Title>
        <Text type="secondary">
          输入单号并选择船公司，点击查询后将跳转到船公司官网跟踪页面查看实时轨迹
        </Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="累计查询次数"
              value={stats.totalQueries}
              prefix={<HistoryOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="今日查询次数"
              value={stats.todayQueries}
              prefix={<SearchOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="支持船公司"
              value={carriers.length}
              suffix="家"
              prefix={<EnvironmentOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 查询表单 */}
      <Card
        title={
          <Space>
            <SearchOutlined />
            <span>轨迹查询</span>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form
          form={form}
          layout="inline"
          onFinish={handleQuery}
          initialValues={{ carrierCode: 'MSK' }}
        >
          <Form.Item
            name="trackingNo"
            rules={[{ required: true, message: '请输入单号' }]}
            style={{ flex: 1, minWidth: 300 }}
          >
            <Input
              placeholder="请输入提单号/订舱号/箱号（如：275629708）"
              size="large"
              allowClear
              prefix={<SearchOutlined />}
              onPressEnter={() => form.submit()}
            />
          </Form.Item>
          <Form.Item
            name="carrierCode"
            rules={[{ required: true, message: '请选择船公司' }]}
            style={{ minWidth: 200 }}
          >
            <Select
              placeholder="选择船公司"
              size="large"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {carriers.map((c) => (
                <Option key={c.code} value={c.code}>
                  {c.name}（{c.enName}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={loading}
              icon={<SearchOutlined />}
            >
              查询轨迹
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 8, paddingLeft: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            查询后将在新窗口打开对应船公司官网的跟踪页面，支持马士基、MSC、中远、达飞、赫伯罗特等 {carriers.length} 家主流船公司
          </Text>
        </div>
      </Card>

      {/* 历史记录 */}
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <span>查询历史</span>
            <Tag color="blue">{history.length} 条</Tag>
          </Space>
        }
        extra={
          history.length > 0 ? (
            <Popconfirm
              title="确定清空所有查询历史？"
              onConfirm={handleClearAll}
              okText="确定"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                清空历史
              </Button>
            </Popconfirm>
          ) : null
        }
      >
        <Table
          columns={columns}
          dataSource={history}
          rowKey="id"
          loading={historyLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          size="middle"
          locale={{ emptyText: '暂无查询记录，输入单号开始查询吧' }}
        />
      </Card>
    </div>
  );
}

export default Tracking;
