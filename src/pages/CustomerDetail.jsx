// 客户详情页面
import React, { useState, useEffect } from 'react';
import {
  Card, Descriptions, Tag, Timeline, Button, Modal, Form, Input,
  Select, DatePicker, message, Typography, Space, Row, Col, Divider,
  Spin, Badge, Empty, Popconfirm, Collapse, Table,
} from 'antd';
import {
  ArrowLeftOutlined, PhoneOutlined, MessageOutlined, MailOutlined,
  EditOutlined, PlusOutlined, SwapOutlined, ClockCircleOutlined,
  UserOutlined, DeleteOutlined, FileTextOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { customerAPI } from '../api';
import {
  CUSTOMER_STATUS, CUSTOMER_GRADE, CUSTOMER_TYPE, FOLLOWUP_METHOD,
  getStatusText, getStatusColor, getGradeColor, getMethodText,
} from '../utils/constants';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function CustomerDetail() {
  const user = useAuthStore((s) => s.user);
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followupModalVisible, setFollowupModalVisible] = useState(false);
  const [gradeModalVisible, setGradeModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [followupForm] = Form.useForm();
  const [gradeForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const result = await customerAPI.getDetail(id);
      setCustomer(result);
    } catch (err) {
      message.error(err.message || '加载客户详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowup = async () => {
    try {
      const values = await followupForm.validateFields();
      await customerAPI.addFollowup(id, {
        ...values,
        followup_date: values.followup_date.format('YYYY-MM-DD'),
        next_time: values.next_time ? values.next_time.format('YYYY-MM-DD') : null,
      });
      message.success('跟进记录添加成功');
      setFollowupModalVisible(false);
      followupForm.resetFields();
      fetchDetail();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleChangeGrade = async () => {
    try {
      const values = await gradeForm.validateFields();
      await customerAPI.update(id, {
        grade: values.to_grade,
        grade_reason: values.reason,
      });
      message.success('等级变更成功');
      setGradeModalVisible(false);
      gradeForm.resetFields();
      fetchDetail();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await customerAPI.delete(id);
      message.success('客户已删除');
      navigate('/customers');
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const handleEditCustomer = async () => {
    try {
      const values = await editForm.validateFields();
      await customerAPI.update(id, {
        ...values,
        next_followup_at: values.next_followup_at ? values.next_followup_at.format('YYYY-MM-DD') : null,
      });
      message.success('客户信息更新成功');
      setEditModalVisible(false);
      fetchDetail();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  if (!customer) {
    return <Empty description="客户不存在" />;
  }

  const getFollowupUrgency = () => {
    if (!customer.next_followup_at) return null;
    const now = dayjs();
    const next = dayjs(customer.next_followup_at);
    const diff = next.diff(now, 'day');
    if (diff < 0) return { text: `已超期 ${Math.abs(diff)} 天`, color: '#ff4d4f' };
    if (diff === 0) return { text: '今天需要跟进', color: '#faad14' };
    if (diff <= 3) return { text: `${diff}天后需要跟进`, color: '#2E86C1' };
    return { text: `${diff}天后需要跟进`, color: '#52c41a' };
  };

  const urgency = getFollowupUrgency();
  const gradeInfo = CUSTOMER_GRADE[customer.grade] || {};

  // 报价表格列
  const quoteColumns = [
    { title: '航线', dataIndex: 'route', key: 'route', width: 120 },
    { title: '柜型', dataIndex: 'container_type', key: 'container_type', width: 80 },
    {
      title: '金额', dataIndex: 'amount', key: 'amount', width: 100,
      render: (amount, record) => `${record.currency === 'USD' ? '$' : '¥'}${amount?.toLocaleString() || 0}`,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => {
        const map = { pending: { label: '待回复', color: '#faad14' }, accepted: { label: '已接受', color: '#52c41a' }, rejected: { label: '已拒绝', color: '#ff4d4f' }, expired: { label: '已过期', color: '#8c8c8c' } };
        return <Tag color={map[s]?.color}>{map[s]?.label || s}</Tag>;
      },
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 100,
      render: (d) => d ? dayjs(d).format('MM-DD HH:mm') : '-',
    },
  ];

  // 判断是否有画像信息
  const hasProfile = customer.cargo_type || customer.monthly_volume || customer.decision_maker || customer.current_forwarder || customer.pain_points || customer.entry_strategy;

  return (
    <div>
      {/* 头部 */}
      <div style={{ marginBottom: 20 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/customers')}
          style={{ marginBottom: 12 }}
        >
          返回列表
        </Button>

        <Card>
          <Row gutter={24} align="middle">
            <Col flex="auto">
              <Space align="start" size="large" wrap>
                <div>
                  <Title level={3} style={{ margin: 0 }}>{customer.company_name}</Title>
                  <Space style={{ marginTop: 8 }} wrap>
                    <Tag color={getGradeColor(customer.grade)} style={{ fontWeight: 'bold', fontSize: 14 }}>
                      {customer.grade}级
                    </Tag>
                    <Tag color={getStatusColor(customer.status)}>
                      {getStatusText(customer.status)}
                    </Tag>
                    {customer.customer_type && (
                      <Tag color={CUSTOMER_TYPE[customer.customer_type]?.color}>
                        {customer.customer_type}
                      </Tag>
                    )}
                  </Space>
                </div>
                {urgency && (
                  <Badge
                    count={urgency.text}
                    style={{
                      backgroundColor: urgency.color,
                      fontSize: 12,
                      padding: '2px 8px',
                    }}
                  />
                )}
              </Space>
            </Col>
            <Col>
              <Space wrap>
                <Button
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => {
                    followupForm.setFieldsValue({
                      followup_date: dayjs(),
                    });
                    setFollowupModalVisible(true);
                  }}
                >
                  添加跟进
                </Button>
                <Button
                  icon={<SwapOutlined />}
                  onClick={() => {
                    gradeForm.setFieldsValue({
                      from_grade: customer.grade,
                    });
                    setGradeModalVisible(true);
                  }}
                >
                  调整等级
                </Button>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => {
                    editForm.setFieldsValue({
                      ...customer,
                      next_followup_at: customer.next_followup_at ? dayjs(customer.next_followup_at) : null,
                    });
                    setEditModalVisible(true);
                  }}
                >
                  编辑
                </Button>
                {user.role === 'admin' && (
                  <Popconfirm
                    title="确认删除该客户？"
                    description="将同时删除所有跟进记录和等级变更记录，不可恢复"
                    onConfirm={handleDelete}
                    okText="确认删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      <Row gutter={[16, 16]}>
        {/* 客户信息 */}
        <Col xs={24} lg={12}>
          <Card title="客户信息" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="联系人">
                {customer.contact_name || '-'}
                {customer.position ? ` (${customer.position})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="电话">
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`}>
                    <PhoneOutlined /> {customer.phone}
                  </a>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="微信">
                {customer.wechat ? (
                  <span><MessageOutlined /> {customer.wechat}</span>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`}>
                    <MailOutlined /> {customer.email}
                  </a>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="所属销售">
                {customer.owner_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {customer.created_at ? dayjs(customer.created_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="最后跟进">
                {customer.last_followup_at ? dayjs(customer.last_followup_at).format('YYYY-MM-DD') : '暂无跟进'}
              </Descriptions.Item>
              <Descriptions.Item label="下次跟进">
                {customer.next_followup_at ? (
                  <span style={{ color: urgency?.color || '#666' }}>
                    {dayjs(customer.next_followup_at).format('YYYY-MM-DD')} ({urgency?.text || ''})
                  </span>
                ) : '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="跟进频率">
                <Tag color={getGradeColor(customer.grade)}>
                  {gradeInfo.followupFrequency || '-'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
            {customer.tags && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">标签：</Text>
                {customer.tags.split(',').map(tag => (
                  <Tag key={tag} style={{ marginTop: 4 }}>{tag}</Tag>
                ))}
              </div>
            )}
            {customer.notes && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">备注：</Text>
                <Paragraph style={{ marginTop: 4, background: '#f6f8fa', padding: 12, borderRadius: 6 }}>
                  {customer.notes}
                </Paragraph>
              </div>
            )}
          </Card>
        </Col>

        {/* 功能7：客户画像信息 */}
        <Col xs={24} lg={12}>
          <Card title={<><ExperimentOutlined /> 客户画像</>} size="small">
            {hasProfile ? (
              <Descriptions column={1} size="small">
                {customer.cargo_type && (
                  <Descriptions.Item label="货物类型">
                    <Tag color="blue">{customer.cargo_type}</Tag>
                  </Descriptions.Item>
                )}
                {customer.monthly_volume && (
                  <Descriptions.Item label="月均货量">
                    {customer.monthly_volume}
                  </Descriptions.Item>
                )}
                {customer.decision_maker && (
                  <Descriptions.Item label="决策人">
                    <UserOutlined style={{ marginRight: 4 }} />{customer.decision_maker}
                  </Descriptions.Item>
                )}
                {customer.current_forwarder && (
                  <Descriptions.Item label="当前货代">
                    {customer.current_forwarder}
                  </Descriptions.Item>
                )}
                {customer.pain_points && (
                  <Descriptions.Item label="痛点">
                    <div style={{ background: '#fff2f0', padding: '8px 12px', borderRadius: 6, color: '#ff4d4f', fontSize: 13 }}>
                      {customer.pain_points}
                    </div>
                  </Descriptions.Item>
                )}
                {customer.entry_strategy && (
                  <Descriptions.Item label="切入策略">
                    <div style={{ background: '#f6ffed', padding: '8px 12px', borderRadius: 6, color: '#52c41a', fontSize: 13 }}>
                      {customer.entry_strategy}
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            ) : (
              <Empty description="暂无画像信息，请在编辑中填写" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 跟进记录时间线 */}
        <Col xs={24} lg={12}>
          <Card
            title="跟进记录"
            size="small"
            extra={
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={() => {
                  followupForm.setFieldsValue({ followup_date: dayjs() });
                  setFollowupModalVisible(true);
                }}
              >
                添加
              </Button>
            }
          >
            {customer.followups && customer.followups.length > 0 ? (
              <Timeline
                style={{ marginTop: 16 }}
                items={customer.followups.map(f => ({
                  color: FOLLOWUP_METHOD[f.method]?.color || '#2E86C1',
                  children: (
                    <div key={f.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Space>
                          <Tag color={FOLLOWUP_METHOD[f.method]?.color}>
                            {getMethodText(f.method)}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {f.user_name}
                          </Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(f.followup_date).format('YYYY-MM-DD')}
                        </Text>
                      </div>
                      <Paragraph style={{ margin: '4px 0' }}>{f.content}</Paragraph>
                      {f.next_plan && (
                        <div style={{ background: '#f6f8fa', padding: '4px 8px', borderRadius: 4, marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            📋 下一步：{f.next_plan}
                            {f.next_time && ` (${dayjs(f.next_time).format('MM-DD')})`}
                          </Text>
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="暂无跟进记录" />
            )}
          </Card>
        </Col>

        {/* 功能4：报价记录展示 */}
        <Col xs={24} lg={12}>
          <Card title={<><FileTextOutlined /> 历史报价</>} size="small">
            {customer.quotes && customer.quotes.length > 0 ? (
              <Table
                columns={quoteColumns}
                dataSource={customer.quotes}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: 500 }}
              />
            ) : (
              <Empty description="暂无报价记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        {/* 等级变更记录 */}
        <Col xs={24}>
          <Card title="等级变更记录" size="small">
            {customer.gradeChanges && customer.gradeChanges.length > 0 ? (
              <Timeline
                style={{ marginTop: 16 }}
                items={customer.gradeChanges.map(gc => ({
                  color: getGradeColor(gc.to_grade),
                  children: (
                    <div key={gc.id}>
                      <Space>
                        <Tag color={getGradeColor(gc.from_grade)}>{gc.from_grade}级</Tag>
                        <span>→</span>
                        <Tag color={getGradeColor(gc.to_grade)}>{gc.to_grade}级</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {gc.user_name} · {dayjs(gc.created_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      </Space>
                      {gc.reason && (
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">原因：{gc.reason}</Text>
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="暂无等级变更记录" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 添加跟进弹窗 */}
      <Modal
        title="添加跟进记录"
        open={followupModalVisible}
        onOk={handleAddFollowup}
        onCancel={() => setFollowupModalVisible(false)}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={followupForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="followup_date" label="跟进日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="method" label="跟进方式">
                <Select placeholder="请选择">
                  {Object.entries(FOLLOWUP_METHOD).map(([key, val]) => (
                    <Select.Option key={key} value={key}>{val.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="content" label="跟进内容" rules={[{ required: true, message: '请输入跟进内容' }]}>
            <TextArea rows={4} placeholder="请详细描述本次跟进的内容" />
          </Form.Item>
          <Form.Item name="next_plan" label="下一步计划">
            <Input placeholder="下一步需要做什么" />
          </Form.Item>
          <Form.Item name="next_time" label="下次跟进时间">
            <DatePicker style={{ width: '100%' }} placeholder="选择下次跟进日期" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 调整等级弹窗 */}
      <Modal
        title="调整客户等级"
        open={gradeModalVisible}
        onOk={handleChangeGrade}
        onCancel={() => setGradeModalVisible(false)}
        okText="确认"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={gradeForm} layout="vertical">
          <Form.Item name="from_grade" label="当前等级">
            <Input disabled />
          </Form.Item>
          <Form.Item name="to_grade" label="调整为" rules={[{ required: true }]}>
            <Select placeholder="请选择目标等级">
              {Object.entries(CUSTOMER_GRADE).map(([key, val]) => (
                <Select.Option key={key} value={key} disabled={key === customer.grade}>
                  {key}级 - {val.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="变更原因" rules={[{ required: true, message: '请输入变更原因' }]}>
            <TextArea rows={3} placeholder="请说明升降级原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑客户信息弹窗 */}
      <Modal
        title="编辑客户信息"
        open={editModalVisible}
        onOk={handleEditCustomer}
        onCancel={() => setEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={650}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company_name" label="公司名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_name" label="联系人">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="wechat" label="微信">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select>
                  {Object.entries(CUSTOMER_STATUS).map(([key, val]) => (
                    <Select.Option key={key} value={key}>{val.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="next_followup_at" label="下次跟进">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {/* 画像字段编辑 */}
          <Collapse ghost size="small" style={{ background: '#f6f8fa', borderRadius: 6, marginBottom: 12 }}>
            <Collapse.Panel header="客户画像" key="profile">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="cargo_type" label="货物类型">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="monthly_volume" label="月均货量">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="decision_maker" label="决策人">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="current_forwarder" label="当前货代">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="pain_points" label="痛点">
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item name="entry_strategy" label="切入策略">
                <TextArea rows={2} />
              </Form.Item>
            </Collapse.Panel>
          </Collapse>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CustomerDetail;