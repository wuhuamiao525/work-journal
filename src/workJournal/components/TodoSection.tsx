import React, { useState } from 'react';
import { Button, Card, List, Checkbox, Space, Popconfirm, message, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { TodoProject, TodoTask } from '../types';
import { generateId } from '../types';
import TodoModal from '../modals/TodoModal';

interface TodoSectionProps {
  todos: TodoProject[];
  onChange: (todos: TodoProject[]) => void;
}

const TodoSection: React.FC<TodoSectionProps> = (props) => {
  const { todos, onChange } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'project' | 'task'>('project');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const handleAddProject = () => {
    setModalType('project');
    setModalVisible(true);
    setCurrentProjectId(null);
  };

  const handleAddTask = (projectId: string) => {
    setModalType('task');
    setModalVisible(true);
    setCurrentProjectId(projectId);
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
    } else {
      // 新建任务
      const newTask: TodoTask = {
        id: generateId(),
        content: data.content || '',
        completed: false,
        createdAt: new Date().toISOString(),
      };
      const newTodos = todos.map((tp) =>
        tp.id === currentProjectId ? { ...tp, tasks: [...tp.tasks, newTask] } : tp,
      );
      onChange(newTodos);
    }
    setModalVisible(false);
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
                    renderItem={(task) => (
                      <List.Item
                        actions={[
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
                        <Checkbox
                          checked={task.completed}
                          onChange={(e) =>
                            handleToggleTask(todoProject.id, task.id, e.target.checked)
                          }
                          style={{
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? '#999' : 'inherit',
                          }}
                        >
                          {task.content}
                        </Checkbox>
                      </List.Item>
                    )}
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
    </>
  );
};

export default TodoSection;
