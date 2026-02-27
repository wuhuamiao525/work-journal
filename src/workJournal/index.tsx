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

const WorkJournal: React.FC<WorkJournalProps> = ({ onLogout }) => {
  const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [journalData, setJournalData] = useState<DailyWorkJournal | null>(null);
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      let data = await WorkJournalStorage.get(currentDate);
      if (!data) {
        // 创建空数据（不立即保存，给自动同步一次机会）
        data = WorkJournalStorage.createEmptyDaily(currentDate);
      }
      setJournalData(data);
    } catch (error) {
      console.error('Failed to load data:', error);
      message.error('加载数据失败');
    }
  }, [currentDate]);

  // 保存数据（防抖）
  const saveData = useCallback(async () => {
    if (journalData) {
      try {
        await WorkJournalStorage.save({
          ...journalData,
          lastModified: new Date().toISOString(),
        });
      } catch (error) {
        message.error('保存失败，请检查网络连接');
      }
    }
  }, [journalData]);

  // 自动保存（数据变化后 1 秒）
  useEffect(() => {
    if (journalData) {
      // 清除之前的定时器
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      // 设置新的定时器
      const timer = setTimeout(saveData, 1000);
      setSaveTimer(timer);
    }
  }, [journalData]);

  // 页面加载时加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 启动自动同步
  useEffect(() => {
    const cleanup = AutoSyncService.startAutoCheck((syncedData) => {
      message.success('已自动从昨日工作日复制未完成的内容');
      setJournalData(syncedData);
    });
    return cleanup;
  }, []);

  // 日期切换处理
  const handleDateChange = async (date: dayjs.Dayjs | null) => {
    if (date) {
      const newDate = date.format('YYYY-MM-DD');
      // 切换日期前,先立即保存当前日期的数据
      if (journalData && currentDate !== newDate) {
        try {
          await WorkJournalStorage.save({
            ...journalData,
            lastModified: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to save before date change:', error);
        }
        // 清除防抖定时器
        if (saveTimer) {
          clearTimeout(saveTimer);
          setSaveTimer(null);
        }
      }
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
