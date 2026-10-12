import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Input, Button, Tag, Space, Typography, Row, Col, Statistic,
  message, Select, Modal, Form, InputNumber, DatePicker, Popconfirm, Descriptions,
  Tabs, Upload, Tooltip,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, ExportOutlined, UploadOutlined,
  DownloadOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  DollarOutlined, CheckCircleOutlined, MinusCircleOutlined,
  FileExcelOutlined, ReloadOutlined, HistoryOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { shippingRatesAPI } from '../api';
import useAuthStore from '../store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const CARRIER_OPTIONS = [
  'COSCO', 'OOCL', 'KMTC', 'MSC', 'ONE', 'SML', 'EMC', 'YML', 'OA',
  'MSK', 'WHL', 'HPL', 'ZIM', 'PIL', 'CMA', 'HMM', 'SITC', 'MATSON',
].map(c => ({ label: c, value: c }));

function ShippingRates() {
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState({ page: 1, pageSize: 20, search: '', status: '' });
  const [filters, setFilters] = useState({ pols: [], pods: [], container_types: [] });
  const [importing, setImporting] = useState(false);

  // 销售看板
  const [activeRates, setActiveRates] = useState([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateFilter, setRateFilter] = useState({ pol: '', pod: '', container_type: '' });

  // 弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editingBatch, setEditingBatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // 详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // 报价单预览弹窗
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 供应商管理弹窗
  const [supplierVisible, setSupplierVisible] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierForm] = Form.useForm();
  const [supplierSaving, setSupplierSaving] = useState(false);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shippingRatesAPI.getBatches(params);
      setBatches(res.list || []);
      setTotal(res.total || 0);
    } catch (err) {
      message.error('加载报价批次失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const fetchActiveRates = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await shippingRatesAPI.getActiveRates(rateFilter);
      setActiveRates(res || []);
    } catch (err) {
      message.error('加载有效报价失败: ' + err.message);
    } finally {
      setRateLoading(false);
    }
  }, [rateFilter]);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await shippingRatesAPI.getFilters();
      setFilters(res || { pols: [], pods: [], container_types: [] });
    } catch (_) {}
  }, []);

  useEffect(() => { fetchBatches(); fetchFilters(); }, [fetchBatches, fetchFilters]);
  useEffect(() => { if (activeTab === 'active') fetchActiveRates(); }, [activeTab, fetchActiveRates]);

  // ==================== 批次管理 ====================

  const handleCreate = () => {
    setEditingBatch(null);
    setModalTitle('新增报价批次');
    form.resetFields();
    form.setFieldsValue({ valid_range: [dayjs(), dayjs().add(3, 'day')] });
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingBatch(record);
    setModalTitle('编辑报价批次');
    try {
      const res = await shippingRatesAPI.getBatch(record.id);
      const batch = res;
      form.setFieldsValue({
        pol: batch.pol,
        pod: batch.pod,
        container_type: batch.container_type,
        valid_range: [dayjs(batch.valid_from), dayjs(batch.valid_to)],
        notes: batch.notes,
        items: (batch.items || []).map(item => ({
          carrier_name: item.carrier_name,
          vessel_voyage: item.vessel_voyage,
          freight_rate: item.freight_rate,
          transit_days: item.transit_days || '',
          supplier_name: item.supplier_name,
          supplier_contact: item.supplier_contact,
          remarks: item.remarks,
        })),
      });
      setModalVisible(true);
    } catch (err) {
      message.error('获取批次详情失败: ' + err.message);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        pol: values.pol,
        pod: values.pod,
        container_type: values.container_type,
        valid_from: values.valid_range?.[0]?.format('YYYY-MM-DD') || '',
        valid_to: values.valid_range?.[1]?.format('YYYY-MM-DD') || '',
        notes: values.notes || '',
        items: (values.items || []).filter(i => i && i.carrier_name),
      };

      if (editingBatch) {
        await shippingRatesAPI.updateBatch(editingBatch.id, payload);
        message.success('更新成功');
      } else {
        await shippingRatesAPI.createBatch(payload);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchBatches();
    } catch (err) {
      if (err.errorFields) return;
      message.error('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await shippingRatesAPI.deleteBatch(id);
      message.success('删除成功');
      fetchBatches();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const handleStatus = async (id, status) => {
    try {
      await shippingRatesAPI.updateBatchStatus(id, status);
      message.success(status === 'active' ? '已激活' : '已设为过期');
      fetchBatches();
    } catch (err) {
      message.error('操作失败: ' + err.message);
    }
  };

  // ==================== Excel 导入 ====================

  const handleImport = async (file) => {
    setImporting(true);
    try {
      const result = await shippingRatesAPI.importExcel(file);
      if (result.success) {
        message.success(result.data?.message || '导入成功');
        fetchBatches();
      } else {
        message.error(result.error || '导入失败');
      }
    } catch (err) {
      message.error('导入失败: ' + err.message);
    } finally {
      setImporting(false);
    }
    return false;
  };

  // ==================== 供应商 ====================

  const handleSupplierManage = async () => {
    try {
      const res = await shippingRatesAPI.getSuppliers();
      setSuppliers(res || []);
      supplierForm.resetFields();
      setSupplierVisible(true);
    } catch (err) {
      message.error('加载订舱口列表失败');
    }
  };

  const handleAddSupplier = async () => {
    try {
      const values = await supplierForm.validateFields();
      setSupplierSaving(true);
      await shippingRatesAPI.createSupplier(values);
      message.success('添加成功');
      supplierForm.resetFields();
      const res = await shippingRatesAPI.getSuppliers();
      setSuppliers(res || []);
    } catch (err) {
      if (err.errorFields) return;
      message.error('添加失败');
    } finally {
      setSupplierSaving(false);
    }
  };

  const handleDeleteSupplier = async (id) => {
    try {
      await shippingRatesAPI.deleteSupplier(id);
      message.success('删除成功');
      const res = await shippingRatesAPI.getSuppliers();
      setSuppliers(res || []);
    } catch (err) {
      message.error('删除失败');
    }
  };

  // ==================== 表格列定义 ====================

  const batchColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '起运港', dataIndex: 'pol', width: 100, render: v => <Tag color="blue">{v}</Tag> },
    { title: '目的港', dataIndex: 'pod', width: 100, render: v => <Tag color="green">{v}</Tag> },
    { title: '箱型', dataIndex: 'container_type', width: 80, render: v => <Tag>{v}</Tag> },
    {
      title: '有效期', key: 'valid', width: 180,
      render: (_, r) => `${r.valid_from || '-'} ~ ${r.valid_to || '-'}`,
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: v => v === 'active' ? <Tag color="green" icon={<CheckCircleOutlined />}>有效</Tag> : <Tag color="default" icon={<MinusCircleOutlined />}>过期</Tag>,
    },
    { title: '报价数', dataIndex: 'item_count', width: 70, align: 'center' },
    { title: '录入人', dataIndex: 'created_by_name', width: 80 },
    { title: '备注', dataIndex: 'notes', ellipsis: true, width: 150 },
    {
      title: '操作', key: 'actions', width: 280, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="查看详情"><Button type="link" size="small" icon={<EyeOutlined />} onClick={async () => {
            try {
              const res = await shippingRatesAPI.getBatch(r.id);
              setDetailData(res);
              setDetailVisible(true);
            } catch (_) {}
          }} /></Tooltip>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} /></Tooltip>
          <Tooltip title="导出Excel"><Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => shippingRatesAPI.exportBatch(r.id)} /></Tooltip>
          {r.status === 'active' ? (
            <Popconfirm title="确认设为过期？" onConfirm={() => handleStatus(r.id, 'expired')}>
              <Button type="link" size="small" danger>过期</Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="确认重新激活？" onConfirm={() => handleStatus(r.id, 'active')}>
              <Button type="link" size="small">激活</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const getRateColumns = (batchId) => [
    { title: '船公司', dataIndex: 'carrier_name', width: 100, render: v => <Tag color="blue">{v}</Tag> },
    { title: '船名航次', dataIndex: 'vessel_voyage', width: 180 },
    { title: '海运费(USD)', dataIndex: 'freight_rate', width: 120, align: 'right', render: v => v ? <Text strong style={{ color: '#cf1322' }}>$ {v.toLocaleString()}</Text> : '-' },
    { title: '航程天数', dataIndex: 'transit_days', width: 90, render: v => v ? <Tag color="purple">{v}</Tag> : '-' },
    { title: '订舱口', dataIndex: 'supplier_name', width: 100 },
    { title: '联系人', dataIndex: 'supplier_contact', width: 80 },
    { title: '备注', dataIndex: 'remarks', width: 120, render: v => v ? <Tag color="orange">{v}</Tag> : '-' },
    {
      title: '操作', key: 'actions', width: 100, fixed: 'right',
      render: (_, r) => (
        <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => {
          console.log('点击报价单按钮', batchId, r.id);
          handlePreviewQuotation(batchId, r.id);
        }}>报价单</Button>
      ),
    },
  ];

  const handlePreviewQuotation = async (batchId, itemId) => {
    try {
      console.log('开始预览', batchId, itemId);
      setPreviewLoading(true);
      setPreviewData(null);
      setPreviewVisible(true);
      const res = await shippingRatesAPI.getQuotationPreview(batchId, itemId);
      console.log('预览数据', res);
      if (res) {
        setPreviewData(res);
      } else {
        message.error('数据格式错误');
        setPreviewVisible(false);
      }
    } catch (err) {
      console.error('预览失败', err);
      message.error(err.message || '预览失败');
      setPreviewVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadExcel = async (batchId, itemId) => {
    try {
      console.log('开始下载 Excel', { batchId, itemId });
      message.loading({ content: '正在生成报价单...', key: 'download', duration: 0 });

      const token = useAuthStore.getState().token;
      const url = itemId
        ? `/api/shipping-rates/batches/${batchId}/quotation?item_id=${itemId}`
        : `/api/shipping-rates/batches/${batchId}/quotation`;

      console.log('请求 URL:', url);

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('响应状态:', resp.status);

      if (!resp.ok) {
        const json = await resp.json();
        throw new Error(json.error || '生成失败');
      }

      const blob = await resp.blob();
      console.log('Blob 大小:', blob.size, '类型:', blob.type);

      if (blob.size === 0) {
        throw new Error('生成的文件为空');
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `报价单_${previewData?.carrier || '报价'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      message.success({ content: '报价单已下载', key: 'download', duration: 2 });
    } catch (err) {
      console.error('下载失败:', err);
      message.error({ content: err.message || '下载失败', key: 'download', duration: 3 });
    }
  };

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        <DollarOutlined /> 海运费报价管理
      </Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'active',
          label: <span><DollarOutlined /> 当前报价（销售看板）</span>,
          children: (
            <Card>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Select
                    placeholder="起运港" allowClear style={{ width: '100%' }}
                    value={rateFilter.pol || undefined}
                    onChange={v => setRateFilter(prev => ({ ...prev, pol: v || '' }))}
                    options={filters.pols.map(p => ({ label: p, value: p }))}
                  />
                </Col>
                <Col span={6}>
                  <Select
                    placeholder="目的港" allowClear style={{ width: '100%' }}
                    value={rateFilter.pod || undefined}
                    onChange={v => setRateFilter(prev => ({ ...prev, pod: v || '' }))}
                    options={filters.pods.map(p => ({ label: p, value: p }))}
                  />
                </Col>
                <Col span={6}>
                  <Select
                    placeholder="箱型" allowClear style={{ width: '100%' }}
                    value={rateFilter.container_type || undefined}
                    onChange={v => setRateFilter(prev => ({ ...prev, container_type: v || '' }))}
                    options={filters.container_types.map(t => ({ label: t, value: t }))}
                  />
                </Col>
                <Col span={6}>
                  <Button icon={<ReloadOutlined />} onClick={fetchActiveRates}>刷新</Button>
                </Col>
              </Row>

              {activeRates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <FileExcelOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>暂无有效报价数据，请联系商务录入</div>
                </div>
              ) : (
                activeRates.map(batch => (
                  <Card
                    key={batch.id}
                    size="small"
                    title={
                      <Space>
                        <Tag color="blue">{batch.pol}</Tag>
                        <span>→</span>
                        <Tag color="green">{batch.pod}</Tag>
                        <Tag>{batch.container_type}</Tag>
                        <Text type="secondary">{batch.valid_from} ~ {batch.valid_to}</Text>
                        {batch.notes && <Tag color="orange">{batch.notes}</Tag>}
                      </Space>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Table
                      dataSource={batch.items || []}
                      columns={getRateColumns(batch.id)}
                      rowKey="id"
                      pagination={false}
                      size="small"
                    />
                  </Card>
                ))
              )}
            </Card>
          ),
        },
        {
          key: 'batches',
          label: <span><HistoryOutlined /> 报价批次管理</span>,
          children: (
            <Card>
              <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
                <Col flex="auto">
                  <Space wrap>
                    <Input.Search
                      placeholder="搜索起运港/目的港/箱型"
                      allowClear
                      style={{ width: 250 }}
                      onSearch={v => { setParams(prev => ({ ...prev, search: v, page: 1 })); }}
                    />
                    <Select
                      placeholder="状态" allowClear style={{ width: 100 }}
                      value={params.status || undefined}
                      onChange={v => setParams(prev => ({ ...prev, status: v || '', page: 1 }))}
                      options={[{ label: '有效', value: 'active' }, { label: '过期', value: 'expired' }]}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增批次</Button>
                    <Button icon={<SettingOutlined />} onClick={handleSupplierManage}>订舱口管理</Button>
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport}>
                      <Button icon={<UploadOutlined />} loading={importing}>导入Excel</Button>
                    </Upload>
                    <Tooltip title="下载Excel导入模板">
                      <Button icon={<DownloadOutlined />} onClick={() => shippingRatesAPI.downloadTemplate()}>模板</Button>
                    </Tooltip>
                  </Space>
                </Col>
              </Row>

              <Table
                dataSource={batches}
                columns={batchColumns}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1100 }}
                pagination={{
                  current: params.page,
                  pageSize: params.pageSize,
                  total,
                  showSizeChanger: true,
                  showTotal: t => `共 ${t} 条`,
                  onChange: (page, pageSize) => setParams(prev => ({ ...prev, page, pageSize })),
                }}
              />
            </Card>
          ),
        },
      ]} />

      {/* ==================== 新增/编辑弹窗 ==================== */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        width={900}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="pol" label="起运港" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如：宁波" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="pod" label="目的港" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如：长滩" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="container_type" label="箱型" rules={[{ required: true, message: '必填' }]}>
                <Select placeholder="选择箱型" options={['20GP', '40GP', '40HQ', '45HQ'].map(t => ({ label: t, value: t }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="valid_range" label="有效期" rules={[{ required: true, message: '必填' }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="批次备注">
            <Input placeholder="如：美西柜子报价+50燃油附加费" />
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>报价明细</div>
          <Form.List name="items" initialValue={[{ carrier_name: '', vessel_voyage: '', freight_rate: '', transit_days: '', supplier_name: '', supplier_contact: '', remarks: '' }]}>
            {(fields, { add, remove }) => (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontWeight: 500, fontSize: 12, color: '#888' }}>
                  <div style={{ flex: 1 }}>船公司</div>
                  <div style={{ flex: 1.5 }}>船名航次</div>
                  <div style={{ flex: 1 }}>海运费(USD)</div>
                  <div style={{ flex: 0.7 }}>航程天数</div>
                  <div style={{ flex: 1 }}>订舱口</div>
                  <div style={{ flex: 0.7 }}>联系人</div>
                  <div style={{ flex: 1 }}>备注</div>
                  <div style={{ width: 40 }}></div>
                </div>
                {fields.map(({ key, name, ...rest }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <Form.Item {...rest} name={[name, 'carrier_name']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: '必选' }]}>
                      <Select placeholder="船公司" options={CARRIER_OPTIONS} showSearch allowClear />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'vessel_voyage']} style={{ flex: 1.5, marginBottom: 0 }}>
                      <Input placeholder="船名航次" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'freight_rate']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: '必填' }]}>
                      <InputNumber placeholder="海运费" min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'transit_days']} style={{ flex: 0.7, marginBottom: 0 }}>
                      <Input placeholder="如14+" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'supplier_name']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="订舱口" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'supplier_contact']} style={{ flex: 0.7, marginBottom: 0 }}>
                      <Input placeholder="联系人" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'remarks']} style={{ flex: 1, marginBottom: 0 }}>
                      <Input placeholder="备注" />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} style={{ marginTop: 5 }} disabled={fields.length === 1} />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add({ carrier_name: '', vessel_voyage: '', freight_rate: '', transit_days: '', supplier_name: '', supplier_contact: '', remarks: '' })} block icon={<PlusOutlined />}>
                  添加航司报价
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* ==================== 详情弹窗 ==================== */}
      <Modal
        title="报价批次详情"
        open={detailVisible}
        width={800}
        footer={null}
        onCancel={() => setDetailVisible(false)}
      >
        {detailData && (
          <>
            <Descriptions column={4} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="起运港"><Tag color="blue">{detailData.pol}</Tag></Descriptions.Item>
              <Descriptions.Item label="目的港"><Tag color="green">{detailData.pod}</Tag></Descriptions.Item>
              <Descriptions.Item label="箱型"><Tag>{detailData.container_type}</Tag></Descriptions.Item>
              <Descriptions.Item label="状态">
                {detailData.status === 'active' ? <Tag color="green">有效</Tag> : <Tag color="default">过期</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="有效期">{detailData.valid_from} ~ {detailData.valid_to}</Descriptions.Item>
              <Descriptions.Item label="录入人">{detailData.created_by_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(detailData.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="备注">{detailData.notes || '-'}</Descriptions.Item>
            </Descriptions>
            <Table
              dataSource={detailData.items || []}
              columns={[
                { title: '船公司', dataIndex: 'carrier_name', width: 100, render: v => <Tag color="blue">{v}</Tag> },
                { title: '船名航次', dataIndex: 'vessel_voyage', width: 180 },
                { title: '海运费(USD)', dataIndex: 'freight_rate', width: 120, align: 'right', render: v => v ? <Text strong style={{ color: '#cf1322' }}>$ {v.toLocaleString()}</Text> : '-' },
                { title: '航程天数', dataIndex: 'transit_days', width: 90, render: v => v ? <Tag color="purple">{v}</Tag> : '-' },
                { title: '订舱口', dataIndex: 'supplier_name', width: 100 },
                { title: '联系人', dataIndex: 'supplier_contact', width: 80 },
                { title: '备注', dataIndex: 'remarks', width: 120, render: v => v ? <Tag color="orange">{v}</Tag> : '-' },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          </>
        )}
      </Modal>

      {/* ==================== 订舱口管理弹窗 ==================== */}
      <Modal
        title="订舱口管理"
        open={supplierVisible}
        width={500}
        onCancel={() => setSupplierVisible(false)}
        footer={null}
      >
        <Form form={supplierForm} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item name="name" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="订舱口名称" style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="contact_person">
            <Input placeholder="联系人" style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="contact_phone">
            <Input placeholder="电话" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSupplier} loading={supplierSaving}>添加</Button>
          </Form.Item>
        </Form>
        <Table
          dataSource={suppliers}
          columns={[
            { title: '名称', dataIndex: 'name', key: 'name' },
            { title: '联系人', dataIndex: 'contact_person', key: 'person' },
            { title: '电话', dataIndex: 'contact_phone', key: 'phone' },
            {
              title: '操作', key: 'act', width: 60,
              render: (_, r) => (
                <Popconfirm title="确认删除？" onConfirm={() => handleDeleteSupplier(r.id)}>
                  <Button type="link" danger size="small">删除</Button>
                </Popconfirm>
              ),
            },
          ]}
          rowKey="id"
          size="small"
          pagination={false}
        />
      </Modal>

      <Modal
        title={previewData ? `${previewData.carrier} - ${previewData.pol} → ${previewData.pod} (${previewData.ct}) 报价单预览` : '报价单预览'}
        open={previewVisible}
        onCancel={() => { setPreviewVisible(false); setPreviewData(null); }}
        width={1100}
        footer={[
          <Button key="close" onClick={() => { setPreviewVisible(false); setPreviewData(null); }}>关闭</Button>,
          <Button key="download" type="primary" icon={<DownloadOutlined />} onClick={() => {
            const batchId = previewData._batchId;
            const itemId = previewData._itemId;
            handleDownloadExcel(batchId, itemId);
          }}>下载 Excel</Button>,
        ]}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Text>加载中...</Text></div>
        ) : previewData ? (
          <div id="quotation-preview" style={{ background: '#fff' }}>
            <div style={{ marginBottom: 16, padding: '12px 20px', background: '#1F4E79', color: '#fff', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 15, color: '#fff' }}>费用明细</Text>
              <Text style={{ color: '#FFD700', fontSize: 12 }}>说明：报价根据实际询价，关根据客户的产品名最终确认</Text>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 13 }}>
              <thead>
                <tr>
                  {['费用项目', '计费标准', '费用金额', '备注'].map(h => (
                    <th key={h} style={{ border: '1px solid #d9d9d9', padding: '10px 12px', background: '#1F4E79', color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', fontWeight: idx === 0 ? 'bold' : 'normal', background: idx === 0 ? '#f0f7ff' : (idx === previewData.items.length - 1 ? '#fffbe6' : '#fff') }}>{item.name}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center' }}>{item.standard}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center', color: '#cf1322', fontWeight: 'bold' }}>{item.amount}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', fontSize: 12, lineHeight: 1.6, color: '#666' }}>{item.note}</td>
                  </tr>
                ))}
                <tr style={{ background: '#fffbe6' }}>
                  <td style={{ border: '1px solid #faad14', padding: '10px 12px', fontWeight: 'bold' }}>合计费用</td>
                  <td style={{ border: '1px solid #faad14', padding: '10px 12px', textAlign: 'center', fontWeight: 'bold' }}>一票总计</td>
                  <td colSpan="2" style={{ border: '1px solid #faad14', padding: '10px 12px', fontWeight: 'bold', color: '#cf1322', fontSize: 14 }}>
                    USD {previewData.total.usd.toLocaleString()} + RMB {previewData.total.rmb.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginBottom: 12, padding: '10px 20px', background: '#5B9BD5', color: '#fff', borderRadius: 6, fontWeight: 'bold', fontSize: 14, textAlign: 'center' }}>
              尾程派送注意事项
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['费用项目', '免费期', '超期标准', '备注'].map(h => (
                    <th key={h} style={{ border: '1px solid #d9d9d9', padding: '8px 12px', background: '#5B9BD5', color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.notes.map((note, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px' }}>{note.name}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center' }}>{note.free}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', textAlign: 'center', color: '#1890ff' }}>{note.fee}</td>
                    <td style={{ border: '1px solid #e8e8e8', padding: '8px 12px', fontSize: 12, color: '#666', lineHeight: 1.5 }}>{note.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default ShippingRates;