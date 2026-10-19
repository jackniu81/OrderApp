import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { acceptOrder, cancelOrder, completeOrder, getOrder, printOrder } from '../../services/order';
import { listPrinters } from '../../services/printer';
import { ApiError } from '../../services/request';
import { formatPrice, formatTime } from '../../utils/format';
import { PAY_METHOD_TEXT, STATUS_COLOR, STATUS_TEXT, availableActions } from '../../utils/order-status';
import type { OrderInfo, OrderItemInfo, OrderStatus, PrinterInfo } from '../../types';

const itemColumns: ColumnsType<OrderItemInfo> = [
  { title: '商品', dataIndex: 'productName' },
  {
    title: '规格',
    dataIndex: 'specSnapshot',
    render: (value: string | null) => value ?? <Typography.Text type="secondary">-</Typography.Text>,
  },
  { title: '备注', dataIndex: 'remark', render: (value: string | null) => value ?? '-' },
  { title: '数量', dataIndex: 'quantity', width: 70 },
  { title: '单价', dataIndex: 'price', width: 90, render: (price: number) => formatPrice(price) },
  { title: '小计', dataIndex: 'subtotal', width: 90, render: (subtotal: number) => formatPrice(subtotal) },
];

/** 订单详情：接单/出餐/取消/打印（specs/03-api.md §6.5-§6.7 + §8.3） */
export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [printOpen, setPrintOpen] = useState(false);
  const [printerId, setPrinterId] = useState<string>('');

  const showError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试');

  const load = useCallback(async () => {
    try {
      setOrder(await getOrder(id));
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onStatusEvent = (evt: Event) => {
      const detail = (evt as CustomEvent<{ orderId: string }>).detail;
      if (detail?.orderId === id) void load();
    };
    window.addEventListener('admin:order-status', onStatusEvent);
    return () => window.removeEventListener('admin:order-status', onStatusEvent);
  }, [id, load]);

  const runAction = async (action: 'accept' | 'complete') => {
    setActing(true);
    try {
      if (action === 'accept') await acceptOrder(id);
      else await completeOrder(id);
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setActing(false);
    }
  };

  const onSubmitCancel = async () => {
    if (!reason.trim()) {
      message.warning('请填写取消原因');
      return;
    }
    setActing(true);
    try {
      await cancelOrder(id, reason.trim());
      message.success('订单已取消');
      setCancelOpen(false);
      setReason('');
      await load();
    } catch (e) {
      showError(e);
    } finally {
      setActing(false);
    }
  };

  const openPrintModal = async () => {
    setPrintOpen(true);
    try {
      const list = await listPrinters();
      setPrinters(list);
      setPrinterId((prev) => prev || list[0]?.id || '');
    } catch (e) {
      showError(e);
    }
  };

  const onSubmitPrint = async () => {
    if (!printerId) {
      message.warning('请先在打印机配置中添加打印机');
      return;
    }
    setActing(true);
    try {
      const result = await printOrder(id, printerId);
      message.success(`已下发打印任务：${result.printId}`);
      setPrintOpen(false);
    } catch (e) {
      // 4001：打印机离线或未配置
      showError(e);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  if (!order) {
    return (
      <Card>
        <Typography.Text>订单不存在或不属于本门店</Typography.Text>
      </Card>
    );
  }

  const actions = availableActions(order.status);

  return (
    <Card
      title={
        <Space>
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
            返回
          </Button>
          <span>订单 {order.outTradeNo}</span>
          <Tag color={STATUS_COLOR[order.status]}>{STATUS_TEXT[order.status] ?? order.status}</Tag>
        </Space>
      }
      extra={
        <Space>
          {actions.includes('accept') ? (
            <Button type="primary" loading={acting} onClick={() => void runAction('accept')}>
              接单
            </Button>
          ) : null}
          {actions.includes('complete') ? (
            <Button type="primary" loading={acting} onClick={() => void runAction('complete')}>
              出餐
            </Button>
          ) : null}
          <Button onClick={() => void openPrintModal()}>打印小票</Button>
          {actions.includes('cancel') ? (
            <Button danger onClick={() => setCancelOpen(true)}>
              取消订单
            </Button>
          ) : null}
        </Space>
      }
    >
      <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="下单时间">{formatTime(order.createdAt)}</Descriptions.Item>
        <Descriptions.Item label="支付方式">
          {PAY_METHOD_TEXT[order.payMethod]}（{order.payStatus === 'paid' ? '已支付' : order.payStatus === 'pending' ? '支付中' : '未支付'}）
        </Descriptions.Item>
        <Descriptions.Item label="支付时间">{formatTime(order.paidAt)}</Descriptions.Item>
        <Descriptions.Item label="接单时间">{formatTime(order.acceptedAt)}</Descriptions.Item>
        <Descriptions.Item label="完成时间">{formatTime(order.completedAt)}</Descriptions.Item>
        <Descriptions.Item label="取消时间">{formatTime(order.cancelledAt)}</Descriptions.Item>
        <Descriptions.Item label="顾客备注">{order.remark ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="取消原因">{order.cancelReason ?? '-'}</Descriptions.Item>
      </Descriptions>

      <Table rowKey="id" size="small" columns={itemColumns} dataSource={order.items} pagination={false} />

      <Typography.Paragraph style={{ marginTop: 16, textAlign: 'right' }} strong>
        合计 {formatPrice(order.totalAmount)}
      </Typography.Paragraph>

      <Modal
        title="取消订单"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={() => void onSubmitCancel()}
        confirmLoading={acting}
        okText="确认取消"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea
          rows={3}
          maxLength={100}
          placeholder="如：商品售罄"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          已支付订单将自动发起退款。
        </Typography.Paragraph>
      </Modal>

      <Modal
        title="打印小票"
        open={printOpen}
        onCancel={() => setPrintOpen(false)}
        onOk={() => void onSubmitPrint()}
        confirmLoading={acting}
        okText="打印"
      >
        {printers.length ? (
          <Select
            style={{ width: '100%' }}
            value={printerId || undefined}
            onChange={setPrinterId}
            options={printers.map((p) => ({
              label: `${p.name}（${p.sn}）${p.online ? '' : ' · 离线'}`,
              value: p.id,
            }))}
          />
        ) : (
          <Typography.Text type="danger">尚未配置打印机，请先在「门店设置 → 打印机配置」中添加。</Typography.Text>
        )}
      </Modal>
    </Card>
  );
}
