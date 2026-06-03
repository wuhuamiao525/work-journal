/**
 * 项目相关公共工具函数
 * 从 ProjectDetailDrawer 抽取，供 ProjectDashboard 等多处复用
 */
import dayjs from 'dayjs';
import type { DailyWorkJournal, TodoTask, Meeting, ProjectStatus } from '../types';

// ---- 类型 ----
export interface UniqueTask {
  task: TodoTask;
  projName: string;
  isCompleted: boolean;
}

export interface ProjectStats {
  projectName: string;
  total: number;
  completed: number;
  unfinished: number;
  overdue: number;
  completionRate: number; // 0~100
  healthScore: number;    // 0~100
  lastActiveDate: string;
  status: ProjectStatus | null;
}

// ---- 任务提取（去重，保留最新 sourceDate 副本） ----
export function extractProjectTasks(
  allData: DailyWorkJournal[],
  projectName: string,
): UniqueTask[] {
  const completedKeys = new Set<string>();
  const allItems: { task: TodoTask; projName: string; date: string }[] = [];

  for (const d of allData) {
    for (const proj of d.todos) {
      if (proj.name !== projectName) continue;
      for (const t of proj.tasks) {
        const key = `${t.content}__${proj.name}`;
        if (t.completed) completedKeys.add(key);
        allItems.push({ task: t, projName: proj.name, date: d.date });
      }
    }
  }

  const seen = new Map<string, typeof allItems[0]>();
  for (const item of allItems) {
    const key = `${item.task.content}__${item.projName}`;
    const existing = seen.get(key);
    if (!existing || item.date > existing.date) seen.set(key, item);
  }

  return Array.from(seen.values()).map(({ task, projName }) => {
    const key = `${task.content}__${projName}`;
    return { task, projName, isCompleted: task.completed || completedKeys.has(key) };
  });
}

// ---- 会议提取 ----
export function extractProjectMeetings(
  allData: DailyWorkJournal[],
  projectName: string,
): Meeting[] {
  const seen = new Map<string, Meeting>();
  for (const d of allData) {
    for (const m of d.meetings) {
      let matched = false;
      if (m.projectName) {
        matched = m.projectName === projectName;
      } else {
        matched = !!(m.name?.includes(projectName) || m.minutes?.includes(projectName));
      }
      if (!matched) continue;
      const key = `${m.name}__${dayjs(m.time).format('YYYY-MM-DD')}`;
      if (!seen.has(key)) seen.set(key, m);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.time.localeCompare(a.time));
}

// ---- 健康度评分（0~100） ----
export function calcHealthScore(tasks: UniqueTask[], recentActiveDays: number): number {
  if (tasks.length === 0) return 50;
  const completionRate = tasks.filter((t) => t.isCompleted).length / tasks.length;
  const today = dayjs();
  const overdueCount = tasks.filter(
    (t) => !t.isCompleted && t.task.plannedDate && dayjs(t.task.plannedDate).isBefore(today, 'day'),
  ).length;
  const overdueRate = overdueCount / tasks.length;
  const activeScore = Math.min(recentActiveDays / 7, 1); // 近7天活跃度
  const score =
    completionRate * 50 +
    (1 - overdueRate) * 30 +
    activeScore * 20;
  return Math.round(score * 100);
}

// ---- 汇总所有项目统计 ----
export function buildAllProjectStats(allData: DailyWorkJournal[]): ProjectStats[] {
  // 收集所有项目名及其状态（取最新日期的状态）
  const projectStatusMap = new Map<string, ProjectStatus>();
  const sorted = [...allData].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) {
    for (const status of ['inProgress', 'delivered', 'accepted'] as ProjectStatus[]) {
      for (const p of d.projects[status]) {
        projectStatusMap.set(p.name, status);
      }
    }
  }

  // 收集所有出现过的项目名（来自 todos）
  const allProjectNames = new Set<string>();
  for (const d of allData) {
    for (const tp of d.todos) {
      if (tp.name) allProjectNames.add(tp.name);
    }
  }
  for (const name of projectStatusMap.keys()) {
    allProjectNames.add(name);
  }

  const today = dayjs();
  const result: ProjectStats[] = [];

  for (const name of allProjectNames) {
    const tasks = extractProjectTasks(allData, name);
    const completed = tasks.filter((t) => t.isCompleted).length;
    const unfinished = tasks.filter((t) => !t.isCompleted).length;
    const overdue = tasks.filter(
      (t) => !t.isCompleted && t.task.plannedDate && dayjs(t.task.plannedDate).isBefore(today, 'day'),
    ).length;

    // 近 7 天活跃天数
    const sevenDaysAgo = today.subtract(7, 'day').format('YYYY-MM-DD');
    const recentActiveDays = allData.filter(
      (d) =>
        d.date >= sevenDaysAgo &&
        d.todos.some((tp) => tp.name === name && tp.tasks.length > 0),
    ).length;

    // 最近活跃日期
    const activeDates = allData
      .filter((d) => d.todos.some((tp) => tp.name === name && tp.tasks.length > 0))
      .map((d) => d.date)
      .sort();
    const lastActiveDate = activeDates[activeDates.length - 1] ?? '-';

    result.push({
      projectName: name,
      total: tasks.length,
      completed,
      unfinished,
      overdue,
      completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
      healthScore: calcHealthScore(tasks, recentActiveDays),
      lastActiveDate,
      status: projectStatusMap.get(name) ?? null,
    });
  }

  return result.sort((a, b) => b.completionRate - a.completionRate);
}
