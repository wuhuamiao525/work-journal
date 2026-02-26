import React, { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import type { Meeting } from '../types';
import { generateId } from '../types';

interface MeetingModalProps {
  visible: boolean;
  meeting?: Meeting | null;
  onCancel: () => void;
  onFinish: (meeting: Meeting) => void;
}

const MeetingModal: React.FC<MeetingModalProps> = (props) => {
  const { visible, meeting, onCancel, onFinish } = props;
  const [form] = Form.useForm();
  const isEdit = !!meeting;

  useEffect(() => {
    if (visible) {
      if (meeting) {
        form.setFieldsValue(meeting);
      } else {
        form.resetFields();
      }
    }
  }, [visible, meeting, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const newMeeting: Meeting = {
        id: meeting?.id || generateId(),
        name: values.name,
        time: values.time,
        location: values.location,
        completed: meeting?.completed || false,
        createdAt: meeting?.createdAt || new Date().toISOString(),
      };
      onFinish(newMeeting);
      message.success(isEdit ? '编辑成功' : '新建成功');
      form.resetFields();
    });
  };

  return (
    <Modal
      title={isEdit ? '编辑会议' : '新建会议'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="会议名称"
          rules={[{ required: true, message: '请输入会议名称' }]}
        >
          <Input placeholder="请输入会议名称" />
        </Form.Item>
        <Form.Item
          name="time"
          label="时间"
          rules={[{ required: true, message: '请输入时间' }]}
        >
          <Input placeholder="请输入时间 (例如: 09:30)" />
        </Form.Item>
        <Form.Item
          name="location"
          label="地点"
          rules={[{ required: true, message: '请输入地点' }]}
        >
          <Input placeholder="请输入地点" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MeetingModal;
