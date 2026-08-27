import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Space, message, Popconfirm, Typography, Row, Col, Progress, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { salesAPI, authAPI } from '../../api';
import { TASK_TYPES } from './constants.jsx';

const { Text } = Typography;
const { TextArea } = Input;

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
    try { const res = await salesAPI.getOnboardingPlans(); setAllPlans(res.list || []); setPlans(res.list || []); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  const fetchSummary = async () => {
    try { const res = await salesAPI.getOnboardingSummary(); setAllSummary(res.list || []); setSummary(res.list || []); }
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
    } catch {}
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

export default OnboardingTab;