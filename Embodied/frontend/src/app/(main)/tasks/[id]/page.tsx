'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Descriptions,
  Spin,
  message,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  StopOutlined,
  DownloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { tasksApi } from '@/lib/api/tasks';
import { Task } from '@/types/inference';
import ResultViewer from '@/components/ui/ResultViewer';
import ProgressCard from '@/components/ui/ProgressCard';

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

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTask = useCallback(async () => {
    try {
      const data = await tasksApi.get(taskId);
      setTask(data);
    } catch (error) {
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  // 自动刷新处理中的任务
  useEffect(() => {
    if (task && (task.status === 'pending' || task.status === 'processing')) {
      const interval = setInterval(fetchTask, 2000);
      return () => clearInterval(interval);
    }
  }, [task, fetchTask]);

  const handleDelete = async () => {
    try {
      await tasksApi.delete(taskId);
      message.success('任务已删除');
      router.push('/tasks');
    } catch (error) {
      message.error('删除任务失败');
    }
  };

  const handleDownload = () => {
    if (task?.result?.annotated_image_url) {
      const link = document.createElement('a');
      link.href = task.result.annotated_image_url;
      link.download = `result_${taskId}.jpg`;
      link.click();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <Title level={3} style={{ color: '#F8FAFC' }}>任务不存在</Title>
        <Button type="primary" onClick={() => router.push('/tasks')}>
          返回任务列表
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/tasks')}
            style={{ color: '#94A3B8' }}
          >
            返回
          </Button>
          <Title level={2} style={{ color: '#F8FAFC', margin: 0 }}>
            任务详情
          </Title>
        </Space>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={task.status !== 'completed'}
            style={{ color: '#22C55E' }}
          >
            下载结果
          </Button>
          <Popconfirm
            title="确定要删除这个任务吗？"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              删除任务
            </Button>
          </Popconfirm>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* 左侧信息 */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 任务信息 */}
            <Card
              title={<Text style={{ color: '#F8FAFC' }}>📋 任务信息</Text>}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: 12,
              }}
            >
              <Descriptions column={1} labelStyle={{ color: '#94A3B8' }} contentStyle={{ color: '#F8FAFC' }}>
                <Descriptions.Item label="任务 ID">
                  <Text code style={{ color: '#22C55E' }}>{task.task_id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="任务类型">
                  <Space>
                    <span style={{ color: '#22C55E' }}>{typeIcons[task.task_type]}</span>
                    {typeLabels[task.task_type]}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColors[task.status]} icon={statusIcons[task.status]}>
                    {statusLabels[task.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="任务参数">
                  {task.params.task}
                  {task.params.phrase && ` - ${task.params.phrase}`}
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {new Date(task.created_at).toLocaleString('zh-CN')}
                </Descriptions.Item>
                {task.started_at && (
                  <Descriptions.Item label="开始时间">
                    {new Date(task.started_at).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                )}
                {task.completed_at && (
                  <Descriptions.Item label="完成时间">
                    {new Date(task.completed_at).toLocaleString('zh-CN')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* 进度信息 */}
            {(task.status === 'pending' || task.status === 'processing') && (
              <ProgressCard
                status={task.status}
                progress={
                  task.progress
                    ? Math.round((task.progress.current_frame / task.progress.total_frames) * 100)
                    : 0
                }
                message={
                  task.progress
                    ? `处理帧: ${task.progress.current_frame}/${task.progress.total_frames}`
                    : undefined
                }
                taskId={task.task_id}
              />
            )}

            {/* 错误信息 */}
            {task.status === 'failed' && task.error && (
              <ProgressCard
                status="failed"
                message={task.error}
              />
            )}
          </Space>
        </div>

        {/* 右侧结果 */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          {task.status === 'completed' && task.result ? (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {task.task_type === 'video' ? (
                <Card
                  title={<Text style={{ color: '#F8FAFC' }}>🎬 视频结果</Text>}
                  style={{
                    background: '#1E293B',
                    border: '1px solid #334155',
                    borderRadius: 12,
                  }}
                >
                  <video
                    src={task.result.annotated_image_url}
                    controls
                    style={{ width: '100%', borderRadius: '8px' }}
                  />
                </Card>
              ) : (
                <ResultViewer
                  imageUrl={task.result.annotated_image_url}
                  boxes={task.result.boxes}
                  onDownload={handleDownload}
                />
              )}

              <Card
                title={<Text style={{ color: '#F8FAFC' }}>📊 推理详情</Text>}
                style={{
                  background: '#1E293B',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text style={{ color: '#94A3B8' }}>模型输出：</Text>
                    <div style={{
                      background: '#0F172A',
                      padding: '12px',
                      borderRadius: '8px',
                      marginTop: '8px',
                      fontFamily: "var(--font-fira-code), monospace",
                      fontSize: '12px',
                      color: '#22C55E',
                      overflowX: 'auto',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}>
                      {task.result.answer}
                    </div>
                  </div>

                  {task.result.stats && (
                    <div>
                      <Text style={{ color: '#94A3B8' }}>统计信息：</Text>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <Space>
                          <Text style={{ color: '#64748B' }}>解码模式：</Text>
                          <Text style={{ color: '#F8FAFC' }}>{task.result.stats.decode_mode}</Text>
                        </Space>
                        <Space>
                          <Text style={{ color: '#64748B' }}>Token数：</Text>
                          <Text style={{ color: '#F8FAFC' }}>{task.result.stats.tokens}</Text>
                        </Space>
                        <Space>
                          <Text style={{ color: '#64748B' }}>耗时：</Text>
                          <Text style={{ color: '#F8FAFC' }}>{task.result.stats.time_ms.toFixed(1)}ms</Text>
                        </Space>
                      </div>
                    </div>
                  )}
                </Space>
              </Card>
            </Space>
          ) : (
            <Card
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                borderRadius: 12,
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div style={{ textAlign: 'center', padding: '60px' }}>
                {task.status === 'pending' || task.status === 'processing' ? (
                  <>
                    <SyncOutlined spin style={{ fontSize: '48px', color: '#334155', marginBottom: '16px' }} />
                    <Text style={{ color: '#64748B', display: 'block' }}>
                      任务处理中，请稍候...
                    </Text>
                  </>
                ) : (
                  <>
                    <CloseCircleOutlined style={{ fontSize: '48px', color: '#334155', marginBottom: '16px' }} />
                    <Text style={{ color: '#64748B', display: 'block' }}>
                      暂无结果
                    </Text>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
