// 企业微信推送管理
import React, { useState, useEffect } from 'react';
import {
  Card, Table, Row, Col, Form, Input, Button, Space, Tag, Typography, message,
  Modal, Select, Tabs,
} from 'antd';
import {
  SendOutlined, SettingOutlined, RobotOutlined, WechatOutlined,
  HistoryOutlined, LinkOutlined, ApiOutlined, ReloadOutlined, SaveOutlined,
} from '@ant-design/icons';
import { wechatAPI, yunwuyunAPI } from '../api';

const { Title, Text, Paragraph } = Typography;

function WechatPush() {
  const [activeTab, setActiveTab] = useState('config');
  const [aiConfig, setAiConfig] = useState({});
  const [configLoading, setConfigLoading] = useState(false);
  const [form] = Form.useForm();

  // 客户列表（用于 Webhook 配置）
  const [customers, setCustomers] = useState([]);
  const [custLoading, setCustLoading] = useState(false);

  // 推送
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  // 日志
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);

  // Webhook 编辑弹窗
  const [webhookModal, setWebhookModal] = useState({ visible: false, customer: null });
  const [webhookForm] = Form.useForm();

  useEffect(() => {
    fetchConfig();
    fetchCustomers();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await wechatAPI.getConfig();
      setAiConfig(res);
      form.setFieldsValue(res);
    } catch (err) {
      message.error('加载配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustLoading(true);
    try {
      const res = await yunwuyunAPI.getCustomers({ page: 1, pageSize: 500 });
      setCustomers(res.data || []);
    } catch {} finally {
      setCustLoading(false);
    }
  };

  const fetchOrders = async (clientId) => {
    if (!clientId) { setOrders([]); return; }
    setOrderLoading(true);
    try {
      const res = await yunwuyunAPI.getOrders({ client_id: clientId, page: 1, pageSize: 50 });
      setOrders(res.data || []);
    } catch {} finally {
      setOrderLoading(false);
    }
  };

  const fetchLogs = async (page = 1) => {
    setLogLoading(true);
    try {
      const res = await wechatAPI.getLogs({ page, pageSize: 20 });
      setLogs(res.data || []);
      setLogTotal(res.total || 0);
      setLogPage(page);
    } catch {} finally {
      setLogLoading(false);
    }
  };

  const handleSaveConfig = async (values) => {
    try {
      await wechatAPI.saveConfig(values);
      message.success('AI 配置保存成功');
      fetchConfig();
    } catch (err) {
      message.error('保存失败');
    }
  };

  const handleTestWebhook = async (webhookUrl) => {
    if (!webhookUrl) {
      message.warning('请先填写 Webhook 地址');
      return;
    }
    try {
      const res = await wechatAPI.testWebhook(webhookUrl);
      if (res.success) message.success(res.message);
      else message.error(res.error);
    } catch (err) {
      message.error('测试失败');
    }
  };

  const handleSaveWebhook = async () => {
    try {
      const values = await webhookForm.validateFields();
      await wechatAPI.saveCustomerWebhook(webhookModal.customer.client_id, values);
      message.success('Webhook 配置保存成功');
      setWebhookModal({ visible: false, customer: null });
      fetchCustomers();
    } catch (err) {
      if (err.errorFields) return;
      message.error('保存失败');
    }
  };

  const handlePush = async () => {
    if (!selectedClient) { message.warning('请选择客户'); return; }
    if (selectedOrders.length === 0) { message.warning('请选择要推送的订单'); return; }

    const customer = customers.find(c => c.client_id === selectedClient);
    if (!customer?.wechat_webhook) {
      message.warning('该客户未配置企业微信群机器人，请先在下方配置 Webhook');
      return;
    }

    setPushing(true);
    try {
      const res = await wechatAPI.pushOrders({
        client_id: selectedClient,
        order_ids: selectedOrders,
      });
      if (res.success) {
        message.success(res.message);
        setSelectedOrders([]);
      } else {
        message.error(res.error);
      }
    } catch (err) {
      message.error('推送失败');
    } finally {
      setPushing(false);
    }
  };

  const customerColumns = [
    { title: '客户编码', dataIndex: 'client_code', width: 120 },
    { title: '客户名称', dataIndex: 'client_name', width: 180 },
    { title: '群名称', dataIndex: 'wechat_group_name', width: 150, render: (v) => v || <Text type="secondary">未设置</Text> },
    { title: 'Webhook', dataIndex: 'wechat_webhook', width: 200, ellipsis: true,
      render: (v) => v ? <Tag color="green">已配置</Tag> : <Tag color="default">未配置</Tag> },
    { title: '操作', key: 'action', width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<SettingOutlined />}
            onClick={() => {
              webhookForm.setFieldsValue({
                wechat_webhook: r.wechat_webhook || '',
                wechat_group_name: r.wechat_group_name || '',
              });
              setWebhookModal({ visible: true, customer: r });
            }}>
            配置 Webhook
          </Button>
          {r.wechat_webhook && (
            <Button type="link" size="small" icon={<SendOutlined />}
              onClick={() => handleTestWebhook(r.wechat_webhook)}>测试</Button>
          )}
        </Space>
      ),
    },
  ];

  const orderColumns = [
    { title: '工作号', dataIndex: 'job_no', width: 130 },
    { title: '日期', dataIndex: 'job_date', width: 100, render: (v) => v?.slice(0, 10) },
    { title: '船名/航次', width: 150, render: (_, r) => `${r.vessel || '-'}/${r.voyage || '-'}` },
    { title: 'ETD', dataIndex: 'etd', width: 100, render: (v) => v?.slice(0, 10) },
    { title: '目的国', dataIndex: 'dest_country', width: 100 },
    { title: '状态', dataIndex: 'order_status', width: 80,
      render: (v) => <Tag color={v === '已完成' ? 'green' : 'blue'}>{v || '-'}</Tag> },
  ];

  const logColumns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    { title: '客户', dataIndex: 'client_name', width: 120 },
    { title: '工作号', dataIndex: 'order_no', width: 120 },
    { title: '类型', dataIndex: 'push_type', width: 100 },
    { title: '内容', dataIndex: 'content', width: 300, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v) => <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : '失败'}</Tag> },
    { title: '错误', dataIndex: 'error_msg', width: 150, ellipsis: true, render: (v) => v || '-' },
    { title: '时间', dataIndex: 'created_at', width: 150, render: (v) => v?.slice(0, 19).replace('T', ' ') },
  ];

  const tabItems = [
    {
      key: 'config',
      label: <span><ApiOutlined />AI 配置</span>,
      children: (
        <Card title={<Space><RobotOutlined /><span>AI 大模型配置</span></Space>} loading={configLoading}>
          <Paragraph type="secondary">
            配置 AI 大模型用于自动生成订单推送消息。如不配置，将使用模板格式推送。
            支持 OpenAI 兼容接口（如 DeepSeek、通义千问、GLM 等）。
          </Paragraph>
          <Form form={form} onFinish={handleSaveConfig} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="ai_endpoint" label="API 地址">
              <Input placeholder="https://api.deepseek.com/v1/chat/completions" />
            </Form.Item>
            <Form.Item name="ai_key" label="API Key">
              <Input.Password placeholder="sk-xxxxxxxx" />
            </Form.Item>
            <Form.Item name="ai_model" label="模型名称">
              <Input placeholder="deepseek-chat（默认 gpt-3.5-turbo）" />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>保存配置</Button>
          </Form>
        </Card>
      ),
    },
    {
      key: 'webhook',
      label: <span><LinkOutlined />客户 Webhook 配置</span>,
      children: (
        <Card
          title={<Space><WechatOutlined /><span>客户企业微信群机器人配置</span></Space>}
          extra={<Button icon={<ReloadOutlined />} onClick={fetchCustomers}>刷新</Button>}
        >
          <Paragraph type="secondary">
            为每个客户配置对应的企业微信群机器人 Webhook 地址。
            在企业微信群聊中 → 群设置 → 群机器人 → 添加机器人 → 复制 Webhook 地址。
          </Paragraph>
          <Table
            columns={customerColumns}
            dataSource={customers}
            rowKey="client_id"
            loading={custLoading}
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个客户` }}
            size="small"
          />
        </Card>
      ),
    },
    {
      key: 'push',
      label: <span><SendOutlined />推送订单</span>,
      children: (
        <Card title={<Space><SendOutlined /><span>推送订单到企业微信群</span></Space>}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Select
                showSearch
                placeholder="选择客户"
                style={{ width: '100%' }}
                filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                value={selectedClient}
                onChange={(v) => { setSelectedClient(v); setSelectedOrders([]); fetchOrders(v); }}
                allowClear
                options={customers.filter(c => c.wechat_webhook).map(c => ({
                  value: c.client_id,
                  label: `${c.client_name} (${c.client_code}) ${c.wechat_group_name ? `- ${c.wechat_group_name}` : ''}`,
                }))}
              />
            </Col>
            <Col span={16}>
              <Space>
                <Button type="primary" icon={<SendOutlined />} onClick={handlePush} loading={pushing}
                  disabled={!selectedClient || selectedOrders.length === 0}>
                  推送选中订单 ({selectedOrders.length})
                </Button>
                <Text type="secondary">
                  {selectedClient ? '点击订单行选中，支持多选后批量推送' : '请先选择客户'}
                </Text>
              </Space>
            </Col>
          </Row>
          <Table
            columns={orderColumns}
            dataSource={orders}
            rowKey="job_id"
            loading={orderLoading}
            rowSelection={{
              selectedRowKeys: selectedOrders,
              onChange: setSelectedOrders,
            }}
            pagination={{ pageSize: 20 }}
            size="small"
          />
        </Card>
      ),
    },
    {
      key: 'logs',
      label: <span><HistoryOutlined />推送日志</span>,
      children: (
        <Card
          title={<Space><HistoryOutlined /><span>推送日志</span></Space>}
          extra={<Button icon={<ReloadOutlined />} onClick={() => fetchLogs(logPage)}>刷新</Button>}
        >
          <Table
            columns={logColumns}
            dataSource={logs}
            rowKey="id"
            loading={logLoading}
            pagination={{ current: logPage, total: logTotal, pageSize: 20, onChange: fetchLogs, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ x: 1000 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <Space><WechatOutlined /><span>企业微信推送管理</span></Space>
      </Title>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key); if (key === 'logs') fetchLogs(); }}
        items={tabItems}
        size="large"
      />

      {/* Webhook 配置弹窗 */}
      <Modal
        title={`配置 Webhook - ${webhookModal.customer?.client_name || ''}`}
        open={webhookModal.visible}
        onOk={handleSaveWebhook}
        onCancel={() => setWebhookModal({ visible: false, customer: null })}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={webhookForm} layout="vertical">
          <Form.Item name="wechat_group_name" label="群名称">
            <Input placeholder="如：XX客户对接群" />
          </Form.Item>
          <Form.Item name="wechat_webhook" label="Webhook 地址" rules={[{ required: true, message: '请输入 Webhook 地址' }]}>
            <Input.TextArea rows={4} placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx" />
          </Form.Item>
        </Form>
        <Button
          onClick={() => {
            const url = webhookForm.getFieldValue('wechat_webhook');
            handleTestWebhook(url);
          }}
        >
          测试发送
        </Button>
      </Modal>
    </div>
  );
}

export default WechatPush;