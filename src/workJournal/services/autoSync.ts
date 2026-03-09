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

    // 检查今天是否有真实数据（有会议或待办或项目）
    const todayData = await WorkJournalStorage.get(today);
    console.log('[AutoSync] 今天的数据:', todayData ? '存在' : '不存在');

    if (todayData) {
      const hasData =
        todayData.meetings.length > 0 ||
        todayData.todos.length > 0 ||
        todayData.projects.inProgress.length > 0 ||
        todayData.projects.delivered.length > 0 ||
        todayData.projects.accepted.length > 0 ||
        todayData.diary.trim() !== '';

      console.log('[AutoSync] 今天是否有真实数据:', hasData);
      console.log('[AutoSync] - 会议:', todayData.meetings.length);
      console.log('[AutoSync] - 待办:', todayData.todos.length);
      console.log('[AutoSync] - 项目:', todayData.projects.inProgress.length + todayData.projects.delivered.length + todayData.projects.accepted.length);

      if (hasData) {
        this.lastCheckDate = today;
        console.log('[AutoSync] ❌ 今天已有真实数据，跳过同步');
        return false; // 今天有真实数据，无需同步
      }
    }

    // 标记今天已检查，避免重复同步
    this.lastCheckDate = today;
    console.log('[AutoSync] ✅ 满足同步条件');
    return true;
  }

  /**
   * 执行同步（从上一个工作日复制数据）
   * 过滤规则：
   * - 会议：只复制未完成的
   * - 项目：全部复制
   * - 待办：只复制未完成的任务，移除空项目
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

    // 复制会议（只保留未完成的，保留循环设置，不复制会议纪要）
    const meetings = previousData.meetings
      .filter((m) => !m.completed)
      .map((m) => ({
        ...m,
        id: generateId(),
        completed: false,
        recurrence: m.recurrence || 'none', // 保留循环设置
        minutes: '', // 会议纪要不复制，每个会议独立
        createdAt: new Date().toISOString(),
      }));

    // 复制项目（全部复制）
    const projects = {
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

    // 复制待办（只保留未完成的任务，保留计划完成时间）
    const todos = previousData.todos
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

    // 创建新数据
    const newData: DailyWorkJournal = {
      date: today,
      meetings,
      projects,
      todos,
      diary: '', // 日记不复制
      lastModified: new Date().toISOString(),
    };

    // 保存到数据库
    await WorkJournalStorage.save(newData);
    this.lastCheckDate = today;

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
