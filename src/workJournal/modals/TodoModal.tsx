import React, { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';

interface TodoModalProps {
  visible: boolean;
  type: 'project' | 'task';
  onCancel: () => void;
  onFinish: (data: { name?: string; content?: string }) => void;
}

const TodoModal: React.FC<TodoModalProps> = (props) => {
  const { visible, type, onCancel, onFinish } = props;
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.resetFields();
    }
  }, [visible, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      onFinish(values);
      message.success('创建成功');
      form.resetFields();
    });
  };

  return (
    <Modal
      title={type === 'project' ? '新建项目条目' : '新建任务'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        {type === 'project' ? (
          <Form.Item
            name="name"
            label="项目条目名称"
            rules={[{ required: true, message: '请输入项目条目名称' }]}
          >
            <Input placeholder="请输入项目条目名称" />
          </Form.Item>
        ) : (
          <Form.Item
            name="content"
            label="任务内容"
            rules={[{ required: true, message: '请输入任务内容' }]}
          >
            <Input placeholder="请输入任务内容" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default TodoModal;
