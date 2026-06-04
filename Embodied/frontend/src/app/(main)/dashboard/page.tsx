'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Typography, Button, Space, List, Tag, Spin } from 'antd';
import {
  PlayCircleOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { tasksApi } from '@/lib/api/tasks';
import { Task } from '@/types/inference';

const { Title, Text } = Typography;

const statusColors: Record<string, string> = {
  pending: 'orange',
  processing: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
};

const statusLabels: Record<string, string> = {
  pending: '排队中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const typeIcons: Record<string, React.ReactNode> = {
  image: <PlayCircleOutlined />,
  video: <VideoCameraOutlined />,
  batch: <FolderOutlined />,
};

// 统计卡片组件
function StatCard({
  title,
  value,
  suffix,
  icon,
  color,
  gradient,
}: {
  title: string;
  value: number | string;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}) {
  return (
    <Card
      style={{
        background: 'rgba(30, 41, 59, 0.8)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(51, 65, 85, 0.5)',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
      }}
      styles={{ body: { padding: '24px' } }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <Text style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>{title}</Text>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${color}33`,
            }}
          >
            {icon}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              color: '#F8FAFC',
              fontSize: '32px',
              fontWeight: 700,
              fontFamily: "var(--font-space-grotesk), sans-serif",
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {suffix && (
            <span style={{ color: '#64748B', fontSize: '16px', fontWeight: 500 }}>{suffix}</span>
          )}
        </div>
      </div>
      {/* 装饰性背景 */}
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `${color}10`,
          filter: 'blur(20px)',
        }}
      />
    </Card>
  );
}

// 快速入口卡片组件
function QuickActionCard({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(51, 65, 85, 0.3)',
        borderRadius: 14,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      styles={{ body: { padding: '20px', textAlign: 'center' } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.3)';
        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.2) 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: '24px', color: '#22C55E' }}>{icon}</span>
      </div>
      <Text style={{ color: '#F8FAFC', fontSize: '14px', fontWeight: 500 }}>{title}</Text>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    processing: 0,
    completed: 0,
    successRate: 0,
  });

  const fetchData = async () => {
    try {
      // 单次请求获取足够统计数据的任务列表
      const response = await tasksApi.list({ page: 1, size: 50 });
      setTasks(response.items.slice(0, 5));

      const total = response.total;
      const processing = response.items.filter(
        (t) => t.status === 'pending' || t.status === 'processing'
      ).length;
      const completed = response.items.filter((t) => t.status === 'completed').length;
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      setStats({ total, processing, completed, successRate });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 仅在有进行中任务时轮询
  useEffect(() => {
    if (loading) return;

    const hasProcessingTasks = tasks.some(
      (t) => t.status === 'pending' || t.status === 'processing'
    );

    if (hasProcessingTasks) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [tasks, loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* 页面标题 */}
      <div style={{ marginBottom: 32 }}>
        <Title
          level={2}
          style={{
            color: '#F8FAFC',
            margin: 0,
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          仪表盘
        </Title>
        <Text style={{ color: '#64748B', fontSize: '14px' }}>
          欢迎回来，这里是您的推理工作概览
        </Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={8}>
          <StatCard
            title="总任务数"
            value={stats.total}
            icon={<BarChartOutlined style={{ fontSize: '20px', color: '#fff' }} />}
            color="#3B82F6"
            gradient="linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="进行中"
            value={stats.processing}
            icon={<SyncOutlined style={{ fontSize: '20px', color: '#fff' }} />}
            color="#F59E0B"
            gradient="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="成功率"
            value={stats.successRate}
            suffix="%"
            icon={<RiseOutlined style={{ fontSize: '20px', color: '#fff' }} />}
            color="#22C55E"
            gradient="linear-gradient(135deg, #22C55E 0%, #16A34A 100%)"
          />
        </Col>
      </Row>

      {/* 快速入口 */}
      <div style={{ marginBottom: 32 }}>
        <Title level={4} style={{ color: '#F8FAFC', marginBottom: 16, fontFamily: "var(--font-space-grotesk), sans-serif" }}>
          <ThunderboltOutlined style={{ color: '#22C55E', marginRight: 8 }} />
          快速入口
        </Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <QuickActionCard
              title="图片推理"
              icon={<PlayCircleOutlined />}
              onClick={() => router.push('/inference')}
            />
          </Col>
          <Col xs={24} sm={8}>
            <QuickActionCard
              title="视频推理"
              icon={<VideoCameraOutlined />}
              onClick={() => router.push('/inference')}
            />
          </Col>
          <Col xs={24} sm={8}>
            <QuickActionCard
              title="批量推理"
              icon={<FolderOutlined />}
              onClick={() => router.push('/inference')}
            />
          </Col>
        </Row>
      </div>

      {/* 最近任务 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ color: '#F8FAFC', margin: 0, fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            <ClockCircleOutlined style={{ color: '#22C55E', marginRight: 8 }} />
            最近任务
          </Title>
          <Button
            type="link"
            icon={<ArrowRightOutlined />}
            onClick={() => router.push('/tasks')}
            style={{ color: '#22C55E', fontWeight: 500 }}
          >
            查看全部
          </Button>
        </div>
        <Card
          style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(51, 65, 85, 0.3)',
            borderRadius: 16,
          }}
          styles={{ body: { padding: 0 } }}
        >
          <List
            dataSource={tasks}
            loading={loading}
            locale={{
              emptyText: (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <CheckCircleOutlined style={{ fontSize: '32px', color: '#334155', marginBottom: '12px' }} />
                  <Text style={{ color: '#64748B', display: 'block' }}>暂无任务</Text>
                  <Button
                    type="link"
                    onClick={() => router.push('/inference')}
                    style={{ color: '#22C55E', marginTop: '8px' }}
                  >
                    创建第一个任务
                  </Button>
                </div>
              ),
            }}
            renderItem={(item) => (
              <List.Item
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onClick={() => router.push(`/tasks/${item.task_id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                actions={[
                  <Tag color={statusColors[item.status]} key="status" style={{ margin: 0 }}>
                    {statusLabels[item.status]}
                  </Tag>,
                  <Text style={{ color: '#475569', fontSize: '12px' }} key="time">
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </Text>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        background: 'rgba(34, 197, 94, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ color: '#22C55E', fontSize: '18px' }}>{typeIcons[item.task_type]}</span>
                    </div>
                  }
                  title={
                    <Text style={{ color: '#F8FAFC', fontWeight: 500 }}>
                      {item.params.task}
                      {item.params.phrase && (
                        <Text style={{ color: '#64748B', marginLeft: '8px' }}>- {item.params.phrase}</Text>
                      )}
                    </Text>
                  }
                  description={
                    <Text style={{ color: '#475569', fontSize: '12px' }}>
                      {item.task_type === 'image' ? '图片推理' : item.task_type === 'video' ? '视频推理' : '批量推理'}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
