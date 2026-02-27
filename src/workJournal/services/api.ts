/**
 * API 服务
 * 负责与后端 API 通信
 */

import type { DailyWorkJournal } from '../types';
import { AuthService } from '../../auth/AuthService';

const API_BASE_URL = 'http://localhost:3001/api';

export class APIService {
  /**
   * 获取请求头（包含认证token）
   */
  private static getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = AuthService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }
  /**
   * 获取指定日期的数据
   */
  static async get(date: string): Promise<DailyWorkJournal | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/journals/${date}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch journal');
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get work journal data:', error);
      return null;
    }
  }

  /**
   * 保存数据
   */
  static async save(data: DailyWorkJournal): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/journals`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to save journal');
      }

      return true;
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
      const response = await fetch(`${API_BASE_URL}/journals/dates/all`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch dates');
      }
      const data = await response.json();
      return data.dates || [];
    } catch (error) {
      console.error('Failed to get all dates:', error);
      return [];
    }
  }

  /**
   * 删除指定日期的数据
   */
  static async delete(date: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/journals/${date}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete journal');
      }

      return true;
    } catch (error) {
      console.error('Failed to delete work journal data:', error);
      return false;
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
