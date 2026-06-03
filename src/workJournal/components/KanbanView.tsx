import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Tag, Typography, Spin, Select, Input, Empty, Badge,
  Avatar, Tooltip, Progress, theme as antTheme, Segmented, message,
} from 'antd';
import {
  UserOutlined, CalendarOutlined, ClockCircleOutlined,
  AppstoreOutlined, UnorderedListOutlined, HolderOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TodoTask, TaskPriority } from '../types';
import { WorkJournalStorage } from '../services/storage';
import { KanbanStorage } from '../services/kanbanStorage';
import { TagStorage } from '../services/tagStorage';
import TodoTaskModal from '../modals/TodoTaskModal';
import type { DailyWorkJournal, TodoProject } from '../types';

const { Text } = Typography;

// ---- 扁平任务类型 ----
interface FlatTask extends TodoTask {
  projectName: string;
  sourceDate: string;
  taskKey: string; // `${content}__${projectName}`
}

// ---- 分组模式 ----
type GroupMode = 'status' | 'priority';

// ---- 看板列定义 ----
interface KanbanColumn {
  key: string;
  title: string;
  color: string;
  badgeStatus: 'default' | 'processing' | 'error' | 'success' | 'warning';
}

const STATUS_COLUMNS: KanbanColumn[] = [
  { key: 'todo',       title: '未开始', color: '#8c8c8c', badgeStatus: 'default' },
  { key: 'inprogress', title: '进行中', color: '#1677ff', badgeStatus: 'processing' },
  { key: 'overdue',    title: '已逾期', color: '#ff4d4f', badgeStatus: 'error' },
  { key: 'done',       title: '已完成', color: '#52c41a', badgeStatus: 'success' },
];

const PRIORITY_COLUMNS: KanbanColumn[] = [
  { key: 'high',   title: '高优先级', color: '#ff4d4f', badgeStatus: 'error' },
  { key: 'medium', title: '中优先级', color: '#fa8c16', badgeStatus: 'warning' },
  { key: 'low',    title: '低优先级', color: '#52c41a', badgeStatus: 'success' },
  { key: 'none',   title: '无优先级', color: '#8c8c8c', badgeStatus: 'default' },
];

const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' };
const PRIORITY_COLOR: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' };

// ---- taskKey 生成 ----
const makeTaskKey = (content: string, projectName: string) =>
  `${content}__${projectName}`;

// ---- 获取任务所属状态列 ----
const getStatusColumn = (task: FlatTask, today: string): string => {
  if (task.completed) return 'done';
  if (!task.plannedDate) return 'todo';
  if (task.plannedDate === today) return 'inprogress';
  if (task.plannedDate < today) return 'overdue';
  return 'todo';
};

const getPriorityColumn = (task: FlatTask): string => {
  return task.priority ?? 'none';
};

// ======= 拖拽任务卡片组件 =======
interface TaskCardProps {
  task: FlatTask;
  isDragging?: boolean;
  onEdit: (task: FlatTask) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, isDragging, onEdit }) => {
  const { token } = antTheme.useToken();
  const tagConfigs = TagStorage.getAll();
  const today = dayjs().format('YYYY-MM-DD');
  const isOverdue = !task.completed && task.plannedDate && task.plannedDate < today;
  const subtaskTotal = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.completed).length ?? 0;

  return (
    <div
      onClick={() => onEdit(task)}
      style={{
        background: isDragging ? token.colorPrimaryBg : token.colorBgContainer,
        border: `1px solid ${isDragging ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'pointer',
        boxShadow: isDragging ? `0 4px 16px rgba(0,0,0,0.15)` : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        opacity: isDragging ? 0.95 : 1,
        userSelect: 'none',
      }}
    >
      {/* 顶部：优先级 + 项目名 + 拖拽把手 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {task.priority && (
          <Tag color={PRIORITY_COLOR[task.priority]} bordered={false} style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>
            ● {PRIORITY_LABEL[task.priority]}
          </Tag>
        )}
        <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: 11, padding: '0 4px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.projectName}
        </Tag>
        <HolderOutlined style={{ color: token.colorTextQuaternary, fontSize: 12 }} />
      </div>

      {/* 任务内容 */}
      <Text
        style={{
          fontSize: 13,
          lineHeight: '18px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textDecoration: task.completed ? 'line-through' : 'none',
          color: task.completed ? token.colorTextDisabled : token.colorText,
        }}
      >
        {task.content}
      </Text>

      {/* 底部：责任人 + 计划日期 + 工时 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {task.assignee && (
          <Tooltip title={task.assignee}>
            <Avatar size={18} icon={<UserOutlined />} style={{ fontSize: 10, flexShrink: 0 }} />
          </Tooltip>
        )}
        {task.plannedDate && (
          <Tag
            icon={<CalendarOutlined />}
            color={isOverdue ? 'red' : 'default'}
            bordered={false}
            style={{ margin: 0, fontSize: 11, padding: '0 4px' }}
          >
            {task.plannedDate}
          </Tag>
        )}
        {task.estimatedHours && (
          <Tag icon={<ClockCircleOutlined />} bordered={false} style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>
            {task.estimatedHours}h
          </Tag>
        )}
        {/* 标签 */}
        {task.tags?.slice(0, 2).map((t) => {
          const cfg = tagConfigs.find((c) => c.name === t);
          return (
            <Tag key={t} color={cfg?.color ?? 'default'} bordered={false} style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>
              {t}
            </Tag>
          );
        })}
        {(task.tags?.length ?? 0) > 2 && (
          <Text type="secondary" style={{ fontSize: 11 }}>+{(task.tags?.length ?? 0) - 2}</Text>
        )}
      </div>

      {/* 子任务进度 */}
      {subtaskTotal > 0 && (
        <div style={{ marginTop: 6 }}>
          <Progress
            percent={Math.round((subtaskDone / subtaskTotal) * 100)}
            size="small"
            format={() => `${subtaskDone}/${subtaskTotal}`}
            strokeColor={subtaskDone === subtaskTotal ? token.colorSuccess : token.colorPrimary}
          />
        </div>
      )}
    </div>
  );
};

// ======= 可排序任务卡片包装 =======
const SortableTaskCard: React.FC<TaskCardProps & { id: string }> = ({ id, task, onEdit }) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={onEdit} />
    </div>
  );
};

// ======= 看板列组件 =======
interface KanbanColumnProps {
  column: KanbanColumn;
  tasks: FlatTask[];
  isOverdue?: boolean;
  onEdit: (task: FlatTask) => void;
}

const KanbanColumnComponent: React.FC<KanbanColumnProps> = ({ column, tasks, onEdit }) => {
  const { token } = antTheme.useToken();

  return (
    <div style={{
      flex: '1 1 240px',
      minWidth: 240,
      maxWidth: 320,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Card
        size="small"
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        styles={{
          header: { borderBottom: `2px solid ${column.color}`, paddingBottom: 8 },
          body: { flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', padding: '8px 8px' },
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge status={column.badgeStatus} />
            <Text strong style={{ color: column.color }}>{column.title}</Text>
            <Tag style={{ marginLeft: 'auto', marginRight: 0 }}>{tasks.length}</Tag>
          </div>
        }
      >
        <SortableContext items={tasks.map((t) => t.taskKey)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>暂无任务</Text>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.taskKey}
                id={task.taskKey}
                task={task}
                onEdit={onEdit}
              />
            ))
          )}
        </SortableContext>
      </Card>
    </div>
  );
};

// ======= 主组件 =======
const KanbanView: React.FC = () => {
  const { token } = antTheme.useToken();
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<DailyWorkJournal[]>([]);
  const [groupMode, setGroupMode] = useState<GroupMode>('status');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');
  const [columns, setColumns] = useState<Record<string, FlatTask[]>>({});
  const [activeTask, setActiveTask] = useState<FlatTask | null>(null);
  const [editingTask, setEditingTask] = useState<FlatTask | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const today = dayjs().format('YYYY-MM-DD');

  // 加载数据
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

  // 聚合所有未完成任务（去重，key = content + projectName）
  const allFlatTasks = useMemo((): FlatTask[] => {
    const completedKeys = new Set<string>();
    const seen = new Map<string, FlatTask>();

    // 先收集所有已完成的 key
    for (const d of allData) {
      for (const tp of d.todos) {
        for (const t of tp.tasks) {
          if (t.completed) completedKeys.add(makeTaskKey(t.content, tp.name));
        }
      }
    }

    // 按日期升序，保留最新副本
    const sorted = [...allData].sort((a, b) => a.date.localeCompare(b.date));
    for (const d of sorted) {
      for (const tp of d.todos) {
        for (const t of tp.tasks) {
          const key = makeTaskKey(t.content, tp.name);
          seen.set(key, {
            ...t,
            completed: t.completed || completedKeys.has(key),
            projectName: tp.name,
            sourceDate: d.date,
            taskKey: key,
          });
        }
      }
    }

    return Array.from(seen.values());
  }, [allData]);

  // 过滤后的任务
  const filteredTasks = useMemo(() => {
    return allFlatTasks.filter((t) => {
      if (projectFilter.length > 0 && !projectFilter.includes(t.projectName)) return false;
      if (assigneeFilter && t.assignee !== assigneeFilter) return false;
      if (searchText && !t.content.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [allFlatTasks, projectFilter, assigneeFilter, searchText]);

  // 构建看板列数据（应用持久化排序）
  useEffect(() => {
    if (allData.length === 0) return;
    const order = KanbanStorage.get();
    const cols = groupMode === 'status' ? STATUS_COLUMNS : PRIORITY_COLUMNS;
    const newCols: Record<string, FlatTask[]> = {};

    for (const col of cols) {
      const tasksInCol = filteredTasks.filter((t) =>
        groupMode === 'status'
          ? getStatusColumn(t, today) === col.key
          : getPriorityColumn(t) === col.key,
      );
      const storedOrder = groupMode === 'status'
        ? order.byStatus[col.key as keyof typeof order.byStatus] ?? []
        : order.byPriority[col.key as keyof typeof order.byPriority] ?? [];
      const keys = tasksInCol.map((t) => t.taskKey);
      const sortedKeys = KanbanStorage.sortKeys(keys, storedOrder);
      const taskMap = new Map(tasksInCol.map((t) => [t.taskKey, t]));
      newCols[col.key] = sortedKeys.map((k) => taskMap.get(k)!).filter(Boolean);
    }

    setColumns(newCols);
  }, [filteredTasks, groupMode, allData, today]);

  // 持久化排序到 localStorage
  const persistOrder = useCallback((newCols: Record<string, FlatTask[]>) => {
    const order = KanbanStorage.get();
    if (groupMode === 'status') {
      order.byStatus = {
        todo: newCols['todo']?.map((t) => t.taskKey) ?? [],
        inprogress: newCols['inprogress']?.map((t) => t.taskKey) ?? [],
        overdue: newCols['overdue']?.map((t) => t.taskKey) ?? [],
        done: newCols['done']?.map((t) => t.taskKey) ?? [],
      };
    } else {
      order.byPriority = {
        high: newCols['high']?.map((t) => t.taskKey) ?? [],
        medium: newCols['medium']?.map((t) => t.taskKey) ?? [],
        low: newCols['low']?.map((t) => t.taskKey) ?? [],
        none: newCols['none']?.map((t) => t.taskKey) ?? [],
      };
    }
    KanbanStorage.save(order);
  }, [groupMode]);

  // 找到任务所在列
  const findColumn = useCallback((taskKey: string): string | null => {
    for (const [colKey, tasks] of Object.entries(columns)) {
      if (tasks.some((t) => t.taskKey === taskKey)) return colKey;
    }
    return null;
  }, [columns]);

  // 拖拽开始
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    for (const tasks of Object.values(columns)) {
      const t = tasks.find((t) => t.taskKey === id);
      if (t) { setActiveTask(t); return; }
    }
  }, [columns]);

  // 拖拽悬停（跨列预览）
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    const activeCol = findColumn(activeId);
    // overId 可能是列 key 或另一个任务的 key
    const overCol = findColumn(overId) ?? overId;

    if (!activeCol || activeCol === overCol) return;
    // 逾期列不允许拖入
    if (groupMode === 'status' && overCol === 'overdue') return;

    setColumns((prev) => {
      const activeTask = prev[activeCol]?.find((t) => t.taskKey === activeId);
      if (!activeTask) return prev;
      const newCols = { ...prev };
      newCols[activeCol] = prev[activeCol].filter((t) => t.taskKey !== activeId);
      newCols[overCol] = [...(prev[overCol] ?? []), activeTask];
      return newCols;
    });
  }, [findColumn, groupMode]);

  // 写回日记文件
  const writeTaskField = useCallback(async (task: FlatTask, updates: Partial<TodoTask>) => {
    try {
      const d = await WorkJournalStorage.get(task.sourceDate);
      if (!d) return;
      const newTodos: TodoProject[] = d.todos.map((tp) => {
        if (tp.name !== task.projectName) return tp;
        return {
          ...tp,
          tasks: tp.tasks.map((t) =>
            t.content === task.content ? { ...t, ...updates } : t,
          ),
        };
      });
      await WorkJournalStorage.save({ ...d, todos: newTodos, lastModified: new Date().toISOString() });
    } catch {
      message.error('保存失败，请重试');
    }
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeCol = findColumn(activeId);
    if (!activeCol) return;

    const overCol = findColumn(overId) ?? overId;

    // 逾期列不允许拖入
    if (groupMode === 'status' && overCol === 'overdue') return;

    const activeTask = Object.values(columns).flat().find((t) => t.taskKey === activeId);
    if (!activeTask) return;

    let newCols = { ...columns };

    if (activeCol === overCol) {
      // 同列排序
      const colTasks = [...(columns[activeCol] ?? [])];
      const oldIdx = colTasks.findIndex((t) => t.taskKey === activeId);
      const newIdx = colTasks.findIndex((t) => t.taskKey === overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        newCols[activeCol] = arrayMove(colTasks, oldIdx, newIdx);
      }
    } else {
      // 跨列：更新字段
      const updates: Partial<TodoTask> = {};

      if (groupMode === 'status') {
        if (overCol === 'done') {
          updates.completed = true;
          updates.completedAt = new Date().toISOString();
        } else if (overCol === 'inprogress') {
          updates.completed = false;
          updates.plannedDate = today;
          updates.completedAt = undefined;
        } else if (overCol === 'todo') {
          updates.completed = false;
          updates.plannedDate = undefined;
          updates.completedAt = undefined;
        }
        // 从逾期列拖出 → 自动顺延到今天
        if (activeCol === 'overdue') {
          updates.plannedDate = today;
          updates.completed = false;
        }
      } else {
        // 按优先级
        updates.priority = overCol === 'none' ? undefined : (overCol as TaskPriority);
      }

      // 乐观更新 state
      newCols[activeCol] = (columns[activeCol] ?? []).filter((t) => t.taskKey !== activeId);
      const updatedTask = { ...activeTask, ...updates };
      const overIdx = (columns[overCol] ?? []).findIndex((t) => t.taskKey === overId);
      if (overIdx >= 0) {
        const arr = [...(columns[overCol] ?? [])];
        arr.splice(overIdx, 0, updatedTask);
        newCols[overCol] = arr;
      } else {
        newCols[overCol] = [...(columns[overCol] ?? []), updatedTask];
      }

      // 写回日记文件（异步，不阻塞 UI）
      writeTaskField(activeTask, updates);
    }

    setColumns(newCols);
    persistOrder(newCols);
  }, [columns, findColumn, groupMode, today, writeTaskField, persistOrder]);

  // 编辑任务保存
  const handleTaskSave = useCallback(async (updatedTask: TodoTask) => {
    if (!editingTask) return;
    await writeTaskField(editingTask, updatedTask);
    await loadData();
    setEditModalVisible(false);
    setEditingTask(null);
  }, [editingTask, writeTaskField, loadData]);

  // 派生数据：项目列表、责任人列表
  const allProjects = useMemo(() =>
    [...new Set(allFlatTasks.map((t) => t.projectName))].sort(), [allFlatTasks]);
  const allAssignees = useMemo(() =>
    [...new Set(allFlatTasks.map((t) => t.assignee).filter(Boolean) as string[])].sort(), [allFlatTasks]);

  const currentColumns = groupMode === 'status' ? STATUS_COLUMNS : PRIORITY_COLUMNS;

  return (
    <Spin spinning={loading}>
      {/* 顶部工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Segmented
          value={groupMode}
          onChange={(val) => setGroupMode(val as GroupMode)}
          options={[
            { label: '按状态', value: 'status', icon: <AppstoreOutlined /> },
            { label: '按优先级', value: 'priority', icon: <UnorderedListOutlined /> },
          ]}
        />
        <Select
          mode="multiple"
          placeholder="按项目筛选"
          value={projectFilter}
          onChange={setProjectFilter}
          style={{ minWidth: 160, maxWidth: 300 }}
          allowClear
          size="small"
          options={allProjects.map((p) => ({ label: p, value: p }))}
        />
        <Select
          placeholder="按责任人"
          value={assigneeFilter}
          onChange={setAssigneeFilter}
          allowClear
          size="small"
          style={{ width: 120 }}
          options={allAssignees.map((a) => ({ label: a, value: a }))}
        />
        <Input
          placeholder="搜索任务内容"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          size="small"
          style={{ width: 180 }}
        />
        <span style={{ marginLeft: 'auto', color: token.colorTextSecondary, fontSize: 12 }}>
          共 {filteredTasks.length} 个任务
        </span>
      </div>

      {/* 看板主体 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
          {currentColumns.map((col) => (
            <KanbanColumnComponent
              key={col.key}
              column={col}
              tasks={columns[col.key] ?? []}
              isOverdue={col.key === 'overdue'}
              onEdit={(task) => { setEditingTask(task); setEditModalVisible(true); }}
            />
          ))}
        </div>

        {/* 拖拽浮层 */}
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isDragging onEdit={() => {}} />}
        </DragOverlay>
      </DndContext>

      {/* 编辑弹窗 */}
      {editModalVisible && editingTask && (
        <TodoTaskModal
          visible={editModalVisible}
          task={editingTask}
          onFinish={handleTaskSave}
          onCancel={() => { setEditModalVisible(false); setEditingTask(null); }}
          allTags={[...new Set(allFlatTasks.flatMap((t) => t.tags ?? []))]}
        />
      )}
    </Spin>
  );
};

export default KanbanView;
