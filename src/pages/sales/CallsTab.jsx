import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space, message, Popconfirm, Typography, Row, Col, Statistic, Rate } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons';
import { salesAPI, authAPI, customerAPI } from '../../api';
import FileLink from './FileLink';
import UploadBtn from './UploadBtn';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

function CallsTab({ isAdmin }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [filterUserId, setFilterUserId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(3);
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => { fetchList(); fetchStats(); fetchCustomers(); fetchScripts(); if (isAdmin) fetchUsers(); }, [page]);

  const fetchList = async () => {
    setLoading(true);
    try { const res = await salesAPI.getCalls({ page, pageSize: 20, keyword, user_id: filterUserId }); setList(res.list); setTotal(res.total); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try { const res = await authAPI.getUsers(); setUsers(res.filter(u => u.role === 'sales')); }
    catch {}
  };

  const handleSearch = () => { setPage(1); fetchList(); };
  const handleClear = () => { setKeyword(''); setFilterUserId(null); setPage(1); };

  const fetchStats = async () => {
    try { const res = await salesAPI.getCallStats(); setStats(res); }
    catch {}
  };

  const fetchCustomers = async () => {
    try { const res = await customerAPI.getList({ pageSize: 1000 }); setCustomers(res.list || []); }
    catch {}
  };

  const fetchScripts = async () => {
    try { const res = await salesAPI.getScripts({ pageSize: 1000 }); setScripts(res.list || []); }
    catch {}
  };

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) { await salesAPI.updateCall(editing.id, values); message.success('更新成功'); }
      else { await salesAPI.createCall(values); message.success('创建成功'); }
      setModalOpen(false); fetchList(); fetchStats();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const handleDelete = async (id) => { await salesAPI.deleteCall(id); message.success('删除成功'); fetchList(); fetchStats(); };
  const handleDeleteFile = async (id) => { await salesAPI.updateCall(id, { file_url: '' }); message.success('附件已删除'); fetchList(); };

  const openDetail = async (id) => {
    try { const res = await salesAPI.getCall(id); setDetail(res); setDetailOpen(true); setReviewText(''); setReviewRating(3); }
    catch { message.error('加载失败'); }
  };

  const handleAddReview = async () => {
    if (!reviewText) { message.warning('请输入点评内容'); return; }
    try {
      await salesAPI.addCallReview(detail.id, { comment: reviewText, rating: reviewRating });
      message.success('点评成功');
      openDetail(detail.id);
    } catch { message.error('点评失败'); }
  };

  const columns = [
    { title: '客户', dataIndex: 'customer_name', key: 'customer_name', width: 120 },
    { title: '销售', dataIndex: 'user_name', key: 'user_name', width: 80 },
    { title: '时长', dataIndex: 'duration_minutes', key: 'duration_minutes', width: 70, render: (v) => v ? `${v}分钟` : '-' },
    { title: '内容摘要', dataIndex: 'content', key: 'content', ellipsis: true, render: (v) => v?.slice(0, 60) },
    { title: '自我复盘', dataIndex: 'self_review', key: 'self_review', ellipsis: true, width: 120, render: (v) => v?.slice(0, 30) || '-' },
    { title: '点评数', dataIndex: 'review_count', key: 'review_count', width: 70 },
    { title: '附件', dataIndex: 'file_url', key: 'file_url', width: 120, render: (v, r) => v ? <FileLink fileUrl={v} onDelete={isAdmin ? () => handleDeleteFile(r.id) : undefined} /> : null },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 150, render: (v) => v?.slice(0, 16) },
    {
      title: '操作', key: 'action', width: 200, render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>详情</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <>
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card><Statistic title="今日通话" value={stats.todayCount} suffix="通" /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="本周通话" value={stats.weekCount} suffix="通" /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="累计通话" value={stats.totalCount} suffix="通" /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="累计时长" value={stats.totalDuration} suffix="分钟" /></Card></Col>
        </Row>
      )}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Input.Search value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={handleSearch} placeholder="搜索客户/通话内容" style={{ width: 280 }} allowClear />
            {isAdmin && (
              <Select value={filterUserId} onChange={v => { setFilterUserId(v); setPage(1); }} style={{ width: 160 }} allowClear placeholder="按销售筛选">
                {users.map(u => <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>)}
              </Select>
            )}
            <Button icon={<ClearOutlined />} onClick={handleClear}>清空筛选</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>记录通话</Button>
          </Space>
        </Space>
      </Card>
      <Table columns={columns} dataSource={list} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={editing ? '编辑通话记录' : '记录通话'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={700}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_id" label="选择客户">
                <Select showSearch allowClear placeholder="搜索客户" filterOption={(input, option) => option.children?.toLowerCase().includes(input.toLowerCase())}>
                  {customers.map(c => <Select.Option key={c.id} value={c.id}>{c.company_name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customer_name" label="客户名称"><Input placeholder="手动输入" /></Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="duration_minutes" label="通话时长(分钟)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="scenario_id" label="场景"><Select placeholder="选择场景" options={[
                { value: 1, label: '初次电话' }, { value: 2, label: '跟进回访' }, { value: 3, label: '报价沟通' },
                { value: 4, label: '异议处理' }, { value: 5, label: '促成成交' }, { value: 6, label: '其他' },
              ]} /></Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="script_id" label="使用话术">
                <Select showSearch allowClear placeholder="选择话术" filterOption={(input, option) => option.children?.toLowerCase().includes(input.toLowerCase())}>
                  {scripts.map(s => <Select.Option key={s.id} value={s.id}>{s.title}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="content" label="通话内容" rules={[{ required: true }]}><TextArea rows={5} placeholder="通话的主要内容..." /></Form.Item>
          <Form.Item name="customer_response" label="客户反应"><TextArea rows={2} placeholder="客户说了什么，态度如何..." /></Form.Item>
          <Form.Item name="self_review" label="自我复盘"><TextArea rows={2} placeholder="哪里做得好，哪里需要改进..." /></Form.Item>
          <Form.Item name="next_steps" label="下一步计划"><TextArea rows={2} placeholder="下一步做什么..." /></Form.Item>
          <Form.Item name="file_url" label="附件（录音/截图）"><UploadBtn /></Form.Item>
        </Form>
      </Modal>

      <Modal title="通话详情" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={800}>
        {detail && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Text strong>客户：</Text>{detail.customer_name || '-'}</Col>
              <Col span={8}><Text strong>销售：</Text>{detail.user_name}</Col>
              <Col span={8}><Text strong>时长：</Text>{detail.duration_minutes}分钟</Col>
            </Row>
            <Card size="small" title="通话内容" style={{ marginBottom: 12 }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</Paragraph>
            </Card>
            <Card size="small" title="客户反应" style={{ marginBottom: 12 }}>
              <Paragraph>{detail.customer_response || '-'}</Paragraph>
            </Card>
            <Card size="small" title="自我复盘" style={{ marginBottom: 12 }}>
              <Paragraph>{detail.self_review || '-'}</Paragraph>
            </Card>
            <Card size="small" title="下一步计划" style={{ marginBottom: 12 }}>
              <Paragraph>{detail.next_steps || '-'}</Paragraph>
            </Card>

            {detail.reviews?.length > 0 && (
              <Card size="small" title={`点评 (${detail.reviews.length})`} style={{ marginBottom: 12 }}>
                {detail.reviews.map((r, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < detail.reviews.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    <Space><Text strong>{r.reviewer_name}</Text><Rate disabled value={r.rating} style={{ fontSize: 14 }} /></Space>
                    <Paragraph style={{ marginTop: 4 }}>{r.comment}</Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.created_at?.slice(0, 16)}</Text>
                  </div>
                ))}
              </Card>
            )}

            <Card size="small" title="添加点评">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Rate value={reviewRating} onChange={setReviewRating} />
                <TextArea rows={3} value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="输入点评内容..." />
                <Button type="primary" onClick={handleAddReview}>提交点评</Button>
              </Space>
            </Card>
          </div>
        )}
      </Modal>
    </>
  );
}

export default CallsTab;