'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Button, Avatar, Dropdown, Drawer } from 'antd';
import {
  DashboardOutlined,
  PlayCircleOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useUserStore } from '@/stores/userStore';

const { Sider } = Layout;

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/inference',
    icon: <PlayCircleOutlined />,
    label: '推理工作台',
  },
  {
    key: '/tasks',
    icon: <UnorderedListOutlined />,
    label: '任务管理',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '用户设置',
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useUserStore();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setDrawerOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMenuClick = (info: { key: string }) => {
    router.push(info.key);
    if (isMobile) {
      setDrawerOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => router.push('/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const sidebarContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? '20px 12px' : '20px 24px',
          borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            }}
          >
            <ThunderboltOutlined style={{ fontSize: '18px', color: '#fff' }} />
          </div>
          {!collapsed && (
            <div>
              <h1
                style={{
                  color: '#F8FAFC',
                  fontSize: '1.1rem',
                  margin: 0,
                  fontWeight: 700,
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                  letterSpacing: '-0.02em',
                }}
              >
                <span style={{ color: '#22C55E' }}>Locate</span>Anything
              </h1>
              <span style={{ color: '#64748B', fontSize: '11px' }}>Visual Grounding AI</span>
            </div>
          )}
        </div>
      </div>

      {/* 菜单 */}
      <div style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            background: 'transparent',
            borderRight: 'none',
          }}
        />
      </div>

      {/* 折叠按钮 */}
      {!isMobile && (
        <div style={{ padding: '0 8px 8px' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              height: 40,
              borderRadius: 10,
            }}
          >
            {!collapsed && '收起菜单'}
          </Button>
        </div>
      )}

      {/* 用户信息 */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid rgba(51, 65, 85, 0.3)',
          background: 'rgba(15, 23, 42, 0.3)',
        }}
      >
        <Dropdown menu={{ items: userMenuItems }} placement="topRight" trigger={['click']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: '10px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <Avatar
              size={36}
              icon={<UserOutlined />}
              style={{
                background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
              }}
            />
            {(!collapsed || isMobile) && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    color: '#F8FAFC',
                    fontSize: '13px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.username || '用户'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#22C55E',
                      boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)',
                    }}
                  />
                  <span style={{ color: '#64748B', fontSize: '11px' }}>在线</span>
                </div>
              </div>
            )}
          </div>
        </Dropdown>
      </div>
    </div>
  );

  // 移动端使用 Drawer
  if (isMobile) {
    return (
      <>
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerOpen(true)}
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1000,
            color: '#F8FAFC',
            background: 'rgba(30, 41, 59, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(51, 65, 85, 0.5)',
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        <Drawer
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          width={260}
          styles={{
            body: {
              padding: 0,
              background: 'linear-gradient(180deg, #0B1120 0%, #0F172A 100%)',
            },
            header: {
              display: 'none',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
      </>
    );
  }

  // 桌面端使用 Sider
  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      style={{
        background: 'linear-gradient(180deg, #0B1120 0%, #0F172A 100%)',
        borderRight: '1px solid rgba(51, 65, 85, 0.3)',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        overflow: 'hidden',
      }}
      width={260}
      collapsedWidth={72}
    >
      {sidebarContent}
    </Sider>
  );
}
