import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Tag, Checkbox, Empty, Spin, Select, Button, Space, Typography, Badge,
  Popconfirm, message, Alert, Input, DatePicker, theme as antTheme,
} from 'antd';
import { ReloadOutlined, CheckCircleOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { TodoTask, TodoProject, TaskPriority } from '../types';
import { WorkJournalStorage } from '../services/storage';
import { TagStorage } from '../services/tagStorage';

const { Text } = Typography;

interface FlatTask extends TodoTask {
  projectName: string;
  sourceDate: string;
}

type FilterType = 'all' | 'overdue' | 'today' | 'upcoming';

const PRIORITY_TAG: Record<TaskPriority, { color: string; label: string }> = {
  high:   { color: 'red',     label: '高' },
  medium: { color: 'orange',  label: '中' },
  low:    { color: 'default', label: '低' },
};

const PRIORITY_WEIGHT: Record<string, number> = { high: 0, medium: 1, low: 2, '': 3 };

const UnfinishedTasks: React.FC = () => {
  const { token } = antTheme.useToken();
  const [tasks, setTasks] = useState<FlatTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  // 批量操作面板
  const [batchAction, setBatchAction] = useState<null | 'priority' | 'tags' | 'move' | 'delete'>(null);
  const [batchActionValue, setBatchActionValue] = useState<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  const loadAllUnfinishedTasks = useCallback(async () => {
    setLoading(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      const completedKeys = new Set<string>();
      const allIncompleteTasks: FlatTask[] = [];

      for (const date of dates) {
        const data = await WorkJournalStorage.get(date);
        if (!data) continue;
        for (const project of data.todos as TodoProject[]) {
          for (const task of project.tasks) {
            const key = `${task.content}__${project.name}`;
            if (task.completed) {
              completedKeys.add(key);
            } else {
              allIncompleteTasks.push({
                ...task,
                projectName: project.name,
                sourceDate: date,
              });
            }
          }
        }
      }

      // 排除在任意日期已被标记完成的任务
      const flatTasks = allIncompleteTasks.filter((t) => {
        const key = `${t.content}__${t.projectName}`;
        return !completedKeys.has(key);
      });

      // 去重：同一任务（content + projectName）可能因修改 plannedDate 存在多个版本，
      // 保留来源日期最新的那条（最新副本的 plannedDate 即为用户最后一次修改的值）
      const deduped = new Map<string, FlatTask>();
      for (const task of flatTasks) {
        const key = `${task.content}__${task.projectName}`;
        const existing = deduped.get(key);
        if (!existing || task.sourceDate > existing.sourceDate) {
          deduped.set(key, task);
        }
      }
      const uniqueTasks = Array.from(deduped.values());

      // 排序：逾期 > 今日 > 无日期 > 未来；同级别再按优先级高→中→低
      const today = dayjs().startOf('day');
      uniqueTasks.sort((a, b) => {
        const getWeight = (t: FlatTask) => {
          if (!t.plannedDate) return 1;
          const d = dayjs(t.plannedDate);
          if (d.isBefore(today)) return 0;
          if (d.isSame(today)) return 0.5;
          return 2;
        };
        const wa = getWeight(a);
        const wb = getWeight(b);
        if (wa !== wb) return wa - wb;
        // 同日期分组内按优先级排
        const pa = PRIORITY_WEIGHT[a.priority || ''];
        const pb = PRIORITY_WEIGHT[b.priority || ''];
        if (pa !== pb) return pa - pb;
        if (a.plannedDate && b.plannedDate) {
          return dayjs(a.plannedDate).valueOf() - dayjs(b.plannedDate).valueOf();
        }
        return 0;
      });

      setTasks(uniqueTasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllUnfinishedTasks();
  }, [loadAllUnfinishedTasks]);

  // 单个任务完成：跨所有日期更新副本
  const handleToggleComplete = async (task: FlatTask, completed: boolean) => {
    const dates = await WorkJournalStorage.getAllDates();

    for (const date of dates) {
      const data = await WorkJournalStorage.get(date);
      if (!data) continue;

      let changed = false;
      const newTodos = data.todos.map((proj: TodoProject) => {
        const hasMatch = proj.tasks.some(
          (t: TodoTask) =>
            t.content === task.content &&
            proj.name === task.projectName &&
            (t.plannedDate || '') === (task.plannedDate || '') &&
            !t.completed
        );
        if (!hasMatch) return proj;

        changed = true;
        return {
          ...proj,
          tasks: proj.tasks.map((t: TodoTask) =>
            t.content === task.content &&
            (t.plannedDate || '') === (task.plannedDate || '')
              ? {
                  ...t,
                  completed,
                  completedAt: completed ? dayjs().format('YYYY-MM-DD HH:mm:ss') : undefined,
                }
              : t
          ),
        };
      });

      if (changed) {
        await WorkJournalStorage.save({ ...data, todos: newTodos, lastModified: new Date().toISOString() });
      }
    }

    setTasks((prev) =>
      prev.filter(
        (t) =>
          !(
            t.content === task.content &&
            t.projectName === task.projectName &&
            (t.plannedDate || '') === (task.plannedDate || '')
          )
      )
    );
  };

  // 批量完成：对选中的所有任务跨日期更新
  const handleBatchComplete = async () => {
    const targets = filteredTasks.filter((t) => selectedRowKeys.includes(t.id));
    if (targets.length === 0) return;

    setBatchLoading(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();

      for (const date of dates) {
        const data = await WorkJournalStorage.get(date);
        if (!data) continue;

        let changed = false;
        const newTodos = data.todos.map((proj: TodoProject) => {
          const hasMatch = proj.tasks.some((t: TodoTask) =>
            targets.some(
              (target) =>
                t.content === target.content &&
                proj.name === target.projectName &&
                (t.plannedDate || '') === (target.plannedDate || '') &&
                !t.completed
            )
          );
          if (!hasMatch) return proj;

          changed = true;
          return {
            ...proj,
            tasks: proj.tasks.map((t: TodoTask) => {
              const matched = targets.find(
                (target) =>
                  t.content === target.content &&
                  proj.name === target.projectName &&
                  (t.plannedDate || '') === (target.plannedDate || '')
              );
              if (!matched || t.completed) return t;
              return {
                ...t,
                completed: true,
                completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              };
            }),
          };
        });

        if (changed) {
          await WorkJournalStorage.save({ ...data, todos: newTodos, lastModified: new Date().toISOString() });
        }
      }

      setTasks((prev) =>
        prev.filter(
          (t) =>
            !targets.some(
              (target) =>
                t.content === target.content &&
                t.projectName === target.projectName &&
                (t.plannedDate || '') === (target.plannedDate || '')
            )
        )
      );
      setSelectedRowKeys([]);
      message.success(`已将 ${targets.length} 个任务标记为完成`);
    } catch {
      message.error('批量完成失败，请重试');
    } finally {
      setBatchLoading(false);
    }
  };

  // 通用批量更新：对选中任务应用字段修改
  const handleBatchUpdate = async (
    patchFn: (task: TodoTask) => Partial<TodoTask>,
    successMsg: string,
    removeFromList = false,
  ) => {
    const targets = filteredTasks.filter((t) => selectedRowKeys.includes(t.id));
    if (targets.length === 0) return;
    setBatchLoading(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      for (const date of dates) {
        const data = await WorkJournalStorage.get(date);
        if (!data) continue;
        let changed = false;
        const newTodos = data.todos.map((proj: TodoProject) => ({
          ...proj,
          tasks: proj.tasks.map((t: TodoTask) => {
            const matched = targets.find(
              (target) =>
                t.content === target.content &&
                proj.name === target.projectName &&
                (t.plannedDate || '') === (target.plannedDate || '')
            );
            if (!matched) return t;
            changed = true;
            return { ...t, ...patchFn(t) };
          }),
        }));
        if (changed) {
          await WorkJournalStorage.save({ ...data, todos: newTodos, lastModified: new Date().toISOString() });
        }
      }
      if (removeFromList) {
        setTasks((prev) =>
          prev.filter(
            (t) => !targets.some(
              (target) =>
                t.content === target.content &&
                t.projectName === target.projectName &&
                (t.plannedDate || '') === (target.plannedDate || '')
            )
          )
        );
      } else {
        await loadAllUnfinishedTasks();
      }
      setSelectedRowKeys([]);
      setBatchAction(null);
      setBatchActionValue(null);
      message.success(successMsg);
    } catch {
      message.error('操作失败，请重试');
    } finally {
      setBatchLoading(false);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    const targets = filteredTasks.filter((t) => selectedRowKeys.includes(t.id));
    if (targets.length === 0) return;
    setBatchLoading(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      for (const date of dates) {
        const data = await WorkJournalStorage.get(date);
        if (!data) continue;
        let changed = false;
        const newTodos = data.todos.map((proj: TodoProject) => {
          const newTasks = proj.tasks.filter((t: TodoTask) => {
            const shouldDelete = targets.some(
              (target) =>
                t.content === target.content &&
                proj.name === target.projectName &&
                (t.plannedDate || '') === (target.plannedDate || '')
            );
            if (shouldDelete) changed = true;
            return !shouldDelete;
          });
          return { ...proj, tasks: newTasks };
        });
        if (changed) {
          await WorkJournalStorage.save({ ...data, todos: newTodos, lastModified: new Date().toISOString() });
        }
      }
      setTasks((prev) =>
        prev.filter(
          (t) => !targets.some(
            (target) =>
              t.content === target.content &&
              t.projectName === target.projectName &&
              (t.plannedDate || '') === (target.plannedDate || '')
          )
        )
      );
      setSelectedRowKeys([]);
      setBatchAction(null);
      message.success(`已删除 ${targets.length} 个任务`);
    } catch {
      message.error('删除失败，请重试');
    } finally {
      setBatchLoading(false);
    }
  };

  // 所有项目名列表（供批量移动用）
  const allProjectNames = useMemo(() => {
    const nameSet = new Set<string>();
    tasks.forEach((t) => nameSet.add(t.projectName));
    return Array.from(nameSet).sort().map((n) => ({ label: n, value: n }));
  }, [tasks]);

  const today = dayjs().startOf('day');

  const getTaskType = (task: FlatTask): 'overdue' | 'today' | 'upcoming' | 'nodate' => {
    if (!task.plannedDate) return 'nodate';
    const d = dayjs(task.plannedDate);
    if (d.isBefore(today)) return 'overdue';
    if (d.isSame(today)) return 'today';
    return 'upcoming';
  };

  const overdueCount = tasks.filter((t) => getTaskType(t) === 'overdue').length;
  const todayCount = tasks.filter((t) => getTaskType(t) === 'today').length;
  const upcomingCount = tasks.filter((t) => getTaskType(t) === 'upcoming').length;

  const allTagOptions = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((t) => (t.tags || []).forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort().map((t) => ({ label: t, value: t }));
  }, [tasks]);

  const filteredTasks = tasks
    .filter((t) => filter === 'all' || getTaskType(t) === filter)
    .filter((t) => priorityFilter === 'all' || (t.priority || '') === priorityFilter)
    .filter((t) => tagFilter.length === 0 || tagFilter.every((tag) => (t.tags || []).includes(tag)))
    .filter((t) => !searchText.trim() || t.content.includes(searchText.trim()))
    .filter((t) => {
      const [start, end] = dateRange;
      if (!start && !end) return true;
      if (!t.plannedDate) return false;
      const d = dayjs(t.plannedDate);
      if (start && d.isBefore(start, 'day')) return false;
      if (end && d.isAfter(end, 'day')) return false;
      return true;
    });

  const columns = [
    {
      title: '完成',
      key: 'complete',
      width: 60,
      render: (_: unknown, record: FlatTask) => (
        <Checkbox onChange={(e) => handleToggleComplete(record, e.target.checked)} />
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (v: TaskPriority) => v
        ? <Tag color={PRIORITY_TAG[v].color}>{PRIORITY_TAG[v].label}</Tag>
        : <Text type="secondary">-</Text>,
    },
    {
      title: '任务内容',
      dataIndex: 'content',
      key: 'content',
      render: (text: string, record: FlatTask) => (
        <Space direction="vertical" size={2}>
          <Text>{text}</Text>
          {record.progress && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              进展：{record.progress}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '所属项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 160,
      render: (name: string) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: '责任人',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 100,
      render: (v: string) => v ? <Tag color="purple">👤 {v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (tags: string[]) => (
        <Space size={4} wrap>
          {(tags || []).map((tag) => <Tag key={tag} color={TagStorage.getColor(tag) ?? 'cyan'}>{tag}</Tag>)}
        </Space>
      ),
    },
    {
      title: '计划日期',
      dataIndex: 'plannedDate',
      key: 'plannedDate',
      width: 130,
      render: (date: string, record: FlatTask) => {
        const type = getTaskType(record);
        if (!date) return <Text type="secondary">未设置</Text>;
        const colorMap = { overdue: 'red', today: 'orange', upcoming: 'blue', nodate: 'default' } as const;
        const labelMap = { overdue: '已逾期', today: '今日', upcoming: '', nodate: '' };
        return (
          <Tag color={colorMap[type]}>
            {labelMap[type] && `${labelMap[type]} `}{date}
          </Tag>
        );
      },
    },
    {
      title: '来源日期',
      dataIndex: 'sourceDate',
      key: 'sourceDate',
      width: 120,
      render: (date: string) => <Text type="secondary">{date}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Space>
          <Badge count={overdueCount} color="red">
            <Select
              value={filter}
              onChange={(val) => { setFilter(val); setSelectedRowKeys([]); }}
              style={{ width: 150 }}
              options={[
                { label: `全部 (${tasks.length})`, value: 'all' },
                { label: `已逾期 (${overdueCount})`, value: 'overdue' },
                { label: `今日 (${todayCount})`, value: 'today' },
                { label: `未来 (${upcomingCount})`, value: 'upcoming' },
              ]}
            />
          </Badge>
          <Input
            placeholder="搜索任务内容..."
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            value={priorityFilter}
            onChange={(val) => setPriorityFilter(val)}
            style={{ width: 120 }}
            options={[
              { label: '全部优先级', value: 'all' },
              { label: '🔴 高', value: 'high' },
              { label: '🟠 中', value: 'medium' },
              { label: '⚪ 低', value: 'low' },
            ]}
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="按标签筛选"
            value={tagFilter}
            onChange={(vals) => setTagFilter(vals)}
            options={allTagOptions}
            style={{ minWidth: 160 }}
          />
          <DatePicker.RangePicker
            placeholder={['计划开始日期', '计划结束日期']}
            value={dateRange}
            onChange={(dates) => setDateRange(dates ? [dates[0], dates[1]] : [null, null])}
            allowClear
            style={{ width: 260 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAllUnfinishedTasks}
            loading={loading}
          >
            刷新
          </Button>
        </Space>

        {/* 批量操作栏：选中行后出现 */}
        {selectedRowKeys.length > 0 && (
          <Alert
            type="info"
            style={{ padding: '8px 12px', flex: 1 }}
            message={
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {/* 第一行：操作按钮 */}
                <Space wrap>
                  <span>已选 <strong>{selectedRowKeys.length}</strong> 个任务</span>
                  <Popconfirm
                    title={`确定将 ${selectedRowKeys.length} 个任务全部标记为完成吗？`}
                    onConfirm={handleBatchComplete}
                    okText="确定完成"
                    cancelText="取消"
                  >
                    <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={batchLoading}>
                      完成
                    </Button>
                  </Popconfirm>
                  <Button
                    size="small"
                    onClick={() => { setBatchAction(batchAction === 'priority' ? null : 'priority'); setBatchActionValue(null); }}
                  >
                    设优先级
                  </Button>
                  <Button
                    size="small"
                    onClick={() => { setBatchAction(batchAction === 'tags' ? null : 'tags'); setBatchActionValue([]); }}
                  >
                    追加标签
                  </Button>
                  <Button
                    size="small"
                    onClick={() => { setBatchAction(batchAction === 'move' ? null : 'move'); setBatchActionValue(null); }}
                  >
                    移动项目
                  </Button>
                  <Popconfirm
                    title={`确定删除选中的 ${selectedRowKeys.length} 个任务吗？此操作不可恢复！`}
                    onConfirm={handleBatchDelete}
                    okText="确定删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} loading={batchLoading}>
                      删除
                    </Button>
                  </Popconfirm>
                  <Button size="small" onClick={() => { setSelectedRowKeys([]); setBatchAction(null); setBatchActionValue(null); }}>
                    取消选择
                  </Button>
                </Space>

                {/* 第二行：展开的操作面板 */}
                {batchAction === 'priority' && (
                  <Space>
                    <Select
                      size="small"
                      placeholder="选择优先级"
                      value={batchActionValue}
                      onChange={(v) => setBatchActionValue(v)}
                      style={{ width: 120 }}
                      options={[
                        { label: '🔴 高', value: 'high' },
                        { label: '🟠 中', value: 'medium' },
                        { label: '⚪ 低', value: 'low' },
                      ]}
                    />
                    <Button
                      size="small"
                      type="primary"
                      disabled={!batchActionValue}
                      loading={batchLoading}
                      onClick={() => handleBatchUpdate(
                        () => ({ priority: batchActionValue as TaskPriority }),
                        `已将 ${selectedRowKeys.length} 个任务优先级设为「${batchActionValue}」`,
                      )}
                    >
                      应用
                    </Button>
                    <Button size="small" onClick={() => setBatchAction(null)}>收起</Button>
                  </Space>
                )}

                {batchAction === 'tags' && (
                  <Space>
                    <Select
                      size="small"
                      mode="tags"
                      placeholder="输入或选择标签"
                      value={batchActionValue || []}
                      onChange={(v) => setBatchActionValue(v)}
                      options={allTagOptions}
                      style={{ minWidth: 200 }}
                    />
                    <Button
                      size="small"
                      type="primary"
                      disabled={!batchActionValue || batchActionValue.length === 0}
                      loading={batchLoading}
                      onClick={() => handleBatchUpdate(
                        (t) => ({ tags: Array.from(new Set([...(t.tags || []), ...batchActionValue])) }),
                        `已为 ${selectedRowKeys.length} 个任务追加标签`,
                      )}
                    >
                      追加
                    </Button>
                    <Button size="small" onClick={() => setBatchAction(null)}>收起</Button>
                  </Space>
                )}

                {batchAction === 'move' && (
                  <Space>
                    <Select
                      size="small"
                      placeholder="选择目标项目"
                      value={batchActionValue}
                      onChange={(v) => setBatchActionValue(v)}
                      options={allProjectNames}
                      style={{ minWidth: 200 }}
                      showSearch
                    />
                    <Button
                      size="small"
                      type="primary"
                      disabled={!batchActionValue}
                      loading={batchLoading}
                      onClick={async () => {
                        const targets = filteredTasks.filter((t) => selectedRowKeys.includes(t.id));
                        if (targets.length === 0 || !batchActionValue) return;
                        setBatchLoading(true);
                        try {
                          const dates = await WorkJournalStorage.getAllDates();
                          for (const date of dates) {
                            const data = await WorkJournalStorage.get(date);
                            if (!data) continue;
                            let changed = false;
                            // 先从原项目移除
                            const withRemoved = data.todos.map((proj: TodoProject) => ({
                              ...proj,
                              tasks: proj.tasks.filter((t: TodoTask) => {
                                const shouldMove = targets.some(
                                  (target) =>
                                    t.content === target.content &&
                                    proj.name === target.projectName &&
                                    (t.plannedDate || '') === (target.plannedDate || '')
                                );
                                if (shouldMove) changed = true;
                                return !shouldMove;
                              }),
                            }));
                            // 再追加到目标项目
                            const newTodos = withRemoved.map((proj: TodoProject) => {
                              if (proj.name !== batchActionValue) return proj;
                              const toAdd = targets
                                .filter((target) => {
                                  const alreadyExists = proj.tasks.some(
                                    (t: TodoTask) =>
                                      t.content === target.content &&
                                      (t.plannedDate || '') === (target.plannedDate || '')
                                  );
                                  return !alreadyExists;
                                })
                                .map((target) => ({ ...target, projectName: undefined } as any));
                              return { ...proj, tasks: [...proj.tasks, ...toAdd] };
                            });
                            if (changed) {
                              await WorkJournalStorage.save({ ...data, todos: newTodos, lastModified: new Date().toISOString() });
                            }
                          }
                          await loadAllUnfinishedTasks();
                          setSelectedRowKeys([]);
                          setBatchAction(null);
                          setBatchActionValue(null);
                          message.success(`已将 ${targets.length} 个任务移动到「${batchActionValue}」`);
                        } catch {
                          message.error('移动失败，请重试');
                        } finally {
                          setBatchLoading(false);
                        }
                      }}
                    >
                      移动
                    </Button>
                    <Button size="small" onClick={() => setBatchAction(null)}>收起</Button>
                  </Space>
                )}
              </Space>
            }
          />
        )}

        {overdueCount > 0 && selectedRowKeys.length === 0 && (
          <Tag color="red" style={{ fontSize: 13 }}>
            ⚠️ 有 {overdueCount} 个任务已逾期
          </Tag>
        )}
      </div>

      <Spin spinning={loading}>
        {filteredTasks.length === 0 && !loading ? (
          <Empty description="暂无未完成任务" />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredTasks}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys as string[]),
            }}
            onRow={(record) => {
              const type = getTaskType(record);
              return {
                style: type === 'overdue'
                  ? { backgroundColor: token.colorErrorBg }
                  : type === 'today'
                  ? { backgroundColor: token.colorWarningBg }
                  : {},
              };
            }}
          />
        )}
      </Spin>
    </div>
  );
};

export default UnfinishedTasks;
