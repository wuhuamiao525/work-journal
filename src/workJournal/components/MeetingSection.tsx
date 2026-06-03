import React, { useState, useMemo } from 'react';
import { Button, Checkbox, Space, Popconfirm, message, Table, Tag, Badge, Avatar, Tooltip, theme as antTheme } from 'antd';
import { PlusOutlined, FileTextOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Meeting, ProjectCollection } from '../types';
import MeetingModal from '../modals/MeetingModal';
import MinutesModal from '../modals/MinutesModal';
import { RecurringMeetingService } from '../services/recurringMeeting';
import dayjs from 'dayjs';

interface MeetingSectionProps {
  meetings: Meeting[];
  onChange: (meetings: Meeting[]) => void;
  projects?: ProjectCollection;
}

const MeetingSection: React.FC<MeetingSectionProps> = (props) => {
  const { meetings, onChange, projects } = props;
  const { token } = antTheme.useToken();
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [minutesModalVisible, setMinutesModalVisible] = useState(false);
  const [minutesMeeting, setMinutesMeeting] = useState<Meeting | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    meetings.forEach((m) => (m.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [meetings]);

  const handleAdd = () => { setCurrentMeeting(null); setModalVisible(true); };
  const handleEdit = (meeting: Meeting) => { setCurrentMeeting(meeting); setModalVisible(true); };
  const handleDelete = (meeting: Meeting) => {
    onChange(meetings.filter((m) => m.id !== meeting.id));
    message.success('删除成功');
  };

  const handleToggleComplete = async (meeting: Meeting, completed: boolean) => {
    const updatedMeeting = { ...meeting, completed };
    onChange(meetings.map((m) => m.id === meeting.id ? updatedMeeting : m));
    if (completed && meeting.recurrence && meeting.recurrence !== 'none') {
      try {
        await RecurringMeetingService.handleMeetingCompleted(updatedMeeting);
        const recurrenceText =
          meeting.recurrence === 'daily' ? '明日' :
          meeting.recurrence === 'weekly' ? '下周' : '下下周';
        message.success(`会议已完成，已自动创建${recurrenceText}同一时间的会议`);
      } catch {
        message.warning('会议已完成，但自动创建下次会议失败');
      }
    }
  };

  const handleModalFinish = (meeting: Meeting) => {
    if (currentMeeting) {
      onChange(meetings.map((m) => m.id === meeting.id ? meeting : m));
    } else {
      onChange([...meetings, meeting]);
    }
    setModalVisible(false);
    setCurrentMeeting(null);
  };

  const handleOpenMinutes = (meeting: Meeting) => { setMinutesMeeting(meeting); setMinutesModalVisible(true); };
  const handleSaveMinutes = (meeting: Meeting, minutes: string) => {
    onChange(meetings.map((m) => m.id === meeting.id ? { ...meeting, minutes } : m));
    setMinutesModalVisible(false);
    setMinutesMeeting(null);
  };

  const sortedMeetings = useMemo(() =>
    [...meetings].sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf()),
  [meetings]);

  const getRecurrenceTag = (recurrence: string) => {
    if (recurrence === 'daily') return <Tag color="orange" bordered={false}>每日</Tag>;
    if (recurrence === 'weekly') return <Tag color="blue" bordered={false}>每周</Tag>;
    if (recurrence === 'biweekly') return <Tag color="green" bordered={false}>每两周</Tag>;
    return null;
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}分钟`;
    if (m === 0) return `${h}小时`;
    return `${h}h ${m}m`;
  };

  const isTodayMeeting = (time: string) => dayjs(time).isSame(dayjs(), 'day');

  const columns = [
    {
      title: '会议名称', dataIndex: 'name', key: 'name', width: 260,
      render: (text: string, record: Meeting) => (
        <Space>{text}{getRecurrenceTag(record.recurrence)}</Space>
      ),
    },
    { title: '时间', dataIndex: 'time', key: 'time', width: 130 },
    {
      title: '时长', key: 'duration', width: 90,
      render: (_: any, record: Meeting) => (
        <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          {formatDuration(record.duration)}
        </span>
      ),
    },
    { title: '地点', dataIndex: 'location', key: 'location', width: 160 },
    {
      title: '参与人', key: 'attendees', width: 150,
      render: (_: any, record: Meeting) => {
        const attendees = record.attendees || [];
        if (attendees.length === 0) return <span style={{ color: token.colorTextQuaternary }}>-</span>;
        return (
          <Avatar.Group maxCount={3} size="small" maxStyle={{ backgroundColor: token.colorPrimary }}>
            {attendees.map((name) => (
              <Tooltip key={name} title={name}>
                <Avatar size="small" style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary, fontSize: 11 }}>
                  {name.charAt(0)}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
        );
      },
    },
    {
      title: '所属项目', dataIndex: 'projectName', key: 'projectName', width: 150,
      render: (v: string) => v ? <Tag color="blue" bordered={false}>{v}</Tag> : null,
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', width: 180,
      render: (tags: string[]) => (
        <Space size={4} wrap>
          {(tags || []).map((tag) => <Tag key={tag} color="cyan" bordered={false}>{tag}</Tag>)}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'completed', key: 'completed', width: 100,
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
      title: '操作', key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, record: Meeting) => (
        <Space size={2}>
          <Badge dot={!!record.minutes && record.minutes.trim() !== ''}>
            <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleOpenMinutes(record)}>
              纪要
            </Button>
          </Badge>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除这个会议吗？" onConfirm={() => handleDelete(record)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建会议</Button>
      </div>
      <Table
        columns={columns}
        dataSource={sortedMeetings}
        rowKey="id"
        pagination={false}
        scroll={{ x: 1400 }}
        onRow={(record) => ({
          style: record.completed
            ? { backgroundColor: token.colorSuccessBg }
            : isTodayMeeting(record.time)
            ? { backgroundColor: token.colorInfoBg }
            : {},
        })}
      />
      <MeetingModal
        visible={modalVisible}
        meeting={currentMeeting}
        projects={projects}
        allTags={allTags}
        onCancel={() => { setModalVisible(false); setCurrentMeeting(null); }}
        onFinish={handleModalFinish}
      />
      <MinutesModal
        visible={minutesModalVisible}
        meeting={minutesMeeting}
        onCancel={() => { setMinutesModalVisible(false); setMinutesMeeting(null); }}
        onSave={handleSaveMinutes}
      />
    </>
  );
};

export default MeetingSection;
