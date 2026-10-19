import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Radio, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { acceptOrder, completeOrder, confirmPaymentOrder, listOrders } from '../../services/order';
import { ApiError } from '../../services/request';
import { formatPrice, formatTime } from '../../utils/format';
import { ADMIN_ORDER_STATUSES, PAY_METHOD_TEXT, STATUS_COLOR, STATUS_TEXT, availableActions } from '../../utils/order-status';
import { resetNewOrderCount } from '../../utils/new-order';
import type { OrderInfo, OrderStatus } from '../../types';

/**
 * 商家订单列表（specs/03-api.md §6.4，F-07）
 * 新单提醒由 App 外壳的 WS 推送，本页监听后刷新
 */
export default function OrdersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<OrderInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [loading, setLoading] = useState(false);

  const showError = (e: unknown) =>
    message.error(e instanceof ApiError ? e.message : '操作失败，请稍后重试');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await listOrders({ status: status || undefined, page, pageSize });
        setRows(data.list);
        setTotal(data.total);
        resetNewOrderCount();
      } catch (e) {
        showError(e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [status, page, pageSize],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => void load(true);
    window.addEventListener('admin:order-new', refresh);
    window.addEventListener('admin:order-status', refresh);
    return () => {
      window.removeEventListener('admin:order-new', refresh);
      window.removeEventListener('admin:order-status', refresh);
    };
  }, [load]);

  const runAction = async (row: OrderInfo, action: 'confirm_payment' | 'accept' | 'complete') => {
    try {
      if (action === 'confirm_payment') {
        await confirmPaymentOrder(row.id);
        message.success(`已确认收款：${row.outTradeNo}`);
      } else if (action === 'accept') {
        await acceptOrder(row.id);
        message.success(`已接单：${row.outTradeNo}`);
      } else {
        await completeOrder(row.id);
        message.success(`已出餐：${row.outTradeNo}`);
      }
      await load(true);
    } catch (e) {
      showError(e);
      await load(true);
    }
  };

  const columns: ColumnsType<OrderInfo> = [
    {
      title: '订单号',
      dataIndex: 'outTradeNo',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Link onClick={() => navigate(`/orders/${row.id}`)}>{row.outTradeNo}</Typography.Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatTime(row.createdAt)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '商品',
      dataIndex: 'items',
      render: (_, row) =>
        row.items.slice(0, 3).map((item) => (
          <div key={item.id} style={{ fontSize: 12 }}>
            {item.productName} ×{item.quantity}
            {item.specSnapshot ? <span style={{ color: '#999' }}>（{item.specSnapshot}）</span> : null}
          </div>
        )),
    },
    { title: '金额', dataIndex: 'totalAmount', width: 100, render: (amount: number) => formatPrice(amount) },
    {
      title: '支付',
      dataIndex: 'payMethod',
      width: 100,
      render: (method: keyof typeof PAY_METHOD_TEXT) => PAY_METHOD_TEXT[method] ?? method,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: OrderStatus) => <Tag color={STATUS_COLOR[value]}>{STATUS_TEXT[value] ?? value}</Tag>,
    },
    {
      title: '操作',
      width: 220,
      render: (_, row) => {
        const actions = availableActions(row.status, row.payMethod);
        return (
          <Space>
            {actions.includes('confirm_payment') ? (
              <Button size="small" type="primary" onClick={() => void runAction(row, 'confirm_payment')}>
                确认收款
              </Button>
            ) : null}
            {actions.includes('accept') ? (
              <Button size="small" type="primary" onClick={() => void runAction(row, 'accept')}>
                接单
              </Button>
            ) : null}
            {actions.includes('complete') ? (
              <Button size="small" type="primary" onClick={() => void runAction(row, 'complete')}>
                出餐
              </Button>
            ) : null}
            <Button size="small" onClick={() => navigate(`/orders/${row.id}`)}>
              详情
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="订单管理">
      <Radio.Group
        style={{ marginBottom: 16 }}
        value={status}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
        }}
        optionType="button"
        buttonStyle="solid"
      >
        <Radio.Button value="">全部</Radio.Button>
        {ADMIN_ORDER_STATUSES.map((s) => (
          <Radio.Button key={s} value={s}>
            {STATUS_TEXT[s]}
          </Radio.Button>
        ))}
      </Radio.Group>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 单`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </Card>
  );
}
