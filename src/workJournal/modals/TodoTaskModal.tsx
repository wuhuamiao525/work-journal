import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import type { TodoTask } from '../types';
import { generateId } from '../types';

interface TodoTaskModalProps {
  visible: boolean;
  task?: TodoTask | null;
  onCancel: () => void;
  onFinish: (task: TodoTask) => void;
}

const TodoTaskModal: React.FC<TodoTaskModalProps> = (props) => {
  const { visible, task, onCancel, onFinish } = props;
  const [form] = Form.useForm();
  const isEdit = !!task;

  useEffect(() => {
    if (visible) {
      if (task) {
        form.setFieldsValue({
          content: task.content,
          plannedDate: task.plannedDate ? dayjs(task.plannedDate) : null,
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
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="content"
          label="任务内容"
          rules={[{ required: true, message: '请输入任务内容' }]}
        >
          <Input placeholder="请输入任务内容" />
        </Form.Item>
        <Form.Item
          name="plannedDate"
          label="计划完成时间"
        >
          <DatePicker
            format="YYYY-MM-DD"
            placeholder="请选择计划完成日期"
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TodoTaskModal;
