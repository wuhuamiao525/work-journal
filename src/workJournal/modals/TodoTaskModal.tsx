import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Radio, Select, InputNumber, Row, Col, message } from 'antd';
import dayjs from 'dayjs';
import type { TodoTask, TaskPriority } from '../types';
import { generateId } from '../types';

interface TodoTaskModalProps {
  visible: boolean;
  task?: TodoTask | null;
  allTags?: string[];
  onCancel: () => void;
  onFinish: (task: TodoTask) => void;
}

const PRIORITY_OPTIONS = [
  { label: '🔴 高', value: 'high' },
  { label: '🟠 中', value: 'medium' },
  { label: '⚪ 低', value: 'low' },
];

const TodoTaskModal: React.FC<TodoTaskModalProps> = (props) => {
  const { visible, task, allTags = [], onCancel, onFinish } = props;
  const [form] = Form.useForm();
  const isEdit = !!task;

  useEffect(() => {
    if (visible) {
      if (task) {
        form.setFieldsValue({
          content: task.content,
          plannedDate: task.plannedDate ? dayjs(task.plannedDate) : null,
          assignee: task.assignee,
          priority: task.priority || null,
          tags: task.tags || [],
          estimatedHours: task.estimatedHours ?? null,
          actualHours: task.actualHours ?? null,
        });
      } else {
        form.resetFields();
      }
    }
  }, [visible, task, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const newTask: TodoTask = {
        id: task?.id || generateId(),
        content: values.content,
        completed: task?.completed || false,
        plannedDate: values.plannedDate ? values.plannedDate.format('YYYY-MM-DD') : undefined,
        assignee: values.assignee,
        priority: values.priority as TaskPriority | undefined,
        tags: values.tags && values.tags.length > 0 ? values.tags : undefined,
        estimatedHours: values.estimatedHours ?? undefined,
        actualHours: values.actualHours ?? undefined,
        subtasks: task?.subtasks || [],
        createdAt: task?.createdAt || new Date().toISOString(),
      };
      onFinish(newTask);
      message.success(isEdit ? '编辑成功' : '新建成功');
      form.resetFields();
    });
  };

  return (
    <Modal
      title={isEdit ? '编辑任务' : '新建任务'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnClose
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="content" label="任务内容" rules={[{ required: true, message: '请输入任务内容' }]}>
          <Input placeholder="请输入任务内容" />
        </Form.Item>
        <Form.Item name="priority" label="优先级">
          <Radio.Group options={PRIORITY_OPTIONS} optionType="button" buttonStyle="solid" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="plannedDate" label="计划完成时间">
              <DatePicker format="YYYY-MM-DD" placeholder="请选择计划完成日期" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="assignee" label="责任人">
              <Input placeholder="请输入责任人" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="estimatedHours" label="预计工时">
              <InputNumber min={0.5} max={999} step={0.5} placeholder="小时数" style={{ width: '100%' }} addonAfter="h" />
            </Form.Item>
          </Col>
          {isEdit && (
            <Col span={12}>
              <Form.Item name="actualHours" label="实际工时">
                <InputNumber min={0} max={999} step={0.5} placeholder="小时数" style={{ width: '100%' }} addonAfter="h" />
              </Form.Item>
            </Col>
          )}
        </Row>
        <Form.Item name="tags" label="标签">
          <Select
            mode="tags"
            placeholder="输入后回车添加标签，或从历史标签中选择"
            options={allTags.map((t) => ({ label: t, value: t }))}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TodoTaskModal;
