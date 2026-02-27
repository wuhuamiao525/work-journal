/**
 * 数据存储服务
 * 使用后端 API 存储数据，LocalStorage 作为备份
 */

import type { DailyWorkJournal } from '../types';
import { APIService } from './api';

export class WorkJournalStorage {
  private static readonly KEY_PREFIX = 'workJournal_backup_';

  /**
   * 生成备份存储键名
   */
  private static getBackupKey(date: string): string {
    return `${this.KEY_PREFIX}${date}`;
  }

  /**
   * 保存到 localStorage 备份
   */
  private static saveToBackup(data: DailyWorkJournal): void {
    try {
      const key = this.getBackupKey(data.date);
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save backup to localStorage:', error);
    }
  }

  /**
   * 从备份读取
   */
  private static getFromBackup(date: string): DailyWorkJournal | null {
    try {
      const key = this.getBackupKey(date);
      const data = window.localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to get backup from localStorage:', error);
      return null;
    }
  }

  /**
   * 获取指定日期的数据
   */
  static async get(date: string): Promise<DailyWorkJournal | null> {
    try {
      // 优先从 API 获取
      const data = await APIService.get(date);
      if (data) {
        // 更新备份
        this.saveToBackup(data);
        return data;
      }
      // API 失败时，尝试从备份读取
      return this.getFromBackup(date);
    } catch (error) {
      console.error('Failed to get work journal data:', error);
      // 发生错误时，尝试从备份读取
      return this.getFromBackup(date);
    }
  }

  /**
   * 保存数据
   */
  static async save(data: DailyWorkJournal): Promise<void> {
    try {
      // 先保存到备份
      this.saveToBackup(data);
      // 再保存到 API
      await APIService.save(data);
    } catch (error) {
      console.error('Failed to save work journal data:', error);
      throw error;
    }
  }

  /**
   * 获取所有日期列表（倒序）
   */
  static async getAllDates(): Promise<string[]> {
    try {
      return await APIService.getAllDates();
    } catch (error) {
      console.error('Failed to get all dates:', error);
      return [];
    }
  }

  /**
   * 删除指定日期的数据
   */
  static async delete(date: string): Promise<void> {
    try {
      await APIService.delete(date);
      // 同时删除备份
      const key = this.getBackupKey(date);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete work journal data:', error);
      throw error;
    }
  }

  /**
   * 清除所有工作日记数据
   */
  static async clearAll(): Promise<void> {
    try {
      const dates = await this.getAllDates();
      for (const date of dates) {
        await this.delete(date);
      }
    } catch (error) {
      console.error('Failed to clear all work journal data:', error);
      throw error;
    }
  }

  /**
   * 创建空的每日数据结构
   */
  static createEmptyDaily(date: string): DailyWorkJournal {
    return APIService.createEmptyDaily(date);
  }
}
