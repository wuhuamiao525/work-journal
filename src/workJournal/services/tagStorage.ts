import type { TagConfig } from '../types';

const TAG_CONFIG_KEY = 'workJournal_tag_configs';

export class TagStorage {
  static getAll(): TagConfig[] {
    try {
      const raw = localStorage.getItem(TAG_CONFIG_KEY);
      return raw ? (JSON.parse(raw) as TagConfig[]) : [];
    } catch {
      return [];
    }
  }

  static save(configs: TagConfig[]): void {
    try {
      localStorage.setItem(TAG_CONFIG_KEY, JSON.stringify(configs));
    } catch {
      console.warn('[TagStorage] Failed to save tag configs');
    }
  }

  static getColor(name: string): string {
    const configs = this.getAll();
    return configs.find((c) => c.name === name)?.color ?? 'default';
  }

  static upsert(config: TagConfig): void {
    const configs = this.getAll();
    const idx = configs.findIndex((c) => c.name === config.name);
    if (idx >= 0) {
      configs[idx] = config;
    } else {
      configs.push(config);
    }
    this.save(configs);
  }

  static rename(oldName: string, newName: string): void {
    const configs = this.getAll();
    const idx = configs.findIndex((c) => c.name === oldName);
    if (idx >= 0) {
      configs[idx] = { ...configs[idx], name: newName };
      this.save(configs);
    }
  }

  static delete(name: string): void {
    const configs = this.getAll().filter((c) => c.name !== name);
    this.save(configs);
  }
}
