// 报价记录管理页面
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Tag, Space, Modal, Form, Input, Select, InputNumber,
  DatePicker, message, Typography, Row, Col, Popconfirm, Statistic, Spin,
} from 'antd';
import {
  PlusOutlined, FileTextOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, DollarOutlined,
  DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { quoteAPI, customerAPI } from '../api';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const { Title } = Typography;
const { TextArea } = Input;

const STATUS_MAP = {
  pending: { label: '待回复', color: '#faad14', icon: <ClockCircleOutlined /> },
  accepted: { label: '已接受', color: '#52c41a', icon: <CheckCircleOutlined /> },
  rejected: { label: '已拒绝', color: '#ff4d4f', icon: <CloseCircleOutlined /> },
  expired: { label: '已过期', color: '#8c8c8c', icon: <ClockCircleOutlined /> },
};

function Quotes() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({ page: 1, pageSize: 20 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(null);
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchQuotes();
    fetchStats();
    fetchCustomers();
  }, [params]);

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const result = await quoteAPI.getList(params);
      setQuotes(result.data);
      setTotal(result.total);
    } catch (err) {
      message.error('加载报价列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await quoteAPI.getStats();
      setStats(data);
    } catch {}
  };

  const fetchCustomers = async () => {
    try {
      const result = await customerAPI.getList({ pageSize: 200 });
      setCustomers(result.data);
    } catch {}
  };

  const handleCreate = () => {
    setEditingQuote(null);
    form.resetFields();
    form.setFieldsValue({ currency: 'CNY' });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        valid_until: values.valid_until ? values.valid_until.format('YYYY-MM-DD') : null,
      };
      await quoteAPI.create(data);
      message.success('报价创建成功');
      setModalVisible(false);
      fetchQuotes();
      fetchStats();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleStatusChange = async () => {
    try {
      const values = await statusForm.validateFields();
      await quoteAPI.update(currentQuote.id, values);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      fetchQuotes();
      fetchStats();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await quoteAPI.delete(id);
      message.success('报价已删除');
      fetchQuotes();
      fetchStats();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '客户', dataIndex: 'customer_name', key: 'customer_name', width: 180,
      render: (name, record) => (
        <a onClick={() => navigate(`/customers/${record.customer_id}`)} style={{ fontWeight: 500 }}>
          {name}
        </a>
      ),
    },
    { title: '航线', dataIndex: 'route', key: 'route', width: 150, ellipsis: true },
    { title: '柜型', dataIndex: 'container_type', key: 'container_type', width: 100 },
    {
      title: '金额', dataIndex: 'amount', key: 'amount', width: 120,
      render: (amount, record) => (
        <span style={{ fontWeight: 500 }}>
          {record.currency === 'USD' ? '$' : '¥'}{amount?.toLocaleString() || 0}
        </span>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => (
        <Tag color={STATUS_MAP[status]?.color || 'default'}>
          {STATUS_MAP[status]?.icon} {STATUS_MAP[status]?.label || status}
        </Tag>
      ),
    },
    {
      title: '有效期', dataIndex: 'valid_until', key: 'valid_until', width: 110,
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '响应时间', dataIndex: 'response_time_hours', key: 'response_time_hours', width: 100,
      render: (hours) => {
        if (hours === null) return <span style={{ color: '#999' }}>待回复</span>;
        const color = hours <= 0.5 ? '#52c41a' : hours <= 2 ? '#faad14' : '#ff4d4f';
        return <span style={{ color }}>{hours >= 24 ? `${Math.round(hours/24)}天` : `${hours}h`}</span>;
      },
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (date) => dayjs(date).format('MM-DD HH:mm'),
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button type="link" size="small" onClick={() => { setCurrentQuote(record); statusForm.resetFields(); setStatusModalVisible(true); }}>
              更新
            </Button>
          )}
          <Popconfirm title="确认删除该报价？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}><FileTextOutlined /> 报价管理</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchQuotes(); fetchStats(); }}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建报价</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="总报价" value={stats.total} prefix={<FileTextOutlined />} valueStyle={{ color: '#1B4F72' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="待回复" value={stats.pending} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="已接受" value={stats.accepted} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="≤30分钟达标率" value={stats.responseRate} suffix="%" prefix={<DollarOutlined />}
                valueStyle={{ color: stats.responseRate >= 50 ? '#52c41a' : '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select placeholder="状态筛选" allowClear style={{ width: 140 }}
            onChange={(val) => setParams(p => ({ ...p, status: val || undefined, page: 1 }))}>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <Select.Option key={key} value={key}>{val.label}</Select.Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* 报价列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={quotes}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          size="middle"
          pagination={{
            current: params.page,
            pageSize: params.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (page, pageSize) => setParams(p => ({ ...p, page, pageSize })),
          }}
        />
      </Card>

      {/* 新建报价弹窗 */}
      <Modal
        title="新建报价"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customer_id" label="选择客户" rules={[{ required: true, message: '请选择客户' }]}>
            <Select
              showSearch
              placeholder="搜索并选择客户"
              optionFilterProp="children"
              options={customers.map(c => ({ value: c.id, label: `${c.company_name} (${c.contact_name || '未知'})` }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="route" label="航线">
                <Input placeholder="如：深圳-洛杉矶" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="container_type" label="柜型">
                <Select placeholder="选择柜型" allowClear>
                  <Select.Option value="20GP">20GP</Select.Option>
                  <Select.Option value="40GP">40GP</Select.Option>
                  <Select.Option value="40HQ">40HQ</Select.Option>
                  <Select.Option value="45HQ">45HQ</Select.Option>
                  <Select.Option value="LCL">散货(LCL)</Select.Option>
                  <Select.Option value="其他">其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="报价金额" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="币种" initialValue="CNY">
                <Select>
                  <Select.Option value="CNY">人民币 (¥)</Select.Option>
                  <Select.Option value="USD">美元 ($)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="valid_until" label="有效期">
            <DatePicker style={{ width: '100%' }} placeholder="选择报价有效期" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="报价备注说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 更新状态弹窗 */}
      <Modal
        title="更新报价状态"
        open={statusModalVisible}
        onOk={handleStatusChange}
        onCancel={() => setStatusModalVisible(false)}
        okText="确认"
        cancelText="取消"
        destroyOnHidden
      >
        {currentQuote && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>客户：</strong>{currentQuote.customer_name}</p>
            <p><strong>航线：</strong>{currentQuote.route}</p>
            <p><strong>金额：</strong>{currentQuote.currency === 'USD' ? '$' : '¥'}{currentQuote.amount?.toLocaleString()}</p>
          </div>
        )}
        <Form form={statusForm} layout="vertical">
          <Form.Item name="status" label="更新状态" rules={[{ required: true }]}>
            <Select>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <Select.Option key={key} value={key}>{val.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Quotes;