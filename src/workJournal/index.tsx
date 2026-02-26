import React, { useState, useEffect, useCallback } from 'react';
import { DatePicker, Collapse, message, Layout, Typography } from 'antd';
import moment from 'moment';
import type { DailyWorkJournal } from './types';
import { WorkJournalStorage } from './services/storage';
import { AutoSyncService } from './services/autoSync';
import MeetingSection from './components/MeetingSection';
import ProjectSection from './components/ProjectSection';
import TodoSection from './components/TodoSection';
import DiarySection from './components/DiarySection';
import './index.css';

const { Header, Content } = Layout;
const { Title } = Typography;

const { Panel } = Collapse;

const WorkJournal: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(moment().format('YYYY-MM-DD'));
  const [journalData, setJournalData] = useState<DailyWorkJournal | null>(null);
  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // 加载数据
  const loadData = useCallback(() => {
    let data = WorkJournalStorage.get(currentDate);
    if (!data) {
      // 创建空数据
      data = WorkJournalStorage.createEmptyDaily(currentDate);
      WorkJournalStorage.save(data);
    }
    setJournalData(data);
  }, [currentDate]);

  // 保存数据（防抖）
  const saveData = useCallback(() => {
    if (journalData) {
      try {
        WorkJournalStorage.save({
          ...journalData,
          lastModified: new Date().toISOString(),
        });
      } catch (error) {
        message.error('保存失败，请检查存储空间');
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
  const handleDateChange = (date: moment.Moment | null) => {
    if (date) {
      setCurrentDate(date.format('YYYY-MM-DD'));
    }
  };

  if (!journalData) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
        <Title level={3} style={{ margin: 0 }}>每日工作日记</Title>
        <DatePicker
          value={moment(currentDate)}
          onChange={handleDateChange}
          allowClear={false}
        />
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
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
              />
            </Panel>
          </Collapse>
        </div>
      </Content>
    </Layout>
  );
};

export default WorkJournal;
