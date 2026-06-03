import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, DatePicker, Select, InputNumber, Row, Col, message } from 'antd';
import dayjs from 'dayjs';
import type { Meeting, ProjectCollection } from '../types';
import { generateId } from '../types';

interface MeetingModalProps {
  visible: boolean;
  meeting?: Meeting | null;
  projects?: ProjectCollection;
  allTags?: string[];
  onCancel: () => void;
  onFinish: (meeting: Meeting) => void;
}

const MeetingModal: React.FC<MeetingModalProps> = (props) => {
  const { visible, meeting, projects, allTags = [], onCancel, onFinish } = props;
  const [form] = Form.useForm();
  const isEdit = !!meeting;

  const projectOptions = useMemo(() => {
    if (!projects) return [];
    const allProjects = [
      ...(projects.inProgress || []),
      ...(projects.delivered || []),
      ...(projects.accepted || []),
    ];
    const seen = new Set<string>();
    return allProjects
      .filter((p) => {
        if (!p.name || seen.has(p.name)) return false;
        seen.add(p.name);
        return true;
      })
      .map((p) => ({ label: p.name, value: p.name }));
  }, [projects]);

  useEffect(() => {
    if (visible) {
      if (meeting) {
        form.setFieldsValue({
          ...meeting,
          time: meeting.time ? dayjs(meeting.time) : null,
          attendees: meeting.attendees || [],
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
        projectName: values.projectName || undefined,
        tags: values.tags && values.tags.length > 0 ? values.tags : undefined,
        attendees: values.attendees && values.attendees.length > 0 ? values.attendees : undefined,
        duration: values.duration || undefined,
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
      width={560}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="会议名称" rules={[{ required: true, message: '请输入会议名称' }]}>
          <Input placeholder="请输入会议名称" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={14}>
            <Form.Item name="time" label="时间" rules={[{ required: true, message: '请选择时间' }]}>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                placeholder="请选择日期和时间"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="duration" label="时长（分钟）">
              <InputNumber
                min={15}
                max={480}
                step={15}
                placeholder="如：60"
                style={{ width: '100%' }}
                addonAfter="分钟"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="location" label="地点" rules={[{ required: true, message: '请输入地点' }]}>
          <Input placeholder="请输入地点" />
        </Form.Item>
        <Form.Item name="attendees" label="参与人">
          <Select
            mode="tags"
            placeholder="输入姓名后回车添加参与人"
            style={{ width: '100%' }}
            tokenSeparators={[',']}
          />
        </Form.Item>
        <Form.Item name="projectName" label="所属项目">
          <Select
            allowClear
            showSearch
            placeholder="请选择所属项目（可选）"
            options={projectOptions}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Select
            mode="tags"
            placeholder="输入后回车添加标签，或从历史标签中选择"
            options={allTags.map((t) => ({ label: t, value: t }))}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="recurrence" label="循环设置" initialValue="none">
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
