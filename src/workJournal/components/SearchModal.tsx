import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal, Input, List, Tag, Typography, Spin, Empty, Space, Badge,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { DailyWorkJournal, TodoProject, TodoTask, Meeting } from '../types';
import { WorkJournalStorage } from '../services/storage';
import { TagStorage } from '../services/tagStorage';

const { Text, Link } = Typography;

interface SearchResult {
  type: 'task' | 'meeting' | 'diary';
  date: string;
  title: string;
  snippet: string;
  tags?: string[];
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigate?: (date: string) => void;
}

const highlight = (text: string, keyword: string): React.ReactNode => {
  if (!keyword.trim()) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#ffe58f', padding: 0 }}>{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </>
  );
};

const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose, onNavigate }) => {
  const [keyword, setKeyword] = useState('');
  const [allData, setAllData] = useState<DailyWorkJournal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 首次打开时加载全量数据
  const loadAll = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      const list: DailyWorkJournal[] = [];
      for (const date of dates) {
        const d = await WorkJournalStorage.get(date);
        if (d) list.push(d);
      }
      setAllData(list);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  React.useEffect(() => {
    if (visible) loadAll();
    else setKeyword('');
  }, [visible, loadAll]);

  const results = useMemo((): SearchResult[] => {
    const q = keyword.trim().toLowerCase();
    if (!q || allData.length === 0) return [];

    const out: SearchResult[] = [];

    for (const d of allData) {
      // 搜索任务
      for (const proj of d.todos as TodoProject[]) {
        for (const task of proj.tasks) {
          if (
            task.content.toLowerCase().includes(q) ||
            (task.progress || '').toLowerCase().includes(q) ||
            (task.assignee || '').toLowerCase().includes(q) ||
            (task.tags || []).some((t) => t.toLowerCase().includes(q))
          ) {
            out.push({
              type: 'task',
              date: d.date,
              title: task.content,
              snippet: `${proj.name}${task.progress ? ' · ' + task.progress.slice(0, 50) : ''}`,
              tags: task.tags,
            });
          }
        }
      }

      // 搜索会议
      for (const m of d.meetings as Meeting[]) {
        if (
          (m.name || '').toLowerCase().includes(q) ||
          (m.location || '').toLowerCase().includes(q) ||
          (m.minutes || '').toLowerCase().includes(q) ||
          (m.projectName || '').toLowerCase().includes(q) ||
          (m.tags || []).some((t) => t.toLowerCase().includes(q))
        ) {
          out.push({
            type: 'meeting',
            date: d.date,
            title: m.name,
            snippet: `${m.time} · ${m.location}${m.projectName ? ' · ' + m.projectName : ''}`,
            tags: m.tags,
          });
        }
      }

      // 搜索日记正文
      if ((d.diary || '').toLowerCase().includes(q)) {
        const idx = d.diary.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 20);
        const snippet = '...' + d.diary.slice(start, start + 80) + '...';
        out.push({
          type: 'diary',
          date: d.date,
          title: `${d.date} 日记`,
          snippet,
        });
      }
    }

    // 按日期倒序
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  }, [keyword, allData]);

  const typeConfig: Record<string, { color: string; label: string }> = {
    task:    { color: 'blue',   label: '任务' },
    meeting: { color: 'orange', label: '会议' },
    diary:   { color: 'purple', label: '日记' },
  };

  return (
    <Modal
      title={
        <Space>
          <SearchOutlined />
          全文检索
          {!loading && loaded && keyword.trim() && (
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              找到 {results.length} 条结果
            </Text>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose={false}
    >
      <Input
        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
        placeholder="搜索任务、会议、日记内容..."
        allowClear
        autoFocus
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 16 }}
        size="large"
      />

      <Spin spinning={loading}>
        {!keyword.trim() ? (
          <Empty description={loaded ? '请输入关键词开始搜索' : '正在加载数据...'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : results.length === 0 ? (
          <Empty description={`未找到包含「${keyword}」的内容`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={results}
            style={{ maxHeight: 480, overflowY: 'auto' }}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: onNavigate ? 'pointer' : 'default', padding: '8px 4px' }}
                onClick={() => onNavigate && (onNavigate(item.date), onClose())}
              >
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space>
                    <Tag color={typeConfig[item.type].color}>{typeConfig[item.type].label}</Tag>
                    <Link strong>{highlight(item.title, keyword)}</Link>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.date}</Text>
                    {(item.tags || []).map((t) => <Tag key={t} color={TagStorage.getColor(t) ?? 'cyan'} style={{ marginLeft: 0 }}>{t}</Tag>)}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>
                    {highlight(item.snippet, keyword)}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Spin>
    </Modal>
  );
};

export default SearchModal;
