/**
 * 自动同步服务
 * 负责工作日判断和自动复制昨日数据
 */

import moment from 'moment';
import type { DailyWorkJournal } from '../types';
import { generateId } from '../types';
import { WorkJournalStorage } from './storage';

export class AutoSyncService {
  private static lastCheckDate: string | null = null;

  /**
   * 判断是否为工作日（周一到周五）
   */
  static isWorkday(date: moment.Moment): boolean {
    const dayOfWeek = date.day();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  /**
   * 获取上一个工作日（跳过周末）
   */
  static getPreviousWorkday(date: moment.Moment): string {
    let previous = date.clone().subtract(1, 'days');
    while (!this.isWorkday(previous)) {
      previous.subtract(1, 'days');
    }
    return previous.format('YYYY-MM-DD');
  }

  /**
   * 检查是否需要同步
   * 条件：工作日 + 9点后 + 今日数据不存在 + 今日未检查过
   */
  static shouldSync(): boolean {
    const now = moment();
    const today = now.format('YYYY-MM-DD');
    const currentHour = now.hour();

    // 如果今天已经检查过，不再检查
    if (this.lastCheckDate === today) {
      return false;
    }

    // 只在工作日且时间超过 9:00 时同步
    if (!this.isWorkday(now) || currentHour < 9) {
      return false;
    }

    // 检查今天的数据是否已存在
    const todayData = WorkJournalStorage.get(today);
    if (todayData) {
      this.lastCheckDate = today;
      return false; // 今天数据已存在，无需同步
    }

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
  static syncFromPreviousDay(): DailyWorkJournal | null {
    const today = moment().format('YYYY-MM-DD');
    const previousWorkday = this.getPreviousWorkday(moment());
    const previousData = WorkJournalStorage.get(previousWorkday);

    if (!previousData) {
      return null; // 没有历史数据
    }

    // 复制会议（只保留未完成的）
    const meetings = previousData.meetings
      .filter((m) => !m.completed)
      .map((m) => ({
        ...m,
        id: generateId(),
        completed: false,
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

    // 复制待办（只保留未完成的任务）
    const todos = previousData.todos
      .map((todoProject) => {
        const uncompletedTasks = todoProject.tasks
          .filter((t) => !t.completed)
          .map((t) => ({
            ...t,
            id: generateId(),
            completed: false,
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

    // 保存到localStorage
    WorkJournalStorage.save(newData);
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
    if (this.shouldSync()) {
      const syncedData = this.syncFromPreviousDay();
      if (syncedData) {
        onSync(syncedData);
      }
    }

    // 每分钟检查一次
    const intervalId = setInterval(() => {
      if (this.shouldSync()) {
        const syncedData = this.syncFromPreviousDay();
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
  static manualSync(): DailyWorkJournal | null {
    return this.syncFromPreviousDay();
  }

  /**
   * 重置检查状态（用于测试）
   */
  static resetCheckState(): void {
    this.lastCheckDate = null;
  }
}
