import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { salesAPI } from '../../api';
import { MATERIAL_CATEGORIES } from './constants.jsx';
import FileLink from './FileLink';
import UploadBtn from './UploadBtn';

const { Text } = Typography;
const { TextArea } = Input;

function MaterialsTab({ isAdmin }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => { fetchList(); }, [page, category]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await salesAPI.getMaterials({ category, keyword, page, pageSize: 20 });
      setList(res.list);
      setTotal(res.total);
    } catch (e) { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); fetchList(); };

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) { await salesAPI.updateMaterial(editing.id, values); message.success('更新成功'); }
      else { await salesAPI.createMaterial(values); message.success('创建成功'); }
      setModalOpen(false); fetchList();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const handleDelete = async (id) => {
    await salesAPI.deleteMaterial(id);
    message.success('删除成功');
    fetchList();
  };

  const handleDeleteFile = async (id) => {
    await salesAPI.updateMaterial(id, { file_url: '' });
    message.success('附件已删除');
    fetchList();
  };

  const openDetail = async (id) => {
    try {
      const res = await salesAPI.getMaterial(id);
      setDetail(res);
      setDetailOpen(true);
      fetchList();
    } catch (e) { message.error('加载失败'); }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (t, r) => (
      <span>
        {r.is_pinned ? <Tag color="red" style={{ marginRight: 4 }}>置顶</Tag> : null}
        <a onClick={() => openDetail(r.id)}>{t}</a>
      </span>
    )},
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (v) => {
      const cat = MATERIAL_CATEGORIES.find(c => c.value === v);
      return <Tag>{cat?.label || v}</Tag>;
    } },
    { title: '附件', dataIndex: 'file_url', key: 'file_url', width: 160, render: (v, r) => v ? <FileLink fileUrl={v} onDelete={isAdmin ? () => handleDeleteFile(r.id) : undefined} /> : null },
    { title: '作者', dataIndex: 'author_name', key: 'author_name', width: 100 },
    { title: '浏览', dataIndex: 'view_count', key: 'view_count', width: 80 },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 170, render: (v) => v?.slice(0, 16) },
    { title: '操作', key: 'action', width: 180, render: (_, r) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>查看</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Tag.CheckableTag checked={!category} onChange={() => { setCategory(''); setPage(1); }}>
              全部
            </Tag.CheckableTag>
            {MATERIAL_CATEGORIES.map(c => (
              <Tag.CheckableTag key={c.value} checked={category === c.value} onChange={() => { setCategory(category === c.value ? '' : c.value); setPage(1); }}>
                {c.label}
              </Tag.CheckableTag>
            ))}
          </Space>
          <Space>
            <Input.Search value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={handleSearch} placeholder="搜索标题/内容" style={{ width: 280 }} allowClear />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建资料</Button>
          </Space>
        </Space>
      </Card>
      <Table columns={columns} dataSource={list} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={editing ? '编辑资料' : '新建资料'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={700}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="category" label="分类" initialValue="product"><Select options={MATERIAL_CATEGORIES} /></Form.Item>
          <Form.Item name="content" label="内容"><TextArea rows={10} placeholder="支持富文本..." /></Form.Item>
          <Form.Item name="file_url" label="附件"><UploadBtn /></Form.Item>
          <Form.Item name="is_pinned" label="置顶" valuePropName="checked">
            <Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={detail?.title} open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={800}>
        {detail && (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Tag>{MATERIAL_CATEGORIES.find(c => c.value === detail.category)?.label}</Tag>
              <Text type="secondary">作者：{detail.author_name} | 浏览：{detail.view_count} | {detail.updated_at?.slice(0, 16)}</Text>
            </Space>
            <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, minHeight: 200, background: '#fafafa' }}>
              {detail.content || '暂无内容'}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default MaterialsTab;