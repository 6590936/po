import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Input, Button, Tag, Space, Typography, Row, Col, Statistic,
  message, Select, Modal, Form, InputNumber, DatePicker, Popconfirm, Descriptions,
  Tabs, Upload, Tooltip, Dropdown, Pagination, Drawer, Spin,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, ExportOutlined, UploadOutlined,
  DownloadOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  DollarOutlined, CheckCircleOutlined, MinusCircleOutlined,
  FileExcelOutlined, ReloadOutlined, HistoryOutlined,
  SettingOutlined, MoreOutlined,
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
  const [params, setParams] = useState({ page: 1, pageSize: 100, search: '', status: '', vessel: '', validFrom: '', validTo: '' });
  const [filters, setFilters] = useState({ pols: [], pods: [], container_types: [] });
  const [importing, setImporting] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [editingRoute, setEditingRoute] = useState(null);
  const [activePolTab, setActivePolTab] = useState('');

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  // 海运费模块数据权限：三个 Tab 各自可控
  const perms = user?.permissions || [];
  const canViewActive = perms.includes('shipping:active') || isAdmin;
  const canViewBatches = perms.includes('shipping:batches') || isAdmin;
  const canViewDetail = perms.includes('shipping:detail') || isAdmin;

  // 销售看板
  const [activeRates, setActiveRates] = useState([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateFilter, setRateFilter] = useState({ pol: '', pod: '', container_type: '', vessel: '', validFrom: '', validTo: '' });

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

  // 航线子批次抽屉
  const [subBatchRoute, setSubBatchRoute] = useState(null);
  const [subBatchItems, setSubBatchItems] = useState({});
  const [subBatchLoading, setSubBatchLoading] = useState(false);

  // 报价明细数据
  const [detailRows, setDetailRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailParams, setDetailParams] = useState({ page: 1, pageSize: 20, pol: '', pod: '', carrier: '', supplier: '', validFrom: '', validTo: '' });
  const [detailEditVisible, setDetailEditVisible] = useState(false);
  const [detailEditRow, setDetailEditRow] = useState(null);
  const [detailEditSaving, setDetailEditSaving] = useState(false);
  const [detailForm] = Form.useForm();

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

  useEffect(() => {
    if (activeRates.length > 0) {
      const firstPol = activeRates[0]?.pol;
      if (firstPol && !activePolTab) setActivePolTab(firstPol);
    }
  }, [activeRates]);

  useEffect(() => {
    if (!subBatchRoute) return;
    setSubBatchLoading(true);
    setSubBatchItems({});
    const children = subBatchRoute.children || [];
    Promise.allSettled(children.map(b => shippingRatesAPI.getBatch(b.id)))
      .then(results => {
        const map = {};
        results.forEach((r, i) => {
          map[children[i].id] = (r.status === 'fulfilled' && r.value?.items) ? r.value.items : [];
        });
        setSubBatchItems(map);
      })
      .finally(() => setSubBatchLoading(false));
  }, [subBatchRoute]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [params.page, params.pageSize, params.search, params.status]);

  // ==================== 批次管理 ====================

  const handleCreate = () => {
    setEditingBatch(null);
    setEditingRoute(null);
    setModalTitle('新增报价批次');
    form.resetFields();
    form.setFieldsValue({ valid_range: [dayjs(), dayjs().add(3, 'day')] });
    setModalVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingBatch(record);
    setEditingRoute(null);
    setModalTitle('编辑报价批次');
    form.resetFields();
    setModalVisible(true);
    try {
      const res = await shippingRatesAPI.getBatch(record.id);
      const batch = res;
      setTimeout(() => {
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
          cost_freight: item.cost_freight || 0,
          transit_days: item.transit_days || '',
          supplier_name: item.supplier_name,
          supplier_contact: item.supplier_contact,
          remarks: item.remarks,
        })),
      });
      }, 50);
    } catch (err) {
      message.error('获取批次详情失败: ' + err.message);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingRoute) {
        const itemsByBatch = {};
        (values.items || []).forEach(item => {
          if (!item.carrier_name) return;
          const batchId = item._batchId;
          if (!itemsByBatch[batchId]) itemsByBatch[batchId] = [];
          itemsByBatch[batchId].push({
            carrier_name: item.carrier_name,
            vessel_voyage: item.vessel_voyage || '',
            freight_rate: item.freight_rate || 0,
            cost_freight: item.cost_freight || 0,
            transit_days: item.transit_days || '',
            supplier_name: item.supplier_name || '',
            supplier_contact: item.supplier_contact || '',
            remarks: item.remarks || '',
            _itemId: item._itemId,
          });
        });

        let successCount = 0;
        for (const [batchId, items] of Object.entries(itemsByBatch)) {
          try {
            await shippingRatesAPI.updateBatch(parseInt(batchId), {
              pol: values.pol,
              pod: values.pod,
              container_type: (editingRoute.children || []).find(b => b.id === parseInt(batchId))?.container_type || '40HQ',
              valid_from: values.valid_range?.[0]?.format('YYYY-MM-DD') || '',
              valid_to: values.valid_range?.[1]?.format('YYYY-MM-DD') || '',
              notes: values.notes || '',
              items,
            });
            successCount++;
          } catch (err) {
            console.error(`更新批次 ${batchId} 失败:`, err);
          }
        }
        
        if (successCount > 0) {
          message.success(`已更新 ${successCount} 个批次的报价`);
        } else {
          message.error('保存失败');
        }
      } else {
        const payload = {
          pol: values.pol,
          pod: values.pod,
          container_type: values.container_type,
          valid_from: values.valid_range?.[0]?.format('YYYY-MM-DD') || '',
          valid_to: values.valid_range?.[1]?.format('YYYY-MM-DD') || '',
          notes: values.notes || '',
          items: (values.items || []).filter(i => i && i.carrier_name).map(i => ({
            carrier_name: i.carrier_name,
            vessel_voyage: i.vessel_voyage,
            freight_rate: i.freight_rate,
            cost_freight: i.cost_freight,
            transit_days: i.transit_days,
            supplier_name: i.supplier_name,
            supplier_contact: i.supplier_contact,
            remarks: i.remarks,
          })),
        };

        if (editingBatch) {
          await shippingRatesAPI.updateBatch(editingBatch.id, payload);
          message.success('更新成功');
        } else {
          await shippingRatesAPI.createBatch(payload);
          message.success('创建成功');
        }
      }
      
      setModalVisible(false);
      setEditingRoute(null);
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

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的批次');
      return;
    }
    try {
      const ids = [];
      for (const key of selectedRowKeys) {
        const parts = key.replace('route-', '').split('|');
        if (parts.length >= 2) {
          batches.forEach(b => {
            if (b.pol === parts[0] && b.pod === parts.slice(1).join('|')) ids.push(b.id);
          });
        }
      }
      await shippingRatesAPI.deleteBatches(ids);
      message.success(`成功删除 ${ids.length} 个批次`);
      setSelectedRowKeys([]);
      fetchBatches();
    } catch (err) {
      message.error('批量删除失败: ' + err.message);
    }
  };

  const handleBatchExpire = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要设为过期的批次');
      return;
    }
    try {
      const ids = [];
      for (const key of selectedRowKeys) {
        const parts = key.replace('route-', '').split('|');
        if (parts.length >= 2) {
          batches.forEach(b => {
            if (b.pol === parts[0] && b.pod === parts.slice(1).join('|')) ids.push(b.id);
          });
        }
      }
      const res = await shippingRatesAPI.updateBatchStatusBatch(ids, 'expired');
      message.success(`成功将 ${res.updated || ids.length} 个批次设为过期`);
      setSelectedRowKeys([]);
      fetchBatches();
    } catch (err) {
      message.error('批量设为过期失败: ' + err.message);
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

  const handleRouteEdit = async (route) => {
    setEditingRoute(route);
    setEditingBatch(null);
    setModalTitle(`编辑航线 ${route.pol} → ${route.pod}`);
    form.resetFields();
    setModalVisible(true);

    try {
      const results = await Promise.allSettled(
        (route.children || []).map(batch => shippingRatesAPI.getBatch(batch.id))
      );
      const allItems = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const res = result.value;
          const batch = (route.children || [])[i];
          if (res && Array.isArray(res.items)) {
            res.items.forEach(item => {
              allItems.push({
                ...item,
                _batchId: batch.id,
                _containerType: batch.container_type,
                _validFrom: batch.valid_from,
                _validTo: batch.valid_to,
                _batchNotes: batch.notes || '',
              });
            });
          }
        } else {
          console.error('获取批次失败:', result.reason?.message);
        }
      });

      const populateForm = () => {
        form.setFieldsValue({
          pol: route.pol,
          pod: route.pod,
          container_type: route.containerTypes.join(', '),
          valid_range: [dayjs(route.validFrom || undefined), dayjs(route.validTo || undefined)],
          notes: '',
          items: allItems.map(item => ({
            carrier_name: item.carrier_name,
            vessel_voyage: item.vessel_voyage,
            freight_rate: item.freight_rate,
            cost_freight: item.cost_freight || 0,
            transit_days: item.transit_days || '',
            supplier_name: item.supplier_name || '',
            supplier_contact: item.supplier_contact || '',
            remarks: item.remarks || '',
            _batchId: item._batchId,
            _containerType: item._containerType,
            _itemId: item.id,
          })),
        });
      };

      setTimeout(populateForm, 50);
    } catch (err) {
      message.error('加载航线数据失败: ' + err.message);
    }
  };

  const handleRouteDelete = async (route) => {
    try {
      const ids = (route.children || []).map(b => b.id);
      await shippingRatesAPI.deleteBatches(ids);
      message.success(`已删除航线 ${route.pol}→${route.pod} 下的 ${ids.length} 个批次`);
      fetchBatches();
    } catch (err) {
      message.error('删除失败: ' + err.message);
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

  const routeColumns = [
    { title: '起运港', dataIndex: 'pol', width: 90, render: v => <Tag color="blue">{v}</Tag> },
    { title: '目的港', dataIndex: 'pod', width: 90, render: v => <Tag color="green">{v}</Tag> },
    {
      title: '有效期', key: 'valid', width: 180,
      render: (_, r) => `${r.validFrom || '-'} ~ ${r.validTo || '-'}`,
    },
    { title: '批次', key: 'count', width: 60, align: 'center', render: (_, r) => <Text strong>{(r.children || []).length}</Text> },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: v => v === 'active' ? <Tag color="green" icon={<CheckCircleOutlined />}>有效</Tag> : <Tag color="default" icon={<MinusCircleOutlined />}>过期</Tag>,
    },
    { title: '录入人', dataIndex: 'createdByName', width: 80 },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space size={2}>
          <Tooltip title="查看批次"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSubBatchRoute(r)} /></Tooltip>
          <Tooltip title="编辑航线"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleRouteEdit(r)} /></Tooltip>
          <Dropdown menu={{
            items: [
              { key: 'export', icon: <DownloadOutlined />, label: '导出整条航线', onClick: () => (r.children || []).forEach(b => shippingRatesAPI.exportBatch(b.id)) },
              { type: 'divider' },
              ...(r.status === 'active' ? [{ key: 'expire', label: '整条设为过期', danger: true, onClick: () => (r.children || []).forEach(b => handleStatus(b.id, 'expired')) }] : [{ key: 'activate', label: '整条重新激活', onClick: () => (r.children || []).forEach(b => handleStatus(b.id, 'active')) }]),
            ],
          }} trigger={['click']}>
            <Button type="link" size="small" icon={<MoreOutlined />} />
          </Dropdown>
          <Popconfirm title={`确认删除 ${r.pol}→${r.pod} 下全部 ${(r.children || []).length} 个批次？`} onConfirm={() => handleRouteDelete(r)}>
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
    ...(isAdmin ? [
      { title: '成本(USD)', dataIndex: 'cost_freight', width: 110, align: 'right', render: v => v ? <Text type="secondary">$ {v.toLocaleString()}</Text> : '-' },
      { title: '利润(USD)', key: 'profit', width: 110, align: 'right', render: (_, r) => {
        const p = (r.freight_rate || 0) - (r.cost_freight || 0);
        return p !== 0 ? <Text strong style={{ color: p > 0 ? '#3f8600' : '#cf1322' }}>{p > 0 ? '+' : ''}$ {p.toLocaleString()}</Text> : '-';
      }},
    ] : []),
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

  // ==================== 报价明细数据 ====================

  const fetchDetails = useCallback(async () => {
    setDetailLoading(true);
    try {
      const res = await shippingRatesAPI.getDetails(detailParams);
      setDetailRows(res.list || []);
      setDetailTotal(res.total || 0);
    } catch (err) {
      message.error('加载明细失败: ' + err.message);
    } finally {
      setDetailLoading(false);
    }
  }, [detailParams]);

  useEffect(() => { if (activeTab === 'detail') fetchDetails(); }, [activeTab, fetchDetails]);

  const openDetailEdit = (row) => {
    detailForm.setFieldsValue({
      carrier_name: row.carrier_name,
      vessel_voyage: row.vessel_voyage,
      freight_rate: row.freight_rate,
      cost_freight: row.cost_freight,
      transit_days: row.transit_days,
      supplier_name: row.supplier_name,
      supplier_contact: row.supplier_contact,
      remarks: row.remarks,
    });
    setDetailEditRow(row);
    setDetailEditVisible(true);
  };

  const handleDetailSave = async () => {
    try {
      const values = await detailForm.validateFields();
      setDetailEditSaving(true);
      await shippingRatesAPI.updateDetail(detailEditRow.id, values);
      message.success('明细更新成功');
      setDetailEditVisible(false);
      setDetailEditRow(null);
      fetchDetails();
    } catch (err) {
      if (err.errorFields) return;
      message.error('更新失败: ' + err.message);
    } finally {
      setDetailEditSaving(false);
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
              <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
                <Col span={4}>
                  <Select
                    placeholder="起运港" allowClear style={{ width: '100%' }}
                    value={rateFilter.pol || undefined}
                    onChange={v => setRateFilter(prev => ({ ...prev, pol: v || '' }))}
                    options={filters.pols.map(p => ({ label: p, value: p }))}
                  />
                </Col>
                <Col span={4}>
                  <Select
                    placeholder="目的港" allowClear style={{ width: '100%' }}
                    value={rateFilter.pod || undefined}
                    onChange={v => setRateFilter(prev => ({ ...prev, pod: v || '' }))}
                    options={filters.pods.map(p => ({ label: p, value: p }))}
                  />
                </Col>
                <Col span={4}>
                  <Select
                    placeholder="箱型" allowClear style={{ width: '100%' }}
                    value={rateFilter.container_type || undefined}
                    onChange={v => setRateFilter(prev => ({ ...prev, container_type: v || '' }))}
                    options={filters.container_types.map(t => ({ label: t, value: t }))}
                  />
                </Col>
                <Col span={4}>
                  <Input
                    placeholder="船名航次" allowClear
                    value={rateFilter.vessel}
                    onChange={e => setRateFilter(prev => ({ ...prev, vessel: e.target.value }))}
                  />
                </Col>
                <Col span={5}>
                  <RangePicker
                    placeholder={['有效期起', '有效期止']} style={{ width: '100%' }}
                    value={rateFilter.validFrom && rateFilter.validTo ? [dayjs(rateFilter.validFrom), dayjs(rateFilter.validTo)] : null}
                    onChange={(dates) => setRateFilter(prev => ({
                      ...prev,
                      validFrom: dates ? dates[0].format('YYYY-MM-DD') : '',
                      validTo: dates ? dates[1].format('YYYY-MM-DD') : '',
                    }))}
                  />
                </Col>
                <Col span={3}>
                  <Button icon={<ReloadOutlined />} onClick={fetchActiveRates}>刷新</Button>
                </Col>
              </Row>

              {activeRates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <FileExcelOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>暂无有效报价数据，请联系商务录入</div>
                </div>
              ) : (
                (() => {
                  const polMap = {};
                  activeRates.forEach(b => {
                    if (!polMap[b.pol]) polMap[b.pol] = [];
                    polMap[b.pol].push(b);
                  });
                  const pols = Object.keys(polMap);
                  const currentPol = activePolTab && pols.includes(activePolTab) ? activePolTab : pols[0] || '';
                  const items = currentPol ? (polMap[currentPol] || []) : [];
                  const podMap = {};
                  items.forEach(b => {
                    if (!podMap[b.pod]) podMap[b.pod] = [];
                    podMap[b.pod].push(b);
                  });

                  return (
                    <>
                      <Tabs
                        activeKey={currentPol}
                        onChange={setActivePolTab}
                        type="card"
                        size="small"
                        style={{ marginBottom: 12 }}
                        items={pols.map(pol => ({ key: pol, label: <Space size={4}><Tag color="blue" style={{ margin: 0 }}>{pol}</Tag><Text type="secondary" style={{ fontSize: 12 }}>{polMap[pol].length}港</Text></Space> }))}
                      />
                      {Object.entries(podMap).map(([pod, batches]) => (
                        <Card
                          key={pod}
                          size="small"
                          style={{ marginBottom: 12 }}
                          title={
                            <Space size={8} wrap>
                              <Tag color="green" style={{ fontSize: 14, padding: '2px 10px' }}>{pod}</Tag>
                              {[...new Set(batches.map(b => b.container_type))].map(ct => (
                                <Tag key={ct}>{ct}</Tag>
                              ))}
                              <Text type="secondary" style={{ fontSize: 12 }}>{batches.length} 个批次</Text>
                            </Space>
                          }
                        >
                          <Table
                            dataSource={batches.flatMap(b => (b.items || []).map(item => ({ ...item, _batchId: b.id, _containerType: b.container_type, _validFrom: b.valid_from, _validTo: b.valid_to, _notes: b.notes })))}
                            columns={[
                              { title: '船公司', dataIndex: 'carrier_name', width: 100, render: v => <Tag color="blue">{v}</Tag> },
                              { title: '箱型', dataIndex: '_containerType', width: 70, render: v => <Tag>{v}</Tag> },
                              { title: '船名航次', dataIndex: 'vessel_voyage', width: 170 },
                              { title: '海运费(USD)', dataIndex: 'freight_rate', width: 120, align: 'right', render: v => v ? <Text strong style={{ color: '#cf1322' }}>$ {v.toLocaleString()}</Text> : '-' },
                              ...(isAdmin ? [
                                { title: '成本(USD)', dataIndex: 'cost_freight', width: 100, align: 'right', render: v => v ? <Text type="secondary">$ {v.toLocaleString()}</Text> : '-' },
                                { title: '利润(USD)', key: 'profit', width: 100, align: 'right', render: (_, r) => {
                                  const p = (r.freight_rate || 0) - (r.cost_freight || 0);
                                  return p !== 0 ? <Text strong style={{ color: p > 0 ? '#3f8600' : '#cf1322' }}>{p > 0 ? '+' : ''}$ {p.toLocaleString()}</Text> : '-';
                                }},
                              ] : []),
                              { title: '航程', dataIndex: 'transit_days', width: 70, render: v => v ? <Tag color="purple">{v}</Tag> : '-' },
                              { title: '订舱口', dataIndex: 'supplier_name', width: 90 },
                              { title: '备注', dataIndex: 'remarks', width: 100, render: v => v ? <Tag color="orange">{v}</Tag> : '-' },
                              {
                                title: '操作', key: 'act', width: 70,
                                render: (_, r) => <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handlePreviewQuotation(r._batchId, r.id)}>报价单</Button>,
                              },
                            ]}
                            rowKey={(r) => `${r._batchId}_${r.id}`}
                            pagination={false}
                            size="small"
                            loading={rateLoading}
                          />
                        </Card>
                      ))}
                    </>
                  );
                })()
              )}
            </Card>
          ),
        },
        ...(canViewBatches ? [{
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
                    <Input
                      placeholder="船名航次" allowClear style={{ width: 150 }}
                      value={params.vessel}
                      onChange={e => setParams(prev => ({ ...prev, vessel: e.target.value, page: 1 }))}
                    />
                    <RangePicker
                      placeholder={['有效期起', '有效期止']} style={{ width: 240 }}
                      value={params.validFrom && params.validTo ? [dayjs(params.validFrom), dayjs(params.validTo)] : null}
                      onChange={(dates) => setParams(prev => ({
                        ...prev,
                        validFrom: dates ? dates[0].format('YYYY-MM-DD') : '',
                        validTo: dates ? dates[1].format('YYYY-MM-DD') : '',
                        page: 1,
                      }))}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增批次</Button>
                    <Button icon={<SettingOutlined />} onClick={handleSupplierManage}>订舱口管理</Button>
                  </Space>
                </Col>
                <Col>
                  <Space>
                    <Popconfirm
                      title={selectedRowKeys.length > 0 ? `确认删除选中的 ${selectedRowKeys.length} 个批次？` : ''}
                      onConfirm={handleBatchDelete}
                      disabled={selectedRowKeys.length === 0}
                    >
                      <Button danger icon={<DeleteOutlined />} disabled={selectedRowKeys.length === 0}>
                        批量删除{selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title={selectedRowKeys.length > 0 ? `确认将选中的 ${selectedRowKeys.length} 个批次设为过期？` : ''}
                      onConfirm={handleBatchExpire}
                      disabled={selectedRowKeys.length === 0}
                    >
                      <Button icon={<MinusCircleOutlined />} disabled={selectedRowKeys.length === 0}>
                        批量设为过期{selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''}
                      </Button>
                    </Popconfirm>
                    <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImport}>
                      <Button icon={<UploadOutlined />} loading={importing}>导入Excel</Button>
                    </Upload>
                    <Tooltip title="下载Excel导入模板">
                      <Button icon={<DownloadOutlined />} onClick={() => shippingRatesAPI.downloadTemplate()}>模板</Button>
                    </Tooltip>
                  </Space>
                </Col>
              </Row>

              {batches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <FileExcelOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>暂无报价批次，请新增或导入</div>
                </div>
              ) : (
                (() => {
                  const routeMap = {};
                  batches.forEach(b => {
                    if (!b.pol || !b.pod || !b.valid_from || !b.valid_to) return;
                    const key = `${b.pol}\x00${b.pod}`;
                    if (!routeMap[key]) {
                      routeMap[key] = { pol: b.pol, pod: b.pod, validFrom: b.valid_from, validTo: b.valid_to, status: b.status, createdByName: b.created_by_name, containerTypes: [], children: [] };
                    }
                    routeMap[key].children.push(b);
                    if (!routeMap[key].containerTypes.includes(b.container_type)) {
                      routeMap[key].containerTypes.push(b.container_type);
                    }
                    if (b.valid_from < routeMap[key].validFrom) routeMap[key].validFrom = b.valid_from;
                    if (b.valid_to > routeMap[key].validTo) routeMap[key].validTo = b.valid_to;
                  });
                  const routes = Object.values(routeMap).filter(r => r.children && r.children.length > 0);

                  return (
                    <Table
                      key={`${params.page}-${params.search}-${params.status}`}
                      dataSource={routes}
                      columns={routeColumns}
                      rowKey={(r) => `route-${r.pol}|${r.pod}`}
                      summary={(pageData) => {
                        const totalBatches = pageData.reduce((sum, r) => sum + (r.children || []).length, 0);
                        return (
                          <Table.Summary fixed>
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0}><Text strong>合计：{pageData.length} 条航线</Text></Table.Summary.Cell>
                              <Table.Summary.Cell index={1} />
                              <Table.Summary.Cell index={2} />
                              <Table.Summary.Cell index={3} align="center"><Text strong>{totalBatches} 个批次</Text></Table.Summary.Cell>
                              <Table.Summary.Cell index={4} />
                              <Table.Summary.Cell index={5} />
                              <Table.Summary.Cell index={6} />
                            </Table.Summary.Row>
                          </Table.Summary>
                        );
                      }}
                      loading={loading}
                      size="small"
                      pagination={false}
                      rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, columnWidth: 45 }}
                      className="shipping-routes-table"
                    />
                  );
                })()
              )}

              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Space>
                  <Text type="secondary">共 {total} 个批次</Text>
                  <Select
                    value={params.pageSize}
                    onChange={(v) => setParams(prev => ({ ...prev, pageSize: v, page: 1 }))}
                    options={[10, 20, 50, 100].map(v => ({ label: `${v}条/页`, value: v }))}
                    style={{ width: 100 }}
                  />
                  <Pagination
                    current={params.page}
                    total={total}
                    pageSize={params.pageSize}
                    showQuickJumper
                    showSizeChanger={false}
                    onChange={(page) => setParams(prev => ({ ...prev, page }))}
                  />
                </Space>
              </div>

              <Drawer
                title={subBatchRoute ? `航线 ${subBatchRoute.pol} → ${subBatchRoute.pod}` : ''}
                open={!!subBatchRoute}
                onClose={() => setSubBatchRoute(null)}
                width={850}
              >
                {subBatchRoute && (
                  <Spin spinning={subBatchLoading}>
                    {(subBatchRoute.children || []).map((b) => {
                      const items = subBatchItems[b.id] || [];
                      return (
                        <Card
                          key={b.id}
                          size="small"
                          style={{ marginBottom: 12 }}
                          title={
                            <Space size={8}>
                              <Tag>{b.container_type}</Tag>
                              <span style={{ fontSize: 12, color: '#666' }}>{b.valid_from || '-'} ~ {b.valid_to || '-'}</span>
                              <Tag color={b.status === 'active' ? 'green' : 'default'}>{b.status === 'active' ? '有效' : '过期'}</Tag>
                              <span style={{ fontSize: 12, color: '#999' }}>共 {b.item_count || 0} 条报价</span>
                            </Space>
                          }
                          extra={
                            <Space size={2}>
                              <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setSubBatchRoute(null); handleEdit(b); }} /></Tooltip>
                              <Popconfirm title="确认删除？" onConfirm={() => handleDelete(b.id)}>
                                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </Space>
                          }
                        >
                          {items.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#999', padding: 12 }}>暂无报价明细</div>
                          ) : (
                            <Table
                              dataSource={items}
                              rowKey="id"
                              size="small"
                              pagination={false}
                              columns={[
                                { title: '船公司', dataIndex: 'carrier_name', width: 80, render: v => <Tag color="blue">{v}</Tag> },
                                { title: '船名航次', dataIndex: 'vessel_voyage', width: 140 },
                                { title: '海运费(USD)', dataIndex: 'freight_rate', width: 110, align: 'right', render: v => v ? <Text strong style={{ color: '#cf1322' }}>$ {v.toLocaleString()}</Text> : '-' },
                                ...(isAdmin ? [
                                  { title: '成本(USD)', dataIndex: 'cost_freight', width: 100, align: 'right', render: v => v ? <Text type="secondary">$ {v.toLocaleString()}</Text> : '-' },
                                ] : []),
                                { title: '航程', dataIndex: 'transit_days', width: 60, render: v => v ? <Tag color="purple">{v}</Tag> : '-' },
                                { title: '订舱口', dataIndex: 'supplier_name', width: 80 },
                                { title: '备注', dataIndex: 'remarks', width: 100, render: v => v || '-' },
                              ]}
                            />
                          )}
                        </Card>
                      );
                    })}
                  </Spin>
                )}
              </Drawer>
            </Card>
          ),
        },
      ] : []),
      ...(canViewDetail ? [{
        key: 'detail',
        label: <span><FileExcelOutlined /> 报价明细数据</span>,
        children: (
          <Card>
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Input placeholder="起运港" allowClear value={detailParams.pol}
                  onChange={e => setDetailParams(prev => ({ ...prev, pol: e.target.value, page: 1 }))} />
              </Col>
              <Col span={4}>
                <Input placeholder="目的港" allowClear value={detailParams.pod}
                  onChange={e => setDetailParams(prev => ({ ...prev, pod: e.target.value, page: 1 }))} />
              </Col>
              <Col span={4}>
                <Input placeholder="船公司" allowClear value={detailParams.carrier}
                  onChange={e => setDetailParams(prev => ({ ...prev, carrier: e.target.value, page: 1 }))} />
              </Col>
              <Col span={4}>
                <Input placeholder="订舱口" allowClear value={detailParams.supplier}
                  onChange={e => setDetailParams(prev => ({ ...prev, supplier: e.target.value, page: 1 }))} />
              </Col>
              <Col span={6}>
                <Space>
                  <DatePicker placeholder="有效期起" value={detailParams.validFrom ? dayjs(detailParams.validFrom) : null}
                    onChange={v => setDetailParams(prev => ({ ...prev, validFrom: v ? v.format('YYYY-MM-DD') : '', page: 1 }))} style={{ width: 130 }} />
                  <span>-</span>
                  <DatePicker placeholder="有效期止" value={detailParams.validTo ? dayjs(detailParams.validTo) : null}
                    onChange={v => setDetailParams(prev => ({ ...prev, validTo: v ? v.format('YYYY-MM-DD') : '', page: 1 }))} style={{ width: 130 }} />
                </Space>
              </Col>
              <Col span={2}>
                <Button type="primary" icon={<SearchOutlined />} onClick={fetchDetails}>
                  搜索
                </Button>
              </Col>
            </Row>

            <Table
              dataSource={detailRows}
              rowKey="id"
              loading={detailLoading}
              size="small"
              scroll={{ x: 1100 }}
              columns={[
                { title: '起运港', dataIndex: 'pol', width: 90, render: v => <Tag color="blue">{v}</Tag> },
                { title: '目的港', dataIndex: 'pod', width: 90, render: v => <Tag color="green">{v}</Tag> },
                { title: '箱型', dataIndex: 'container_type', width: 70, render: v => <Tag>{v}</Tag> },
                { title: '有效期', key: 'valid', width: 180, render: (_, r) => `${r.valid_from || '-'} ~ ${r.valid_to || '-'}` },
                { title: '船公司', dataIndex: 'carrier_name', width: 90, render: v => <Tag color="blue">{v}</Tag> },
                { title: '船名航次', dataIndex: 'vessel_voyage', width: 160 },
                { title: '海运费(USD)', dataIndex: 'freight_rate', width: 110, align: 'right', render: v => v ? <Text strong style={{ color: '#cf1322' }}>$ {v.toLocaleString()}</Text> : '-' },
                { title: '成本(USD)', dataIndex: 'cost_freight', width: 100, align: 'right', render: v => v ? <Text type="secondary">$ {v.toLocaleString()}</Text> : '-' },
                { title: '航程(天)', dataIndex: 'transit_days', width: 80, render: v => v ? <Tag color="purple">{v}</Tag> : '-' },
                { title: '订舱口', dataIndex: 'supplier_name', width: 90 },
                {
                  title: '操作', key: 'actions', width: 80, fixed: 'right',
                  render: (_, r) => (
                    <Button type="link" size="small" icon={<EditOutlined />}
                      onClick={() => openDetailEdit(r)} />
                  ),
                },
              ]}
              pagination={false}
            />

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Space>
                <Text type="secondary">共 {detailTotal} 条</Text>
                <Select
                  value={detailParams.pageSize}
                  onChange={v => setDetailParams(prev => ({ ...prev, pageSize: v, page: 1 }))}
                  options={[10, 20, 50, 100].map(v => ({ label: `${v}条/页`, value: v }))}
                  style={{ width: 100 }}
                />
                <Pagination
                  current={detailParams.page}
                  total={detailTotal}
                  pageSize={detailParams.pageSize}
                  showQuickJumper
                  showSizeChanger={false}
                  onChange={page => setDetailParams(prev => ({ ...prev, page }))}
                />
              </Space>
            </div>
          </Card>
        ),
      }] : []),
      ]} />

      {/* ==================== 报价明细编辑弹窗 ==================== */}
      <Modal
        title="编辑报价明细"
        open={detailEditVisible}
        width={600}
        onOk={handleDetailSave}
        onCancel={() => { setDetailEditVisible(false); setDetailEditRow(null); }}
        confirmLoading={detailEditSaving}
      >
        <Form form={detailForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="carrier_name" label="船公司">
                <Select placeholder="选择船公司" allowClear showSearch
                  options={CARRIER_OPTIONS}
                  filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vessel_voyage" label="船名航次">
                <Input placeholder="如：COSCO SOUTH CHINA SEA/085E" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="freight_rate" label="海运费(USD)">
                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="如：8215" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cost_freight" label="成本(USD)">
                <InputNumber style={{ width: '100%' }} min={0} precision={0} placeholder="如：7000" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="transit_days" label="航程(天)">
                <Input placeholder="如：14+" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier_name" label="订舱口">
                <Input placeholder="如：聚航" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier_contact" label="联系人">
                <Input placeholder="订舱口联系人" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarks" label="备注">
                <Input placeholder="备注信息" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ==================== 新增/编辑弹窗 ==================== */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        width={900}
        onOk={handleSave}
        onCancel={() => { setModalVisible(false); setEditingRoute(null); }}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="pol" label="起运港" rules={[{ required: true, message: '必填' }]}>
                {editingRoute ? (
                  <Input disabled style={{ background: '#f5f5f5' }} />
                ) : (
                  <Input placeholder="如：宁波" />
                )}
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="pod" label="目的港" rules={[{ required: true, message: '必填' }]}>
                {editingRoute ? (
                  <Input disabled style={{ background: '#f5f5f5' }} />
                ) : (
                  <Input placeholder="如：长滩" />
                )}
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="container_type" label="箱型" rules={[{ required: true, message: '必填' }]}>
                {editingRoute ? (
                  <Input disabled style={{ background: '#f5f5f5' }} />
                ) : (
                  <Select placeholder="选择箱型" options={['20GP', '40GP', '40HQ', '45HQ'].map(t => ({ label: t, value: t }))} />
                )}
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
          <Form.List name="items" initialValue={[{ carrier_name: '', vessel_voyage: '', freight_rate: '', cost_freight: '', transit_days: '', supplier_name: '', supplier_contact: '', remarks: '' }]}>
            {(fields, { add, remove }) => (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontWeight: 500, fontSize: 12, color: '#888' }}>
                  {editingRoute && <div style={{ flex: 0.7 }}>箱型</div>}
                  <div style={{ flex: 1 }}>船公司</div>
                  <div style={{ flex: 1.5 }}>船名航次</div>
                  <div style={{ flex: 1 }}>海运费</div>
                  <div style={{ flex: 0.9 }}>成本</div>
                  <div style={{ flex: 0.7 }}>航程</div>
                  <div style={{ flex: 1 }}>订舱口</div>
                  <div style={{ flex: 0.7 }}>联系人</div>
                  <div style={{ flex: 1 }}>备注</div>
                  <div style={{ width: 40 }}></div>
                </div>
                {fields.map(({ key, name, ...rest }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {editingRoute && (
                      <>
                        <Form.Item {...rest} name={[name, '_containerType']} style={{ flex: 0.7, marginBottom: 0 }} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item {...rest} name={[name, '_batchId']} style={{ marginBottom: 0 }} hidden>
                          <InputNumber />
                        </Form.Item>
                        <Form.Item {...rest} name={[name, '_itemId']} style={{ marginBottom: 0 }} hidden>
                          <InputNumber />
                        </Form.Item>
                        <Form.Item noStyle shouldUpdate>
                          {() => {
                            const ct = form.getFieldValue(['items', name, '_containerType']);
                            return (
                              <div style={{ flex: 0.7, paddingTop: 4 }}>
                                <Tag>{ct || '-'}</Tag>
                              </div>
                            );
                          }}
                        </Form.Item>
                      </>
                    )}
                    <Form.Item {...rest} name={[name, 'carrier_name']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: '必选' }]}>
                      <Select placeholder="船公司" options={CARRIER_OPTIONS} showSearch allowClear />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'vessel_voyage']} style={{ flex: 1.5, marginBottom: 0 }}>
                      <Input placeholder="船名航次" />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'freight_rate']} style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: '必填' }]}>
                      <InputNumber placeholder="售价" min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item {...rest} name={[name, 'cost_freight']} style={{ flex: 0.9, marginBottom: 0 }}>
                      <InputNumber placeholder="成本" min={0} style={{ width: '100%' }} />
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
                <Button type="dashed" onClick={() => add({ carrier_name: '', vessel_voyage: '', freight_rate: '', cost_freight: '', transit_days: '', supplier_name: '', supplier_contact: '', remarks: '' })} block icon={<PlusOutlined />}>
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
                ...(isAdmin ? [
                  { title: '成本(USD)', dataIndex: 'cost_freight', width: 100, align: 'right', render: v => v ? <Text type="secondary">$ {v.toLocaleString()}</Text> : '-' },
                  { title: '利润(USD)', key: 'profit', width: 100, align: 'right', render: (_, r) => {
                    const p = (r.freight_rate || 0) - (r.cost_freight || 0);
                    return p !== 0 ? <Text strong style={{ color: p > 0 ? '#3f8600' : '#cf1322' }}>{p > 0 ? '+' : ''}$ {p.toLocaleString()}</Text> : '-';
                  }},
                ] : []),
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
      <style>{`
        .shipping-routes-table .ant-table-expand-icon-col,
        .shipping-routes-table .ant-table-row-expand-icon { display: none !important; }
      `}</style>
    </div>
  );
}

export default ShippingRates;