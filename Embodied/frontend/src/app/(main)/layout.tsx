'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout, Spin } from 'antd';
import Sidebar from '@/components/layout/Sidebar';
import { useUserStore } from '@/stores/userStore';

const { Content } = Layout;

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, user, fetchUserInfo } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        // 已有用户数据时跳过重复请求
        if (!user) {
          await fetchUserInfo();
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [fetchUserInfo, router]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#0F172A',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout
        style={{
          marginLeft: isMobile ? 0 : 250,
          transition: 'margin-left 0.2s',
          background: '#0F172A',
        }}
      >
        <Content
          style={{
            padding: isMobile ? '16px' : '24px',
            paddingTop: isMobile ? '60px' : '24px', // 为移动端菜单按钮留出空间
            minHeight: '100vh',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
