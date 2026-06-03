import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Card, Statistic, Spin, Progress, Table, Tag, Empty, Drawer, Typography, Tooltip as AntTooltip, theme as antTheme } from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine,
} from 'recharts';
import { CheckCircleOutlined, ClockCircleOutlined, ProjectOutlined, TeamOutlined, FireOutlined, WarningOutlined } from '@ant-design/icons';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { DailyWorkJournal, TodoProject, TodoTask, Meeting } from '../types';
import { WorkJournalStorage } from '../services/storage';

dayjs.extend(isoWeek);

const { Text } = Typography;

const PIE_COLORS = ['#1677ff', '#52c41a', '#faad14'];
const PIE_STATUS_MAP: Record<string, string> = {
  '进行中': 'inProgress',
  '已交付': 'delivered',
  '已验收': 'accepted',
};

function deduplicateAllTasks(list: DailyWorkJournal[]) {
  const completedKeys = new Set<string>();
  const allItems: { task: TodoTask; projName: string; date: string }[] = [];
  for (const d of list) {
    for (const proj of d.todos as TodoProject[]) {
      for (const t of proj.tasks) {
        const key = `${t.content}__${proj.name}__${t.plannedDate || ''}`;
        if (t.completed) completedKeys.add(key);
        allItems.push({ task: t, projName: proj.name, date: d.date });
      }
    }
  }
  const seen = new Map<string, typeof allItems[0]>();
  for (const item of allItems) {
    const key = `${item.task.content}__${item.projName}__${item.task.plannedDate || ''}`;
    const existing = seen.get(key);
    if (!existing || item.date > existing.date) seen.set(key, item);
  }
  return { uniqueItems: Array.from(seen.values()), completedKeys };
}

function deduplicateAllMeetings(list: DailyWorkJournal[]): Meeting[] {
  const seen = new Map<string, Meeting>();
  for (const d of list) {
    for (const m of d.meetings) {
      const key = `${m.name}__${dayjs(m.time).format('YYYY-MM-DD')}`;
      if (!seen.has(key)) seen.set(key, m);
    }
  }
  return Array.from(seen.values());
}

type DrawerConfig =
  | { type: 'weekTasks'; title: string }
  | { type: 'monthTasks'; title: string }
  | { type: 'weekMeetings'; title: string }
  | { type: 'projects'; title: string }
  | { type: 'projectStatus'; title: string; status: string }
  | { type: 'projectTasks'; title: string; projectName: string }
  | { type: 'dayTasks'; title: string; date: string }
  | { type: 'healthDetail'; title: string; projectName: string }
  | null;

const taskColumns = [
  {
    title: '任务内容', dataIndex: 'content', key: 'content',
    render: (text: string, record: any) => (
      <span style={{ textDecoration: record.isCompleted ? 'line-through' : 'none', color: record.isCompleted ? 'var(--ant-color-text-quaternary, #bbb)' : 'inherit' }}>{text}</span>
    ),
  },
  { title: '所属项目', dataIndex: 'projName', key: 'projName', width: 150, render: (v: string) => <Tag color="blue" bordered={false}>{v}</Tag> },
  {
    title: '计划日期', dataIndex: 'plannedDate', key: 'plannedDate', width: 120,
    render: (v: string) => v ? <Tag color={dayjs(v).isBefore(dayjs(), 'day') ? 'red' : 'blue'} bordered={false}>{v}</Tag> : <Text type="secondary">未设置</Text>,
  },
  {
    title: '状态', key: 'status', width: 90,
    render: (_: any, record: any) => record.isCompleted ? <Tag color="green" bordered={false}>已完成</Tag> : <Tag color="orange" bordered={false}>未完成</Tag>,
  },
  {
    title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', width: 170,
    render: (v: string) => v ? <Text type="secondary">{v}</Text> : '-',
  },
];

const meetingColumns = [
  { title: '会议名称', dataIndex: 'name', key: 'name' },
  { title: '时间', dataIndex: 'time', key: 'time', width: 160 },
  { title: '地点', dataIndex: 'location', key: 'location', width: 150 },
  { title: '状态', dataIndex: 'completed', key: 'completed', width: 90, render: (v: boolean) => v ? <Tag color="green" bordered={false}>已完成</Tag> : <Tag color="orange" bordered={false}>未完成</Tag> },
];

const projectColumns = [
  { title: '项目名称', dataIndex: 'name', key: 'name' },
  { title: '下一交付节点', dataIndex: 'nextDelivery', key: 'nextDelivery', width: 160 },
  { title: '研发人员', dataIndex: 'developer', key: 'developer', width: 120 },
  { title: 'PM', dataIndex: 'pm', key: 'pm', width: 100 },
  {
    title: '状态', dataIndex: 'status', key: 'status', width: 90,
    render: (v: string) => {
      const map: Record<string, { color: string; label: string }> = {
        inProgress: { color: 'blue', label: '进行中' },
        delivered: { color: 'orange', label: '已交付' },
        accepted: { color: 'green', label: '已验收' },
      };
      return <Tag color={map[v]?.color} bordered={false}>{map[v]?.label || v}</Tag>;
    },
  },
];

const StatsBoard: React.FC = () => {
  const { token } = antTheme.useToken();
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<DailyWorkJournal[]>([]);
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      const list: DailyWorkJournal[] = [];
      for (const date of dates) {
        const d = await WorkJournalStorage.get(date);
        if (d) list.push(d);
      }
      setAllData(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = dayjs();
  const weekStart = today.startOf('isoWeek');
  const weekEnd = today.endOf('isoWeek');
  const monthStart = today.startOf('month');
  const monthEnd = today.endOf('month');

  const isInWeek = (date: string) => !dayjs(date).isBefore(weekStart, 'day') && !dayjs(date).isAfter(weekEnd, 'day');
  const isInMonth = (date: string) => !dayjs(date).isBefore(monthStart, 'day') && !dayjs(date).isAfter(monthEnd, 'day');

  const { uniqueItems: allUniqueItems, completedKeys: allCompletedKeys } = deduplicateAllTasks(allData);
  const allUniqueMeetings = deduplicateAllMeetings(allData);

  const weekUniqueItems = allUniqueItems.filter(({ task }) => task.plannedDate && isInWeek(task.plannedDate));
  const monthUniqueItems = allUniqueItems.filter(({ task }) => task.plannedDate && isInMonth(task.plannedDate));

  const calcTaskStats = (items: typeof allUniqueItems) => {
    let total = 0; let completed = 0;
    for (const { task, projName } of items) {
      const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
      total++;
      if (task.completed || allCompletedKeys.has(key)) completed++;
    }
    return { total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const weekStats = calcTaskStats(weekUniqueItems);
  const monthStats = calcTaskStats(monthUniqueItems);

  // 最近14天趋势
  const trendData = Array.from({ length: 14 }, (_, i) => {
    const date = today.subtract(13 - i, 'day').format('YYYY-MM-DD');
    let completed = 0; let unfinished = 0;
    for (const { task, projName } of allUniqueItems) {
      if (task.plannedDate !== date) continue;
      const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
      if (task.completed || allCompletedKeys.has(key)) completed++;
      else unfinished++;
    }
    return { date: dayjs(date).format('MM/DD'), rawDate: date, 完成: completed, 未完成: unfinished };
  });

  // 今日完成数
  const todayStr = today.format('YYYY-MM-DD');
  const todayCompleted = allUniqueItems.filter(({ task, projName }) => {
    const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
    return task.plannedDate === todayStr && (task.completed || allCompletedKeys.has(key));
  }).length;

  // 当前逾期任务数
  const overdueCount = allUniqueItems.filter(({ task, projName }) => {
    const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
    return task.plannedDate && dayjs(task.plannedDate).isBefore(today, 'day') && !(task.completed || allCompletedKeys.has(key));
  }).length;

  // 连续打卡天数：从今天往前数连续有完成任务的天数
  const streakDays = useMemo(() => {
    const completedByDate = new Map<string, number>();
    for (const { task, projName } of allUniqueItems) {
      if (!task.plannedDate) continue;
      const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
      if (task.completed || allCompletedKeys.has(key)) {
        completedByDate.set(task.plannedDate, (completedByDate.get(task.plannedDate) || 0) + 1);
      }
    }
    let streak = 0;
    let d = today.clone();
    while (true) {
      const ds = d.format('YYYY-MM-DD');
      if (!completedByDate.has(ds)) break;
      streak++;
      d = d.subtract(1, 'day');
    }
    return streak;
  }, [allUniqueItems, allCompletedKeys, today]);

  // 项目饼图
  const latestData = allData.find((d) => d.date === todayStr) || allData[0];
  const projectPieData = latestData ? [
    { name: '进行中', value: latestData.projects.inProgress.length },
    { name: '已交付', value: latestData.projects.delivered.length },
    { name: '已验收', value: latestData.projects.accepted.length },
  ].filter((x) => x.value > 0) : [];

  // 本月项目未完成
  const projectTaskMap = new Map<string, number>();
  for (const { task, projName } of monthUniqueItems) {
    const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
    if (!(task.completed || allCompletedKeys.has(key))) {
      projectTaskMap.set(projName, (projectTaskMap.get(projName) || 0) + 1);
    }
  }
  const projectTaskRank = Array.from(projectTaskMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  const weekUniqueMeetings = allUniqueMeetings.filter((m) => isInWeek(dayjs(m.time).format('YYYY-MM-DD')));
  const weekMeetings = weekUniqueMeetings.length;
  const weekMeetingsCompleted = weekUniqueMeetings.filter((m) => m.completed).length;

  const latestProjectData = [...allData]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((d) => d.projects.inProgress.length > 0 || d.projects.delivered.length > 0 || d.projects.accepted.length > 0) || null;

  const deduplicateProjectList = (list: any[]) => {
    const seen = new Set<string>();
    return list.filter((p) => { if (seen.has(p.name)) return false; seen.add(p.name); return true; });
  };

  const inProgressCount = latestProjectData ? deduplicateProjectList(latestProjectData.projects.inProgress).length : 0;
  const deliveredCount = latestProjectData ? deduplicateProjectList(latestProjectData.projects.delivered).length : 0;
  const acceptedCount = latestProjectData ? deduplicateProjectList(latestProjectData.projects.accepted).length : 0;
  const totalProjectCount = inProgressCount + deliveredCount + acceptedCount;

  // 热力图数据：过去365天每天完成任务数
  const heatmapValues = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const { task, projName } of allUniqueItems) {
      if (!task.plannedDate) continue;
      const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
      if (task.completed || allCompletedKeys.has(key)) {
        countMap.set(task.plannedDate, (countMap.get(task.plannedDate) || 0) + 1);
      }
    }
    return Array.from(countMap.entries()).map(([date, count]) => ({ date, count }));
  }, [allUniqueItems, allCompletedKeys]);

  // 每周效率折线图：过去12周
  const weeklyTrendData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const wStart = today.subtract(11 - i, 'week').startOf('isoWeek');
      const wEnd = wStart.endOf('isoWeek');
      const isInThisWeek = (date: string) => !dayjs(date).isBefore(wStart, 'day') && !dayjs(date).isAfter(wEnd, 'day');
      const wItems = allUniqueItems.filter(({ task }) => task.plannedDate && isInThisWeek(task.plannedDate));
      const stats = calcTaskStats(wItems);
      return {
        week: wStart.format('MM/DD'),
        完成率: stats.rate,
        完成数: stats.completed,
      };
    });
  }, [allUniqueItems, allCompletedKeys, today]);

  // 项目健康度
  const projectHealthList = useMemo(() => {
    if (!latestProjectData) return [];
    const allProjects = [
      ...deduplicateProjectList(latestProjectData.projects.inProgress).map((p: any) => ({ ...p, status: 'inProgress' })),
      ...deduplicateProjectList(latestProjectData.projects.delivered).map((p: any) => ({ ...p, status: 'delivered' })),
      ...deduplicateProjectList(latestProjectData.projects.accepted).map((p: any) => ({ ...p, status: 'accepted' })),
    ];
    return allProjects.map((p) => {
      const projTasks = allUniqueItems.filter(({ projName }) => projName === p.name);
      const totalTasks = projTasks.length;
      const completedTasks = projTasks.filter(({ task, projName }) => {
        const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
        return task.completed || allCompletedKeys.has(key);
      }).length;
      const overdueTasks = projTasks.filter(({ task, projName }) => {
        const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
        return !(task.completed || allCompletedKeys.has(key)) && task.plannedDate && dayjs(task.plannedDate).isBefore(dayjs(), 'day');
      }).length;
      const projDates = allData
        .filter((d) => (d.todos as TodoProject[]).some((tp) => tp.name === p.name && tp.tasks.length > 0))
        .map((d) => d.date).sort();
      const lastActiveDate = projDates[projDates.length - 1];
      const daysSinceActive = lastActiveDate ? dayjs(todayStr).diff(dayjs(lastActiveDate), 'day') : 999;
      const overdueRate = totalTasks > 0 ? overdueTasks / totalTasks : 0;
      const unfinishedRate = totalTasks > 0 ? (totalTasks - completedTasks) / totalTasks : 0;
      const inactivePenalty = daysSinceActive > 30 ? 20 : daysSinceActive > 14 ? 10 : daysSinceActive > 7 ? 5 : 0;
      const score = Math.max(0, Math.round(100 - overdueRate * 40 - unfinishedRate * 40 - inactivePenalty));
      return { ...p, totalTasks, completedTasks, overdueTasks, lastActiveDate: lastActiveDate || '-', daysSinceActive, score, overdueRate: Math.round(overdueRate * 100), unfinishedRate: Math.round(unfinishedRate * 100) };
    }).sort((a, b) => a.score - b.score);
  }, [latestProjectData, allUniqueItems, allCompletedKeys, allData]);

  const mapTaskItems = (items: typeof allUniqueItems) =>
    items.map(({ task, projName }) => {
      const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
      return { ...task, projName, isCompleted: task.completed || allCompletedKeys.has(key) };
    }).sort((a, b) => (a.isCompleted === b.isCompleted ? 0 : a.isCompleted ? 1 : -1));

  const getDrawerContent = () => {
    if (!drawerConfig) return null;
    switch (drawerConfig.type) {
      case 'weekTasks': return <Table dataSource={mapTaskItems(weekUniqueItems)} columns={taskColumns} rowKey="id" size="small" pagination={{ pageSize: 15 }} />;
      case 'monthTasks': return <Table dataSource={mapTaskItems(monthUniqueItems)} columns={taskColumns} rowKey="id" size="small" pagination={{ pageSize: 15 }} />;
      case 'weekMeetings': return <Table dataSource={[...weekUniqueMeetings].sort((a, b) => a.time.localeCompare(b.time))} columns={meetingColumns} rowKey="id" size="small" pagination={false} />;
      case 'projects': {
        if (!latestProjectData) return <Empty />;
        const allProjects = [
          ...deduplicateProjectList(latestProjectData.projects.inProgress).map((p: any) => ({ ...p, status: 'inProgress' })),
          ...deduplicateProjectList(latestProjectData.projects.delivered).map((p: any) => ({ ...p, status: 'delivered' })),
          ...deduplicateProjectList(latestProjectData.projects.accepted).map((p: any) => ({ ...p, status: 'accepted' })),
        ];
        return <Table dataSource={allProjects} columns={projectColumns} rowKey="id" size="small" pagination={false} />;
      }
      case 'projectStatus': {
        if (!latestProjectData) return <Empty />;
        const statusKey = drawerConfig.status as keyof typeof latestProjectData.projects;
        const list = deduplicateProjectList(latestProjectData.projects[statusKey] || []).map((p: any) => ({ ...p, status: drawerConfig.status }));
        return <Table dataSource={list} columns={projectColumns} rowKey="id" size="small" pagination={false} />;
      }
      case 'projectTasks': {
        const data = mapTaskItems(monthUniqueItems.filter(({ projName }) => projName === (drawerConfig as any).projectName)).filter((t) => !t.isCompleted);
        return data.length === 0 ? <Empty description="该项目本月无未完成任务" /> : <Table dataSource={data} columns={taskColumns} rowKey="id" size="small" pagination={false} />;
      }
      case 'dayTasks': {
        const dayItems = allUniqueItems.filter(({ task }) => task.plannedDate === (drawerConfig as any).date);
        const data = mapTaskItems(dayItems);
        return data.length === 0 ? <Empty description="该日无计划任务" /> : <Table dataSource={data} columns={taskColumns} rowKey="id" size="small" pagination={false} />;
      }
      case 'healthDetail': {
        const projItems = allUniqueItems.filter(({ projName }) => projName === (drawerConfig as any).projectName);
        const data = mapTaskItems(projItems);
        return data.length === 0 ? <Empty description="该项目暂无任务数据" /> : <Table dataSource={data} columns={taskColumns} rowKey="id" size="small" pagination={{ pageSize: 15 }} />;
      }
      default: return null;
    }
  };

  const cardHoverProps = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 16px rgba(0,0,0,0.12)`; },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 1px 4px rgba(0,0,0,0.06)`; },
  };
  const cardStyle = { cursor: 'pointer', transition: 'box-shadow 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };

  const heatmapClassForValue = (value: { count: number } | null) => {
    if (!value || value.count === 0) return 'color-empty';
    if (value.count <= 2) return 'color-scale-1';
    if (value.count <= 5) return 'color-scale-2';
    if (value.count <= 9) return 'color-scale-3';
    return 'color-scale-4';
  };

  return (
    <Spin spinning={loading}>
      {/* ── 摘要横幅 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
        borderRadius: 12,
        padding: '20px 28px',
        marginBottom: 20,
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(22,119,255,0.25)',
      }}>
        {[
          { icon: <FireOutlined />, value: streakDays, label: '天连续打卡', color: '#ffd666' },
          { icon: <CheckCircleOutlined />, value: todayCompleted, label: '今日已完成', color: '#95de64' },
          { icon: <CheckCircleOutlined />, value: `${weekStats.rate}%`, label: '本周完成率', color: '#69b1ff' },
          { icon: <WarningOutlined />, value: overdueCount, label: '任务已逾期', color: overdueCount > 0 ? '#ff7875' : '#95de64' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 140 }}>
            <div style={{ fontSize: 28, color: item.color }}>{item.icon}</div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{item.value}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{item.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 趋势图 + 指标卡片 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="最近 14 天任务趋势" size="small" style={cardStyle}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: token.colorTextSecondary }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: token.colorTextSecondary }} />
                <Tooltip contentStyle={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="完成" stackId="a" fill="#52c41a" radius={[0, 0, 0, 0]}
                  onClick={(data: any) => setDrawerConfig({ type: 'dayTasks', title: `${data.rawDate} 任务明细`, date: data.rawDate })} />
                <Bar dataKey="未完成" stackId="a" fill="#ff7875" radius={[4, 4, 0, 0]}
                  onClick={(data: any) => setDrawerConfig({ type: 'dayTasks', title: `${data.rawDate} 任务明细`, date: data.rawDate })} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Row gutter={[16, 16]}>
            <Col xs={12}>
              <Card style={{ ...cardStyle, height: '100%' }} {...cardHoverProps}
                onClick={() => setDrawerConfig({ type: 'weekTasks', title: '本周任务明细' })}>
                <Statistic title="本周完成率" value={weekStats.rate} suffix="%"
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: weekStats.rate >= 80 ? '#52c41a' : weekStats.rate >= 50 ? '#faad14' : '#ff4d4f', fontSize: 24 }} />
                <Progress percent={weekStats.rate} showInfo={false} strokeColor="#52c41a" size="small" style={{ marginTop: 8 }} />
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 4 }}>{weekStats.completed}/{weekStats.total} 项</div>
              </Card>
            </Col>
            <Col xs={12}>
              <Card style={{ ...cardStyle, height: '100%' }} {...cardHoverProps}
                onClick={() => setDrawerConfig({ type: 'monthTasks', title: '本月任务明细' })}>
                <Statistic title="本月完成率" value={monthStats.rate} suffix="%"
                  prefix={<CheckCircleOutlined style={{ color: '#1677ff' }} />}
                  valueStyle={{ color: '#1677ff', fontSize: 24 }} />
                <Progress percent={monthStats.rate} showInfo={false} size="small" style={{ marginTop: 8 }} />
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 4 }}>{monthStats.completed}/{monthStats.total} 项</div>
              </Card>
            </Col>
            <Col xs={12}>
              <Card style={{ ...cardStyle, height: '100%' }} {...cardHoverProps}
                onClick={() => setDrawerConfig({ type: 'weekMeetings', title: '本周会议明细' })}>
                <Statistic title="本周会议" value={weekMeetings} suffix="次"
                  prefix={<TeamOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ fontSize: 24 }} />
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 8 }}>完成 {weekMeetingsCompleted}/{weekMeetings}</div>
              </Card>
            </Col>
            <Col xs={12}>
              <Card style={{ ...cardStyle, height: '100%' }} {...cardHoverProps}
                onClick={() => setDrawerConfig({ type: 'projects', title: '项目列表明细' })}>
                <Statistic title="累计项目" value={totalProjectCount} suffix="个"
                  prefix={<ProjectOutlined style={{ color: '#722ed1' }} />}
                  valueStyle={{ fontSize: 24 }} />
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Tag color="blue" bordered={false}>{inProgressCount}进行</Tag>
                  <Tag color="orange" bordered={false}>{deliveredCount}交付</Tag>
                  <Tag color="green" bordered={false}>{acceptedCount}验收</Tag>
                </div>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* ── 任务完成热力图 ── */}
      <Card title="任务完成热力图（过去一年，颜色深浅=完成数量，点击查看当日详情）" size="small" style={{ marginBottom: 16, ...cardStyle }}>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <CalendarHeatmap
            startDate={today.subtract(1, 'year').toDate()}
            endDate={today.toDate()}
            values={heatmapValues}
            classForValue={heatmapClassForValue}
            tooltipDataAttrs={(value: any) => ({
              'data-tip': value && value.date
                ? `${value.date} 完成 ${value.count || 0} 项`
                : '无数据',
            })}
            onClick={(value: any) => {
              if (value && value.date) {
                setDrawerConfig({ type: 'dayTasks', title: `${value.date} 完成任务`, date: value.date });
              }
            }}
            showWeekdayLabels
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
          <span>少</span>
          {['color-empty', 'color-scale-1', 'color-scale-2', 'color-scale-3', 'color-scale-4'].map((cls) => (
            <svg key={cls} width={12} height={12}><rect width={12} height={12} rx={2} className={cls} /></svg>
          ))}
          <span>多</span>
        </div>
      </Card>

      {/* ── 每周效率折线图 + Top8 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="过去 12 周效率趋势" size="small" style={cardStyle}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weeklyTrendData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: token.colorTextSecondary }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: token.colorTextSecondary }} unit="%" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: token.colorTextSecondary }} />
                <Tooltip contentStyle={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }} />
                <Legend />
                <ReferenceLine yAxisId="left" y={80} stroke="#52c41a" strokeDasharray="4 4" label={{ value: '目标80%', fill: '#52c41a', fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="完成率" stroke="#1677ff" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="完成数" stroke="#52c41a" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="项目状态分布" size="small" style={cardStyle}>
            {projectPieData.length === 0 ? (
              <Empty description="暂无项目数据" style={{ padding: '30px 0' }} />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart style={{ cursor: 'pointer' }}>
                  <Pie data={projectPieData} cx="50%" cy="45%" outerRadius={70} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    onClick={(data: any) => setDrawerConfig({ type: 'projectStatus', title: `${data.name}项目列表`, status: PIE_STATUS_MAP[data.name] || data.name })}>
                    {projectPieData.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── 未完成排名 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card title="本月各项目未完成任务数（Top 8，点击查看任务列表）" size="small" style={cardStyle}>
            {projectTaskRank.length === 0 ? (
              <Empty description="本月所有任务均已完成 🎉" />
            ) : (
              <Table dataSource={projectTaskRank} rowKey="name" pagination={false} size="small"
                onRow={(record) => ({
                  onClick: () => setDrawerConfig({ type: 'projectTasks', title: `${record.name} - 本月未完成任务`, projectName: record.name }),
                  style: { cursor: 'pointer' },
                })}
                columns={[
                  {
                    title: '排名', key: 'rank', width: 70,
                    render: (_: unknown, __: unknown, index: number) => (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: index === 0 ? '#ff4d4f' : index === 1 ? '#fa8c16' : index === 2 ? '#faad14' : token.colorFillSecondary,
                        color: index < 3 ? '#fff' : token.colorTextSecondary,
                        fontWeight: 600, fontSize: 13,
                      }}>
                        {index + 1}
                      </div>
                    ),
                  },
                  { title: '项目名称', dataIndex: 'name', key: 'name' },
                  {
                    title: '未完成任务数', dataIndex: 'count', key: 'count', width: 160,
                    render: (count: number) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ClockCircleOutlined style={{ color: token.colorError }} />
                        <span style={{ color: token.colorError, fontWeight: 600 }}>{count}</span>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── 项目健康度 ── */}
      <Card title="项目健康度（点击行查看任务明细）" size="small" style={cardStyle}>
        {projectHealthList.length === 0 ? (
          <Empty description="暂无项目数据" />
        ) : (
          <Table dataSource={projectHealthList} rowKey="name" pagination={false} size="small"
            onRow={(record) => ({
              onClick: () => setDrawerConfig({ type: 'healthDetail', title: `${record.name} - 全部任务`, projectName: record.name }),
              style: { cursor: 'pointer' },
            })}
            columns={[
              { title: '项目名称', dataIndex: 'name', key: 'name' },
              {
                title: '状态', dataIndex: 'status', key: 'status', width: 90,
                render: (v: string) => {
                  const map: Record<string, { color: string; label: string }> = { inProgress: { color: 'blue', label: '进行中' }, delivered: { color: 'orange', label: '已交付' }, accepted: { color: 'green', label: '已验收' } };
                  return <Tag color={map[v]?.color} bordered={false}>{map[v]?.label || v}</Tag>;
                },
              },
              {
                title: '健康度', dataIndex: 'score', key: 'score', width: 180,
                render: (score: number) => {
                  const color = score >= 80 ? '#52c41a' : score >= 60 ? '#faad14' : '#ff4d4f';
                  const label = score >= 80 ? '健康' : score >= 60 ? '注意' : '风险';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Progress percent={score} size="small" showInfo={false}
                        strokeColor={{ '0%': color === '#ff4d4f' ? '#ff4d4f' : color, '100%': color }}
                        style={{ width: 90, margin: 0 }} />
                      <Tag color={color} bordered={false}>{score} {label}</Tag>
                    </div>
                  );
                },
              },
              {
                title: '逾期率', dataIndex: 'overdueRate', key: 'overdueRate', width: 100,
                render: (v: number, r: any) => (
                  <AntTooltip title={`${r.overdueTasks} 个逾期任务`}>
                    <Tag color={v > 20 ? 'red' : v > 0 ? 'orange' : 'green'} bordered={false}>{v}%</Tag>
                  </AntTooltip>
                ),
              },
              {
                title: '未完成率', dataIndex: 'unfinishedRate', key: 'unfinishedRate', width: 100,
                render: (v: number, r: any) => (
                  <AntTooltip title={`${r.totalTasks - r.completedTasks}/${r.totalTasks} 未完成`}>
                    <Tag color={v > 50 ? 'orange' : 'default'} bordered={false}>{v}%</Tag>
                  </AntTooltip>
                ),
              },
              {
                title: '最后活跃', dataIndex: 'lastActiveDate', key: 'lastActiveDate', width: 130,
                render: (v: string, r: any) => (
                  <AntTooltip title={r.daysSinceActive === 999 ? '从未记录' : `${r.daysSinceActive} 天前`}>
                    <Tag color={r.daysSinceActive > 14 ? 'red' : r.daysSinceActive > 7 ? 'orange' : 'default'} bordered={false}>{v}</Tag>
                  </AntTooltip>
                ),
              },
              {
                title: '任务数', key: 'taskStat', width: 90,
                render: (_: any, r: any) => <Text type="secondary">{r.completedTasks}/{r.totalTasks}</Text>,
              },
            ]}
          />
        )}
      </Card>

      <Drawer title={drawerConfig?.title || ''} open={!!drawerConfig} onClose={() => setDrawerConfig(null)} width={860} destroyOnClose>
        {getDrawerContent()}
      </Drawer>
    </Spin>
  );
};

export default StatsBoard;
