'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Typography,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  PlayCircleOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { tasksApi, TaskListParams } from '@/lib/api/tasks';
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

const statusIcons: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined />,
  processing: <SyncOutlined spin />,
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  cancelled: <StopOutlined />,
};

const typeIcons: Record<string, React.ReactNode> = {
  image: <PlayCircleOutlined />,
  video: <VideoCameraOutlined />,
  batch: <FolderOutlined />,
};

const typeLabels: Record<string, string> = {
  image: '图片推理',
  video: '视频推理',
  batch: '批量推理',
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [params, setParams] = useState<TaskListParams>({
    page: 1,
    size: 10,
    status: undefined,
  });
  const [searchText, setSearchText] = useState('');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await tasksApi.list(params);
      setTasks(response.items);
      setTotal(response.total);
    } catch (error) {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 自动刷新处理中的任务
  useEffect(() => {
    const hasProcessingTasks = tasks.some(
      (t) => t.status === 'pending' || t.status === 'processing'
    );

    if (hasProcessingTasks) {
      const interval = setInterval(fetchTasks, 3000);
      return () => clearInterval(interval);
    }
  }, [tasks, fetchTasks]);

  const handleDelete = async (taskId: string) => {
    try {
      await tasksApi.delete(taskId);
      message.success('任务已删除');
      fetchTasks();
    } catch (error) {
      message.error('删除任务失败');
    }
  };

  const handleViewDetail = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'task_type',
      key: 'task_type',
      width: 100,
      render: (type: string) => (
        <Space>
          <span style={{ color: '#22C55E' }}>{typeIcons[type]}</span>
          <Text style={{ color: '#F8FAFC' }}>{typeLabels[type]}</Text>
        </Space>
      ),
    },
    {
      title: '任务',
      key: 'task',
      render: (_: unknown, record: Task) => (
        <div>
          <Text style={{ color: '#F8FAFC' }}>{record.params.task}</Text>
          {record.params.phrase && (
            <Text style={{ color: '#64748B', marginLeft: '8px' }}>
              - {record.params.phrase}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: Task) => (
        <div>
          <Tag color={statusColors[status]} icon={statusIcons[status]}>
            {statusLabels[status]}
          </Tag>
          {record.progress && status === 'processing' && (
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
              {record.progress.current_frame}/{record.progress.total_frames} 帧
            </div>
          )}
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (time: string) => (
        <Text style={{ color: '#94A3B8' }}>
          {new Date(time).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Task) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record.task_id)}
              style={{ color: '#22C55E' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个任务吗？"
            onConfirm={() => handleDelete(record.task_id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ color: '#F8FAFC', margin: 0 }}>
          任务管理
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchTasks}
          style={{ color: '#94A3B8' }}
        >
          刷新
        </Button>
      </div>

      <Card
        style={{
          background: '#1E293B',
          border: '1px solid #334155',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setParams({ ...params, status: value, page: 1 })}
            options={[
              { value: 'pending', label: '排队中' },
              { value: 'processing', label: '处理中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '失败' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
          <Input
            placeholder="搜索任务..."
            prefix={<SearchOutlined style={{ color: '#64748B' }} />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => fetchTasks()}
          />
        </div>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="task_id"
          loading={loading}
          pagination={{
            current: params.page,
            pageSize: params.size,
            total,
            onChange: (page, pageSize) => setParams({ ...params, page, size: pageSize }),
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          style={{ background: 'transparent' }}
        />
      </Card>
    </div>
  );
}
