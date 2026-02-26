/**
 * 本地存储服务
 * 使用 localStorage 存储每日工作日记数据
 */

import type { DailyWorkJournal } from '../types';

export class WorkJournalStorage {
  private static readonly KEY_PREFIX = 'workJournal_';

  /**
   * 生成存储键名
   */
  private static getKey(date: string): string {
    return `${this.KEY_PREFIX}${date}`;
  }

  /**
   * 获取指定日期的数据
   */
  static get(date: string): DailyWorkJournal | null {
    try {
      const key = this.getKey(date);
      const data = window.localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get work journal data:', error);
      return null;
    }
  }

  /**
   * 保存数据
   */
  static save(data: DailyWorkJournal): void {
    try {
      const key = this.getKey(data.date);
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save work journal data:', error);
      throw error;
    }
  }

  /**
   * 获取所有日期列表（倒序）
   */
  static getAllDates(): string[] {
    try {
      const dates: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(this.KEY_PREFIX)) {
          dates.push(key.replace(this.KEY_PREFIX, ''));
        }
      }
      return dates.sort().reverse(); // 最新日期在前
    } catch (error) {
      console.error('Failed to get all dates:', error);
      return [];
    }
  }

  /**
   * 删除指定日期的数据
   */
  static delete(date: string): void {
    try {
      const key = this.getKey(date);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete work journal data:', error);
      throw error;
    }
  }

  /**
   * 清除所有工作日记数据
   */
  static clearAll(): void {
    try {
      const dates = this.getAllDates();
      dates.forEach((date) => this.delete(date));
    } catch (error) {
      console.error('Failed to clear all work journal data:', error);
      throw error;
    }
  }

  /**
   * 获取存储大小（估算，单位：字节）
   */
  static getStorageSize(): number {
    try {
      let totalSize = 0;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(this.KEY_PREFIX)) {
          const value = window.localStorage.getItem(key);
          totalSize += key.length + (value?.length || 0);
        }
      }
      return totalSize;
    } catch (error) {
      console.error('Failed to calculate storage size:', error);
      return 0;
    }
  }

  /**
   * 创建空的每日数据结构
   */
  static createEmptyDaily(date: string): DailyWorkJournal {
    return {
      date,
      meetings: [],
      projects: {
        inProgress: [],
        delivered: [],
        accepted: [],
      },
      todos: [],
      diary: '',
      lastModified: new Date().toISOString(),
    };
  }
}
