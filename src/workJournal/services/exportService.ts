/**
 * Excel 导出服务
 * 支持导出单日 / 多日范围的项目表和任务表
 */

import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import type { DailyWorkJournal, TodoProject, TodoTask } from '../types';

// ---- 单日导出 ----
export function exportDayToExcel(data: DailyWorkJournal) {
  const wb = XLSX.utils.book_new();

  // Sheet1: 项目人员安排
  const projectRows: unknown[][] = [
    ['状态', '编号', '项目名称', '下一个交付节点', '测试人员', '工程引擎人员',
      '研发人员', '工程开发人员', '硬件负责人', '产品人员', 'PM', '商务', '对接人', '供应商', '金额'],
  ];

  const statusLabel: Record<string, string> = {
    inProgress: '进行中',
    delivered: '已交付',
    accepted: '已验收',
  };

  for (const [status, list] of Object.entries(data.projects)) {
    for (const p of list as any[]) {
      projectRows.push([
        statusLabel[status] || status,
        p.index, p.name, p.nextDelivery, p.tester, p.engineEngineer,
        p.developer, p.engineDeveloper, p.hardwareLeader, p.productManager,
        p.pm, p.business, p.contact, p.supplier, p.amount,
      ]);
    }
  }

  const wsProjects = XLSX.utils.aoa_to_sheet(projectRows);
  wsProjects['!cols'] = [10, 8, 20, 18, 12, 12, 12, 12, 12, 12, 10, 10, 10, 12, 12].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsProjects, '项目人员安排');

  // Sheet2: 待办任务
  const taskRows: unknown[][] = [
    ['所属项目', '任务内容', '责任人', '计划日期', '是否完成', '完成时间', '任务进展'],
  ];

  for (const proj of data.todos as TodoProject[]) {
    for (const task of proj.tasks as TodoTask[]) {
      taskRows.push([
        proj.name,
        task.content,
        task.assignee || '',
        task.plannedDate || '',
        task.completed ? '已完成' : '未完成',
        task.completedAt || '',
        task.progress || '',
      ]);
    }
  }

  const wsTasks = XLSX.utils.aoa_to_sheet(taskRows);
  wsTasks['!cols'] = [20, 30, 10, 12, 10, 20, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTasks, '待办任务');

  // Sheet3: 会议记录
  const meetingRows: unknown[][] = [
    ['会议名称', '时间', '地点', '循环类型', '是否完成', '会议纪要'],
  ];

  const recurrenceLabel: Record<string, string> = {
    none: '不循环', daily: '每日', weekly: '每周', biweekly: '每两周',
  };

  for (const m of data.meetings) {
    meetingRows.push([
      m.name, m.time, m.location,
      recurrenceLabel[m.recurrence] || m.recurrence,
      m.completed ? '已完成' : '未完成',
      m.minutes || '',
    ]);
  }

  const wsMeetings = XLSX.utils.aoa_to_sheet(meetingRows);
  wsMeetings['!cols'] = [25, 18, 20, 10, 10, 40].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsMeetings, '会议记录');

  XLSX.writeFile(wb, `工作日记_${data.date}.xlsx`);
}

// ---- 多日范围导出（本周 / 自定义范围） ----
export function exportRangeToExcel(dataList: DailyWorkJournal[], label: string) {
  const wb = XLSX.utils.book_new();

  // Sheet: 所有任务汇总
  const taskRows: unknown[][] = [
    ['日期', '所属项目', '任务内容', '责任人', '计划日期', '是否完成', '完成时间', '任务进展'],
  ];

  for (const data of dataList) {
    for (const proj of data.todos as TodoProject[]) {
      for (const task of proj.tasks as TodoTask[]) {
        taskRows.push([
          data.date,
          proj.name,
          task.content,
          task.assignee || '',
          task.plannedDate || '',
          task.completed ? '已完成' : '未完成',
          task.completedAt || '',
          task.progress || '',
        ]);
      }
    }
  }

  const wsTasks = XLSX.utils.aoa_to_sheet(taskRows);
  wsTasks['!cols'] = [12, 20, 30, 10, 12, 10, 20, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTasks, '任务汇总');

  // Sheet: 会议汇总
  const meetingRows: unknown[][] = [
    ['日期', '会议名称', '时间', '地点', '是否完成'],
  ];

  for (const data of dataList) {
    for (const m of data.meetings) {
      meetingRows.push([data.date, m.name, m.time, m.location, m.completed ? '已完成' : '未完成']);
    }
  }

  const wsMeetings = XLSX.utils.aoa_to_sheet(meetingRows);
  wsMeetings['!cols'] = [12, 25, 18, 20, 10].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsMeetings, '会议汇总');

  const filename = `工作日记_${label}_${dayjs().format('YYYYMMDD')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
