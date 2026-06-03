import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Table, Tag, Progress, Spin, Select,
  Radio, Typography, Empty, theme as antTheme, Tooltip,
} from 'antd';
import {
  FundOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  ClockCircleOutlined, RiseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import { WorkJournalStorage } from '../services/storage';
import { buildAllProjectStats, extractProjectTasks, extractProjectMeetings } from '../utils/projectUtils';
import type { ProjectStats } from '../utils/projectUtils';
import type { DailyWorkJournal, ProjectStatus } from '../types';
import ProjectDetailDrawer from './ProjectDetailDrawer';
import type { Project } from '../types';

const { Title, Text } = Typography;

type TimeRange = '30' | '90' | 'all';
type StatusFilter = 'all' | 'inProgress' | 'delivered' | 'accepted';

const STATUS_LABEL: Record<string, string> = {
  inProgress: '进行中',
  delivered: '已交付',
  accepted: '已验收',
};
const STATUS_COLOR: Record<string, string> = {
  inProgress: 'blue',
  delivered: 'orange',
  accepted: 'green',
};

const HEALTH_COLOR = (score: number) => {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
};

const ProjectDashboard: React.FC = () => {
  const { token } = antTheme.useToken();
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<DailyWorkJournal[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stats, setStats] = useState<ProjectStats[]>([]);

  // 项目详情 Drawer
  const [drawerProject, setDrawerProject] = useState<Project | null>(null);
  const [drawerStatus, setDrawerStatus] = useState<ProjectStatus | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 加载全量数据
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

  // 计算统计数据
  useEffect(() => {
    if (allData.length === 0) return;

    // 按时间范围过滤
    let filteredData = allData;
    if (timeRange !== 'all') {
      const cutoff = dayjs().subtract(parseInt(timeRange), 'day').format('YYYY-MM-DD');
      filteredData = allData.filter((d) => d.date >= cutoff);
    }

    let result = buildAllProjectStats(filteredData);

    // 按状态过滤
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    setStats(result);
  }, [allData, timeRange, statusFilter]);

  // 打开项目详情
  const openDrawer = useCallback((projectName: string) => {
    // 从全量数据里找到最新项目对象
    let foundProject: Project | null = null;
    let foundStatus: ProjectStatus | null = null;
    for (const d of [...allData].sort((a, b) => b.date.localeCompare(a.date))) {
      for (const status of ['inProgress', 'delivered', 'accepted'] as ProjectStatus[]) {
        const p = d.projects[status].find((p) => p.name === projectName);
        if (p) { foundProject = p; foundStatus = status; break; }
      }
      if (foundProject) break;
    }
    if (foundProject) {
      setDrawerProject(foundProject);
      setDrawerStatus(foundStatus);
      setDrawerVisible(true);
    }
  }, [allData]);

  // 派生数据
  const inProgressCount = stats.filter((s) => s.status === 'inProgress').length;
  const totalTasks = stats.reduce((a, b) => a + b.total, 0);
  const totalCompleted = stats.reduce((a, b) => a + b.completed, 0);
  const totalOverdue = stats.reduce((a, b) => a + b.overdue, 0);
  const overallRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // 近期完成任务数
  const cutoffDate = timeRange !== 'all'
    ? dayjs().subtract(parseInt(timeRange), 'day').format('YYYY-MM-DD')
    : '2000-01-01';
  const recentCompleted = allData
    .filter((d) => d.date >= cutoffDate)
    .flatMap((d) => d.todos.flatMap((tp) => tp.tasks))
    .filter((t) => t.completed && t.completedAt && t.completedAt.slice(0, 10) >= cutoffDate)
    .length;

  // 横向 Bar Chart 数据（最多 15 个项目）
  const barData = stats.slice(0, 15).map((s) => ({
    name: s.projectName.length > 10 ? s.projectName.slice(0, 10) + '…' : s.projectName,
    fullName: s.projectName,
    completed: s.completed,
    unfinished: s.unfinished,
    rate: s.completionRate,
  }));

  // 雷达图数据（进行中项目，最多 6 个）
  const radarProjects = stats.filter((s) => s.status === 'inProgress').slice(0, 6);
  const radarDimensions = ['任务完成率', '低逾期率', '近期活跃', '无风险', '会议活跃'];
  const radarData = radarDimensions.map((dim) => {
    const entry: Record<string, number | string> = { dimension: dim };
    radarProjects.forEach((s) => {
      if (dim === '任务完成率') entry[s.projectName] = s.completionRate;
      else if (dim === '低逾期率') entry[s.projectName] = Math.max(0, 100 - (s.total > 0 ? Math.round((s.overdue / s.total) * 100) : 0));
      else if (dim === '近期活跃') entry[s.projectName] = s.lastActiveDate >= dayjs().subtract(7, 'day').format('YYYY-MM-DD') ? 80 : 30;
      else if (dim === '无风险') entry[s.projectName] = 70; // 暂无风险字段接入
      else if (dim === '会议活跃') entry[s.projectName] = Math.min(100, extractProjectMeetings(allData, s.projectName).length * 10);
    });
    return entry;
  });

  const RADAR_COLORS = ['#1677ff', '#722ed1', '#52c41a', '#fa8c16', '#ff4d4f', '#13c2c2'];

  // 表格列
  const columns = [
    {
      title: '项目名称', dataIndex: 'projectName', key: 'projectName', fixed: 'left' as const, width: 160,
      render: (name: string) => (
        <a onClick={() => openDrawer(name)} style={{ color: token.colorPrimary }}>{name}</a>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => s ? <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '完成率', dataIndex: 'completionRate', key: 'completionRate', width: 160,
      sorter: (a: ProjectStats, b: ProjectStats) => a.completionRate - b.completionRate,
      render: (rate: number) => (
        <Progress percent={rate} size="small" strokeColor={rate >= 80 ? token.colorSuccess : rate >= 50 ? token.colorWarning : token.colorError} />
      ),
    },
    { title: '总任务', dataIndex: 'total', key: 'total', width: 80, sorter: (a: ProjectStats, b: ProjectStats) => a.total - b.total },
    {
      title: '已完成', dataIndex: 'completed', key: 'completed', width: 80,
      render: (v: number) => <Text style={{ color: token.colorSuccess }}>{v}</Text>,
    },
    {
      title: '未完成', dataIndex: 'unfinished', key: 'unfinished', width: 80,
      render: (v: number) => <Text style={{ color: v > 0 ? token.colorWarning : token.colorTextSecondary }}>{v}</Text>,
    },
    {
      title: '已逾期', dataIndex: 'overdue', key: 'overdue', width: 80,
      sorter: (a: ProjectStats, b: ProjectStats) => a.overdue - b.overdue,
      render: (v: number) => <Text style={{ color: v > 0 ? token.colorError : token.colorTextSecondary }}>{v}</Text>,
    },
    {
      title: '最近活跃', dataIndex: 'lastActiveDate', key: 'lastActiveDate', width: 110,
      render: (v: string) => <Text type="secondary">{v}</Text>,
    },
    {
      title: '健康度', dataIndex: 'healthScore', key: 'healthScore', width: 100,
      sorter: (a: ProjectStats, b: ProjectStats) => a.healthScore - b.healthScore,
      render: (score: number) => (
        <Tag color={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'}>
          {score} 分
        </Tag>
      ),
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_: unknown, record: ProjectStats) => (
        <a onClick={() => openDrawer(record.projectName)} style={{ color: token.colorPrimary }}>详情</a>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      {/* 筛选栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary">时间范围：</Text>
          <Radio.Group value={timeRange} onChange={(e) => setTimeRange(e.target.value)} size="small">
            <Radio.Button value="30">近 30 天</Radio.Button>
            <Radio.Button value="90">近 90 天</Radio.Button>
            <Radio.Button value="all">全量</Radio.Button>
          </Radio.Group>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary">项目状态：</Text>
          <Select value={statusFilter} onChange={setStatusFilter} size="small" style={{ width: 120 }}>
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="inProgress">进行中</Select.Option>
            <Select.Option value="delivered">已交付</Select.Option>
            <Select.Option value="accepted">已验收</Select.Option>
          </Select>
        </div>
      </div>

      {/* 汇总横幅 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { title: '进行中项目', value: inProgressCount, icon: <FundOutlined />, color: token.colorPrimary },
          { title: '整体完成率', value: `${overallRate}%`, icon: <RiseOutlined />, color: token.colorSuccess },
          { title: '逾期未完成', value: totalOverdue, icon: <ExclamationCircleOutlined />, color: token.colorError },
          { title: `近期完成任务`, value: recentCompleted, icon: <CheckCircleOutlined />, color: token.colorSuccess },
        ].map((item, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card size="small" style={{ borderTop: `3px solid ${item.color}` }}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={React.cloneElement(item.icon, { style: { color: item.color } })}
                valueStyle={{ color: item.color, fontSize: 24 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        {/* 各项目完成率横向 Bar */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={<span><FundOutlined style={{ marginRight: 6 }} />各项目完成率对比</span>}
            style={{ height: 380 }}
          >
            {barData.length === 0 ? <Empty description="暂无数据" /> : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 40, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <RechartTooltip
                    formatter={(value: number, name: string) => [
                      name === 'completed' ? `已完成 ${value} 个` : `未完成 ${value} 个`,
                    ]}
                    labelFormatter={(label: string) => {
                      const item = barData.find((b) => b.name === label);
                      return item?.fullName ?? label;
                    }}
                  />
                  <Bar dataKey="completed" name="已完成" stackId="a" fill={token.colorSuccess} />
                  <Bar dataKey="unfinished" name="未完成" stackId="a" fill={token.colorWarning}
                    label={{ position: 'right', formatter: (_: unknown, entry: { rate?: number }) => `${entry?.rate ?? 0}%`, fontSize: 11 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* 健康度雷达图 */}
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title={<span><ClockCircleOutlined style={{ marginRight: 6 }} />项目健康度雷达（进行中）</span>}
            style={{ height: 380 }}
          >
            {radarProjects.length === 0 ? <Empty description="暂无进行中项目" /> : (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} />
                  {radarProjects.map((s, i) => (
                    <Radar
                      key={s.projectName}
                      name={s.projectName}
                      dataKey={s.projectName}
                      stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fill={RADAR_COLORS[i % RADAR_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <RechartTooltip />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* 项目详细数据表格 */}
      <Card
        size="small"
        title={<span><FundOutlined style={{ marginRight: 6 }} />项目详细数据（{stats.length} 个项目）</span>}
      >
        {stats.length === 0 ? <Empty description="暂无项目数据" /> : (
          <Table
            dataSource={stats}
            columns={columns}
            rowKey="projectName"
            size="small"
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 15, showSizeChanger: false }}
          />
        )}
      </Card>

      {/* 项目详情 Drawer */}
      <ProjectDetailDrawer
        project={drawerProject}
        projectStatus={drawerStatus}
        visible={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDrawerProject(null); }}
      />
    </Spin>
  );
};

export default ProjectDashboard;
