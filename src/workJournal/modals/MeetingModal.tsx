import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, message } from 'antd';
import dayjs from 'dayjs';
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
        // 将时间字符串转换为 dayjs 对象
        form.setFieldsValue({
          ...meeting,
          time: meeting.time ? dayjs(meeting.time) : null,
        });
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
        time: values.time ? values.time.format('YYYY-MM-DD HH:mm') : '',
        location: values.location,
        completed: meeting?.completed || false,
        recurrence: values.recurrence || 'none',
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
          rules={[{ required: true, message: '请选择时间' }]}
        >
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            placeholder="请选择日期和时间"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          name="location"
          label="地点"
          rules={[{ required: true, message: '请输入地点' }]}
        >
          <Input placeholder="请输入地点" />
        </Form.Item>
        <Form.Item
          name="recurrence"
          label="循环设置"
          initialValue="none"
        >
          <Select
            placeholder="请选择循环类型"
            options={[
              { label: '不循环', value: 'none' },
              { label: '每日循环', value: 'daily' },
              { label: '每周循环', value: 'weekly' },
              { label: '每两周循环', value: 'biweekly' },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MeetingModal;
