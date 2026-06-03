import React, { useState, useMemo, useEffect } from 'react';
import { Button, Card, List, Checkbox, Space, Popconfirm, message, Empty, Tag, Modal, Input, Select, Typography, theme as antTheme } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, AppstoreOutlined, RightOutlined, DownOutlined } from '@ant-design/icons';
import type { TodoProject, TodoTask, TaskPriority, SubTask } from '../types';
import { generateId } from '../types';
import { TagStorage } from '../services/tagStorage';
import TodoModal from '../modals/TodoModal';
import TodoTaskModal from '../modals/TodoTaskModal';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

const PRIORITY_TAG: Record<TaskPriority, { color: string; label: string }> = {
  high:   { color: 'red',    label: '高' },
  medium: { color: 'orange', label: '中' },
  low:    { color: 'default', label: '低' },
};

interface TodoSectionProps {
  todos: TodoProject[];
  onChange: (todos: TodoProject[]) => void;
  activeProjectId?: string | null;
  onActiveProjectChange?: (id: string | null) => void;
  addTaskTrigger?: number;
}

const TodoSection: React.FC<TodoSectionProps> = (props) => {
  const { todos, onChange, activeProjectId, onActiveProjectChange, addTaskTrigger } = props;
  const { token } = antTheme.useToken();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'project' | 'task'>('project');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<{ projectId: string; task: TodoTask } | null>(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{ projectId: string; task: TodoTask } | null>(null);
  const [progressInput, setProgressInput] = useState('');
  // 批量模式
  const [batchModeProjectId, setBatchModeProjectId] = useState<string | null>(null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  const [batchPriorityValue, setBatchPriorityValue] = useState<TaskPriority | null>(null);
  // 子任务展开
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [newSubtaskInputs, setNewSubtaskInputs] = useState<Record<string, string>>({});
  // 收集所有已使用的标签，作为候选项
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    todos.forEach((tp) => (tp.tasks || []).forEach((t) => (t.tags || []).forEach((tag) => tagSet.add(tag))));
    return Array.from(tagSet).sort();
  }, [todos]);

  // Ctrl+N 快捷键：在已激活项目下新建任务
  useEffect(() => {
    if (!addTaskTrigger || !activeProjectId) return;
    const project = todos.find((tp) => tp.id === activeProjectId);
    if (project) {
      setCurrentTask(null);
      setCurrentProjectId(activeProjectId);
      setTaskModalVisible(true);
    }
  }, [addTaskTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddProject = () => {
    setModalType('project');
    setModalVisible(true);
    setCurrentProjectId(null);
  };

  const handleAddTask = (projectId: string) => {
    setCurrentTask(null);
    setCurrentProjectId(projectId);
    setTaskModalVisible(true);
  };

  const handleEditTask = (projectId: string, task: TodoTask) => {
    setCurrentTask({ projectId, task });
    setTaskModalVisible(true);
  };

  const handleDeleteProject = (projectId: string) => {
    const newTodos = todos.filter((tp) => tp.id !== projectId);
    onChange(newTodos);
    message.success('删除成功');
  };

  const handleDeleteTask = (projectId: string, taskId: string) => {
    const newTodos = todos.map((tp) =>
      tp.id === projectId
        ? { ...tp, tasks: tp.tasks.filter((t) => t.id !== taskId) }
        : tp,
    );
    onChange(newTodos);
    message.success('删除成功');
  };

  const handleOpenProgress = (projectId: string, task: TodoTask) => {
    setCurrentProgress({ projectId, task });
    setProgressInput(task.progress || '');
    setProgressModalVisible(true);
  };

  const handleSaveProgress = () => {
    if (!currentProgress) return;

    const newTodos = todos.map((tp) =>
      tp.id === currentProgress.projectId
        ? {
            ...tp,
            tasks: tp.tasks.map((t) =>
              t.id === currentProgress.task.id
                ? { ...t, progress: progressInput }
                : t
            ),
          }
        : tp
    );

    onChange(newTodos);
    setProgressModalVisible(false);
    setCurrentProgress(null);
    setProgressInput('');
    message.success('进展已保存');
  };

  const handleToggleTask = (projectId: string, taskId: string, completed: boolean) => {
    const newTodos = todos.map((tp) =>
      tp.id === projectId
        ? {
            ...tp,
            tasks: tp.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    completed,
                    completedAt: completed ? dayjs().format('YYYY-MM-DD HH:mm:ss') : undefined, // 记录完成时间
                    status: completed ? '已完成' : '未开始' // ✅ 同步更新 status 字段
                  }
                : t
            ),
          }
        : tp,
    );
    onChange(newTodos);
  };

  const handleModalFinish = (data: { name?: string; content?: string }) => {
    if (modalType === 'project') {
      // 新建项目
      const newProject: TodoProject = {
        id: generateId(),
        name: data.name || '',
        tasks: [],
        createdAt: new Date().toISOString(),
      };
      onChange([...todos, newProject]);
    }
    setModalVisible(false);
    setCurrentProjectId(null);
  };

  const handleTaskModalFinish = (task: TodoTask) => {
    if (currentTask) {
      // 编辑任务 - 保留原有的progress字段
      const newTodos = todos.map((tp) =>
        tp.id === currentTask.projectId
          ? {
              ...tp,
              tasks: tp.tasks.map((t) =>
                t.id === task.id
                  ? { ...task, progress: t.progress } // 保留原有的progress
                  : t
              ),
            }
          : tp,
      );
      onChange(newTodos);    } else {
      // 新建任务
      const newTodos = todos.map((tp) =>
        tp.id === currentProjectId ? { ...tp, tasks: [...tp.tasks, task] } : tp,
      );
      onChange(newTodos);
    }
    setTaskModalVisible(false);
    setCurrentTask(null);
    setCurrentProjectId(null);
  };

  // 批量模式操作
  const handleBatchComplete = (projectId: string) => {
    const newTodos = todos.map((tp) =>
      tp.id !== projectId ? tp : {
        ...tp,
        tasks: tp.tasks.map((t) =>
          batchSelectedIds.includes(t.id)
            ? { ...t, completed: true, completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
            : t
        ),
      }
    );
    onChange(newTodos);
    setBatchSelectedIds([]);
    message.success(`已完成 ${batchSelectedIds.length} 个任务`);
  };

  const handleBatchDelete = (projectId: string) => {
    const newTodos = todos.map((tp) =>
      tp.id !== projectId ? tp : {
        ...tp,
        tasks: tp.tasks.filter((t) => !batchSelectedIds.includes(t.id)),
      }
    );
    onChange(newTodos);
    setBatchSelectedIds([]);
    message.success(`已删除 ${batchSelectedIds.length} 个任务`);
  };

  const handleBatchSetPriority = (projectId: string) => {
    if (!batchPriorityValue) return;
    const newTodos = todos.map((tp) =>
      tp.id !== projectId ? tp : {
        ...tp,
        tasks: tp.tasks.map((t) =>
          batchSelectedIds.includes(t.id) ? { ...t, priority: batchPriorityValue } : t
        ),
      }
    );
    onChange(newTodos);
    setBatchSelectedIds([]);
    setBatchPriorityValue(null);
    message.success(`已设置优先级`);
  };

  const exitBatchMode = () => {
    setBatchModeProjectId(null);
    setBatchSelectedIds([]);
    setBatchPriorityValue(null);
  };

  // 子任务操作
  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleToggleSubtask = (projectId: string, taskId: string, subtaskId: string, completed: boolean) => {
    const newTodos = todos.map((tp) =>
      tp.id !== projectId ? tp : {
        ...tp,
        tasks: tp.tasks.map((t) =>
          t.id !== taskId ? t : {
            ...t,
            subtasks: (t.subtasks || []).map((s) =>
              s.id === subtaskId ? { ...s, completed } : s
            ),
          }
        ),
      }
    );
    onChange(newTodos);
  };

  const handleAddSubtask = (projectId: string, taskId: string) => {
    const content = (newSubtaskInputs[taskId] || '').trim();
    if (!content) return;
    const newSubtask: SubTask = { id: generateId(), content, completed: false };
    const newTodos = todos.map((tp) =>
      tp.id !== projectId ? tp : {
        ...tp,
        tasks: tp.tasks.map((t) =>
          t.id !== taskId ? t : {
            ...t,
            subtasks: [...(t.subtasks || []), newSubtask],
          }
        ),
      }
    );
    onChange(newTodos);
    setNewSubtaskInputs((prev) => ({ ...prev, [taskId]: '' }));
  };

  const handleDeleteSubtask = (projectId: string, taskId: string, subtaskId: string) => {
    const newTodos = todos.map((tp) =>
      tp.id !== projectId ? tp : {
        ...tp,
        tasks: tp.tasks.map((t) =>
          t.id !== taskId ? t : {
            ...t,
            subtasks: (t.subtasks || []).filter((s) => s.id !== subtaskId),
          }
        ),
      }
    );
    onChange(newTodos);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAddProject}
        style={{ marginBottom: 16 }}
      >
        新建项目条目
      </Button>

      {todos.length === 0 ? (
        <Empty description="暂无待办项目" />
      ) : (
        <List
          dataSource={todos}
          renderItem={(todoProject) => (
            <List.Item style={{ display: 'block', padding: 0, marginBottom: 16 }}>
              <Card
                className="project-card"
                title={
                  <Space>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{todoProject.name}</span>
                    <span style={{ color: token.colorTextQuaternary, fontSize: 13 }}>
                      ({(todoProject.tasks || []).filter((t) => t.completed).length}/
                      {(todoProject.tasks || []).length})
                    </span>
                    {activeProjectId === todoProject.id && (
                      <span style={{ fontSize: 12, color: token.colorPrimary }}>● 已激活 Ctrl+N 新建</span>
                    )}
                  </Space>
                }
                style={{
                  borderLeft: activeProjectId === todoProject.id ? `3px solid ${token.colorPrimary}` : undefined,
                  cursor: 'pointer',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s',
                }}
                styles={{
                  header: {
                    background: activeProjectId === todoProject.id
                      ? token.colorPrimaryBg
                      : token.colorFillAlter,
                    borderRadius: '12px 12px 0 0',
                  },
                }}
                onClick={() => onActiveProjectChange && onActiveProjectChange(
                  activeProjectId === todoProject.id ? null : todoProject.id
                )}
                extra={
                  <Space onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddTask(todoProject.id)}
                    >
                      添加任务
                    </Button>
                    <Button
                      type="link"
                      icon={<AppstoreOutlined />}
                      onClick={() => {
                        if (batchModeProjectId === todoProject.id) {
                          exitBatchMode();
                        } else {
                          setBatchModeProjectId(todoProject.id);
                          setBatchSelectedIds([]);
                        }
                      }}
                      style={{ color: batchModeProjectId === todoProject.id ? token.colorPrimary : undefined }}
                    >
                      {batchModeProjectId === todoProject.id ? '退出批量' : '批量'}
                    </Button>
                    <Popconfirm
                      title="确定删除这个项目条目吗？"
                      onConfirm={() => handleDeleteProject(todoProject.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="link" danger icon={<DeleteOutlined />}>
                        删除项目
                      </Button>
                    </Popconfirm>
                  </Space>
                }
              >
                {(todoProject.tasks || []).length === 0 ? (
                  <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <List
                    dataSource={[...(todoProject.tasks || [])].sort((a, b) => {
                      // 没有计划时间的任务排在最后
                      if (!a.plannedDate && !b.plannedDate) return 0;
                      if (!a.plannedDate) return 1;
                      if (!b.plannedDate) return -1;
                      // 按计划完成时间升序排序
                      return dayjs(a.plannedDate).valueOf() - dayjs(b.plannedDate).valueOf();
                    })}
                    renderItem={(task) => {
                      const isOverdue = task.plannedDate && !task.completed &&
                        dayjs(task.plannedDate).isBefore(dayjs(), 'day');
                      const isToday = task.plannedDate &&
                        dayjs(task.plannedDate).isSame(dayjs(), 'day');

                      return (
                        <List.Item
                          className="task-item"
                          actions={batchModeProjectId === todoProject.id ? [] : [
                            <a key="progress" onClick={() => handleOpenProgress(todoProject.id, task)}>
                              <FileTextOutlined /> 进展
                            </a>,
                            <a key="edit" onClick={() => handleEditTask(todoProject.id, task)}>
                              <EditOutlined /> 编辑
                            </a>,
                            <Popconfirm
                              key="delete"
                              title="确定删除这个任务吗？"
                              onConfirm={() => handleDeleteTask(todoProject.id, task.id)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <a style={{ color: 'red' }}>删除</a>
                            </Popconfirm>,
                          ]}
                        >
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Space>
                              {/* 批量模式：显示批量选择框；普通模式：显示完成勾选框 */}
                              {batchModeProjectId === todoProject.id ? (
                                <Checkbox
                                  checked={batchSelectedIds.includes(task.id)}
                                  onChange={(e) => {
                                    setBatchSelectedIds((prev) =>
                                      e.target.checked
                                        ? [...prev, task.id]
                                        : prev.filter((id) => id !== task.id)
                                    );
                                  }}
                                />
                              ) : (
                                <Checkbox
                                  checked={task.completed}
                                  onChange={(e) =>
                                    handleToggleTask(todoProject.id, task.id, e.target.checked)
                                  }
                                />
                              )}
                              {task.priority && (
                                <Tag color={PRIORITY_TAG[task.priority].color} bordered={false} style={{ marginRight: 0 }}>
                                  ● {PRIORITY_TAG[task.priority].label}
                                </Tag>
                              )}
                              <span
                                style={{
                                  textDecoration: task.completed ? 'line-through' : 'none',
                                  color: task.completed ? token.colorTextQuaternary : 'inherit',
                                }}
                              >
                                {task.content}
                              </span>
                              {task.assignee && (
                                <Tag color="purple" bordered={false}>
                                  👤 {task.assignee}
                                </Tag>
                              )}
                              {(task.tags || []).map((tag) => (
                                <Tag key={tag} color={TagStorage.getColor(tag) ?? 'cyan'} bordered={false}>{tag}</Tag>
                              ))}
                              {task.plannedDate && (
                                <Tag color={isOverdue ? 'red' : isToday ? 'orange' : 'blue'} bordered={false}>
                                  {isOverdue ? '已逾期 ' : isToday ? '今日 ' : ''}
                                  {task.plannedDate}
                                </Tag>
                              )}
                              {task.completedAt && (
                                <Tag color="green" bordered={false}>
                                  ✓ {task.completedAt}
                                </Tag>
                              )}
                              {/* 工时显示 */}
                              {(task.estimatedHours || task.actualHours) && (
                                <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
                                  {task.estimatedHours ? `预计 ${task.estimatedHours}h` : ''}
                                  {task.estimatedHours && task.actualHours ? ' / ' : ''}
                                  {task.actualHours ? `实际 ${task.actualHours}h` : ''}
                                </span>
                              )}
                              {/* 子任务展开按钮 */}
                              {batchModeProjectId !== todoProject.id && (
                                <Button
                                  type="text"
                                  size="small"
                                  icon={expandedTaskIds.has(task.id) ? <DownOutlined /> : <RightOutlined />}
                                  onClick={(e) => { e.stopPropagation(); toggleTaskExpand(task.id); }}
                                  style={{ fontSize: 11, color: token.colorTextQuaternary, padding: '0 4px', height: 20 }}
                                >
                                  子任务{(task.subtasks || []).length > 0 ? ` (${(task.subtasks || []).filter(s=>s.completed).length}/${(task.subtasks || []).length})` : ''}
                                </Button>
                              )}
                            </Space>
                            {/* 子任务区域 */}
                            {expandedTaskIds.has(task.id) && batchModeProjectId !== todoProject.id && (
                              <div style={{ paddingLeft: 24, marginTop: 4 }}>
                                {(task.subtasks || []).map((subtask) => (
                                  <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                                    <Checkbox
                                      checked={subtask.completed}
                                      onChange={(e) => handleToggleSubtask(todoProject.id, task.id, subtask.id, e.target.checked)}
                                    />
                                    <span style={{
                                      fontSize: 13,
                                      textDecoration: subtask.completed ? 'line-through' : 'none',
                                      color: subtask.completed ? token.colorTextQuaternary : token.colorTextSecondary,
                                      flex: 1,
                                    }}>
                                      {subtask.content}
                                    </span>
                                    <Button
                                      type="text" size="small" danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => handleDeleteSubtask(todoProject.id, task.id, subtask.id)}
                                      style={{ opacity: 0.5, padding: '0 4px' }}
                                    />
                                  </div>
                                ))}
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                  <Input
                                    size="small"
                                    placeholder="新增子任务..."
                                    value={newSubtaskInputs[task.id] || ''}
                                    onChange={(e) => setNewSubtaskInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                    onPressEnter={() => handleAddSubtask(todoProject.id, task.id)}
                                    style={{ flex: 1, fontSize: 13 }}
                                  />
                                  <Button size="small" type="primary" ghost onClick={() => handleAddSubtask(todoProject.id, task.id)}>
                                    添加
                                  </Button>
                                </div>
                              </div>
                            )}
                            {task.progress && (
                              <div style={{
                                fontSize: 13,
                                color: token.colorTextSecondary,
                                background: token.colorFillQuaternary,
                                padding: '6px 12px 6px 16px',
                                borderRadius: 6,
                                borderLeft: `3px solid ${token.colorBorderSecondary}`,
                                whiteSpace: 'pre-wrap',
                              }}>
                                <strong>进展：</strong>{task.progress}
                              </div>
                            )}
                          </Space>
                        </List.Item>
                      );
                    }}
                  />
                )}
                {/* 批量操作栏 */}
                {batchModeProjectId === todoProject.id && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: token.colorPrimaryBg, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      已选 {batchSelectedIds.length} 项
                    </Text>
                    <Checkbox
                      indeterminate={batchSelectedIds.length > 0 && batchSelectedIds.length < (todoProject.tasks || []).length}
                      checked={batchSelectedIds.length === (todoProject.tasks || []).length && (todoProject.tasks || []).length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBatchSelectedIds((todoProject.tasks || []).map((t) => t.id));
                        } else {
                          setBatchSelectedIds([]);
                        }
                      }}
                    >
                      全选
                    </Checkbox>
                    <Button
                      size="small"
                      type="primary"
                      disabled={batchSelectedIds.length === 0}
                      onClick={() => handleBatchComplete(todoProject.id)}
                    >
                      批量完成
                    </Button>
                    <Select
                      size="small"
                      placeholder="设置优先级"
                      style={{ width: 100 }}
                      value={batchPriorityValue}
                      onChange={(v) => setBatchPriorityValue(v)}
                      options={[
                        { value: 'high', label: '高优先级' },
                        { value: 'medium', label: '中优先级' },
                        { value: 'low', label: '低优先级' },
                      ]}
                    />
                    <Button
                      size="small"
                      disabled={batchSelectedIds.length === 0 || !batchPriorityValue}
                      onClick={() => handleBatchSetPriority(todoProject.id)}
                    >
                      应用优先级
                    </Button>
                    <Popconfirm
                      title={`确定删除选中的 ${batchSelectedIds.length} 个任务吗？`}
                      onConfirm={() => handleBatchDelete(todoProject.id)}
                      okText="确定"
                      cancelText="取消"
                      disabled={batchSelectedIds.length === 0}
                    >
                      <Button size="small" danger disabled={batchSelectedIds.length === 0}>
                        批量删除
                      </Button>
                    </Popconfirm>
                    <Button size="small" onClick={exitBatchMode}>退出</Button>
                  </div>
                )}
              </Card>
            </List.Item>
          )}
        />
      )}

      <TodoModal
        visible={modalVisible}
        type={modalType}
        onCancel={() => {
          setModalVisible(false);
          setCurrentProjectId(null);
        }}
        onFinish={handleModalFinish}
      />
      <TodoTaskModal
        visible={taskModalVisible}
        task={currentTask?.task || null}
        allTags={allTags}
        onCancel={() => {
          setTaskModalVisible(false);
          setCurrentTask(null);
          setCurrentProjectId(null);
        }}
        onFinish={handleTaskModalFinish}
      />

      <Modal
        title="任务进展"
        open={progressModalVisible}
        onOk={handleSaveProgress}
        onCancel={() => {
          setProgressModalVisible(false);
          setCurrentProgress(null);
          setProgressInput('');
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: 8 }}>
          <strong>任务：</strong>{currentProgress?.task.content}
        </div>
        <TextArea
          rows={8}
          placeholder="请输入任务进展..."
          value={progressInput}
          onChange={(e) => setProgressInput(e.target.value)}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </>
  );
};

export default TodoSection;
