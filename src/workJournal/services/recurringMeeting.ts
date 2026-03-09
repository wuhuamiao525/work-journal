/**
 * 循环会议服务
 * 负责自动创建下一次循环会议
 */

import dayjs from 'dayjs';
import type { Meeting, DailyWorkJournal } from '../types';
import { generateId } from '../types';
import { WorkJournalStorage } from './storage';

export class RecurringMeetingService {
  /**
   * 当会议完成时，检查是否需要创建下一次循环会议
   */
  static async handleMeetingCompleted(meeting: Meeting): Promise<void> {
    // 只处理有循环设置的会议
    if (!meeting.recurrence || meeting.recurrence === 'none') {
      return;
    }

    // 解析会议时间
    const meetingTime = dayjs(meeting.time);
    if (!meetingTime.isValid()) {
      console.error('Invalid meeting time:', meeting.time);
      return;
    }

    // 计算下次会议时间
    let nextMeetingTime: dayjs.Dayjs;
    if (meeting.recurrence === 'daily') {
      // 每日循环：1天后
      nextMeetingTime = meetingTime.add(1, 'days');
    } else if (meeting.recurrence === 'weekly') {
      // 单周循环：7天后
      nextMeetingTime = meetingTime.add(7, 'days');
    } else if (meeting.recurrence === 'biweekly') {
      // 双周循环：14天后
      nextMeetingTime = meetingTime.add(14, 'days');
    } else {
      return;
    }

    // 获取下次会议所在日期的数据
    const nextDate = nextMeetingTime.format('YYYY-MM-DD');
    let nextDayData = await WorkJournalStorage.get(nextDate);

    // 如果那天的数据不存在，创建空数据
    if (!nextDayData) {
      nextDayData = WorkJournalStorage.createEmptyDaily(nextDate);
    }

    // 检查是否已经存在相同的会议（避免重复创建）
    const existingMeeting = nextDayData.meetings.find(
      (m) => m.name === meeting.name && m.time === nextMeetingTime.format('YYYY-MM-DD HH:mm')
    );

    if (existingMeeting) {
      console.log('下次会议已存在，跳过创建');
      return;
    }

    // 创建下次会议（不复制会议纪要）
    const nextMeeting: Meeting = {
      id: generateId(),
      name: meeting.name,
      time: nextMeetingTime.format('YYYY-MM-DD HH:mm'),
      location: meeting.location,
      completed: false,
      recurrence: meeting.recurrence, // 保持相同的循环设置
      minutes: '', // 会议纪要不复制，每个会议独立
      createdAt: new Date().toISOString(),
    };

    // 添加到下次会议日期的数据中
    nextDayData.meetings.push(nextMeeting);
    nextDayData.lastModified = new Date().toISOString();

    // 保存到数据库
    await WorkJournalStorage.save(nextDayData);

    const recurrenceText =
      meeting.recurrence === 'daily' ? '明日' :
      meeting.recurrence === 'weekly' ? '下周' : '下下周';

    console.log(`✅ 已自动创建${recurrenceText}同一时间的循环会议:`, {
      name: meeting.name,
      time: nextMeetingTime.format('YYYY-MM-DD HH:mm'),
    });
  }

  /**
   * 批量处理多个已完成的会议
   */
  static async handleMultipleMeetingsCompleted(meetings: Meeting[]): Promise<void> {
    const completedRecurringMeetings = meetings.filter(
      (m) => m.completed && m.recurrence && m.recurrence !== 'none'
    );

    for (const meeting of completedRecurringMeetings) {
      try {
        await this.handleMeetingCompleted(meeting);
      } catch (error) {
        console.error('创建循环会议失败:', meeting.name, error);
      }
    }
  }

  /**
   * 获取所有即将到来的循环会议
   * @param currentDate 当前查看的日期
   * @returns 应该在当前日期显示的循环会议列表
   */
  static async getUpcomingRecurringMeetings(currentDate: string): Promise<Meeting[]> {
    const today = dayjs(currentDate);
    const upcomingMeetings: Meeting[] = [];

    // 查找过去30天内创建的所有循环会议
    const startDate = today.subtract(30, 'days');
    const allDates: string[] = [];

    for (let i = 0; i <= 30; i++) {
      allDates.push(startDate.add(i, 'days').format('YYYY-MM-DD'));
    }

    // 收集所有循环会议
    for (const date of allDates) {
      const dayData = await WorkJournalStorage.get(date);
      if (!dayData) continue;

      for (const meeting of dayData.meetings) {
        // 只处理未完成的循环会议
        if (!meeting.recurrence || meeting.recurrence === 'none' || meeting.completed) {
          continue;
        }

        const meetingTime = dayjs(meeting.time);
        if (!meetingTime.isValid()) continue;

        // 计算这个循环会议在当前日期的下一次时间
        let nextOccurrence = meetingTime;

        // 如果会议时间在当前日期之前，计算下一次发生时间
        while (nextOccurrence.isBefore(today, 'day')) {
          if (meeting.recurrence === 'daily') {
            nextOccurrence = nextOccurrence.add(1, 'day');
          } else if (meeting.recurrence === 'weekly') {
            nextOccurrence = nextOccurrence.add(7, 'days');
          } else if (meeting.recurrence === 'biweekly') {
            nextOccurrence = nextOccurrence.add(14, 'days');
          }
        }

        // 如果下一次发生时间是今天，且时间还没开始，添加到列表
        if (nextOccurrence.format('YYYY-MM-DD') === currentDate) {
          const now = dayjs();
          const shouldShow = today.isAfter(now, 'day') || nextOccurrence.isAfter(now);

          if (shouldShow) {
            upcomingMeetings.push({
              ...meeting,
              id: generateId(), // 生成新ID，避免与原会议冲突
              time: nextOccurrence.format('YYYY-MM-DD HH:mm'),
              completed: false,
            });
          }
        }
      }
    }

    // 去重（根据会议名称和时间）
    const uniqueMeetings = upcomingMeetings.filter((meeting, index, self) =>
      index === self.findIndex((m) => m.name === meeting.name && m.time === meeting.time)
    );

    return uniqueMeetings;
  }
}
