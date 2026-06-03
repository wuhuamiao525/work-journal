/**
 * 工作日记数据类型定义
 */

// 会议循环类型
export type MeetingRecurrence = 'none' | 'daily' | 'weekly' | 'biweekly';

// 会议
export interface Meeting {
  id: string;
  name: string;
  time: string;
  location: string;
  completed: boolean;
  recurrence: MeetingRecurrence;
  minutes?: string;
  projectName?: string;
  tags?: string[];
  attendees?: string[];   // 参与人
  duration?: number;      // 时长（分钟）
  createdAt: string;
}

// 项目（14个字段 + 备注/风险）
export interface Project {
  id: string;
  index: number;
  name: string;
  nextDelivery: string;
  tester: string;
  engineEngineer: string;
  developer: string;
  engineDeveloper: string;
  hardwareLeader: string;
  productManager: string;
  pm: string;
  business: string;
  contact: string;
  supplier: string;
  amount: string;
  notes?: string;   // 项目备注
  risks?: string;   // 风险点
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

// 任务优先级
export type TaskPriority = 'high' | 'medium' | 'low';

// 子任务
export interface SubTask {
  id: string;
  content: string;
  completed: boolean;
}

// 待办任务
export interface TodoTask {
  id: string;
  content: string;
  completed: boolean;
  plannedDate?: string;
  progress?: string;
  createdAt: string;
  completedAt?: string;
  assignee?: string;
  priority?: TaskPriority;
  tags?: string[];
  estimatedHours?: number;  // 预计工时（小时）
  actualHours?: number;     // 实际工时（小时）
  subtasks?: SubTask[];     // 子任务列表
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

// 标签配置（存 localStorage，支持自定义颜色）
export interface TagConfig {
  name: string;    // 标签名（唯一 key）
  color: string;   // Ant Design 预设色名 或 hex，如 'blue'/'#ff4d4f'
}

// 看板排序持久化（存 localStorage）
// taskKey = `${task.content}__${task.projectName}`
export interface KanbanOrder {
  byStatus: {
    todo: string[];
    inprogress: string[];
    overdue: string[];
    done: string[];
  };
  byPriority: {
    high: string[];
    medium: string[];
    low: string[];
    none: string[];
  };
  updatedAt: string; // ISO timestamp
}
