import React, { useState, useEffect, useCallback } from 'react';
import { DatePicker, Collapse, message, Layout, Typography, Button, Dropdown } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import type { DailyWorkJournal } from './types';
import { WorkJournalStorage } from './services/storage';
import { AutoSyncService } from './services/autoSync';
import { AuthService } from '../auth/AuthService';
import MeetingSection from './components/MeetingSection';
import ProjectSection from './components/ProjectSection';
import TodoSection from './components/TodoSection';
import DiarySection from './components/DiarySection';
import './index.css';

const { Header, Content } = Layout;
const { Title } = Typography;

const { Panel } = Collapse;

interface WorkJournalProps {
  onLogout: () => void;
}

// 加载未来的循环会议
const loadUpcomingRecurringMeetings = async (currentDate: string) => {
  const today = dayjs(currentDate);
  const upcomingMeetings: any[] = [];

  // 查找从今天往后30天内的所有未完成循环会议
  for (let i = 0; i <= 30; i++) {
    const futureDate = today.add(i, 'days').format('YYYY-MM-DD');
    const futureData = await WorkJournalStorage.get(futureDate);

    if (!futureData) continue;

    for (const meeting of futureData.meetings) {
      // 只显示未完成的循环会议，且会议时间在未来
      if (!meeting.recurrence || meeting.recurrence === 'none' || meeting.completed) {
        continue;
      }

      const meetingTime = dayjs(meeting.time);
      const now = dayjs();

      // 如果会议时间在当前时间之后，添加到列表
      if (meetingTime.isAfter(now)) {
        upcomingMeetings.push(meeting);
      }
    }
  }

  return upcomingMeetings;
};

const WorkJournal: React.FC<WorkJournalProps> = ({ onLogout }) => {
  const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [journalData, setJournalData] = useState<DailyWorkJournal | null>(null);
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 标记是否是初始加载

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setIsInitialLoad(true); // 标记为初始加载，防止触发自动保存

      let data = await WorkJournalStorage.get(currentDate);
      if (!data) {
        // 如果没有数据，创建空数据但不立即保存到数据库
        data = WorkJournalStorage.createEmptyDaily(currentDate);
        console.log('[工作日记] 没有数据，创建空结构（仅内存，不保存）');
      } else {
        console.log('[工作日记] 加载到数据:', {
          会议: data.meetings?.length || 0,
          项目: (data.projects?.inProgress?.length || 0) + (data.projects?.delivered?.length || 0) + (data.projects?.accepted?.length || 0),
          待办: data.todos?.length || 0
        });
      }

      // 加载未来的循环会议（从今天往后30天内）
      const upcomingRecurringMeetings = await loadUpcomingRecurringMeetings(currentDate);
      if (upcomingRecurringMeetings.length > 0) {
        console.log('[工作日记] 加载到未来循环会议:', upcomingRecurringMeetings.length, '个');
        // 合并到当前数据，避免重复
        const existingIds = new Set(data.meetings.map(m => `${m.name}-${m.time}`));
        const newMeetings = upcomingRecurringMeetings.filter(
          m => !existingIds.has(`${m.name}-${m.time}`)
        );
        data.meetings = [...data.meetings, ...newMeetings];
      }

      setJournalData(data);

      // 延迟重置标记，确保 useEffect 不会在初始加载时触发保存
      setTimeout(() => setIsInitialLoad(false), 100);
    } catch (error) {
      console.error('Failed to load data:', error);
      message.error('加载数据失败');
    }
  }, [currentDate]);

  // 保存数据（防抖）
  const saveData = useCallback(async () => {
    if (!journalData) return;

    try {
      await WorkJournalStorage.save(journalData);
      console.log('[工作日记] 数据已保存');
    } catch (error) {
      console.error('[工作日记] 保存失败:', error);
      message.error('保存失败，请稍后重试');
    }
  }, [journalData]);

  // 自动保存（数据变化后 1 秒）
  useEffect(() => {
    // 如果是初始加载，不触发自动保存
    if (isInitialLoad || !journalData) {
      return;
    }

    console.log('[工作日记] 数据变化，1秒后自动保存');
    const timer = setTimeout(() => {
      saveData();
    }, 1000);

    return () => clearTimeout(timer);
  }, [journalData, saveData, isInitialLoad]);

  // 页面加载时加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 启动自动同步
  useEffect(() => {
    const cleanup = AutoSyncService.startAutoCheck((syncedData) => {
      console.log('[工作日记] 自动同步完成，已复制上一个工作日的数据');
      setJournalData(syncedData);
      message.success('已自动从上一个工作日同步数据');
    });

    return cleanup;
  }, []);

  // 日期切换处理
  const handleDateChange = async (date: dayjs.Dayjs | null) => {
    if (date) {
      const newDate = date.format('YYYY-MM-DD');
      console.log('[工作日记] 切换日期到:', newDate);
      setCurrentDate(newDate);
    }
  };

  if (!journalData) {
    return null;
  }

  const currentUser = AuthService.getUser();

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  return (
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0
      }}>
        <Title level={3} style={{ margin: 0 }}>每日工作日记</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <DatePicker
            value={dayjs(currentDate)}
            onChange={handleDateChange}
            allowClear={false}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button icon={<UserOutlined />}>
              {currentUser?.displayName || currentUser?.username || '用户'}
            </Button>
          </Dropdown>
        </div>
      </Header>
      <Content style={{
        padding: '24px',
        background: '#f0f2f5',
        flex: 1,
        overflow: 'auto'
      }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '8px' }}>
          <Collapse
            defaultActiveKey={['meetings', 'projects', 'todos', 'diary']}
          >
            <Panel header="会议安排" key="meetings">
              <MeetingSection
                meetings={journalData.meetings}
                onChange={(meetings) => setJournalData({ ...journalData, meetings })}
              />
            </Panel>

            <Panel header="交付项目人员安排" key="projects">
              <ProjectSection
                projects={journalData.projects}
                onChange={(projects) => setJournalData({ ...journalData, projects })}
              />
            </Panel>

            <Panel header="交付项目待办" key="todos">
              <TodoSection
                todos={journalData.todos}
                onChange={(todos) => setJournalData({ ...journalData, todos })}
              />
            </Panel>

            <Panel header="工作日记" key="diary">
              <DiarySection
                diary={journalData.diary}
                onChange={(diary) => setJournalData({ ...journalData, diary })}
                onSave={async () => {
                  await WorkJournalStorage.save({
                    ...journalData,
                    lastModified: new Date().toISOString(),
                  });
                }}
              />
            </Panel>
          </Collapse>
        </div>
      </Content>
    </Layout>
  );
};

export default WorkJournal;
