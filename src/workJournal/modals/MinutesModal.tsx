import React, { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import type { Meeting } from '../types';

const { TextArea } = Input;

interface MinutesModalProps {
  visible: boolean;
  meeting: Meeting | null;
  onCancel: () => void;
  onSave: (meeting: Meeting, minutes: string) => void;
}

const MinutesModal: React.FC<MinutesModalProps> = (props) => {
  const { visible, meeting, onCancel, onSave } = props;
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && meeting) {
      form.setFieldsValue({
        minutes: meeting.minutes || '',
      });
    }
  }, [visible, meeting, form]);

  const handleOk = () => {
    if (!meeting) return;

    form.validateFields().then((values) => {
      onSave(meeting, values.minutes || '');
      message.success('会议纪要保存成功');
      form.resetFields();
    });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={`会议纪要 - ${meeting?.name || ''}`}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={700}
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="minutes" label="会议纪要内容">
          <TextArea
            placeholder="请输入会议纪要..."
            rows={12}
            maxLength={10000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MinutesModal;
