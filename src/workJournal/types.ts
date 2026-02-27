/**
 * 工作日记数据类型定义
 */

// 会议循环类型
export type MeetingRecurrence = 'none' | 'daily' | 'weekly' | 'biweekly';

// 会议
export interface Meeting {
  id: string;
  name: string; // 会议名称
  time: string; // 时间 (YYYY-MM-DD HH:mm)
  location: string; // 地点
  completed: boolean; // 是否完成
  recurrence: MeetingRecurrence; // 循环类型：none-不循环, daily-每日循环, weekly-单周循环, biweekly-双周循环
  minutes?: string; // 会议纪要（可选）
  createdAt: string;
}

// 项目（14个字段）
export interface Project {
  id: string;
  index: number; // 编号
  name: string; // 项目名称
  nextDelivery: string; // 下一个交付节点
  tester: string; // 测试人员
  engineEngineer: string; // 工程引擎人员
  developer: string; // 研发人员
  engineDeveloper: string; // 工程开发人员
  hardwareLeader: string; // 硬件负责人
  productManager: string; // 产品人员
  pm: string; // PM
  business: string; // 商务
  contact: string; // 对接人
  supplier: string; // 供应商
  amount: string; // 金额
  createdAt: string;
}

// 项目状态类型
export type ProjectStatus = 'inProgress' | 'delivered' | 'accepted';

// 项目集合
export interface ProjectCollection {
  inProgress: Project[]; // 进行中的项目
  delivered: Project[]; // 已交付的项目
  accepted: Project[]; // 已验收项目
}

// 待办任务
export interface TodoTask {
  id: string;
  content: string;
  completed: boolean;
  plannedDate?: string; // 计划完成时间 (YYYY-MM-DD)
  createdAt: string;
}

// 待办项目
export interface TodoProject {
  id: string;
  name: string; // 项目条目名称
  tasks: TodoTask[]; // 多个任务
  createdAt: string;
}

// 每日工作日记数据结构
export interface DailyWorkJournal {
  date: string; // YYYY-MM-DD
  meetings: Meeting[];
  projects: ProjectCollection;
  todos: TodoProject[];
  diary: string; // 日记内容
  lastModified: string; // ISO timestamp
}

// 生成唯一ID的辅助函数
export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
