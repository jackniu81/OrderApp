import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Layout, Menu, Space, Typography, notification } from 'antd';
import {
  CoffeeOutlined,
  DashboardOutlined,
  LogoutOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import CategoriesPage from './pages/menu/categories';
import ProductsPage from './pages/menu/products';
import SpecGroupsPage from './pages/menu/spec-groups';
import OrdersPage from './pages/orders';
import OrderDetailPage from './pages/orders/detail';
import BusinessPage from './pages/settings/business';
import PrinterPage from './pages/settings/printer';
import { clearSession, getSession } from './utils/session';
import { subscribeAdminOrders } from './services/ws';
import { beep, bumpNewOrder, resetNewOrderCount, subscribeNewOrderCount } from './utils/new-order';
import { formatPrice } from './utils/format';

const { Header, Sider, Content } = Layout;

function RequireAuth({ children }: { children: ReactNode }) {
  const session = getSession();
  return session?.token ? <>{children}</> : <Navigate to="/login" replace />;
}

/** 一级/二级菜单当前展开项 */
function openKeysOf(pathname: string): string[] {
  if (pathname.startsWith('/menu')) return ['menu'];
  if (pathname.startsWith('/settings')) return ['settings'];
  return [];
}

function Shell() {
  const session = getSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [openKeys, setOpenKeys] = useState<string[]>(openKeysOf(pathname));

  useEffect(() => subscribeNewOrderCount(setPendingCount), []);

  // 路由变化时展开当前所属的二级菜单
  useEffect(() => {
    setOpenKeys((prev) => Array.from(new Set([...prev, ...openKeysOf(pathname)])));
  }, [pathname]);

  useEffect(() => {
    if (!session?.merchantId) return;
    return subscribeAdminOrders(session.merchantId, {
      onNewOrder: (e) => {
        bumpNewOrder();
        beep();
        window.dispatchEvent(new CustomEvent('admin:order-new', { detail: e }));
        notification.info({
          message: '收到新订单',
          description: `${formatPrice(e.totalAmount)} · ${e.items.length} 件商品`,
          placement: 'topRight',
          actions: (
            <Button size="small" type="primary" onClick={() => navigate('/orders')}>
              去接单
            </Button>
          ),
        });
      },
      // 商家自己操作也会推送，页面据此刷新，不额外弹窗
      onOrderStatus: (e) => {
        window.dispatchEvent(new CustomEvent('admin:order-status', { detail: e }));
      },
    });
  }, [session?.merchantId, navigate]);

  const onLogout = () => {
    clearSession();
    resetNewOrderCount();
    navigate('/login', { replace: true });
  };

  const items = useMemo(
    () => [
      { key: '/', icon: <DashboardOutlined />, label: <NavLink to="/">工作台</NavLink> },
      {
        key: 'menu',
        icon: <CoffeeOutlined />,
        label: '菜单管理',
        children: [
          { key: '/menu/categories', label: <NavLink to="/menu/categories">分类</NavLink> },
          { key: '/menu/products', label: <NavLink to="/menu/products">商品</NavLink> },
          { key: '/menu/spec-groups', label: <NavLink to="/menu/spec-groups">规格组</NavLink> },
        ],
      },
      {
        key: '/orders',
        icon: <ProfileOutlined />,
        label: (
          <NavLink to="/orders">
            <Badge count={pendingCount} size="small" offset={[8, 0]}>
              订单管理
            </Badge>
          </NavLink>
        ),
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: '门店设置',
        children: [
          { key: '/settings/business', label: <NavLink to="/settings/business">营业设置</NavLink> },
          { key: '/settings/printer', label: <NavLink to="/settings/printer">打印机配置</NavLink> },
        ],
      },
    ],
    [pendingCount],
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <Space>
          <ShopOutlined style={{ color: '#fff', fontSize: 18 }} />
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            商家后台
          </Typography.Title>
        </Space>
        <Space style={{ marginLeft: 'auto' }}>
          <Typography.Text style={{ color: '#fff' }}>{session?.username ?? '-'}</Typography.Text>
          <Button size="small" icon={<LogoutOutlined />} onClick={onLogout}>
            退出登录
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={180} theme="light" breakpoint="lg" collapsedWidth={0}>
          <Menu
            mode="inline"
            items={items}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            selectedKeys={[pathname]}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="menu/categories" element={<CategoriesPage />} />
            <Route path="menu/products" element={<ProductsPage />} />
            <Route path="menu/spec-groups" element={<SpecGroupsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="settings/business" element={<BusinessPage />} />
            <Route path="settings/printer" element={<PrinterPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
