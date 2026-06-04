'use client';

import { theme } from 'antd';

export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    // 主色调
    colorPrimary: '#22C55E',
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3B82F6',

    // 背景色
    colorBgBase: '#0B1120',
    colorBgContainer: 'rgba(30, 41, 59, 0.8)',
    colorBgElevated: '#334155',
    colorBgLayout: '#0B1120',
    colorBgMask: 'rgba(0, 0, 0, 0.6)',

    // 文字色
    colorText: '#F8FAFC',
    colorTextSecondary: '#94A3B8',
    colorTextTertiary: '#64748B',
    colorTextQuaternary: '#475569',

    // 边框
    colorBorder: '#334155',
    colorBorderSecondary: 'rgba(51, 65, 85, 0.5)',

    // 圆角
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    // 字体
    fontFamily: "var(--font-dm-sans), -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 14,
    fontSizeHeading1: 30,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,

    // 间距
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,

    // 阴影
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
    boxShadowSecondary: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',

    // 动画
    motionDurationSlow: '0.3s',
    motionDurationMid: '0.2s',
    motionDurationFast: '0.1s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  components: {
    Button: {
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      borderRadius: 10,
      fontWeight: 500,
      primaryShadow: '0 4px 14px rgba(34, 197, 94, 0.3)',
    },
    Input: {
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      borderRadius: 10,
      activeBorderColor: '#22C55E',
      hoverBorderColor: '#4ADE80',
    },
    Select: {
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
      borderRadius: 10,
    },
    Card: {
      colorBgContainer: 'rgba(30, 41, 59, 0.8)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
      borderRadiusLG: 16,
      paddingLG: 24,
    },
    Menu: {
      colorItemBg: 'transparent',
      colorItemBgSelected: 'rgba(34, 197, 94, 0.1)',
      colorItemTextSelected: '#22C55E',
      colorItemBgHover: 'rgba(30, 41, 59, 0.5)',
      borderRadius: 10,
      itemMarginInline: 8,
      itemPaddingInline: 16,
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: 'rgba(30, 41, 59, 0.5)',
      headerColor: '#94A3B8',
      rowHoverBg: 'rgba(30, 41, 59, 0.3)',
      borderColor: 'rgba(51, 65, 85, 0.5)',
    },
    Modal: {
      contentBg: '#1E293B',
      headerBg: '#1E293B',
      titleColor: '#F8FAFC',
      borderRadiusLG: 16,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Tabs: {
      inkBarColor: '#22C55E',
      itemActiveColor: '#22C55E',
      itemHoverColor: '#4ADE80',
      itemSelectedColor: '#22C55E',
    },
    Switch: {
      colorPrimary: '#22C55E',
      colorPrimaryHover: '#4ADE80',
    },
    Slider: {
      trackBg: '#22C55E',
      trackHoverBg: '#4ADE80',
      handleColor: '#22C55E',
      handleActiveColor: '#4ADE80',
    },
    Progress: {
      defaultColor: '#22C55E',
    },
    Spin: {
      colorPrimary: '#22C55E',
    },
    Message: {
      contentBg: '#1E293B',
    },
    Notification: {
      colorBgElevated: '#1E293B',
    },
  },
  cssVar: true,
};

// 标题字体配置
export const headingStyle = {
  fontFamily: "var(--font-space-grotesk), -apple-system, BlinkMacSystemFont, sans-serif",
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

// 玻璃态卡片样式
export const glassCardStyle = {
  background: 'rgba(30, 41, 59, 0.8)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(51, 65, 85, 0.5)',
  borderRadius: 16,
};

// 发光效果样式
export const glowStyle = {
  boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)',
};
