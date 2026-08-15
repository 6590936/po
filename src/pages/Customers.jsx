// 客户列表页面
import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Input, Select, Button, Tag, Space, Modal, Form,
  DatePicker, message, Typography, Row, Col, Tooltip, Badge, Popconfirm, Collapse,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ExportOutlined, ReloadOutlined,
  PhoneOutlined, MessageOutlined, MailOutlined, EyeOutlined,
  EditOutlined, DeleteOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerAPI } from '../api';
import {
  CUSTOMER_STATUS, CUSTOMER_GRADE, CUSTOMER_TYPE,
  getStatusText, getStatusColor, getGradeColor,
} from '../utils/constants';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

// 客户类型画像提示
const PROFILE_PLACEHOLDERS = {
  '跨境电商': {
    cargo_type: 'FBA入仓货物/小包/集运',
    monthly_volume: '月均5-30CBM',
    decision_maker: '姓名-职位（如：王明-物流经理）',
    current_forwarder: '当前合作的货代/物流商',
    pain_points: '如：旺季舱位紧张、时效不稳定',
    entry_strategy: '如：提供稳定美西专线方案+旺季保舱',
  },
  '传统外贸': {
    cargo_type: '整柜/散货/具体货物品名',
    monthly_volume: '月均1-5个40HQ',
    decision_maker: '姓名-职位（如：李华-外贸经理）',
    current_forwarder: '当前合作货代',
    pain_points: '如：运价偏高、清关延误',
    entry_strategy: '如：提供竞争力整柜运价+目的港服务',
  },
  '储能电池': {
    cargo_type: 'Class 9危险品（电池/电源）',
    monthly_volume: '月均5-10CBM',
    decision_maker: '姓名-职位（如：赵强-供应链总监）',
    current_forwarder: '当前合作货代（若无则填"无"）',
    pain_points: '如：危险品运输合规困难、渠道少',
    entry_strategy: '如：展示危险品运输资质+合规方案',
  },
  '同行货代': {
    cargo_type: '代理合作/拼箱/代收',
    monthly_volume: '月均合作量预估',
    decision_maker: '姓名-职位',
    current_forwarder: '主要合作渠道',
    pain_points: '如：同行价格不透明、账期要求',
    entry_strategy: '如：提供同行价+灵活账期方案',
  },
};

function Customers() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({ page: 1, pageSize: 20 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [salesList, setSalesList] = useState([]);
  const [selectedType, setSelectedType] = useState(null);

  useEffect(() => {
    fetchCustomers();
    fetchSalesList();
  }, [params]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const result = await customerAPI.getList(params);
      setCustomers(result.data);
      setTotal(result.total);
    } catch (err) {
      message.error('加载客户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesList = async () => {
    try {
      const result = await customerAPI.getSalesList();
      setSalesList(result);
    } catch {}
  };

  const handleCreate = () => {
    setEditingCustomer(null);
    form.resetFields();
    setSelectedType(null);
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    try {
      const detail = await customerAPI.getDetail(record.id);
      setEditingCustomer(detail);
      setSelectedType(detail.customer_type);
      form.setFieldsValue({
        ...detail,
        next_followup_at: detail.next_followup_at ? dayjs(detail.next_followup_at) : null,
      });
      setModalVisible(true);
    } catch (err) {
      message.error('加载客户详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        next_followup_at: values.next_followup_at ? values.next_followup_at.format('YYYY-MM-DD') : null,
      };

      if (editingCustomer) {
        await customerAPI.update(editingCustomer.id, data);
        message.success('客户更新成功');
      } else {
        await customerAPI.create(data);
        message.success('客户创建成功');
      }
      setModalVisible(false);
      fetchCustomers();
    } catch (err) {
      if (err.message) message.error(err.message);
    }
  };

  const handleDelete = async (id, companyName) => {
    try {
      await customerAPI.delete(id);
      message.success(`客户「${companyName}」已删除`);
      fetchCustomers();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const handleExport = async () => {
    try {
      const data = await customerAPI.exportList();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '客户列表');
      XLSX.writeFile(wb, `客户列表_${dayjs().format('YYYYMMDD')}.xlsx`);
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  const handleExportFollowups = async () => {
    try {
      const data = await customerAPI.exportFollowups();
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '跟进记录');
      XLSX.writeFile(wb, `跟进记录_${dayjs().format('YYYYMMDD')}.xlsx`);
      message.success('导出成功');
    } catch (err) {
      message.error('导出失败');
    }
  };

  // 获取画像placeholder
  const getPlaceholder = (field) => {
    if (selectedType && PROFILE_PLACEHOLDERS[selectedType]) {
      return PROFILE_PLACEHOLDERS[selectedType][field] || '请输入';
    }
    return '请输入';
  };

  const isOverdue = (customer) => {
    if (!customer.next_followup_at || ['deal', 'lost'].includes(customer.status)) return false;
    return dayjs(customer.next_followup_at).isBefore(dayjs(), 'day');
  };

  const isDueToday = (customer) => {
    if (!customer.next_followup_at) return false;
    return dayjs(customer.next_followup_at).isSame(dayjs(), 'day');
  };

  const columns = [
    {
      title: '公司名称',
      dataIndex: 'company_name',
      key: 'company_name',
      fixed: 'left',
      width: 180,
      render: (text, record) => (
        <a onClick={() => navigate(`/customers/${record.id}`)} style={{ fontWeight: 500 }}>
          {text}
        </a>
      ),
    },
    {
      title: '联系人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      width: 100,
      render: (text, record) => (
        <span>{text}{record.position ? ` (${record.position})` : ''}</span>
      ),
    },
    {
      title: '等级',
      dataIndex: 'grade',
      key: 'grade',
      width: 70,
      sorter: true,
      render: (grade) => (
        <Tag color={getGradeColor(grade)} style={{ fontWeight: 'bold' }}>
          {grade}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: Object.entries(CUSTOMER_STATUS).map(([key, val]) => ({
        text: val.label,
        value: key,
      })),
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'customer_type',
      key: 'customer_type',
      width: 100,
      render: (type) => type ? <Tag color={CUSTOMER_TYPE[type]?.color}>{type}</Tag> : '-',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (phone) => phone ? (
        <a href={`tel:${phone}`}><PhoneOutlined /> {phone}</a>
      ) : '-',
    },
    {
      title: '微信',
      dataIndex: 'wechat',
      key: 'wechat',
      width: 120,
      ellipsis: true,
      render: (wechat) => wechat ? <><MessageOutlined /> {wechat}</> : '-',
    },
    {
      title: '下次跟进',
      dataIndex: 'next_followup_at',
      key: 'next_followup_at',
      width: 120,
      sorter: true,
      render: (date, record) => {
        if (!date) return <span style={{ color: '#999' }}>未设置</span>;
        const overdue = isOverdue(record);
        const today = isDueToday(record);
        return (
          <span style={{ color: overdue ? '#ff4d4f' : today ? '#faad14' : '#666' }}>
            {overdue && '⚠️ '}
            {dayjs(date).format('MM-DD')}
          </span>
        );
      },
    },
    {
      title: '所属销售',
      dataIndex: 'owner_name',
      key: 'owner_name',
      width: 90,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 150,
      ellipsis: true,
      render: (tags) => tags ? tags.split(',').map(tag => (
        <Tag key={tag} style={{ marginBottom: 2 }}>{tag}</Tag>
      )) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/customers/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {user.role === 'admin' && (
            <Popconfirm
              title="确认删除该客户？"
              description={`将同时删除该客户的所有跟进记录和等级变更记录，此操作不可恢复`}
              onConfirm={() => handleDelete(record.id, record.company_name)}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>客户管理</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchCustomers}>刷新</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出客户</Button>
          <Button icon={<ExportOutlined />} onClick={handleExportFollowups}>导出跟进</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增客户</Button>
        </Space>
      </div>

      {/* 搜索筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="搜索公司/联系人/电话/微信"
              prefix={<SearchOutlined />}
              allowClear
              onChange={(e) => setParams(p => ({ ...p, keyword: e.target.value, page: 1 }))}
              value={params.keyword}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="客户等级"
              allowClear
              style={{ width: '100%' }}
              onChange={(val) => setParams(p => ({ ...p, grade: val, page: 1 }))}
              value={params.grade}
            >
              {Object.entries(CUSTOMER_GRADE).map(([key, val]) => (
                <Option key={key} value={key}>{key}级</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="客户状态"
              allowClear
              style={{ width: '100%' }}
              onChange={(val) => setParams(p => ({ ...p, status: val, page: 1 }))}
              value={params.status}
            >
              {Object.entries(CUSTOMER_STATUS).map(([key, val]) => (
                <Option key={key} value={key}>{val.label}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="客户类型"
              allowClear
              style={{ width: '100%' }}
              onChange={(val) => setParams(p => ({ ...p, customerType: val, page: 1 }))}
              value={params.customerType}
            >
              {Object.keys(CUSTOMER_TYPE).map(type => (
                <Option key={type} value={type}>{type}</Option>
              ))}
            </Select>
          </Col>
          {user.role === 'admin' && (
            <Col xs={12} sm={6} md={4}>
              <Select
                placeholder="所属销售"
                allowClear
                style={{ width: '100%' }}
                onChange={(val) => setParams(p => ({ ...p, ownerId: val, page: 1 }))}
                value={params.ownerId}
              >
                {salesList.map(s => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Col>
          )}
        </Row>
      </Card>

      {/* 客户表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={customers}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          rowClassName={(record) => {
            if (isOverdue(record)) return 'row-overdue';
            if (isDueToday(record)) return 'row-due-today';
            return '';
          }}
          pagination={{
            current: params.page,
            pageSize: params.pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setParams(p => ({ ...p, page, pageSize })),
          }}
          onChange={(pagination, filters, sorter) => {
            if (sorter.field) {
              setParams(p => ({ ...p, sortBy: sorter.field, sortOrder: sorter.order === 'ascend' ? 'ASC' : 'DESC' }));
            }
          }}
          size="middle"
        />
      </Card>

      {/* 新增/编辑客户弹窗 */}
      <Modal
        title={editingCustomer ? '编辑客户' : '新增客户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={720}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="company_name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
                <Input placeholder="请输入公司名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_name" label="联系人">
                <Input placeholder="请输入联系人姓名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position" label="职位">
                <Input placeholder="请输入职位" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input placeholder="请输入电话号码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="wechat" label="微信">
                <Input placeholder="请输入微信号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="customer_type" label="客户类型">
                <Select placeholder="请选择" allowClear onChange={(val) => setSelectedType(val)}>
                  {Object.keys(CUSTOMER_TYPE).map(type => (
                    <Option key={type} value={type}>{type}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="grade" label="客户等级" initialValue="D">
                <Select placeholder="请选择">
                  {Object.entries(CUSTOMER_GRADE).map(([key, val]) => (
                    <Option key={key} value={key}>{key}级 - {val.followupFrequency}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="客户状态" initialValue="potential">
                <Select placeholder="请选择">
                  {Object.entries(CUSTOMER_STATUS).map(([key, val]) => (
                    <Option key={key} value={key}>{val.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {user.role === 'admin' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="owner_id" label="所属销售">
                  <Select placeholder="请选择销售" allowClear>
                    {salesList.map(s => (
                      <Option key={s.id} value={s.id}>{s.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="next_followup_at" label="下次跟进日期">
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tags" label="标签">
                <Input placeholder="多个标签用逗号分隔" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>

          {/* 功能7：客户画像区域 */}
          <Collapse ghost style={{ background: '#f6f8fa', borderRadius: 8, marginBottom: 16 }}>
            <Panel header={<><UserOutlined /> 客户画像信息（选填）</>} key="profile">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="cargo_type" label="货物类型">
                    <Input placeholder={getPlaceholder('cargo_type')} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="monthly_volume" label="月均货量">
                    <Input placeholder={getPlaceholder('monthly_volume')} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="decision_maker" label="决策人">
                    <Input placeholder={getPlaceholder('decision_maker')} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="current_forwarder" label="当前合作货代">
                    <Input placeholder={getPlaceholder('current_forwarder')} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="pain_points" label="痛点">
                <TextArea rows={2} placeholder={getPlaceholder('pain_points')} />
              </Form.Item>
              <Form.Item name="entry_strategy" label="切入策略">
                <TextArea rows={2} placeholder={getPlaceholder('entry_strategy')} />
              </Form.Item>
            </Panel>
          </Collapse>
        </Form>
      </Modal>

      <style>{`
        .row-overdue { background-color: #fff2f0 !important; }
        .row-overdue:hover > td { background-color: #fff1f0 !important; }
        .row-due-today { background-color: #fffbe6 !important; }
        .row-due-today:hover > td { background-color: #fff8cc !important; }
      `}</style>
    </div>
  );
}

export default Customers;