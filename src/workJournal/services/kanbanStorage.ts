import type { KanbanOrder } from '../types';

const KANBAN_ORDER_KEY = 'workJournal_kanban_order';

const emptyOrder = (): KanbanOrder => ({
  byStatus: { todo: [], inprogress: [], overdue: [], done: [] },
  byPriority: { high: [], medium: [], low: [], none: [] },
  updatedAt: new Date().toISOString(),
});

export class KanbanStorage {
  static get(): KanbanOrder {
    try {
      const raw = localStorage.getItem(KANBAN_ORDER_KEY);
      return raw ? (JSON.parse(raw) as KanbanOrder) : emptyOrder();
    } catch {
      return emptyOrder();
    }
  }

  static save(order: KanbanOrder): void {
    try {
      localStorage.setItem(KANBAN_ORDER_KEY, JSON.stringify({
        ...order,
        updatedAt: new Date().toISOString(),
      }));
    } catch {
      console.warn('[KanbanStorage] Failed to save kanban order');
    }
  }

  /**
   * 对一批任务 key 按已存储的顺序排序
   * - 已存储 key 按存储顺序排在前面
   * - 新出现的 key 追加到末尾
   * - 已消失的 key 自动忽略
   */
  static sortKeys(
    keys: string[],
    storedOrder: string[],
  ): string[] {
    const keySet = new Set(keys);
    const sorted: string[] = [];
    // 先按存储顺序放入仍存在的 key
    for (const k of storedOrder) {
      if (keySet.has(k)) sorted.push(k);
    }
    // 再追加新出现的 key
    const sortedSet = new Set(sorted);
    for (const k of keys) {
      if (!sortedSet.has(k)) sorted.push(k);
    }
    return sorted;
  }
}
