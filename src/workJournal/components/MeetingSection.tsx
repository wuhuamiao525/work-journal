import React, { useState } from 'react';
import { Button, Checkbox, Space, Popconfirm, message, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Meeting } from '../types';
import MeetingModal from '../modals/MeetingModal';

interface MeetingSectionProps {
  meetings: Meeting[];
  onChange: (meetings: Meeting[]) => void;
}

const MeetingSection: React.FC<MeetingSectionProps> = (props) => {
  const { meetings, onChange } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);

  const handleAdd = () => {
    setCurrentMeeting(null);
    setModalVisible(true);
  };

  const handleEdit = (meeting: Meeting) => {
    setCurrentMeeting(meeting);
    setModalVisible(true);
  };

  const handleDelete = (meeting: Meeting) => {
    const newMeetings = meetings.filter((m) => m.id !== meeting.id);
    onChange(newMeetings);
    message.success('删除成功');
  };

  const handleToggleComplete = (meeting: Meeting, completed: boolean) => {
    const newMeetings = meetings.map((m) =>
      m.id === meeting.id ? { ...m, completed } : m,
    );
    onChange(newMeetings);
  };

  const handleModalFinish = (meeting: Meeting) => {
    if (currentMeeting) {
      // 编辑
      const newMeetings = meetings.map((m) => (m.id === meeting.id ? meeting : m));
      onChange(newMeetings);
    } else {
      // 新增
      onChange([...meetings, meeting]);
    }
    setModalVisible(false);
    setCurrentMeeting(null);
  };

  const columns = [
    {
      title: '会议名称',
      dataIndex: 'name',
      key: 'name',
      width: 300,
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 120,
    },
    {
      title: '地点',
      dataIndex: 'location',
      key: 'location',
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'completed',
      key: 'completed',
      width: 100,
      render: (_: any, record: Meeting) => (
        <Checkbox
          checked={record.completed}
          onChange={(e) => handleToggleComplete(record, e.target.checked)}
        >
          {record.completed ? '已完成' : '未完成'}
        </Checkbox>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Meeting) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <Popconfirm
            title="确定删除这个会议吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建会议
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={meetings}
        rowKey="id"
        pagination={false}
      />
      <MeetingModal
        visible={modalVisible}
        meeting={currentMeeting}
        onCancel={() => {
          setModalVisible(false);
          setCurrentMeeting(null);
        }}
        onFinish={handleModalFinish}
      />
    </>
  );
};

export default MeetingSection;
