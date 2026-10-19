import { Card, Descriptions, Layout, Typography } from 'antd';
import { NavLink } from 'react-router-dom';
import { getSession } from '../../utils/session';

const ROLE_TEXT: Record<string, string> = { owner: '店长', staff: '店员' };

/** 工作台：登录态与门店信息入口 */
export default function DashboardPage() {
  const session = getSession();

  return (
    <Layout.Content style={{ padding: 0 }}>
      <Card title="工作台">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="登录账号">{session?.username ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="角色">
            {ROLE_TEXT[session?.role ?? ''] ?? session?.role ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="门店 ID">{session?.merchantId ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="常用入口" style={{ marginTop: 16 }}>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <NavLink to="/orders">订单管理</NavLink>：接单、完成、取消、打印小票
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 8 }}>
          <NavLink to="/menu/products">商品管理</NavLink>：上下架、改价、调库存
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          <NavLink to="/settings/business">营业设置</NavLink>：营业中/打烊、自提支付、公告
        </Typography.Paragraph>
      </Card>
    </Layout.Content>
  );
}
