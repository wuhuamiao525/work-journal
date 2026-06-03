import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Table, Tag, Typography, Spin, Input, Modal, Select, Drawer,
  List, Statistic, Row, Col, Popconfirm, message, Progress, ColorPicker,
  theme as antTheme, Badge, Tooltip,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import {
  TagsOutlined, EditOutlined, DeleteOutlined, MergeCellsOutlined,
  CalendarOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { TagConfig, DailyWorkJournal, TodoTask, TodoProject } from '../types';
import { TagStorage } from '../services/tagStorage';
import { WorkJournalStorage } from '../services/storage';

const { Text, Title } = Typography;

// ---- 标签统计信息 ----
interface TagStat {
  name: string;
  color: string;
  count: number;               // 使用次数（任务数）
  projects: string[];          // 关联项目名列表（去重）
  lastUsed: string;            // 最近使用日期
}

// ---- 包含该标签的任务（用于 Drawer） ----
interface TagTask {
  content: string;
  projectName: string;
  plannedDate?: string;
  completed: boolean;
  sourceDate: string;
}

// 预设颜色（Ant Design 标准 10 色）
const PRESET_COLORS = [
  '#1677ff', '#722ed1', '#52c41a', '#fa8c16', '#ff4d4f',
  '#13c2c2', '#eb2f96', '#fadb14', '#a0d911', '#2f54eb',
];

const TagManager: React.FC = () => {
  const { token } = antTheme.useToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allData, setAllData] = useState<DailyWorkJournal[]>([]);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [searchText, setSearchText] = useState('');

  // 重命名
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 合并
  const [mergingTag, setMergingTag] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | undefined>();

  // 任务详情 Drawer
  const [drawerTag, setDrawerTag] = useState<string | null>(null);
  const [drawerTasks, setDrawerTasks] = useState<TagTask[]>([]);

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

  // 计算标签统计
  useEffect(() => {
    if (allData.length === 0) return;
    const configs = TagStorage.getAll();
    const configMap = new Map(configs.map((c) => [c.name, c.color]));

    // 收集所有标签使用情况
    const statMap = new Map<string, { count: number; projects: Set<string>; lastUsed: string }>();

    for (const d of allData) {
      for (const tp of d.todos) {
        for (const t of tp.tasks) {
          for (const tag of (t.tags ?? [])) {
            if (!statMap.has(tag)) {
              statMap.set(tag, { count: 0, projects: new Set(), lastUsed: '' });
            }
            const s = statMap.get(tag)!;
            s.count++;
            s.projects.add(tp.name);
            if (!s.lastUsed || d.date > s.lastUsed) s.lastUsed = d.date;
          }
        }
      }
    }

    const result: TagStat[] = Array.from(statMap.entries()).map(([name, s]) => ({
      name,
      color: configMap.get(name) ?? 'default',
      count: s.count,
      projects: Array.from(s.projects),
      lastUsed: s.lastUsed,
    })).sort((a, b) => b.count - a.count);

    setTagStats(result);
  }, [allData]);

  // 过滤后标签列表
  const filteredStats = useMemo(() =>
    tagStats.filter((t) =>
      !searchText || t.name.toLowerCase().includes(searchText.toLowerCase()),
    ), [tagStats, searchText]);

  // 最大使用次数（用于进度条）
  const maxCount = useMemo(() => Math.max(...tagStats.map((t) => t.count), 1), [tagStats]);

  // 有标签的任务占比
  const taggedTaskRate = useMemo(() => {
    let total = 0, tagged = 0;
    for (const d of allData) {
      for (const tp of d.todos) {
        for (const t of tp.tasks) {
          total++;
          if (t.tags && t.tags.length > 0) tagged++;
        }
      }
    }
    return total > 0 ? Math.round((tagged / total) * 100) : 0;
  }, [allData]);

  // 更新颜色
  const handleColorChange = useCallback((tagName: string, color: Color) => {
    const hex = color.toHexString();
    TagStorage.upsert({ name: tagName, color: hex });
    setTagStats((prev) =>
      prev.map((t) => t.name === tagName ? { ...t, color: hex } : t),
    );
  }, []);

  // 批量替换标签（重命名/合并/删除）
  const batchUpdateTags = useCallback(async (
    oldName: string,
    newName: string | null, // null = 删除
  ) => {
    setSaving(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      for (const date of dates) {
        const d = await WorkJournalStorage.get(date);
        if (!d) continue;
        let changed = false;
        const newTodos: TodoProject[] = d.todos.map((tp) => ({
          ...tp,
          tasks: tp.tasks.map((t) => {
            if (!t.tags?.includes(oldName)) return t;
            changed = true;
            let newTags = t.tags.filter((tag) => tag !== oldName);
            if (newName) {
              if (!newTags.includes(newName)) newTags = [...newTags, newName];
            }
            return { ...t, tags: newTags };
          }),
        }));
        if (changed) {
          await WorkJournalStorage.save({ ...d, todos: newTodos, lastModified: new Date().toISOString() });
        }
      }
    } finally {
      setSaving(false);
    }
  }, []);

  // 重命名确认
  const handleRenameConfirm = useCallback(async () => {
    if (!renamingTag || !renameValue.trim()) return;
    const newName = renameValue.trim();
    if (newName === renamingTag) { setRenamingTag(null); return; }
    if (tagStats.some((t) => t.name === newName)) {
      message.error('标签名已存在');
      return;
    }
    await batchUpdateTags(renamingTag, newName);
    TagStorage.rename(renamingTag, newName);
    message.success(`已将「${renamingTag}」重命名为「${newName}」`);
    setRenamingTag(null);
    setRenameValue('');
    loadData();
  }, [renamingTag, renameValue, tagStats, batchUpdateTags, loadData]);

  // 合并确认
  const handleMergeConfirm = useCallback(async () => {
    if (!mergingTag || !mergeTarget) return;
    await batchUpdateTags(mergingTag, mergeTarget);
    TagStorage.delete(mergingTag);
    message.success(`已将「${mergingTag}」合并到「${mergeTarget}」`);
    setMergingTag(null);
    setMergeTarget(undefined);
    loadData();
  }, [mergingTag, mergeTarget, batchUpdateTags, loadData]);

  // 删除确认
  const handleDelete = useCallback(async (tagName: string) => {
    await batchUpdateTags(tagName, null);
    TagStorage.delete(tagName);
    message.success(`已删除标签「${tagName}」`);
    loadData();
  }, [batchUpdateTags, loadData]);

  // 打开标签任务 Drawer
  const openDrawer = useCallback((tagName: string) => {
    const tasks: TagTask[] = [];
    const seen = new Set<string>();
    for (const d of allData) {
      for (const tp of d.todos) {
        for (const t of tp.tasks) {
          if (!t.tags?.includes(tagName)) continue;
          const key = `${t.content}__${tp.name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          tasks.push({
            content: t.content,
            projectName: tp.name,
            plannedDate: t.plannedDate,
            completed: t.completed,
            sourceDate: d.date,
          });
        }
      }
    }
    tasks.sort((a, b) => b.sourceDate.localeCompare(a.sourceDate));
    setDrawerTasks(tasks);
    setDrawerTag(tagName);
  }, [allData]);

  // 表格列
  const columns = [
    {
      title: '标签', dataIndex: 'name', key: 'name', width: 200,
      render: (name: string, record: TagStat) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ColorPicker
            value={record.color === 'default' ? '#d9d9d9' : record.color}
            presets={[{ label: '预设颜色', colors: PRESET_COLORS }]}
            onChange={(color) => handleColorChange(name, color)}
            size="small"
          />
          <Tag
            color={record.color === 'default' ? undefined : record.color}
            style={{ cursor: 'pointer', margin: 0 }}
            onClick={() => openDrawer(name)}
          >
            {name}
          </Tag>
        </div>
      ),
    },
    {
      title: '使用次数', dataIndex: 'count', key: 'count', width: 160,
      sorter: (a: TagStat, b: TagStat) => a.count - b.count,
      defaultSortOrder: 'descend' as const,
      render: (count: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text>{count}</Text>
          <Progress
            percent={Math.round((count / maxCount) * 100)}
            size="small"
            showInfo={false}
            style={{ flex: 1, minWidth: 60 }}
          />
        </div>
      ),
    },
    {
      title: '关联项目', dataIndex: 'projects', key: 'projects',
      render: (projects: string[]) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {projects.slice(0, 3).map((p) => (
            <Tag key={p} color="blue" bordered={false} style={{ fontSize: 11, margin: 0 }}>
              {p.length > 8 ? p.slice(0, 8) + '…' : p}
            </Tag>
          ))}
          {projects.length > 3 && (
            <Tooltip title={projects.slice(3).join('、')}>
              <Tag bordered={false} style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}>
                +{projects.length - 3}
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: '最近使用', dataIndex: 'lastUsed', key: 'lastUsed', width: 110,
      render: (v: string) => <Text type="secondary">{v || '-'}</Text>,
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: unknown, record: TagStat) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="重命名">
            <EditOutlined
              style={{ color: token.colorPrimary, cursor: 'pointer' }}
              onClick={() => { setRenamingTag(record.name); setRenameValue(record.name); }}
            />
          </Tooltip>
          <Tooltip title="合并到其他标签">
            <MergeCellsOutlined
              style={{ color: token.colorWarning, cursor: 'pointer' }}
              onClick={() => setMergingTag(record.name)}
            />
          </Tooltip>
          <Popconfirm
            title={`确定删除标签「${record.name}」吗？`}
            description="该标签将从所有任务中移除，不可恢复"
            onConfirm={() => handleDelete(record.name)}
            okText="删除" cancelText="取消" okType="danger"
          >
            <Tooltip title="删除">
              <DeleteOutlined style={{ color: token.colorError, cursor: 'pointer' }} />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const top3 = tagStats.slice(0, 3);

  return (
    <Spin spinning={loading || saving} tip={saving ? '正在批量更新任务数据...' : undefined}>
      {/* 统计卡 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="标签总数"
              value={tagStats.length}
              prefix={<TagsOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" title="使用最多的标签">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {top3.length === 0
                ? <Text type="secondary">暂无</Text>
                : top3.map((t) => (
                  <Tag key={t.name} color={t.color === 'default' ? undefined : t.color}>
                    {t.name} ({t.count})
                  </Tag>
                ))
              }
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="有标签任务占比"
              value={taggedTaskRate}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
              valueStyle={{ color: token.colorSuccess }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索 + 表格 */}
      <Card
        size="small"
        title={<span><TagsOutlined style={{ marginRight: 6 }} />标签列表（{tagStats.length} 个）</span>}
        extra={
          <Input
            placeholder="搜索标签名"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            size="small"
            style={{ width: 160 }}
          />
        }
      >
        <Table
          dataSource={filteredStats}
          columns={columns}
          rowKey="name"
          size="small"
          pagination={{ pageSize: 20 }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => openDrawer(record.name),
          })}
        />
      </Card>

      {/* 重命名 Modal */}
      <Modal
        title={`重命名标签「${renamingTag}」`}
        open={!!renamingTag}
        onOk={handleRenameConfirm}
        onCancel={() => { setRenamingTag(null); setRenameValue(''); }}
        okText="确认重命名"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="请输入新标签名"
          onPressEnter={handleRenameConfirm}
          autoFocus
        />
      </Modal>

      {/* 合并 Modal */}
      <Modal
        title={`合并标签「${mergingTag}」`}
        open={!!mergingTag}
        onOk={handleMergeConfirm}
        onCancel={() => { setMergingTag(null); setMergeTarget(undefined); }}
        okText="确认合并"
        okButtonProps={{ disabled: !mergeTarget }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text>将「{mergingTag}」的所有任务合并到：</Text>
        </div>
        <Select
          placeholder="选择目标标签"
          value={mergeTarget}
          onChange={setMergeTarget}
          style={{ width: '100%' }}
          options={tagStats
            .filter((t) => t.name !== mergingTag)
            .map((t) => ({ label: t.name, value: t.name }))}
        />
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          合并后「{mergingTag}」标签将被删除，其所有任务将改为携带「{mergeTarget ?? '目标标签'}」。
        </Text>
      </Modal>

      {/* 标签任务 Drawer */}
      <Drawer
        title={
          <span>
            <TagsOutlined style={{ marginRight: 8 }} />
            标签「{drawerTag}」的所有任务（{drawerTasks.length} 个）
          </span>
        }
        open={!!drawerTag}
        onClose={() => { setDrawerTag(null); setDrawerTasks([]); }}
        width={520}
      >
        {drawerTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Text type="secondary">暂无任务</Text>
          </div>
        ) : (
          <List
            size="small"
            dataSource={drawerTasks}
            renderItem={(task) => (
              <List.Item style={{ padding: '8px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Badge
                      status={task.completed ? 'success' : 'processing'}
                    />
                    <Text
                      style={{
                        flex: 1,
                        textDecoration: task.completed ? 'line-through' : 'none',
                        color: task.completed ? token.colorTextDisabled : token.colorText,
                      }}
                    >
                      {task.content}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingLeft: 16 }}>
                    <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: 11 }}>
                      {task.projectName}
                    </Tag>
                    {task.plannedDate && (
                      <Tag icon={<CalendarOutlined />} bordered={false} style={{ margin: 0, fontSize: 11 }}>
                        {task.plannedDate}
                      </Tag>
                    )}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      来自 {task.sourceDate}
                    </Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </Spin>
  );
};

export default TagManager;
