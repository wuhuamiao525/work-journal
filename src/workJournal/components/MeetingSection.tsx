import React, { useState, useMemo } from 'react';
import { Button, Checkbox, Space, Popconfirm, message, Table, Tag, Badge } from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import type { Meeting } from '../types';
import MeetingModal from '../modals/MeetingModal';
import MinutesModal from '../modals/MinutesModal';
import { RecurringMeetingService } from '../services/recurringMeeting';
import dayjs from 'dayjs';

interface MeetingSectionProps {
  meetings: Meeting[];
  onChange: (meetings: Meeting[]) => void;
}

const MeetingSection: React.FC<MeetingSectionProps> = (props) => {
  const { meetings, onChange } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [minutesModalVisible, setMinutesModalVisible] = useState(false);
  const [minutesMeeting, setMinutesMeeting] = useState<Meeting | null>(null);

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

  const handleToggleComplete = async (meeting: Meeting, completed: boolean) => {
    const updatedMeeting = { ...meeting, completed };
    const newMeetings = meetings.map((m) =>
      m.id === meeting.id ? updatedMeeting : m,
    );
    onChange(newMeetings);

    // 如果会议被标记为完成，且有循环设置，自动创建下次会议
    if (completed && meeting.recurrence && meeting.recurrence !== 'none') {
      try {
        await RecurringMeetingService.handleMeetingCompleted(updatedMeeting);
        const recurrenceText =
          meeting.recurrence === 'daily' ? '明日' :
          meeting.recurrence === 'weekly' ? '下周' : '下下周';
        message.success(`会议已完成，已自动创建${recurrenceText}同一时间的会议`);
      } catch (error) {
        console.error('创建循环会议失败:', error);
        message.warning('会议已完成，但自动创建下次会议失败');
      }
    }
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

  const handleOpenMinutes = (meeting: Meeting) => {
    setMinutesMeeting(meeting);
    setMinutesModalVisible(true);
  };

  const handleSaveMinutes = (meeting: Meeting, minutes: string) => {
    const updatedMeeting = { ...meeting, minutes };
    const newMeetings = meetings.map((m) => (m.id === meeting.id ? updatedMeeting : m));
    onChange(newMeetings);
    setMinutesModalVisible(false);
    setMinutesMeeting(null);
  };

  // 对会议按时间升序排序
  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      const timeA = dayjs(a.time);
      const timeB = dayjs(b.time);
      return timeA.valueOf() - timeB.valueOf(); // 升序：最早的在前面
    });
  }, [meetings]);

  const getRecurrenceTag = (recurrence: string) => {
    if (recurrence === 'daily') {
      return <Tag color="orange">每日</Tag>;
    } else if (recurrence === 'weekly') {
      return <Tag color="blue">每周</Tag>;
    } else if (recurrence === 'biweekly') {
      return <Tag color="green">每两周</Tag>;
    }
    return null;
  };

  // 判断是否是当天的会议
  const isTodayMeeting = (meetingTime: string) => {
    return dayjs(meetingTime).isSame(dayjs(), 'day');
  };

  const columns = [
    {
      title: '会议名称',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (text: string, record: Meeting) => (
        <Space>
          {text}
          {getRecurrenceTag(record.recurrence)}
        </Space>
      ),
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
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Meeting) => (
        <Space>
          <Badge dot={!!record.minutes && record.minutes.trim() !== ''}>
            <a onClick={() => handleOpenMinutes(record)}>
              <FileTextOutlined /> 纪要
            </a>
          </Badge>
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
        dataSource={sortedMeetings}
        rowKey="id"
        pagination={false}
        rowClassName={(record) => {
          if (record.completed) {
            return 'completed-meeting-row';
          }
          if (isTodayMeeting(record.time)) {
            return 'today-meeting-row';
          }
          return '';
        }}
      />
      <style>{`
        .today-meeting-row {
          background-color: #e6f7ff !important;
        }
        .today-meeting-row:hover > td {
          background-color: #bae7ff !important;
        }
        .completed-meeting-row {
          background-color: #f6ffed !important;
        }
        .completed-meeting-row:hover > td {
          background-color: #d9f7be !important;
        }
      `}</style>
      <MeetingModal
        visible={modalVisible}
        meeting={currentMeeting}
        onCancel={() => {
          setModalVisible(false);
          setCurrentMeeting(null);
        }}
        onFinish={handleModalFinish}
      />
      <MinutesModal
        visible={minutesModalVisible}
        meeting={minutesMeeting}
        onCancel={() => {
          setMinutesModalVisible(false);
          setMinutesMeeting(null);
        }}
        onSave={handleSaveMinutes}
      />
    </>
  );
};

export default MeetingSection;
