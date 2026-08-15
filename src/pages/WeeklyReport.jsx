// 周报模块页面
import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Form, Input, InputNumber, Select, Button, Table, Typography,
  Space, Tag, Statistic, Collapse, message, Spin, Divider,
} from 'antd';
import {
  FileTextOutlined, SaveOutlined, BarChartOutlined,
  CheckCircleOutlined, PlusOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { reportAPI, customerAPI } from '../api';
import dayjs from 'dayjs';
import useAuthStore from '../store/authStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// SOP周报目标
const SOP_WEEKLY_TARGETS = {
  new_customers: { target: 4, label: '新增客户' },
  effective_comms: { target: 25, label: '有效沟通' },
  quotes_sent: { target: 8, label: '发出报价' },
  deals: { target: 1, label: '成交客户' },
};

function WeeklyReport() {
  const user = useAuthStore((s) => s.user);
  const [form] = Form.useForm();
  const [weekStats, setWeekStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stats, list, custResult] = await Promise.all([
        reportAPI.getWeekStats(),
        reportAPI.getWeeklyList({ pageSize: 50 }),
        customerAPI.getList({ pageSize: 200 }),
      ]);
      setWeekStats(stats);
      setHistory(list.data);
      setHistoryTotal(list.total);
      setCustomers(custResult.data);

      // 预填统计数据
      form.setFieldsValue({
        new_customers: stats.new_customers || 0,
        effective_comms: stats.effective_comms || 0,
        quotes_sent: stats.quotes_sent || 0,
        deals: stats.deals || 0,
      });
    } catch (err) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await reportAPI.saveWeekly({
        ...values,
        top3_customers: values.top3_customers || [],
      });
      message.success('周报保存成功');
      fetchAll();
    } catch (err) {
      if (err.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  const weekLabel = weekStats ? `${weekStats.week_start} ~ ${weekStats.week_end}` : '';

  const historyColumns = [
    {
      title: '周次', key: 'week', width: 180,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.week_start}</div>
          <div style={{ fontSize: 12, color: '#999' }}>~ {r.week_end}</div>
        </div>
      ),
    },
    { title: '新增客户', dataIndex: 'new_customers', key: 'new_customers', width: 80 },
    { title: '有效沟通', dataIndex: 'effective_comms', key: 'effective_comms', width: 80 },
    { title: '报价数', dataIndex: 'quotes_sent', key: 'quotes_sent', width: 80 },
    { title: '成交数', dataIndex: 'deals', key: 'deals', width: 80 },
    {
      title: 'TOP3客户', dataIndex: 'top3_customers', key: 'top3_customers',
      render: (arr) => arr && arr.length > 0 ? arr.map((c, i) => (
        <Tag key={i} color="blue" style={{ marginBottom: 2 }}>{c.name}</Tag>
      )) : '-',
    },
    {
      title: '问题', dataIndex: 'problems', key: 'problems', width: 200, ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (d) => dayjs(d).format('MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}><FileTextOutlined /> 周报</Title>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          保存周报
        </Button>
      </div>

      {/* 本周自动统计对比SOP */}
      <Card title={`本周自动统计 (${weekLabel})`} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {Object.entries(SOP_WEEKLY_TARGETS).map(([key, cfg]) => {
            const actual = weekStats?.[key] || 0;
            const pct = Math.min(100, Math.round(actual / cfg.target * 100));
            const color = pct >= 100 ? '#52c41a' : pct >= 70 ? '#faad14' : '#ff4d4f';
            return (
              <Col xs={12} sm={6} key={key}>
                <div style={{ textAlign: 'center', padding: 16, background: '#f6f8fa', borderRadius: 8 }}>
                  <Statistic title={cfg.label} value={actual} suffix={`/ ${cfg.target}`}
                    valueStyle={{ color }} prefix={pct >= 100 ? <CheckCircleOutlined /> : null} />
                  <div style={{ marginTop: 4 }}>
                    <Tag color={color}>{pct}%</Tag>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* 周报填写表单 */}
      <Card title="填写周报" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Form.Item name="new_customers" label="新增客户数">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="effective_comms" label="有效沟通数">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="quotes_sent" label="发出报价数">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="deals" label="成交客户数">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="revenue" label="本周营收">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="本周成交金额（元）" prefix="¥" />
          </Form.Item>

          {/* TOP3客户 */}
          <Divider orientation="left">本周TOP3客户</Divider>
          <Form.List name="top3_customers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={16} key={key} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={10}>
                      <Form.Item {...restField} name={[name, 'id']} style={{ marginBottom: 0 }}>
                        <Select
                          showSearch
                          placeholder="选择客户"
                          optionFilterProp="children"
                          options={customers.map(c => ({ value: c.id, label: c.company_name }))}
                          onSelect={(val) => {
                            const current = form.getFieldValue('top3_customers') || [];
                            const cust = customers.find(c => c.id === val);
                            if (cust) {
                              current[name] = { ...current[name], id: val, name: cust.company_name };
                              form.setFieldsValue({ top3_customers: current });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={11}>
                      <Form.Item {...restField} name={[name, 'reason']} style={{ marginBottom: 0 }}>
                        <Input placeholder="简要原因" />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', fontSize: 18 }} />
                    </Col>
                  </Row>
                ))}
                {fields.length < 3 && (
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加TOP客户
                  </Button>
                )}
              </>
            )}
          </Form.List>

          <Divider />

          <Form.Item name="problems" label="本周遇到的问题">
            <TextArea rows={4} placeholder="请描述本周遇到的问题、困难或需要协助的事项" />
          </Form.Item>

          <Form.Item name="next_week_plan" label="下周计划">
            <TextArea rows={4} placeholder="请描述下周的工作计划和目标" />
          </Form.Item>
        </Form>
      </Card>

      {/* 历史周报 */}
      <Card title="历史周报">
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          size="small"
          scroll={{ x: 800 }}
          pagination={{
            pageSize: 10,
            total: historyTotal,
            showTotal: (t) => `共 ${t} 条`,
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: 12 }}>
                {record.problems && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>遇到的问题：</Text>
                    <Paragraph>{record.problems}</Paragraph>
                  </div>
                )}
                {record.next_week_plan && (
                  <div>
                    <Text strong>下周计划：</Text>
                    <Paragraph>{record.next_week_plan}</Paragraph>
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default WeeklyReport;