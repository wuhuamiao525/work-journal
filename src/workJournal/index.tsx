import React, { useState, useEffect, useCallback } from 'react';
import {
  DatePicker, Collapse, message, Layout, Typography, Button, Dropdown, Tooltip,
  theme as antTheme, Segmented,
} from 'antd';
import {
  LogoutOutlined, UserOutlined, LeftOutlined, RightOutlined, CalendarOutlined,
  MoonOutlined, SunOutlined, DownloadOutlined, FileTextOutlined, BarChartOutlined,
  ExclamationCircleOutlined, BookOutlined, SearchOutlined, CloudSyncOutlined,
  InfoCircleOutlined, FundOutlined, AppstoreOutlined, TagsOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import dayjs from 'dayjs';
import type { DailyWorkJournal, Meeting } from './types';
import { WorkJournalStorage } from './services/storage';
import { AutoSyncService } from './services/autoSync';
import { AuthService } from '../auth/AuthService';
import { exportDayToExcel, exportRangeToExcel } from './services/exportService';
import type { ThemeMode } from '../hooks/useTheme';
import MeetingSection from './components/MeetingSection';
import ProjectSection from './components/ProjectSection';
import TodoSection from './components/TodoSection';
import DiarySection from './components/DiarySection';
import UnfinishedTasks from './components/UnfinishedTasks';
import StatsBoard from './components/StatsBoard';
import CalendarView from './components/CalendarView';
import ChangelogModal from './components/ChangelogModal';
import ReportModal from './components/ReportModal';
import SearchModal from './components/SearchModal';
import BackupModal from './components/BackupModal';
import ProjectDashboard from './components/ProjectDashboard';
import KanbanView from './components/KanbanView';
import TagManager from './components/TagManager';
import './index.css';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Panel } = Collapse;

interface WorkJournalProps {
  onLogout: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

// 加载未来的循环会议
const loadUpcomingRecurringMeetings = async (currentDate: string) => {
  const today = dayjs(currentDate);
  const upcomingMeetings: Meeting[] = [];

  for (let i = 0; i <= 14; i++) {
    const futureDate = today.add(i, 'days').format('YYYY-MM-DD');
    const futureData = await WorkJournalStorage.get(futureDate);
    if (!futureData) continue;

    for (const meeting of futureData.meetings) {
      if (!meeting.recurrence || meeting.recurrence === 'none' || meeting.completed) continue;
      const meetingTime = dayjs(meeting.time);
      if (meetingTime.isAfter(dayjs())) {
        upcomingMeetings.push(meeting);
      }
    }
  }
  return upcomingMeetings;
};

// 获取上一个工作日
const getPrevWorkday = (date: string): string => {
  let d = dayjs(date).subtract(1, 'day');
  while (d.day() === 0 || d.day() === 6) {
    d = d.subtract(1, 'day');
  }
  return d.format('YYYY-MM-DD');
};

// 获取下一个工作日
const getNextWorkday = (date: string): string => {
  let d = dayjs(date).add(1, 'day');
  while (d.day() === 0 || d.day() === 6) {
    d = d.add(1, 'day');
  }
  return d.format('YYYY-MM-DD');
};

type PageView = 'journal' | 'unfinished' | 'stats' | 'calendar' | 'projects' | 'kanban' | 'tags';

const WorkJournal: React.FC<WorkJournalProps> = ({ onLogout, themeMode, onToggleTheme }) => {
  const [currentDate, setCurrentDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [journalData, setJournalData] = useState<DailyWorkJournal | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [pageView, setPageView] = useState<PageView>('journal');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [changelogVisible, setChangelogVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 快捷键：Ctrl+N 新建任务
  const [activeTodoProjectId, setActiveTodoProjectId] = useState<string | null>(null);
  const [addTaskTrigger, setAddTaskTrigger] = useState(0);

  const { token } = antTheme.useToken();

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setIsInitialLoad(true);

      let data = await WorkJournalStorage.get(currentDate);
      if (!data) {
        data = WorkJournalStorage.createEmptyDaily(currentDate);
        console.log('[工作日记] 没有数据，创建空结构（仅内存，不保存）');
      } else {
        console.log('[工作日记] 加载到数据:', {
          会议: data.meetings?.length || 0,
          项目: (data.projects?.inProgress?.length || 0) + (data.projects?.delivered?.length || 0) + (data.projects?.accepted?.length || 0),
          待办: data.todos?.length || 0,
        });
      }

      const isCurrentDatePast = dayjs(currentDate).isBefore(dayjs(), 'day');
      if (!isCurrentDatePast) {
        const upcomingRecurringMeetings = await loadUpcomingRecurringMeetings(currentDate);
        if (upcomingRecurringMeetings.length > 0) {
          const existingIds = new Set(data.meetings.map((m) => `${m.name}-${m.time}`));
          const newMeetings = upcomingRecurringMeetings.filter(
            (m) => !existingIds.has(`${m.name}-${m.time}`)
          );
          data.meetings = [...data.meetings, ...newMeetings];
        }
      }

      setJournalData(data);
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
    } catch (error) {
      console.error('[工作日记] 保存失败:', error);
      message.error('保存失败，请稍后重试');
    }
  }, [journalData]);

  // 自动保存
  useEffect(() => {
    if (isInitialLoad || !journalData) return;
    const timer = setTimeout(() => { saveData(); }, 1000);
    return () => clearTimeout(timer);
  }, [journalData, saveData, isInitialLoad]);

  useEffect(() => { loadData(); }, [loadData]);

  // 自动同步
  useEffect(() => {
    const cleanup = AutoSyncService.startAutoCheck((syncedData) => {
      setJournalData(syncedData);
      message.success('已自动从上一个工作日同步数据');
    });
    return cleanup;
  }, []);

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd+F → 全文搜索
      if (ctrl && e.key === 'f') {
        e.preventDefault();
        setSearchModalVisible(true);
        return;
      }

      // Alt+← → 上一个工作日（仅日记视图）
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentDate((d) => getPrevWorkday(d));
        setPageView('journal');
        return;
      }

      // Alt+→ → 下一个工作日（仅日记视图）
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentDate((d) => getNextWorkday(d));
        setPageView('journal');
        return;
      }

      // Ctrl/Cmd+N → 在已激活的项目下新建任务（仅日记视图）
      if (ctrl && e.key === 'n') {
        e.preventDefault();
        if (pageView === 'journal' && activeTodoProjectId) {
          setAddTaskTrigger((n) => n + 1);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageView, activeTodoProjectId]);

  // 处理会议变更
  const handleMeetingsChange = useCallback(async (newMeetings: Meeting[]) => {
    if (!journalData) return;

    const deletedMeetings = journalData.meetings.filter(
      (m) => !newMeetings.some((nm) => nm.id === m.id)
    );

    for (const deletedMeeting of deletedMeetings) {
      const meetingDate = dayjs(deletedMeeting.time).format('YYYY-MM-DD');
      if (meetingDate !== currentDate) {
        try {
          const otherDateData = await WorkJournalStorage.get(meetingDate);
          if (otherDateData) {
            const updatedMeetings = otherDateData.meetings.filter((m) => m.id !== deletedMeeting.id);
            if (updatedMeetings.length !== otherDateData.meetings.length) {
              await WorkJournalStorage.save({
                ...otherDateData,
                meetings: updatedMeetings,
                lastModified: new Date().toISOString(),
              });
            }
          }
        } catch (error) {
          console.error('[工作日记] 删除关联日期的会议失败:', error);
        }
      }
    }

    setJournalData({ ...journalData, meetings: newMeetings });
  }, [journalData, currentDate]);

  // 日期切换
  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) setCurrentDate(date.format('YYYY-MM-DD'));
  };

  const handlePrevDay = () => setCurrentDate(getPrevWorkday(currentDate));
  const handleNextDay = () => setCurrentDate(getNextWorkday(currentDate));
  const handleToday = () => setCurrentDate(dayjs().format('YYYY-MM-DD'));

  // 导出
  const handleExportDay = async () => {
    if (!journalData) return;
    setExporting(true);
    try {
      exportDayToExcel(journalData);
      message.success(`已导出 ${currentDate} 的数据`);
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportWeek = async () => {
    setExporting(true);
    try {
      const weekStart = dayjs(currentDate).startOf('isoWeek' as dayjs.OpUnitType);
      const weekEnd = dayjs(currentDate).endOf('isoWeek' as dayjs.OpUnitType);
      const dates = await WorkJournalStorage.getAllDates();
      const rangeDates = dates.filter((d) => {
        const dd = dayjs(d);
        return !dd.isBefore(weekStart, 'day') && !dd.isAfter(weekEnd, 'day');
      });
      const dataList: DailyWorkJournal[] = [];
      for (const d of rangeDates.sort()) {
        const data = await WorkJournalStorage.get(d);
        if (data) dataList.push(data);
      }
      if (dataList.length === 0) {
        message.warning('本周没有数据可导出');
        return;
      }
      exportRangeToExcel(dataList, `第${dayjs(currentDate).isoWeek()}周`);
      message.success('本周数据已导出');
    } catch {
      message.error('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const exportMenuItems: MenuProps['items'] = [
    { key: 'day', label: `导出当天 (${currentDate})`, onClick: handleExportDay },
    { key: 'week', label: '导出本周', onClick: handleExportWeek },
  ];

  const currentUser = AuthService.getUser();

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  // 顶部导航 Tab 样式
  if (!journalData && pageView === 'journal') {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        style={{
          background: token.colorBgContainer,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          flexShrink: 0,
          gap: 12,
          flexWrap: 'wrap',
          height: 'auto',
          minHeight: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* 左侧：标题 + 页面切换 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 渐变装饰竖线 */}
          <div style={{
            width: 4,
            height: 22,
            borderRadius: 2,
            background: 'linear-gradient(180deg, #1677ff 0%, #722ed1 100%)',
            flexShrink: 0,
          }} />
          <Title level={3} style={{ margin: 0, whiteSpace: 'nowrap', fontSize: 18 }}>
            日迹
          </Title>
          <Segmented
            value={pageView}
            onChange={(val) => setPageView(val as PageView)}
            options={[
              { label: '日历', value: 'calendar', icon: <CalendarOutlined /> },
              { label: '日记', value: 'journal', icon: <BookOutlined /> },
              { label: '未完成任务', value: 'unfinished', icon: <ExclamationCircleOutlined /> },
              { label: '统计看板', value: 'stats', icon: <BarChartOutlined /> },
              { label: '项目', value: 'projects', icon: <FundOutlined /> },
              { label: '看板', value: 'kanban', icon: <AppstoreOutlined /> },
              { label: '标签', value: 'tags', icon: <TagsOutlined /> },
            ]}
          />
        </div>

        {/* 右侧：工具栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* 日期导航 - 仅在日记视图显示 */}
          {pageView === 'journal' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip title="上一个工作日">
                <Button icon={<LeftOutlined />} size="small" onClick={handlePrevDay} />
              </Tooltip>
              <DatePicker
                value={dayjs(currentDate)}
                onChange={handleDateChange}
                allowClear={false}
                size="small"
              />
              <Tooltip title="下一个工作日">
                <Button icon={<RightOutlined />} size="small" onClick={handleNextDay} />
              </Tooltip>
              <Tooltip title="回到今天">
                <Button
                  icon={<CalendarOutlined />}
                  size="small"
                  onClick={handleToday}
                  type={currentDate === dayjs().format('YYYY-MM-DD') ? 'default' : 'primary'}
                >
                  今天
                </Button>
              </Tooltip>
            </div>
          )}

          {/* 全文检索 */}
          <Tooltip title="全文检索 (Ctrl+F)">
            <Button
              icon={<SearchOutlined />}
              size="small"
              onClick={() => setSearchModalVisible(true)}
            >
              搜索
            </Button>
          </Tooltip>

          {/* 生成报告 */}
          <Tooltip title="生成周报/月报">
            <Button
              icon={<FileTextOutlined />}
              size="small"
              onClick={() => setReportModalVisible(true)}
            >
              报告
            </Button>
          </Tooltip>

          {/* 导出 Excel */}
          <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
            <Button icon={<DownloadOutlined />} size="small" loading={exporting}>
              导出
            </Button>
          </Dropdown>

          {/* 深色模式切换 */}
          <Tooltip title={themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}>
            <Button
              icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              size="small"
              onClick={onToggleTheme}
            />
          </Tooltip>

          {/* 版本说明 */}
          <Tooltip title={`版本说明 v${__APP_VERSION__}`}>
            <Button
              icon={<InfoCircleOutlined />}
              size="small"
              onClick={() => setChangelogVisible(true)}
            />
          </Tooltip>

          {/* 数据备份 */}
          <Tooltip title="数据备份与恢复">
            <Button
              icon={<CloudSyncOutlined />}
              size="small"
              onClick={() => setBackupModalVisible(true)}
            />
          </Tooltip>

          {/* 用户菜单 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button icon={<UserOutlined />} size="small">
              {currentUser?.displayName || currentUser?.username || '用户'}
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Content
        style={{
          padding: '20px',
          background: token.colorBgLayout,
          flex: 1,
          overflow: 'auto',
        }}
      >
        {/* 日历视图 */}
        {pageView === 'calendar' && (
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <CalendarOutlined style={{ marginRight: 8 }} />
              日历视图
            </Title>
            <CalendarView />
          </div>
        )}

        {/* 未完成任务视图 */}
        {pageView === 'unfinished' && (
          <div style={{ background: token.colorBgContainer, padding: 24, borderRadius: 8 }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <ExclamationCircleOutlined style={{ color: token.colorError, marginRight: 8 }} />
              所有未完成任务
            </Title>
            <UnfinishedTasks />
          </div>
        )}

        {/* 统计看板 */}
        {pageView === 'stats' && (
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <BarChartOutlined style={{ marginRight: 8 }} />
              数据统计看板
            </Title>
            <StatsBoard />
          </div>
        )}

        {/* 项目仪表盘 */}
        {pageView === 'projects' && (
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <FundOutlined style={{ marginRight: 8 }} />
              项目进度仪表盘
            </Title>
            <ProjectDashboard />
          </div>
        )}

        {/* 看板视图 */}
        {pageView === 'kanban' && (
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <AppstoreOutlined style={{ marginRight: 8 }} />
              任务看板
            </Title>
            <KanbanView />
          </div>
        )}

        {/* 标签管理 */}
        {pageView === 'tags' && (
          <div>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <TagsOutlined style={{ marginRight: 8 }} />
              标签管理
            </Title>
            <TagManager />
          </div>
        )}

        {/* 日记主视图 */}
        {pageView === 'journal' && journalData && (
          <div style={{ background: token.colorBgContainer, padding: 24, borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Collapse defaultActiveKey={['meetings', 'projects', 'todos', 'diary']} bordered={false} style={{ background: 'transparent' }}>
              <Panel header={<span style={{ borderLeft: '4px solid #1677ff', paddingLeft: 10, fontWeight: 600 }}>会议安排</span>} key="meetings">
                <MeetingSection
                  meetings={
                    dayjs(currentDate).isBefore(dayjs(), 'day')
                      ? journalData.meetings.filter(
                          (m) => dayjs(m.time).format('YYYY-MM-DD') === currentDate
                        )
                      : journalData.meetings
                  }
                  onChange={handleMeetingsChange}
                  projects={journalData.projects}
                />
              </Panel>

              <Panel header={<span style={{ borderLeft: '4px solid #722ed1', paddingLeft: 10, fontWeight: 600 }}>交付项目人员安排</span>} key="projects">
                <ProjectSection
                  projects={journalData.projects}
                  onChange={(projects) => setJournalData({ ...journalData, projects })}
                />
              </Panel>

              <Panel header={<span style={{ borderLeft: '4px solid #52c41a', paddingLeft: 10, fontWeight: 600 }}>交付项目待办</span>} key="todos">
                <TodoSection
                  todos={journalData.todos}
                  onChange={(todos) => setJournalData({ ...journalData, todos })}
                  activeProjectId={activeTodoProjectId}
                  onActiveProjectChange={setActiveTodoProjectId}
                  addTaskTrigger={addTaskTrigger}
                />
              </Panel>

              <Panel header={<span style={{ borderLeft: '4px solid #fa8c16', paddingLeft: 10, fontWeight: 600 }}>工作日记</span>} key="diary">
                <DiarySection
                  diary={journalData.diary}
                  projects={journalData.todos}
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
        )}
      </Content>

      {/* 版本说明弹窗 */}
      <ChangelogModal
        visible={changelogVisible}
        onClose={() => setChangelogVisible(false)}
      />

      {/* 周报/月报弹窗 */}
      <ReportModal
        visible={reportModalVisible}
        onCancel={() => setReportModalVisible(false)}
      />

      {/* 全文检索弹窗 */}
      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        onNavigate={(date) => {
          setCurrentDate(date);
          setPageView('journal');
        }}
      />

      {/* 数据备份/恢复弹窗 */}
      <BackupModal
        visible={backupModalVisible}
        onClose={() => setBackupModalVisible(false)}
      />
    </Layout>
  );
};

export default WorkJournal;
