import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createProduct,
  deleteProduct,
  listCategories,
  listProducts,
  listSpecGroups,
  updateProduct,
  updateProductSale,
  updateProductStock,
} from '../../../services/menu';
import { ApiError } from '../../../services/request';
import { fenToYuan, formatPrice, yuanToFen } from '../../../utils/format';
import type { CategoryInfo, ProductInfo, SpecGroupInfo } from '../../../types';

/** 表单以「元」录入价格，接口以「分」传输 */
interface ProductFormValues {
  categoryId: string;
  name: string;
  description?: string;
  image?: string;
  price: number;
  stock: number;
  onSale: boolean;
  specGroupIds?: string[];
}

/** 商品管理（specs/03-api.md §5.2，F-08） */
export default function ProductsPage() {
  const [rows, setRows] = useState<ProductInfo[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [specGroups, setSpecGroups] = useState<SpecGroupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [editing, setEditing] = useState<ProductInfo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockTarget, setStockTarget] = useState<ProductInfo | null>(null);
  const [stockValue, setStockValue] = useState<number>(0);
  const [form] = Form.useForm<ProductFormValues>();

  const showError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [products, cats, groups] = await Promise.all([listProducts(), listCategories(), listSpecGroups()]);
      setRows(products);
      setCategories(cats);
      setSpecGroups(groups);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const specGroupName = (id: string) => specGroups.find((g) => g.id === id)?.name ?? id;

  const openEditor = (row: ProductInfo | null) => {
    setEditing(row);
    setEditorOpen(true);
    form.setFieldsValue(
      row
        ? {
            categoryId: row.categoryId,
            name: row.name,
            description: row.description ?? '',
            image: row.image ?? '',
            price: fenToYuan(row.price),
            stock: row.stock,
            onSale: row.onSale,
            specGroupIds: row.specGroupIds,
          }
        : {
            categoryId: categories[0]?.id ?? '',
            name: '',
            description: '',
            image: '',
            price: 0,
            stock: 0,
            onSale: true,
            specGroupIds: [],
          },
    );
  };

  const closeEditor = () => {
    setEditing(null);
    setEditorOpen(false);
  };

  const onSubmit = async () => {
    let values: ProductFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = {
      categoryId: values.categoryId,
      name: values.name,
      description: values.description || undefined,
      image: values.image || undefined,
      price: yuanToFen(values.price),
      stock: values.stock,
      onSale: values.onSale,
      specGroupIds: values.specGroupIds ?? [],
    };
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        message.success('商品已更新');
      } else {
        await createProduct(payload);
        message.success('商品已新增');
      }
      closeEditor();
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const onToggleSale = async (row: ProductInfo, onSale: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, onSale } : r)));
    try {
      await updateProductSale(row.id, onSale);
    } catch (e) {
      showError(e);
      void load();
    }
  };

  const onDelete = async (row: ProductInfo) => {
    try {
      await deleteProduct(row.id);
      message.success('商品已删除');
      await load();
    } catch (e) {
      showError(e);
    }
  };

  const onSubmitStock = async () => {
    if (!stockTarget) return;
    setSaving(true);
    try {
      await updateProductStock(stockTarget.id, stockValue);
      message.success('库存已更新');
      setStockTarget(null);
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<ProductInfo> = [
    {
      title: '商品',
      dataIndex: 'name',
      render: (_, row) => (
        <Space>
          {row.image ? <Image src={row.image} width={40} height={40} style={{ objectFit: 'cover' }} /> : null}
          <span>
            <div>{row.name}</div>
            <div style={{ color: '#888', fontSize: 12 }}>{row.description ?? '-'}</div>
          </span>
        </Space>
      ),
    },
    { title: '分类', dataIndex: 'categoryId', width: 120, render: (id: string) => categoryName(id) },
    { title: '价格', dataIndex: 'price', width: 100, render: (price: number) => formatPrice(price) },
    {
      title: '库存',
      dataIndex: 'stock',
      width: 90,
      render: (stock: number) => (stock > 0 ? stock : <Tag color="red">售罄</Tag>),
    },
    {
      title: '规格组',
      dataIndex: 'specGroupIds',
      render: (ids: string[]) =>
        ids.length ? ids.map((id) => <Tag key={id}>{specGroupName(id)}</Tag>) : <span style={{ color: '#bbb' }}>无</span>,
    },
    {
      title: '上架',
      dataIndex: 'onSale',
      width: 80,
      render: (_, row) => <Switch checked={row.onSale} onChange={(v) => void onToggleSale(row, v)} />,
    },
    {
      title: '操作',
      width: 220,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEditor(row)}>
            编辑
          </Button>
          <Button
            size="small"
            onClick={() => {
              setStockTarget(row);
              setStockValue(row.stock);
            }}
          >
            改库存
          </Button>
          <Popconfirm
            title="删除商品"
            description="历史订单不受影响"
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={() => void onDelete(row)}
          >
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filtered = categoryFilter ? rows.filter((r) => r.categoryId === categoryFilter) : rows;

  return (
    <Card
      title="商品管理"
      extra={
        <Space>
          <Select
            style={{ width: 160 }}
            placeholder="全部分类"
            allowClear
            value={categoryFilter || undefined}
            onChange={(v) => setCategoryFilter(v ?? '')}
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
          />
          <Button type="primary" onClick={() => openEditor(null)}>
            新增商品
          </Button>
        </Space>
      }
    >
      <Table rowKey="id" loading={loading} columns={columns} dataSource={filtered} pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? '编辑商品' : '新增商品'}
        open={editorOpen}
        onCancel={closeEditor}
        onOk={() => void onSubmit()}
        confirmLoading={saving}
        okText="保存"
        width={560}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="商品名称" name="name" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input maxLength={50} placeholder="珍珠奶茶" />
          </Form.Item>
          <Form.Item label="分类" name="categoryId" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={categories.map((c) => ({ label: c.name, value: c.id }))} placeholder="选择分类" />
          </Form.Item>
          <Form.Item label="价格（元）" name="price" rules={[{ required: true, message: '请输入价格' }]}>
            <InputNumber min={0} precision={2} step={1} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
          <Form.Item label="库存" name="stock" tooltip="0 表示售罄，顾客端不可下单">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="规格组" name="specGroupIds" tooltip="顾客下单时需选择的杯型/甜度等">
            <Select
              mode="multiple"
              allowClear
              placeholder="不绑定规格组"
              options={specGroups.map((g) => ({ label: `${g.name}（${g.type === 'single' ? '单选' : '多选'}）`, value: g.id }))}
            />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
          <Form.Item label="图片 URL" name="image">
            <Input placeholder="https://cdn.example.com/p001.png" />
          </Form.Item>
          <Form.Item label="上架销售" name="onSale" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`调整库存${stockTarget ? `：${stockTarget.name}` : ''}`}
        open={!!stockTarget}
        onCancel={() => setStockTarget(null)}
        onOk={() => void onSubmitStock()}
        confirmLoading={saving}
        okText="保存"
      >
        <InputNumber min={0} precision={0} value={stockValue} onChange={(v) => setStockValue(v ?? 0)} style={{ width: '100%' }} />
      </Modal>
    </Card>
  );
}
