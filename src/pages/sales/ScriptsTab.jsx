import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import { salesAPI } from '../../api';
import FileLink from './FileLink';
import UploadBtn from './UploadBtn';

const { Text } = Typography;
const { TextArea } = Input;

function ScriptsTab({ isAdmin }) {
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [sceneCategory, setSceneCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [scenes, setScenes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => { fetchList(); fetchScenes(); }, [page, sceneCategory, showFavorites]);

  const fetchScenes = async () => {
    try { const res = await salesAPI.getScriptScenes(); setScenes(res); } catch {}
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      let res;
      if (showFavorites) { const favs = await salesAPI.getFavorites(); res = { list: favs.list || [], total: favs.total || 0 }; }
      else { res = await salesAPI.getScripts({ scene_category: sceneCategory, keyword, page, pageSize: 20 }); }
      setList(res.list);
      setTotal(res.total || 0);
    } catch (e) { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const handleSearch = () => { setPage(1); fetchList(); };
  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) { await salesAPI.updateScript(editing.id, values); message.success('更新成功'); }
      else { await salesAPI.createScript(values); message.success('创建成功'); }
      setModalOpen(false); fetchList();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const handleDelete = async (id) => { await salesAPI.deleteScript(id); message.success('删除成功'); fetchList(); };
  const handleDeleteFile = async (id) => { await salesAPI.updateScript(id, { file_url: '' }); message.success('附件已删除'); fetchList(); };

  const handleFavorite = async (id) => {
    try {
      const res = await salesAPI.toggleFavorite(id);
      message.success(res.favorited ? '已收藏' : '已取消收藏');
      fetchList();
    } catch { message.error('操作失败'); }
  };

  const openDetail = async (id) => {
    try { const res = await salesAPI.getScript(id); setDetail(res); setDetailOpen(true); } catch { message.error('加载失败'); }
  };

  const columns = [
    { title: '话术标题', dataIndex: 'title', key: 'title', render: (t, r) => <a onClick={() => openDetail(r.id)}>{t}</a> },
    { title: '场景', dataIndex: 'scene_name', key: 'scene_name', width: 120, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: '适用客户', dataIndex: 'target_customer_type', key: 'target_customer_type', width: 100 },
    { title: '使用次数', dataIndex: 'usage_count', key: 'usage_count', width: 80 },
    { title: '附件', dataIndex: 'file_url', key: 'file_url', width: 140, render: (v, r) => v ? <FileLink fileUrl={v} onDelete={isAdmin ? () => handleDeleteFile(r.id) : undefined} /> : null },
    { title: '作者', dataIndex: 'author_name', key: 'author_name', width: 80 },
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 150, render: (v) => v?.slice(0, 16) },
    { title: '操作', key: 'action', width: 200, render: (_, r) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r.id)}>查看</Button>
        <Button size="small" icon={r.is_favorite ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={() => handleFavorite(r.id)}>
          {r.is_favorite ? '已收藏' : '收藏'}
        </Button>
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
            <Tag.CheckableTag checked={!sceneCategory} onChange={() => { setSceneCategory(''); setPage(1); }}>
              全部
            </Tag.CheckableTag>
            {scenes.map(s => (
              <Tag.CheckableTag key={s.key} checked={sceneCategory === s.key} onChange={() => { setSceneCategory(sceneCategory === s.key ? '' : s.key); setPage(1); }}>
                {s.icon} {s.name}
              </Tag.CheckableTag>
            ))}
          </Space>
          <Space>
            <Input.Search value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={handleSearch} placeholder="搜索话术" style={{ width: 280 }} allowClear />
            <Button onClick={() => { setShowFavorites(!showFavorites); setPage(1); }} type={showFavorites ? 'primary' : 'default'}>
              {showFavorites ? '我的收藏' : '全部话术'}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建话术</Button>
          </Space>
        </Space>
      </Card>
      <Table columns={columns} dataSource={list} rowKey="id" loading={loading}
        pagination={showFavorites ? false : { current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `共 ${t} 条` }} />

      <Modal title={editing ? '编辑话术' : '新建话术'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={700}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="话术标题" rules={[{ required: true }]}><Input placeholder="如：初次电话-国际物流话术" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="scene_category" label="场景分类" initialValue="first_call">
                <Select options={scenes.map(s => ({ value: s.key, label: s.icon + ' ' + s.name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scene_name" label="场景名称"><Input placeholder="自定义场景名" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="script_content" label="话术内容" rules={[{ required: true }]}>
            <TextArea rows={8} placeholder="对话脚本内容..." />
          </Form.Item>
          <Form.Item name="notes" label="注意事项"><TextArea rows={3} placeholder="使用注意事项..." /></Form.Item>
          <Form.Item name="file_url" label="附件"><UploadBtn /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="target_customer_type" label="适用客户类型"><Input placeholder="如：新客户、老客户、大客户" /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="keywords" label="关键词"><Input placeholder="逗号分隔，如：太贵了,价格高" /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={detail?.title} open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={800}>
        {detail && (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Tag color="blue">{detail.scene_name}</Tag>
              <Tag>{detail.target_customer_type || '通用'}</Tag>
              <Text type="secondary">作者：{detail.author_name} | 使用 {detail.usage_count} 次</Text>
            </Space>
            <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, minHeight: 150, background: '#fafafa', marginBottom: 12 }}>
              {detail.script_content}
            </div>
            {detail.notes && (
              <Card size="small" title="注意事项" style={{ marginBottom: 12 }}>
                <Text type="warning">{detail.notes}</Text>
              </Card>
            )}
            {detail.keywords && <Text type="secondary">关键词：{detail.keywords}</Text>}
          </div>
        )}
      </Modal>
    </>
  );
}

export default ScriptsTab;