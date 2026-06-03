import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Spin, Descriptions, Row, Col, Card, Statistic, Table, Tag, Empty,
  Timeline, Typography, Tabs, Badge, Alert,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  TeamOutlined, BookOutlined, HistoryOutlined, FireOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import type { Project, ProjectStatus, DailyWorkJournal, TodoTask, Meeting } from '../types';
import { WorkJournalStorage } from '../services/storage';

const { Text, Paragraph } = Typography;

// ---- 常量 ----
const STATUS_LABEL: Record<ProjectStatus, string> = {
  inProgress: '进行中',
  delivered: '已交付',
  accepted: '已验收',
};
const STATUS_COLOR: Record<ProjectStatus, string> = {
  inProgress: 'blue',
  delivered: 'orange',
  accepted: 'green',
};

// ---- 类型 ----
interface UniqueTask {
  task: TodoTask;
  projName: string;
  isCompleted: boolean;
}

interface StatusRecord {
  date: string;
  status: ProjectStatus;
}

// ---- 数据处理函数（纯函数，无 JSX） ----
function extractProjectTasks(allData: DailyWorkJournal[], projectName: string): UniqueTask[] {
  const completedKeys = new Set<string>();
  const allItems: { task: TodoTask; projName: string; date: string }[] = [];

  for (const d of allData) {
    for (const proj of d.todos) {
      if (proj.name !== projectName) continue;
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

  return Array.from(seen.values()).map(({ task, projName }) => {
    const key = `${task.content}__${projName}__${task.plannedDate || ''}`;
    return { task, projName, isCompleted: task.completed || completedKeys.has(key) };
  });
}

function extractProjectMeetings(allData: DailyWorkJournal[], projectName: string): Meeting[] {
  const seen = new Map<string, Meeting>();
  for (const d of allData) {
    for (const m of d.meetings) {
      // 优先用 projectName 字段精确匹配；老数据无此字段时回退到文本模糊匹配
      let matched = false;
      if (m.projectName) {
        matched = m.projectName === projectName;
      } else {
        const nameMatch = m.name ? m.name.includes(projectName) : false;
        const minutesMatch = m.minutes ? m.minutes.includes(projectName) : false;
        matched = nameMatch || minutesMatch;
      }
      if (!matched) continue;
      const key = `${m.name}__${dayjs(m.time).format('YYYY-MM-DD')}`;
      if (!seen.has(key)) seen.set(key, m);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.time.localeCompare(a.time));
}

function extractRelatedDiary(allData: DailyWorkJournal[], projectName: string) {
  return allData
    .filter((d) => d.diary && d.diary.includes(projectName))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((d) => ({ date: d.date, diary: d.diary }));
}

function extractStatusHistory(allData: DailyWorkJournal[], projectName: string): StatusRecord[] {
  const sorted = [...allData].sort((a, b) => a.date.localeCompare(b.date));
  const records: StatusRecord[] = [];
  let lastStatus: ProjectStatus | null = null;

  for (const d of sorted) {
    let foundStatus: ProjectStatus | null = null;
    for (const status of ['inProgress', 'delivered', 'accepted'] as ProjectStatus[]) {
      if (d.projects[status].some((p) => p.name === projectName)) {
        foundStatus = status;
        break;
      }
    }
    if (foundStatus && foundStatus !== lastStatus) {
      records.push({ date: d.date, status: foundStatus });
      lastStatus = foundStatus;
    }
  }
  return records;
}

// 燃尽图数据：全生命周期，逐日累计未完成任务数
function buildBurndownData(tasks: UniqueTask[], allData: DailyWorkJournal[], projectName: string) {
  if (tasks.length === 0) return [];

  // 找最早任务出现日期
  const dates = allData
    .filter((d) => d.todos.some((tp) => tp.name === projectName && tp.tasks.length > 0))
    .map((d) => d.date)
    .sort();
  if (dates.length === 0) return [];

  const startDate = dayjs(dates[0]);
  const endDate = dayjs();
  const totalDays = endDate.diff(startDate, 'day') + 1;
  if (totalDays <= 0) return [];

  // 每个任务的「完成日期」：优先用 completedAt，否则用全量数据中最后一次出现且 completed=true 的日期
  const completionDateMap = new Map<string, string>(); // taskKey → completedDate
  for (const { task } of tasks) {
    const key = `${task.content}__${projectName}__${task.plannedDate || ''}`;
    if (task.completedAt) {
      completionDateMap.set(key, task.completedAt.slice(0, 10));
    }
  }
  // 对没有 completedAt 的已完成任务，从 allData 里找最后完成日期
  const sortedData = [...allData].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sortedData) {
    for (const tp of d.todos) {
      if (tp.name !== projectName) continue;
      for (const t of tp.tasks) {
        if (!t.completed) continue;
        const key = `${t.content}__${projectName}__${t.plannedDate || ''}`;
        if (!completionDateMap.has(key)) {
          completionDateMap.set(key, d.date);
        } else {
          const existing = completionDateMap.get(key)!;
          if (d.date > existing) completionDateMap.set(key, d.date);
        }
      }
    }
  }

  const totalTasks = tasks.length;

  // 按日采样，超过 90 天则按周采样
  const step = totalDays > 90 ? 7 : 1;
  const points: { date: string; remaining: number }[] = [];

  for (let i = 0; i < totalDays; i += step) {
    const d = startDate.add(i, 'day').format('YYYY-MM-DD');
    const completedByDay = Array.from(completionDateMap.values()).filter((cd) => cd <= d).length;
    points.push({
      date: totalDays > 90 ? startDate.add(i, 'day').format('MM/DD') : startDate.add(i, 'day').format('MM/DD'),
      remaining: totalTasks - completedByDay,
    });
  }

  // 确保包含今天
  const todayStr = endDate.format('MM/DD');
  if (points.length === 0 || points[points.length - 1].date !== todayStr) {
    const completedTotal = Array.from(completionDateMap.values()).filter((cd) => cd <= endDate.format('YYYY-MM-DD')).length;
    points.push({ date: todayStr, remaining: Math.max(0, totalTasks - completedTotal) });
  }

  return points;
}

// 构建甘特图数据
function buildGanttTasks(tasks: UniqueTask[], projectName: string): GanttTask[] {
  const result: GanttTask[] = [];
  const today = dayjs();

  // 项目汇总行
  const allDates = tasks
    .map((t) => t.task.plannedDate)
    .filter(Boolean) as string[];

  const projectStart = allDates.length > 0
    ? dayjs(allDates.reduce((a, b) => (a < b ? a : b)))
    : today.subtract(7, 'day');
  const projectEnd = allDates.length > 0
    ? dayjs(allDates.reduce((a, b) => (a > b ? a : b)))
    : today.add(7, 'day');

  const totalTasks = tasks.length;
  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  result.push({
    id: '__project__',
    name: projectName,
    start: projectStart.toDate(),
    end: projectEnd.isBefore(projectStart) ? projectStart.add(1, 'day').toDate() : projectEnd.toDate(),
    type: 'project',
    progress,
    hideChildren: false,
  } as GanttTask);

  // 任务行
  tasks.forEach((ut, i) => {
    const { task } = ut;
    const start = task.plannedDate ? dayjs(task.plannedDate) : today;
    const end = task.completedAt
      ? dayjs(task.completedAt.slice(0, 10))
      : start.add(1, 'day');
    const safeEnd = end.isBefore(start) || end.isSame(start, 'day') ? start.add(1, 'day') : end;

    result.push({
      id: `task_${i}`,
      name: task.content.length > 30 ? task.content.slice(0, 30) + '…' : task.content,
      start: start.toDate(),
      end: safeEnd.toDate(),
      type: 'task',
      progress: ut.isCompleted ? 100 : 0,
      project: '__project__',
      styles: ut.isCompleted
        ? { progressColor: '#52c41a', progressSelectedColor: '#52c41a' }
        : undefined,
    } as GanttTask);
  });

  return result;
}

// ---- Props ----
interface ProjectDetailDrawerProps {
  project: Project | null;
  projectStatus: ProjectStatus | null;
  visible: boolean;
  onClose: () => void;
}

// ---- 主组件 ----
const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  project,
  projectStatus,
  visible,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState<DailyWorkJournal[]>([]);

  const projectName = project?.name ?? '';

  const loadAllData = useCallback(async () => {
    if (!visible || !projectName) return;
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
  }, [visible, projectName]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ---- 派生数据（project 为 null 时返回空值，不提前 return） ----
  const tasks = project ? extractProjectTasks(allData, project.name) : [];
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const unfinishedTasks = tasks.filter((t) => !t.isCompleted);
  const overdueTasks = unfinishedTasks.filter(
    (t) => t.task.plannedDate && dayjs(t.task.plannedDate).isBefore(dayjs(), 'day'),
  );
  const meetings = project ? extractProjectMeetings(allData, project.name) : [];
  const diaries = project ? extractRelatedDiary(allData, project.name) : [];
  const statusHistory = project ? extractStatusHistory(allData, project.name) : [];

  const latestUpdateDate = project
    ? allData
        .filter(
          (d) =>
            d.todos.some((p) => p.name === project.name && p.tasks.length > 0) ||
            (projectStatus && d.projects[projectStatus].some((p) => p.name === project.name)),
        )
        .map((d) => d.date)
        .sort()
        .reverse()[0] || '-'
    : '-';

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    const aDate = a.task.plannedDate || '9999-99-99';
    const bDate = b.task.plannedDate || '9999-99-99';
    return aDate.localeCompare(bDate);
  });

  const burndownData = project ? buildBurndownData(tasks, allData, project.name) : [];

  // ---- 表格列（定义在组件内，render 函数是懒执行的） ----
  const taskTableColumns = [
    {
      title: '任务内容',
      dataIndex: ['task', 'content'],
      key: 'content',
      render: (text: string, record: UniqueTask) => (
        <span
          style={{
            textDecoration: record.isCompleted ? 'line-through' : 'none',
            color: record.isCompleted ? '#999' : 'inherit',
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: '计划日期',
      dataIndex: ['task', 'plannedDate'],
      key: 'plannedDate',
      width: 120,
      render: (v: string, record: UniqueTask) => {
        if (!v) return <Text type="secondary">未设置</Text>;
        const isOverdue = !record.isCompleted && dayjs(v).isBefore(dayjs(), 'day');
        return (
          <Tag color={isOverdue ? 'red' : 'blue'}>
            {isOverdue ? '逾期 ' : ''}
            {v}
          </Tag>
        );
      },
    },
    {
      title: '责任人',
      dataIndex: ['task', 'assignee'],
      key: 'assignee',
      width: 100,
      render: (v: string) =>
        v ? <Tag color="purple">{v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: unknown, record: UniqueTask) =>
        record.isCompleted ? (
          <Tag color="green">已完成</Tag>
        ) : (
          <Tag color="orange">未完成</Tag>
        ),
    },
    {
      title: '完成时间',
      dataIndex: ['task', 'completedAt'],
      key: 'completedAt',
      width: 170,
      render: (v: string) => (v ? <Text type="secondary">{v}</Text> : '-'),
    },
    {
      title: '进展',
      dataIndex: ['task', 'progress'],
      key: 'progress',
      render: (v: string) =>
        v ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {v.slice(0, 60)}
            {v.length > 60 ? '…' : ''}
          </Text>
        ) : (
          '-'
        ),
    },
  ];

  const meetingTableColumns = [
    { title: '会议名称', dataIndex: 'name', key: 'name' },
    { title: '时间', dataIndex: 'time', key: 'time', width: 160 },
    { title: '地点', dataIndex: 'location', key: 'location', width: 140 },
    {
      title: '匹配方式',
      key: 'matchType',
      width: 100,
      render: (_: unknown, record: Meeting) => (
        record.projectName
          ? <Tag color="green">精确</Tag>
          : <Tag color="orange">文本匹配</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'completed',
      key: 'completed',
      width: 90,
      render: (v: boolean) =>
        v ? <Tag color="green">已完成</Tag> : <Tag color="orange">未完成</Tag>,
    },
    {
      title: '纪要',
      dataIndex: 'minutes',
      key: 'minutes',
      render: (v: string) =>
        v && v.trim() ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {v.slice(0, 80)}
            {v.length > 80 ? '…' : ''}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  // ---- Tab 内容 ----
  const tabItems = [
    {
      key: 'info',
      label: '基本信息',
      children: project ? (
        <>
        <Descriptions column={2} bordered size="small" style={{ marginTop: 8 }}>
          <Descriptions.Item label="项目名称" span={2}>
            {project.name}
          </Descriptions.Item>
          <Descriptions.Item label="当前状态">
            {projectStatus ? (
              <Tag color={STATUS_COLOR[projectStatus]}>{STATUS_LABEL[projectStatus]}</Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="编号">{project.index || '-'}</Descriptions.Item>
          <Descriptions.Item label="下一交付节点" span={2}>
            {project.nextDelivery || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="研发人员">{project.developer || '-'}</Descriptions.Item>
          <Descriptions.Item label="测试人员">{project.tester || '-'}</Descriptions.Item>
          <Descriptions.Item label="工程引擎人员">{project.engineEngineer || '-'}</Descriptions.Item>
          <Descriptions.Item label="工程开发人员">{project.engineDeveloper || '-'}</Descriptions.Item>
          <Descriptions.Item label="硬件负责人">{project.hardwareLeader || '-'}</Descriptions.Item>
          <Descriptions.Item label="产品人员">{project.productManager || '-'}</Descriptions.Item>
          <Descriptions.Item label="PM">{project.pm || '-'}</Descriptions.Item>
          <Descriptions.Item label="商务">{project.business || '-'}</Descriptions.Item>
          <Descriptions.Item label="对接人">{project.contact || '-'}</Descriptions.Item>
          <Descriptions.Item label="供应商">{project.supplier || '-'}</Descriptions.Item>
          <Descriptions.Item label="金额" span={2}>
            {project.amount || '-'}
          </Descriptions.Item>
          {project.notes && (
            <Descriptions.Item label="项目备注" span={2}>
              <Paragraph copyable style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {project.notes}
              </Paragraph>
            </Descriptions.Item>
          )}
        </Descriptions>
        {project.risks && (
          <Alert
            type="warning"
            showIcon
            message="风险点"
            description={<span style={{ whiteSpace: 'pre-wrap' }}>{project.risks}</span>}
            style={{ marginTop: 12 }}
          />
        )}
        </>
      ) : null,
    },
    {
      key: 'tasks',
      label: (
        <span>
          任务明细
          {unfinishedTasks.length > 0 && (
            <Badge count={unfinishedTasks.length} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div style={{ marginTop: 8 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="总任务数"
                  value={tasks.length}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="已完成"
                  value={completedTasks.length}
                  prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="未完成"
                  value={unfinishedTasks.length}
                  prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: unfinishedTasks.length > 0 ? '#faad14' : 'inherit' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic
                  title="已逾期"
                  value={overdueTasks.length}
                  prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: overdueTasks.length > 0 ? '#ff4d4f' : 'inherit' }}
                />
              </Card>
            </Col>
          </Row>
          {sortedTasks.length === 0 ? (
            <Empty description="该项目暂无任务记录" />
          ) : (
            <>
              {burndownData.length > 1 && (
                <Card
                  size="small"
                  style={{ marginBottom: 16 }}
                  title={<span><FireOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />任务燃尽图（全生命周期）</span>}
                >
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={burndownData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`${v} 个`, '剩余任务']} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="remaining"
                        name="剩余任务数"
                        stroke="#ff4d4f"
                        strokeWidth={2}
                        dot={burndownData.length <= 30}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}
              <Table
                dataSource={sortedTasks}
                columns={taskTableColumns}
                rowKey={(r) => `${r.task.id}_${r.projName}`}
                size="small"
                pagination={{ pageSize: 10 }}
              />
            </>
          )}
        </div>
      ),
    },
    {
      key: 'meetings',
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 4 }} />
          相关会议
          {meetings.length > 0 && (
            <Badge count={meetings.length} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div style={{ marginTop: 8 }}>
          {meetings.length === 0 ? (
            <Empty description="未找到相关会议（按会议名或纪要内容匹配项目名）" />
          ) : (
            <Table
              dataSource={meetings}
              columns={meetingTableColumns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
            />
          )}
        </div>
      ),
    },
    {
      key: 'diary',
      label: (
        <span>
          <BookOutlined style={{ marginRight: 4 }} />
          相关日记
          {diaries.length > 0 && (
            <Badge count={diaries.length} size="small" style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div style={{ marginTop: 8 }}>
          {diaries.length === 0 ? (
            <Empty description="未找到包含该项目名称的日记记录" />
          ) : (
            diaries.map(({ date, diary }) => (
              <Card
                key={date}
                size="small"
                style={{ marginBottom: 12 }}
                title={<Text strong>{date}</Text>}
              >
                <Paragraph
                  style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginBottom: 0 }}
                  ellipsis={{ rows: 4, expandable: true, symbol: '展开' }}
                >
                  {diary}
                </Paragraph>
              </Card>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined style={{ marginRight: 4 }} />
          状态历史
        </span>
      ),
      children: (
        <div style={{ marginTop: 16 }}>
          {statusHistory.length === 0 ? (
            <Empty description="暂无状态变更记录" />
          ) : (
            <Timeline
              items={statusHistory.map(({ date, status }) => ({
                color: STATUS_COLOR[status],
                children: (
                  <div>
                    <Text strong style={{ marginRight: 8 }}>
                      {date}
                    </Text>
                    <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
                  </div>
                ),
              }))}
            />
          )}
          <div style={{ marginTop: 12, color: '#999', fontSize: 12 }}>
            最近更新日期：{latestUpdateDate}
          </div>
        </div>
      ),
    },
    {
      key: 'timeline',
      label: (
        <span>
          <ScheduleOutlined style={{ marginRight: 4 }} />
          任务时间线
        </span>
      ),
      children: (() => {
        const ganttTasks = project ? buildGanttTasks(tasks, project.name) : [];
        if (ganttTasks.length <= 1) {
          return (
            <div style={{ marginTop: 16 }}>
              <Empty description="没有足够的任务数据来显示时间线（需要至少一个有计划日期的任务）" />
            </div>
          );
        }
        return (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <Gantt
              tasks={ganttTasks}
              viewMode={ViewMode.Week}
              locale="zh-CN"
              listCellWidth="200px"
              columnWidth={65}
              barHeight={22}
              fontSize="12px"
              todayColor="rgba(22, 119, 255, 0.1)"
            />
          </div>
        );
      })(),
    },
  ];

  return (
    <Drawer
      title={
        project ? (
          <span>
            项目详情 &nbsp;
            <Text strong style={{ fontSize: 16 }}>
              {project.name}
            </Text>
            {projectStatus && (
              <Tag color={STATUS_COLOR[projectStatus]} style={{ marginLeft: 8 }}>
                {STATUS_LABEL[projectStatus]}
              </Tag>
            )}
          </span>
        ) : (
          '项目详情'
        )
      }
      open={visible}
      onClose={onClose}
      width={900}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Tabs items={tabItems} defaultActiveKey="info" />
      </Spin>
    </Drawer>
  );
};

export default ProjectDetailDrawer;
