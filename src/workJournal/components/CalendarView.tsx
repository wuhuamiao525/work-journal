import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar, Badge, Drawer, Spin, Tag, Typography, List, Empty,
  Row, Col, Statistic, Card, theme as antTheme,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, TeamOutlined, BookOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import type { DailyWorkJournal } from '../types';
import { WorkJournalStorage } from '../services/storage';

const { Text, Paragraph, Title } = Typography;

// 日历格子上显示的摘要（轻量数据）
interface DaySummary {
  taskCount: number;
  completedCount: number;
  meetingCount: number;
  hasDiary: boolean;
}

const CalendarView: React.FC = () => {
  const { token } = antTheme.useToken();
  const [summaryMap, setSummaryMap] = useState<Map<string, DaySummary>>(new Map());
  const [loadingSummary, setLoadingSummary] = useState(true);

  // 详情 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DailyWorkJournal | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 缓存已加载的详情
  const detailCache = useRef<Map<string, DailyWorkJournal>>(new Map());

  // 加载所有日期的摘要
  const loadSummaries = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      const map = new Map<string, DaySummary>();
      // 逐个加载（数据量不大，全量加载以便缓存复用）
      for (const date of dates) {
        const d = await WorkJournalStorage.get(date);
        if (!d) continue;
        detailCache.current.set(date, d);
        const allTasks = d.todos.flatMap((p) => p.tasks);
        // 只统计计划日期 = 当天的任务
        const plannedTasks = allTasks.filter((t) => t.plannedDate === date);
        map.set(date, {
          taskCount: plannedTasks.length,
          completedCount: plannedTasks.filter((t) => t.completed).length,
          meetingCount: d.meetings.filter(
            (m) => dayjs(m.time).format('YYYY-MM-DD') === date
          ).length,
          hasDiary: !!d.diary?.trim(),
        });
      }
      setSummaryMap(map);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // 点击日期格子
  const handleDateSelect = useCallback(async (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const summary = summaryMap.get(dateStr);
    if (!summary) return; // 无数据的日期不弹出

    setSelectedDate(dateStr);
    setDrawerOpen(true);

    // 使用缓存
    if (detailCache.current.has(dateStr)) {
      setDetailData(detailCache.current.get(dateStr)!);
      return;
    }

    setLoadingDetail(true);
    try {
      const d = await WorkJournalStorage.get(dateStr);
      if (d) {
        detailCache.current.set(dateStr, d);
        setDetailData(d);
      }
    } finally {
      setLoadingDetail(false);
    }
  }, [summaryMap]);

  // 日历格子渲染
  const dateCellRender = useCallback((date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    const summary = summaryMap.get(dateStr);
    if (!summary) return null;

    const completionRate = summary.taskCount > 0
      ? Math.round((summary.completedCount / summary.taskCount) * 100)
      : null;

    return (
      <div style={{ fontSize: 11, lineHeight: '18px', padding: '0 2px' }}>
        {summary.taskCount > 0 && (
          <div>
            <Badge
              status={completionRate === 100 ? 'success' : completionRate && completionRate > 50 ? 'processing' : 'warning'}
              text={
                <span style={{ fontSize: 11 }}>
                  {summary.completedCount}/{summary.taskCount} 任务
                </span>
              }
            />
          </div>
        )}
        {summary.meetingCount > 0 && (
          <div>
            <Badge
              color="purple"
              text={<span style={{ fontSize: 11 }}>{summary.meetingCount} 会议</span>}
            />
          </div>
        )}
        {summary.hasDiary && (
          <div>
            <Badge color="orange" text={<span style={{ fontSize: 11 }}>日记</span>} />
          </div>
        )}
      </div>
    );
  }, [summaryMap]);

  // Drawer 内容
  const renderDrawerContent = () => {
    if (loadingDetail) return <Spin />;
    if (!detailData) return <Empty description="暂无数据" />;

    const allTasks = detailData.todos
      .flatMap((p) => p.tasks.map((t) => ({ ...t, projectName: p.name })))
      .filter((t) => t.plannedDate === selectedDate);
    const completedTasks = allTasks.filter((t) => t.completed);
    const unfinishedTasks = allTasks.filter((t) => !t.completed);
    const meetings = detailData.meetings.filter(
      (m) => dayjs(m.time).format('YYYY-MM-DD') === selectedDate
    );

    return (
      <div>
        {/* 摘要统计 */}
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="完成任务"
                value={completedTasks.length}
                suffix={`/ ${allTasks.length}`}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="会议"
                value={meetings.length}
                prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1', fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="未完成"
                value={unfinishedTasks.length}
                prefix={<ClockCircleOutlined style={{ color: unfinishedTasks.length > 0 ? '#faad14' : '#999' }} />}
                valueStyle={{ color: unfinishedTasks.length > 0 ? '#faad14' : '#999', fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>

        {/* 任务列表 */}
        {allTasks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginBottom: 8 }}>
              <CheckCircleOutlined style={{ marginRight: 6 }} />
              任务
            </Title>
            <List
              size="small"
              dataSource={allTasks}
              renderItem={(task) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Tag color={task.completed ? 'success' : 'default'} style={{ flexShrink: 0 }}>
                      {task.projectName}
                    </Tag>
                    <Text
                      style={{
                        textDecoration: task.completed ? 'line-through' : 'none',
                        color: task.completed ? token.colorTextDisabled : token.colorText,
                        flex: 1,
                      }}
                    >
                      {task.content}
                    </Text>
                    {task.plannedDate && (
                      <Tag color={
                        !task.completed && dayjs(task.plannedDate).isBefore(dayjs(), 'day') ? 'red' : 'blue'
                      }>
                        {task.plannedDate}
                      </Tag>
                    )}
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}

        {/* 会议列表 */}
        {meetings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginBottom: 8 }}>
              <TeamOutlined style={{ marginRight: 6 }} />
              会议
            </Title>
            <List
              size="small"
              dataSource={meetings}
              renderItem={(m) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={m.completed ? 'success' : 'purple'}>{m.completed ? '已完成' : '进行中'}</Tag>
                    <Text>{m.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{m.time}</Text>
                    {m.location && <Text type="secondary" style={{ fontSize: 12 }}>@{m.location}</Text>}
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}

        {/* 日记 */}
        {detailData.diary?.trim() && (
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              <BookOutlined style={{ marginRight: 6 }} />
              日记
            </Title>
            <Paragraph
              style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: token.colorBgLayout, padding: 12, borderRadius: 6 }}
              ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}
            >
              {detailData.diary}
            </Paragraph>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Spin spinning={loadingSummary}>
        <Calendar
          cellRender={(date, info) => {
            if (info.type === 'date') return dateCellRender(date);
            return null;
          }}
          onSelect={handleDateSelect}
          style={{ background: token.colorBgContainer, borderRadius: 8, padding: 8 }}
        />
      </Spin>

      <Drawer
        title={selectedDate ? `${selectedDate} 工作日志` : '日志详情'}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setDetailData(null); }}
        width={600}
        destroyOnClose
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
};

export default CalendarView;
