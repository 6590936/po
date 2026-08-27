// 销售管理中心 - 培训资料 / 话术库 / 新人培训 / 通话反馈 / 数据看板
import React, { useState, useEffect } from 'react';
import { Tabs, Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Row, Col, Statistic, Progress, Typography, InputNumber, Rate, Tooltip, DatePicker, Upload } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled, EyeOutlined, PhoneOutlined, TeamOutlined, BookOutlined, TrophyOutlined, BulbOutlined, UserOutlined, ClearOutlined, UploadOutlined, DownloadOutlined, FilePdfOutlined, FileExcelOutlined, FileWordOutlined, FilePptOutlined, FileOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { salesAPI, authAPI, customerAPI } from '../api';
import useAuthStore from '../store/authStore';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 文件图标映射
const FILE_ICON_MAP = {
  '.pdf': <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />,
  '.xls': <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
  '.xlsx': <FileExcelOutlined style={{ color: '#52c41a', fontSize: 18 }} />,
  '.doc': <FileWordOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
  '.docx': <FileWordOutlined style={{ color: '#1890ff', fontSize: 18 }} />,
  '.ppt': <FilePptOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
  '.pptx': <FilePptOutlined style={{ color: '#fa8c16', fontSize: 18 }} />,
};

// 文件预览弹窗
function FilePreviewModal({ open, fileUrl, fileName, onClose }) {
  if (!open) return null;
  const ext = (fileName || fileUrl || '').split('.').pop()?.toLowerCase();

  // PDF 直接内嵌预览
  if (ext === 'pdf') {
    return (
      <Modal open={open} onCancel={onClose} footer={null} width="90%" title={fileName || 'PDF预览'} style={{ top: 20 }}>
        <iframe src={fileUrl} style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none' }} />
      </Modal>
    );
  }

  // Office 文件用本地转换预览
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    const token = useAuthStore.getState().token;
    const previewUrl = `/api/sales/preview?file=${encodeURIComponent(fileUrl)}&token=${encodeURIComponent(token)}`;
    return (
      <Modal open={open} onCancel={onClose} footer={null} width="90%" title={fileName || '文件预览'} style={{ top: 20 }}>
        <iframe src={previewUrl} style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none' }} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={fileName || '文件预览'}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <FileOutlined style={{ fontSize: 48, color: '#999' }} />
        <p style={{ marginTop: 16 }}>此文件类型不支持预览</p>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">下载查看</a>
      </div>
    </Modal>
  );
}

// 文件链接渲染（含预览、下载、删除）
function FileLink({ fileUrl, fileName, onDelete }) {
  if (!fileUrl) return null;
  const ext = (fileName || fileUrl).split('.').pop()?.toLowerCase();
  const icon = FILE_ICON_MAP['.' + ext] || <FileOutlined />;
  const [previewOpen, setPreviewOpen] = useState(false);
  const displayName = fileName || fileUrl.split('/').pop();
  return (
    <>
      <Space size={4}>
        {icon}
        <a onClick={() => setPreviewOpen(true)} style={{ cursor: 'pointer' }}>{displayName}</a>
        <Tooltip title="下载"><a href={fileUrl} download={displayName}><DownloadOutlined /></a></Tooltip>
        {onDelete && (
          <Popconfirm title="确定删除附件？" onConfirm={() => onDelete()}>
            <a style={{ color: '#ff4d4f' }}><CloseCircleOutlined /></a>
          </Popconfirm>
        )}
      </Space>
      <FilePreviewModal open={previewOpen} fileUrl={fileUrl} fileName={displayName} onClose={() => setPreviewOpen(false)} />
    </>
  );
}

// 上传按钮组件
function UploadBtn({ value, onChange, accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx', maxSize = 50 }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (info) => {
    if (info.file.status === 'uploading') { setUploading(true); return; }
    if (info.file.status === 'done') {
      setUploading(false);
      const res = info.file.response;
      if (res.url) { onChange?.(res.url, res.name); message.success('上传成功'); }
      else { message.error(res.error || '上传失败'); }
    } else if (info.file.status === 'error') {
      setUploading(false); message.error('上传失败');
    }
  };
  const beforeUpload = (file) => {
    const isLt = file.size / 1024 / 1024 < maxSize;
    if (!isLt) { message.error(`文件不能超过${maxSize}MB`); return false; }
    return true;
  };
  return (
    <Space>
      <Upload customRequest={({ file, onSuccess, onError }) => {
        salesAPI.upload(file).then(res => {
          if (res.url) onSuccess(res, file);
          else onError(new Error(res.error));
        }).catch(onError);
      }} showUploadList={false} beforeUpload={beforeUpload} onChange={handleUpload} accept={accept}>
        <Button icon={<UploadOutlined />} loading={uploading}>{value ? '重新上传' : '上传文件'}</Button>
      </Upload>
      {value && <FileLink fileUrl={value} onDelete={() => onChange?.('', '')} />}
    </Space>
  );
}

const MATERIAL_CATEGORIES = [
  { value: 'product', label: '产品知识' },
  { value: 'industry', label: '行业知识' },
  { value: 'process', label: '公司流程' },
  { value: 'software', label: '软件操作' },
  { value: 'compliance', label: '合规要求' },
  { value: 'other', label: '其他' },
];

const TASK_TYPES = [
  { value: 'study', label: '学习资料' },
  { value: 'memorize', label: '背诵话术' },
  { value: 'practice', label: '模拟实操' },
  { value: 'real_call', label: '真实通话' },
  { value: 'quiz', label: '考核测验' },
];

function SalesManagement() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user.role === 'admin' || user.role === 'manager';
  const [activeTab, setActiveTab] = useState('materials');

  return (
    <div>
      <Title level={3} style={{ marginBottom: 16 }}>销售管理中心</Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" items={[
        { key: 'materials', label: <span><BookOutlined /> 培训资料库</span>, children: <MaterialsTab isAdmin={isAdmin} /> },
        { key: 'scripts', label: <span><TrophyOutlined /> 话术库</span>, children: <ScriptsTab isAdmin={isAdmin} /> },
        { key: 'onboarding', label: <span><UserOutlined /> 新人培训</span>, children: <OnboardingTab isAdmin={isAdmin} /> },
        { key: 'calls', label: <span><PhoneOutlined /> 通话反馈</span>, children: <CallsTab isAdmin={isAdmin} /> },
        { key: 'feedback', label: <span><BulbOutlined /> 反馈总结</span>, children: <FeedbackTab isAdmin={isAdmin} /> },
        { key: 'dashboard', label: <span><EyeOutlined /> 数据看板</span>, children: <SalesDashboard /> },
      ]} />
    </div>
  );
}

// ==================== 培训资料库 ====================
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
          <Form.Item name="file_url" label="附件">
            <UploadBtn />
          </Form.Item>
          <Form.Item name="is_pinned" label="置顶" valuePropName="checked"><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
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

// ==================== 话术库 ====================
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
      if (showFavorites) { res = { list: await salesAPI.getFavorites(), total: 0 }; }
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

// ==================== 新人培训 ====================
function OnboardingTab({ isAdmin }) {
  const [plans, setPlans] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [summary, setSummary] = useState([]);
  const [allSummary, setAllSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planKeyword, setPlanKeyword] = useState('');
  const [summaryKeyword, setSummaryKeyword] = useState('');
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm] = Form.useForm();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState(null);
  const [assignUserId, setAssignUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [progressUserId, setProgressUserId] = useState(null);
  const [progress, setProgress] = useState(null);

  useEffect(() => { fetchPlans(); fetchSummary(); if (isAdmin) fetchUsers(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try { const res = await salesAPI.getOnboardingPlans(); setAllPlans(res); setPlans(res); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const fetchSummary = async () => {
    try { const res = await salesAPI.getOnboardingSummary(); setAllSummary(res); setSummary(res); }
    catch {}
  };

  const handlePlanSearch = (v) => {
    setPlanKeyword(v);
    if (!v) { setPlans(allPlans); return; }
    setPlans(allPlans.filter(p => p.title?.toLowerCase().includes(v.toLowerCase()) || p.description?.toLowerCase().includes(v.toLowerCase())));
  };

  const handleSummarySearch = (v) => {
    setSummaryKeyword(v);
    if (!v) { setSummary(allSummary); return; }
    setSummary(allSummary.filter(s => s.name?.toLowerCase().includes(v.toLowerCase())));
  };

  const fetchUsers = async () => {
    try {
      const res = await authAPI.getUsers();
      setUsers(res.filter(u => u.role === 'sales'));
    } catch {
      // 非管理员无权限，忽略
    }
  };

  const openCreatePlan = () => { setEditingPlan(null); planForm.resetFields(); setPlanModalOpen(true); };
  const openEditPlan = (plan) => { setEditingPlan(plan); planForm.setFieldsValue({ ...plan, tasks: plan.tasks || [] }); setPlanModalOpen(true); };

  const handleSavePlan = async () => {
    try {
      const values = await planForm.validateFields();
      const data = { ...values, duration_days: values.duration_days || 14 };
      if (editingPlan) { await salesAPI.updateOnboardingPlan(editingPlan.id, data); message.success('更新成功'); }
      else { await salesAPI.createOnboardingPlan(data); message.success('创建成功'); }
      setPlanModalOpen(false); fetchPlans();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const handleDeletePlan = async (id) => { await salesAPI.deleteOnboardingPlan(id); message.success('删除成功'); fetchPlans(); };

  const openAssign = (planId) => { setAssignPlanId(planId); setAssignUserId(null); setAssignModalOpen(true); };
  const handleAssign = async () => {
    if (!assignUserId) { message.warning('请选择销售'); return; }
    try {
      await salesAPI.assignOnboarding({ user_id: assignUserId, plan_id: assignPlanId });
      message.success('分配成功');
      setAssignModalOpen(false); fetchSummary();
    } catch { message.error('分配失败'); }
  };

  const openProgress = async (userId) => {
    setProgressUserId(userId);
    try {
      const res = await salesAPI.getOnboardingProgress(userId);
      setProgress(res);
      setProgressModalOpen(true);
    } catch { message.error('加载失败'); }
  };

  const handleTaskComplete = async (taskId) => {
    await salesAPI.updateOnboardingTask(taskId, { status: 'completed' });
    message.success('任务完成');
    openProgress(progressUserId);
    fetchSummary();
  };

  const handleTaskReview = async (taskId, score, comment) => {
    await salesAPI.updateOnboardingTask(taskId, { score, mentor_comment: comment });
    message.success('点评成功');
    openProgress(progressUserId);
  };

  return (
    <>
      {isAdmin && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePlan}>新建培训计划</Button>
          </Space>
        </Card>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Input.Search value={summaryKeyword} onChange={e => handleSummarySearch(e.target.value)} placeholder="搜索培训人员..." style={{ width: 280 }} allowClear />
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        {summary.map((s) => (
          <Col key={s.id} xs={24} sm={12} md={8} style={{ marginBottom: 16 }}>
            <Card size="small" hoverable onClick={() => openProgress(s.id)}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>{s.name}</Text>
                <Progress percent={s.percent} size="small" status={s.percent === 100 ? 'success' : 'active'} />
                <Text type="secondary">{s.completed}/{s.total} 任务完成</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title={<Space><Text>培训计划列表</Text><Input.Search value={planKeyword} onChange={e => handlePlanSearch(e.target.value)} placeholder="搜索计划..." style={{ width: 200 }} allowClear /></Space>}>
        <Table dataSource={plans} rowKey="id" loading={loading} columns={[
          { title: '计划名称', dataIndex: 'title', key: 'title' },
          { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
          { title: '培训天数', dataIndex: 'duration_days', key: 'duration_days', width: 80 },
          { title: '任务数', dataIndex: 'tasks', key: 'tasks', width: 80, render: (v) => v?.length || 0 },
          { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '启用' : '停用'}</Tag> },
          {
            title: '操作', key: 'action', width: 260, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => openAssign(r.id)}>分配</Button>
                {isAdmin && <Button size="small" icon={<EditOutlined />} onClick={() => openEditPlan(r)}>编辑</Button>}
                {isAdmin && <Popconfirm title="确定删除？" onConfirm={() => handleDeletePlan(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>}
              </Space>
            )
          },
        ]} pagination={false} />
      </Card>

      <Modal title={editingPlan ? '编辑培训计划' : '新建培训计划'} open={planModalOpen} onOk={handleSavePlan} onCancel={() => setPlanModalOpen(false)} width={800}>
        <Form form={planForm} layout="vertical">
          <Form.Item name="title" label="计划名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="计划描述"><TextArea rows={2} /></Form.Item>
          <Form.Item name="duration_days" label="培训天数" initialValue={14}><InputNumber min={1} max={90} /></Form.Item>
          <Form.List name="tasks">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Card key={key} size="small" style={{ marginBottom: 8 }} title={`任务 ${name + 1}`}
                    extra={<Button size="small" danger onClick={() => remove(name)}>删除</Button>}>
                    <Row gutter={12}>
                      <Col span={4}><Form.Item {...rest} name={[name, 'day_number']} label="天数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item {...rest} name={[name, 'title']} label="任务标题" rules={[{ required: true }]}><Input /></Form.Item></Col>
                      <Col span={6}><Form.Item {...rest} name={[name, 'task_type']} label="类型" initialValue="study"><Select options={TASK_TYPES} /></Form.Item></Col>
                      <Col span={6}><Form.Item {...rest} name={[name, 'description']} label="任务说明"><Input /></Form.Item></Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ day_number: 1, task_type: 'study' })} block icon={<PlusOutlined />}>添加任务</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal title="分配培训计划" open={assignModalOpen} onOk={handleAssign} onCancel={() => setAssignModalOpen(false)}>
        <Select value={assignUserId} onChange={setAssignUserId} style={{ width: '100%' }} placeholder="选择销售">
          {users.map(u => <Select.Option key={u.id} value={u.id}>{u.name} ({u.username})</Select.Option>)}
        </Select>
      </Modal>

      <Modal title={`培训进度 - ${progress?.planTitle || ''}`} open={progressModalOpen} onCancel={() => setProgressModalOpen(false)} footer={null} width={700}>
        {progress && (
          <>
            <Progress percent={progress.percent} style={{ marginBottom: 16 }} />
            <Table dataSource={progress.progress} rowKey="id" pagination={false} columns={[
              { title: '天数', dataIndex: 'day_number', width: 60 },
              { title: '任务', dataIndex: 'task_title' },
              { title: '类型', dataIndex: 'task_type', width: 80, render: (v) => <Tag>{TASK_TYPES.find(t => t.value === v)?.label || v}</Tag> },
              { title: '状态', dataIndex: 'status', width: 80, render: (v) => <Tag color={v === 'completed' ? 'green' : 'orange'}>{v === 'completed' ? '已完成' : '待完成'}</Tag> },
              { title: '评分', dataIndex: 'score', width: 60, render: (v) => v || '-' },
              { title: '点评', dataIndex: 'mentor_comment', ellipsis: true },
              {
                title: '操作', key: 'action', width: 120, render: (_, r) => (
                  r.status !== 'completed' ? (
                    <Button size="small" type="primary" onClick={() => handleTaskComplete(r.id)}>完成</Button>
                  ) : (
                    <Tooltip title="主管点评">
                      <Button size="small" onClick={() => {
                        const score = prompt('评分(1-5)', '3');
                        const comment = prompt('点评内容', '');
                        if (score) handleTaskReview(r.id, Number(score), comment || '');
                      }}>评分</Button>
                    </Tooltip>
                  )
                )
              },
            ]} />
          </>
        )}
      </Modal>
    </>
  );
}

// ==================== 通话反馈 ====================
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

// ==================== 反馈总结 ====================
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

// ==================== 数据看板 ====================
function SalesDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await salesAPI.getSalesDashboard(); setData(res); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  if (loading || !data) return <Card loading={loading} />;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="今日通话" value={data.todayCalls} suffix="通" prefix={<PhoneOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="今日反馈" value={data.todayFeedbacks} suffix="条" prefix={<BulbOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="在训新人" value={data.activeTrainees} suffix="人" prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="已完成培训" value={data.completedTrainees} suffix="人" prefix={<TrophyOutlined />} /></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="热门话术 Top 5" size="small" style={{ marginBottom: 16 }}>
            {data.topScripts?.length > 0 ? data.topScripts.map((s, i) => (
              <div key={s.id} style={{ padding: '8px 0', borderBottom: i < data.topScripts.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <Space>
                  <Tag color={i === 0 ? 'gold' : i === 1 ? 'silver' : 'default'}>{i + 1}</Tag>
                  <Text>{s.title}</Text>
                  <Tag color="blue">{s.scene_name}</Tag>
                  <Text type="secondary">使用 {s.usage_count} 次</Text>
                </Space>
              </div>
            )) : <Text type="secondary">暂无数据</Text>}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="热门资料 Top 5" size="small" style={{ marginBottom: 16 }}>
            {data.topMaterials?.length > 0 ? data.topMaterials.map((m, i) => (
              <div key={m.id} style={{ padding: '8px 0', borderBottom: i < data.topMaterials.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <Space>
                  <Tag color={i === 0 ? 'gold' : 'default'}>{i + 1}</Tag>
                  <Text>{m.title}</Text>
                  <Tag>{MATERIAL_CATEGORIES.find(c => c.value === m.category)?.label}</Tag>
                  <Text type="secondary">浏览 {m.view_count} 次</Text>
                </Space>
              </div>
            )) : <Text type="secondary">暂无数据</Text>}
          </Card>
        </Col>
      </Row>

      <Card title="本周通话趋势" size="small" style={{ marginBottom: 16 }}>
        {data.weeklyCalls?.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {data.weeklyCalls.map((d, i) => (
              <Tooltip key={i} title={`${d.day}: ${d.cnt} 通`}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11 }}>{d.cnt}</Text>
                  <div style={{ width: '100%', maxWidth: 40, height: Math.max(d.cnt * 8, 4), background: '#1890ff', borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                  <Text style={{ fontSize: 10, marginTop: 4 }}>{d.day?.slice(5)}</Text>
                </div>
              </Tooltip>
            ))}
          </div>
        ) : <Text type="secondary">暂无数据</Text>}
      </Card>

      <Card title="常见问题汇总" size="small">
        {data.commonProblems?.length > 0 ? data.commonProblems.map((p, i) => (
          <Tag key={i} style={{ marginBottom: 8 }}>{p.slice(0, 60)}{p.length > 60 ? '...' : ''}</Tag>
        )) : <Text type="secondary">暂无数据</Text>}
      </Card>
    </div>
  );
}

export default SalesManagement;