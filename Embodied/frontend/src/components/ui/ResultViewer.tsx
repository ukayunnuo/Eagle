'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, Typography, Space, Tag, Button, Tooltip } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Box } from '@/types/inference';

const { Text } = Typography;

interface ResultViewerProps {
  imageUrl: string;
  boxes?: Box[];
  onBoxClick?: (box: Box) => void;
  onDownload?: () => void;
}

export default function ResultViewer({
  imageUrl,
  boxes = [],
  onBoxClick,
  onDownload,
}: ResultViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [hoveredBox, setHoveredBox] = useState<number | null>(null);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [position]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // 计算 bounding box 在显示时的坐标
  const getBoxStyle = useCallback(
    (box: Box) => {
      if (imageSize.width === 0 || imageSize.height === 0) return {};

      const container = containerRef.current;
      if (!container) return {};

      const containerRect = container.getBoundingClientRect();
      const scaleX = containerRect.width / imageSize.width;
      const scaleY = containerRect.height / imageSize.height;
      const fitScale = Math.min(scaleX, scaleY);

      const offsetX = (containerRect.width - imageSize.width * fitScale) / 2;
      const offsetY = (containerRect.height - imageSize.height * fitScale) / 2;

      return {
        position: 'absolute' as const,
        left: `${offsetX + box.x1 * fitScale}px`,
        top: `${offsetY + box.y1 * fitScale}px`,
        width: `${(box.x2 - box.x1) * fitScale}px`,
        height: `${(box.y2 - box.y1) * fitScale}px`,
        border: '2px solid #22C55E',
        backgroundColor: hoveredBox === boxes.indexOf(box) ? 'rgba(34, 197, 94, 0.3)' : 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      };
    },
    [imageSize, hoveredBox, boxes]
  );

  return (
    <Card
      style={{
        background: '#1E293B',
        border: '1px solid #334155',
        borderRadius: 12,
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#F8FAFC', fontWeight: 600 }}>标注结果</Text>
          <Space>
            <Tooltip title="缩小">
              <Button
                type="text"
                icon={<ZoomOutOutlined />}
                onClick={handleZoomOut}
                style={{ color: '#94A3B8' }}
              />
            </Tooltip>
            <Text style={{ color: '#94A3B8', fontFamily: "var(--font-fira-code), monospace", minWidth: '50px', textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </Text>
            <Tooltip title="放大">
              <Button
                type="text"
                icon={<ZoomInOutlined />}
                onClick={handleZoomIn}
                style={{ color: '#94A3B8' }}
              />
            </Tooltip>
            <Tooltip title="重置">
              <Button
                type="text"
                icon={<ExpandOutlined />}
                onClick={handleReset}
                style={{ color: '#94A3B8' }}
              />
            </Tooltip>
            {onDownload && (
              <Tooltip title="下载">
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  onClick={onDownload}
                  style={{ color: '#22C55E' }}
                />
              </Tooltip>
            )}
          </Space>
        </div>

        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '400px',
            overflow: 'hidden',
            borderRadius: '8px',
            background: '#0F172A',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s',
            }}
          >
            <img
              src={imageUrl}
              alt="Result"
              onLoad={handleImageLoad}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* Bounding Boxes */}
          {boxes.map((box, index) => (
            <div
              key={index}
              style={getBoxStyle(box)}
              onMouseEnter={() => setHoveredBox(index)}
              onMouseLeave={() => setHoveredBox(null)}
              onClick={() => onBoxClick?.(box)}
            >
              {hoveredBox === index && (
                <Tag
                  color="#22C55E"
                  style={{
                    position: 'absolute',
                    top: '-24px',
                    left: 0,
                    fontSize: '12px',
                  }}
                >
                  {box.label}
                </Tag>
              )}
            </div>
          ))}
        </div>

        {/* Box 列表 */}
        {boxes.length > 0 && (
          <div>
            <Text style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>
              检测到 {boxes.length} 个目标
            </Text>
            <Space wrap>
              {boxes.map((box, index) => (
                <Tag
                  key={index}
                  color={hoveredBox === index ? '#22C55E' : 'default'}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredBox(index)}
                  onMouseLeave={() => setHoveredBox(null)}
                >
                  {box.label}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
}
