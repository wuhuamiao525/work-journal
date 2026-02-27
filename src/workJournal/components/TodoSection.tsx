import React, { useState } from 'react';
import { Button, Card, List, Checkbox, Space, Popconfirm, message, Empty, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { TodoProject, TodoTask } from '../types';
import { generateId } from '../types';
import TodoModal from '../modals/TodoModal';
import TodoTaskModal from '../modals/TodoTaskModal';
import dayjs from 'dayjs';

interface TodoSectionProps {
  todos: TodoProject[];
  onChange: (todos: TodoProject[]) => void;
}

const TodoSection: React.FC<TodoSectionProps> = (props) => {
  const { todos, onChange } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'project' | 'task'>('project');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<{ projectId: string; task: TodoTask } | null>(null);

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

  const handleToggleTask = (projectId: string, taskId: string, completed: boolean) => {
    const newTodos = todos.map((tp) =>
      tp.id === projectId
        ? {
            ...tp,
            tasks: tp.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
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
      // 编辑任务
      const newTodos = todos.map((tp) =>
        tp.id === currentTask.projectId
          ? {
              ...tp,
              tasks: tp.tasks.map((t) => (t.id === task.id ? task : t)),
            }
          : tp,
      );
      onChange(newTodos);
    } else {
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
                title={
                  <Space>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{todoProject.name}</span>
                    <span style={{ color: '#999', fontSize: 14 }}>
                      ({todoProject.tasks.filter((t) => t.completed).length}/
                      {todoProject.tasks.length})
                    </span>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      type="link"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddTask(todoProject.id)}
                    >
                      添加任务
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
                {todoProject.tasks.length === 0 ? (
                  <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <List
                    dataSource={todoProject.tasks}
                    renderItem={(task) => {
                      const isOverdue = task.plannedDate && !task.completed &&
                        dayjs(task.plannedDate).isBefore(dayjs(), 'day');
                      const isToday = task.plannedDate &&
                        dayjs(task.plannedDate).isSame(dayjs(), 'day');

                      return (
                        <List.Item
                          actions={[
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
                          <Space style={{ width: '100%' }}>
                            <Checkbox
                              checked={task.completed}
                              onChange={(e) =>
                                handleToggleTask(todoProject.id, task.id, e.target.checked)
                              }
                            />
                            <span
                              style={{
                                textDecoration: task.completed ? 'line-through' : 'none',
                                color: task.completed ? '#999' : 'inherit',
                              }}
                            >
                              {task.content}
                            </span>
                            {task.plannedDate && (
                              <Tag color={isOverdue ? 'red' : isToday ? 'orange' : 'blue'}>
                                {isOverdue ? '已逾期 ' : isToday ? '今日 ' : ''}
                                {task.plannedDate}
                              </Tag>
                            )}
                          </Space>
                        </List.Item>
                      );
                    }}
                  />
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
        onCancel={() => {
          setTaskModalVisible(false);
          setCurrentTask(null);
          setCurrentProjectId(null);
        }}
        onFinish={handleTaskModalFinish}
      />
    </>
  );
};

export default TodoSection;
