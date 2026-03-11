/**
 * 自动同步服务
 * 负责工作日判断和自动复制昨日数据
 */

import dayjs from 'dayjs';
import type { DailyWorkJournal } from '../types';
import { generateId } from '../types';
import { WorkJournalStorage } from './storage';

export class AutoSyncService {
  private static lastCheckDate: string | null = null;

  /**
   * 判断是否为工作日（周一到周五）
   */
  static isWorkday(date: dayjs.Dayjs): boolean {
    const dayOfWeek = date.day();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * 获取上一个工作日（跳过周末）
   */
  static getPreviousWorkday(date: dayjs.Dayjs): string {
    let previous = date.subtract(1, 'days');
    while (!this.isWorkday(previous)) {
      previous = previous.subtract(1, 'days');
    }
    return previous.format('YYYY-MM-DD');
  }

  /**
   * 检查是否需要同步
   * 条件：工作日 + 0点后（午夜开始） + 今日未同步过
   * 智能判断：即使今天有部分数据，如果缺少重要数据（项目/待办），也需要同步
   */
  static async shouldSync(): Promise<boolean> {
    const now = dayjs();
    const today = now.format('YYYY-MM-DD');

    console.log('[AutoSync] 检查是否需要同步...');
    console.log('[AutoSync] 当前时间:', now.format('YYYY-MM-DD HH:mm:ss'));
    console.log('[AutoSync] 今天:', today);
    console.log('[AutoSync] lastCheckDate:', this.lastCheckDate);

    // 如果今天已经同步过，不再同步
    if (this.lastCheckDate === today) {
      console.log('[AutoSync] ❌ 今天已经同步过，跳过');
      return false;
    }

    // 只在工作日时同步（从午夜0点开始）
    if (!this.isWorkday(now)) {
      console.log('[AutoSync] ❌ 今天不是工作日，跳过');
      return false;
    }

    console.log('[AutoSync] ✅ 今天是工作日');

    // 检查今天的数据情况
    const todayData = await WorkJournalStorage.get(today);
    console.log('[AutoSync] 今天的数据:', todayData ? '存在' : '不存在');

    if (todayData) {
      const todayProjectCount =
        todayData.projects.inProgress.length +
        todayData.projects.delivered.length +
        todayData.projects.accepted.length;

      console.log('[AutoSync] 今天的数据详情:');
      console.log('[AutoSync] - 会议:', todayData.meetings.length);
      console.log('[AutoSync] - 项目:', todayProjectCount);
      console.log('[AutoSync] - 待办:', todayData.todos.length);

      // 检查上一个工作日是否有项目/待办数据
      const previousWorkday = this.getPreviousWorkday(dayjs());
      const previousData = await WorkJournalStorage.get(previousWorkday);

      if (previousData) {
        const previousProjectCount =
          previousData.projects.inProgress.length +
          previousData.projects.delivered.length +
          previousData.projects.accepted.length;

        const previousTodoCount = previousData.todos.length;

        console.log('[AutoSync] 上一个工作日的数据:');
        console.log('[AutoSync] - 项目:', previousProjectCount);
        console.log('[AutoSync] - 待办:', previousTodoCount);

        // 智能判断：如果今天缺少项目或待办，但昨天有，则需要同步
        const needsSyncProjects = todayProjectCount === 0 && previousProjectCount > 0;
        const needsSyncTodos = todayData.todos.length === 0 && previousTodoCount > 0;

        if (needsSyncProjects || needsSyncTodos) {
          console.log('[AutoSync] ✅ 今天缺少数据，需要同步');
          console.log('[AutoSync] - 需要同步项目:', needsSyncProjects);
          console.log('[AutoSync] - 需要同步待办:', needsSyncTodos);
          this.lastCheckDate = today;
          return true;
        }
      }

      // 如果今天有完整数据（项目和待办都有），跳过同步
      if (todayProjectCount > 0 || todayData.todos.length > 0) {
        this.lastCheckDate = today;
        console.log('[AutoSync] ❌ 今天已有完整数据，跳过同步');
        return false;
      }
    }

    // 如果今天完全没有数据，需要同步
    console.log('[AutoSync] ✅ 满足同步条件');
    this.lastCheckDate = today;
    return true;
  }

  /**
   * 执行同步（从上一个工作日复制数据）
   * 过滤规则：
   * - 会议：合并今天已有的 + 昨天未完成的（去重）
   * - 项目：如果今天为空则复制昨天的，否则保留今天的
   * - 待办：如果今天为空则复制昨天的，否则保留今天的
   * - 日记：不复制
   */
  static async syncFromPreviousDay(): Promise<DailyWorkJournal | null> {
    const today = dayjs().format('YYYY-MM-DD');
    const previousWorkday = this.getPreviousWorkday(dayjs());

    console.log('[AutoSync] 开始同步...');
    console.log('[AutoSync] 今天:', today);
    console.log('[AutoSync] 上一个工作日:', previousWorkday);

    const previousData = await WorkJournalStorage.get(previousWorkday);

    if (!previousData) {
      console.log('[AutoSync] ❌ 上一个工作日没有数据');
      return null; // 没有历史数据
    }

    console.log('[AutoSync] ✅ 找到上一个工作日的数据');
    console.log('[AutoSync] - 会议数量:', previousData.meetings.length);
    console.log('[AutoSync] - 待办项目数量:', previousData.todos.length);
    console.log('[AutoSync] - 项目总数:', previousData.projects.inProgress.length + previousData.projects.delivered.length + previousData.projects.accepted.length);

    // 检查上一个工作日是否有真实数据
    const hasRealData =
      previousData.meetings.length > 0 ||
      previousData.todos.length > 0 ||
      previousData.projects.inProgress.length > 0 ||
      previousData.projects.delivered.length > 0 ||
      previousData.projects.accepted.length > 0;

    if (!hasRealData) {
      console.log('[AutoSync] ❌ 上一个工作日没有真实数据，跳过同步');
      return null; // 上一个工作日是空的，不同步空数据
    }

    // 获取今天已有的数据
    const todayData = await WorkJournalStorage.get(today);

    // 复制会议：合并今天已有的 + 昨天未完成的（去重）
    let meetings = todayData?.meetings || [];
    const existingMeetingKeys = new Set(meetings.map((m) => `${m.name}-${m.time}`));

    const previousUncompletedMeetings = previousData.meetings
      .filter((m) => !m.completed)
      .map((m) => ({
        ...m,
        id: generateId(),
        completed: false,
        recurrence: m.recurrence || 'none', // 保留循环设置
        minutes: '', // 会议纪要不复制，每个会议独立
        createdAt: new Date().toISOString(),
      }))
      .filter((m) => !existingMeetingKeys.has(`${m.name}-${m.time}`)); // 去重

    meetings = [...meetings, ...previousUncompletedMeetings];
    console.log('[AutoSync] 会议合并: 今天已有', todayData?.meetings.length || 0, '个，新增', previousUncompletedMeetings.length, '个');

    // 复制项目：如果今天为空则复制昨天的，否则保留今天的
    let projects = todayData?.projects || { inProgress: [], delivered: [], accepted: [] };
    const todayProjectCount =
      projects.inProgress.length + projects.delivered.length + projects.accepted.length;

    if (todayProjectCount === 0) {
      projects = {
        inProgress: previousData.projects.inProgress.map((p) => ({
          ...p,
          id: generateId(),
          createdAt: new Date().toISOString(),
        })),
        delivered: previousData.projects.delivered.map((p) => ({
          ...p,
          id: generateId(),
          createdAt: new Date().toISOString(),
        })),
        accepted: previousData.projects.accepted.map((p) => ({
          ...p,
          id: generateId(),
          createdAt: new Date().toISOString(),
        })),
      };
      console.log('[AutoSync] 项目同步: 从昨天复制', previousData.projects.inProgress.length + previousData.projects.delivered.length + previousData.projects.accepted.length, '个项目');
    } else {
      console.log('[AutoSync] 项目保留: 今天已有', todayProjectCount, '个项目，不覆盖');
    }

    // 复制待办：如果今天为空则复制昨天的，否则保留今天的
    let todos = todayData?.todos || [];

    if (todos.length === 0) {
      todos = previousData.todos
        .map((todoProject) => {
          const uncompletedTasks = todoProject.tasks
            .filter((t) => !t.completed)
            .map((t) => ({
              ...t,
              id: generateId(),
              completed: false,
              plannedDate: t.plannedDate, // 保留计划完成时间
              createdAt: new Date().toISOString(),
            }));

          return {
            ...todoProject,
            id: generateId(),
            tasks: uncompletedTasks,
            createdAt: new Date().toISOString(),
          };
        })
        .filter((tp) => tp.tasks.length > 0); // 移除没有任务的项目

      console.log('[AutoSync] 待办同步: 从昨天复制', todos.length, '个待办项目');
    } else {
      console.log('[AutoSync] 待办保留: 今天已有', todos.length, '个待办项目，不覆盖');
    }

    // 创建合并后的数据
    const newData: DailyWorkJournal = {
      date: today,
      meetings,
      projects,
      todos,
      diary: todayData?.diary || '', // 保留今天的日记
      lastModified: new Date().toISOString(),
    };

    // 保存到数据库
    await WorkJournalStorage.save(newData);
    this.lastCheckDate = today;

    console.log('[AutoSync] ✅ 同步完成');
    return newData;
  }

  /**
   * 启动自动检查
   * @param onSync 同步成功的回调函数
   * @returns 清理函数，用于停止定时检查
   */
  static startAutoCheck(onSync: (data: DailyWorkJournal) => void): () => void {
    // 立即检查一次
    (async () => {
      if (await this.shouldSync()) {
        const syncedData = await this.syncFromPreviousDay();
        if (syncedData) {
          onSync(syncedData);
        }
      }
    })();

    // 每分钟检查一次
    const intervalId = setInterval(async () => {
      if (await this.shouldSync()) {
        const syncedData = await this.syncFromPreviousDay();
        if (syncedData) {
          onSync(syncedData);
        }
      }
    }, 60000); // 60秒

    // 返回清理函数
    return () => clearInterval(intervalId);
  }

  /**
   * 手动触发同步（用于测试或手动复制）
   */
  static async manualSync(): Promise<DailyWorkJournal | null> {
    return await this.syncFromPreviousDay();
  }

  /**
   * 重置检查状态（用于测试）
   */
  static resetCheckState(): void {
    this.lastCheckDate = null;
  }
}
