import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { salesAPI } from '../../api';
import FileLink from './FileLink';
import UploadBtn from './UploadBtn';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

function FeedbackTab({ isAdmin }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => { fetchList(); }, [page]);

  const fetchList = async () => {
    setLoading(true);
    try { const res = await salesAPI.getFeedbackList({ keyword, page, pageSize: 20 }); setList(res.list); setTotal(res.total); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); fetchList(); };

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({ ...record, related_call_ids: typeof record.related_call_ids === 'string' ? JSON.parse(record.related_call_ids) : record.related_call_ids });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) { await salesAPI.updateFeedback(editing.id, values); message.success('更新成功'); }
      else { await salesAPI.createFeedback(values); message.success('创建成功'); }
      setModalOpen(false); fetchList();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const handleDelete = async (id) => { await salesAPI.deleteFeedback(id); message.success('删除成功'); fetchList(); };
  const handleDeleteFile = async (id) => { await salesAPI.updateFeedback(id, { file_url: '' }); message.success('附件已删除'); fetchList(); };

  const openDetail = async (id) => {
    try { const res = await salesAPI.getFeedback(id); setDetail(res); setDetailOpen(true); }
    catch { message.error('加载失败'); }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (t, r) => <a onClick={() => openDetail(r.id)}>{t}</a> },
    { title: '作者', dataIndex: 'user_name', key: 'user_name', width: 80 },
    { title: '经验教训', dataIndex: 'lessons_learned', key: 'lessons_learned', ellipsis: true, render: (v) => v?.slice(0, 50) || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v) => <Tag color={v === 'published' ? 'green' : 'default'}>{v === 'published' ? '已发布' : '草稿'}</Tag> },
    { title: '附件', dataIndex: 'file_url', key: 'file_url', width: 120, render: (v, r) => v ? <FileLink fileUrl={v} onDelete={isAdmin ? () => handleDeleteFile(r.id) : undefined} /> : null },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 150, render: (v) => v?.slice(0, 16) },
    {
      title: '操作', key: 'action', width: 180, render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>查看</Button>
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
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input.Search value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={handleSearch} placeholder="搜索总结标题/内容" style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建总结</Button>
        </Space>
      </Card>
      <Table columns={columns} dataSource={list} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={editing ? '编辑反馈总结' : '新建反馈总结'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={700}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input placeholder="本次总结的标题" /></Form.Item>
          <Form.Item name="content" label="总结内容"><TextArea rows={5} placeholder="详细描述遇到的问题和解决方案..." /></Form.Item>
          <Form.Item name="lessons_learned" label="经验教训"><TextArea rows={3} placeholder="总结出的经验教训..." /></Form.Item>
          <Form.Item name="action_items" label="改进措施"><TextArea rows={3} placeholder="后续的改进措施..." /></Form.Item>
          <Form.Item name="file_url" label="附件"><UploadBtn /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft">
            <Select options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '发布' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={detail?.title} open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={800}>
        {detail && (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Text type="secondary">作者：{detail.user_name} | {detail.updated_at?.slice(0, 16)}</Text>
              <Tag color={detail.status === 'published' ? 'green' : 'default'}>{detail.status === 'published' ? '已发布' : '草稿'}</Tag>
            </Space>
            <Card size="small" title="总结内容" style={{ marginBottom: 12 }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detail.content || '-'}</Paragraph>
            </Card>
            <Card size="small" title="经验教训" style={{ marginBottom: 12 }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detail.lessons_learned || '-'}</Paragraph>
            </Card>
            <Card size="small" title="改进措施">
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detail.action_items || '-'}</Paragraph>
            </Card>
          </div>
        )}
      </Modal>
    </>
  );
}

export default FeedbackTab;