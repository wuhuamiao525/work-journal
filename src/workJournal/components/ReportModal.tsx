import React, { useState, useCallback } from 'react';
import {
  Modal, Radio, Button, Spin, Typography, Space, Divider, message, DatePicker,
} from 'antd';
import { CopyOutlined, DownloadOutlined, FileTextOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { DailyWorkJournal, TodoProject } from '../types';
import { WorkJournalStorage } from '../services/storage';

dayjs.extend(isoWeek);

const { Text, Paragraph } = Typography;

type ReportType = 'week' | 'month';

interface ReportModalProps {
  visible: boolean;
  onCancel: () => void;
}

function buildReportText(dataList: DailyWorkJournal[], label: string): string {
  const lines: string[] = [];

  lines.push(`# ${label} 工作报告`);
  lines.push(`> 生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`);
  lines.push('');

  // 会议汇总
  const allMeetings = dataList.flatMap((d) =>
    d.meetings.map((m) => ({ ...m, date: d.date }))
  );
  lines.push(`## 一、会议记录（共 ${allMeetings.length} 次）`);
  if (allMeetings.length === 0) {
    lines.push('本期无会议记录。');
  } else {
    for (const m of allMeetings) {
      const status = m.completed ? '✅' : '⬜';
      lines.push(`- ${status} [${m.date}] **${m.name}**  地点：${m.location || '—'}`);
      if (m.minutes && m.minutes.trim()) {
        lines.push(`  > 纪要：${m.minutes.replace(/\n/g, '\n  > ')}`);
      }
    }
  }
  lines.push('');

  // 项目状态
  const projectSet = new Map<string, { name: string; status: string }>();
  for (const d of dataList) {
    const statusLabel: Record<string, string> = {
      inProgress: '进行中', delivered: '已交付', accepted: '已验收',
    };
    for (const [status, list] of Object.entries(d.projects)) {
      for (const p of list as any[]) {
        projectSet.set(p.id, { name: p.name, status: statusLabel[status] });
      }
    }
  }
  lines.push(`## 二、项目状态（共 ${projectSet.size} 个项目）`);
  for (const { name, status } of projectSet.values()) {
    lines.push(`- **${name}** — ${status}`);
  }
  lines.push('');

  // 已完成任务
  const completedTasks = dataList.flatMap((d) =>
    (d.todos as TodoProject[]).flatMap((proj) =>
      proj.tasks
        .filter((t) => t.completed)
        .map((t) => ({ ...t, projectName: proj.name, date: d.date }))
    )
  );
  lines.push(`## 三、已完成任务（共 ${completedTasks.length} 项）`);
  if (completedTasks.length === 0) {
    lines.push('本期无已完成任务。');
  } else {
    const byProject = new Map<string, typeof completedTasks>();
    for (const t of completedTasks) {
      const arr = byProject.get(t.projectName) || [];
      arr.push(t);
      byProject.set(t.projectName, arr);
    }
    for (const [proj, tasks] of byProject) {
      lines.push(`### ${proj}`);
      for (const t of tasks) {
        const who = t.assignee ? ` (${t.assignee})` : '';
        lines.push(`- ✅ ${t.content}${who}  完成时间：${t.completedAt || t.date}`);
      }
    }
  }
  lines.push('');

  // 未完成任务
  const unfinishedTasks = dataList.flatMap((d) =>
    (d.todos as TodoProject[]).flatMap((proj) =>
      proj.tasks
        .filter((t) => !t.completed)
        .map((t) => ({ ...t, projectName: proj.name }))
    )
  );
  lines.push(`## 四、未完成任务（共 ${unfinishedTasks.length} 项）`);
  if (unfinishedTasks.length === 0) {
    lines.push('本期所有任务均已完成。🎉');
  } else {
    const byProject = new Map<string, typeof unfinishedTasks>();
    for (const t of unfinishedTasks) {
      const arr = byProject.get(t.projectName) || [];
      arr.push(t);
      byProject.set(t.projectName, arr);
    }
    for (const [proj, tasks] of byProject) {
      lines.push(`### ${proj}`);
      for (const t of tasks) {
        const due = t.plannedDate ? `  计划：${t.plannedDate}` : '';
        const who = t.assignee ? ` (${t.assignee})` : '';
        lines.push(`- ⬜ ${t.content}${who}${due}`);
      }
    }
  }
  lines.push('');

  // 工作日记摘要
  const diaries = dataList.filter((d) => d.diary && d.diary.trim());
  if (diaries.length > 0) {
    lines.push('## 五、工作日记摘要');
    for (const d of diaries) {
      lines.push(`### ${d.date}`);
      lines.push(d.diary);
      lines.push('');
    }
  }

  return lines.join('\n');
}

const ReportModal: React.FC<ReportModalProps> = ({ visible, onCancel }) => {
  const [reportType, setReportType] = useState<ReportType>('week');
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setGenerated(false);
    try {
      let startDate: dayjs.Dayjs;
      let endDate: dayjs.Dayjs;
      let label: string;

      if (reportType === 'week') {
        startDate = selectedDate.startOf('isoWeek');
        endDate = selectedDate.endOf('isoWeek');
        const weekNum = selectedDate.isoWeek();
        label = `${selectedDate.year()}年第${weekNum}周`;
      } else {
        startDate = selectedDate.startOf('month');
        endDate = selectedDate.endOf('month');
        label = `${selectedDate.format('YYYY年M月')}`;
      }

      const allDates = await WorkJournalStorage.getAllDates();
      const rangeDates = allDates.filter((d) => {
        const dDay = dayjs(d);
        return (dDay.isAfter(startDate, 'day') || dDay.isSame(startDate, 'day'))
          && (dDay.isBefore(endDate, 'day') || dDay.isSame(endDate, 'day'));
      });

      const dataList: DailyWorkJournal[] = [];
      for (const date of rangeDates.sort()) {
        const data = await WorkJournalStorage.get(date);
        if (data) dataList.push(data);
      }

      if (dataList.length === 0) {
        message.warning('所选时间范围内没有工作记录');
        setLoading(false);
        return;
      }

      const text = buildReportText(dataList, label);
      setReportText(text);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedDate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText).then(() => {
      message.success('已复制到剪贴板');
    });
  };

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = reportType === 'week'
      ? `${selectedDate.year()}年第${selectedDate.isoWeek()}周`
      : selectedDate.format('YYYY年M月');
    a.href = url;
    a.download = `工作报告_${label}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setGenerated(false);
    setReportText('');
    setAiSummary('');
    onCancel();
  };

  const handleAiSummarize = async () => {
    if (!reportText) return;
    setAiLoading(true);
    setAiSummary('');
    try {
      const resp = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reportText, type: reportType === 'week' ? 'weekly' : 'monthly' }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        message.error(data.error || 'AI 总结失败');
        return;
      }
      setAiSummary(data.summary);
    } catch {
      message.error('AI 总结请求失败');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          生成工作报告
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={860}
      footer={null}
      destroyOnClose
    >
      {/* 控制区 */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Radio.Group
          value={reportType}
          onChange={(e) => { setReportType(e.target.value); setGenerated(false); }}
          optionType="button"
          buttonStyle="solid"
          options={[
            { label: '周报', value: 'week' },
            { label: '月报', value: 'month' },
          ]}
        />
        {reportType === 'week' ? (
          <DatePicker
            picker="week"
            value={selectedDate}
            onChange={(d) => { if (d) { setSelectedDate(d); setGenerated(false); } }}
            allowClear={false}
          />
        ) : (
          <DatePicker
            picker="month"
            value={selectedDate}
            onChange={(d) => { if (d) { setSelectedDate(d); setGenerated(false); } }}
            allowClear={false}
          />
        )}
        <Button type="primary" onClick={handleGenerate} loading={loading}>
          生成报告
        </Button>
      </Space>

      {/* 报告内容 */}
      <Spin spinning={loading}>
        {generated && (
          <>
            <Divider />
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button icon={<CopyOutlined />} onClick={handleCopy}>
                一键复制
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                下载 .md 文件
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAiSummarize}
                loading={aiLoading}
                type="primary"
                ghost
              >
                ✨ AI 提炼
              </Button>
              <Text type="secondary" style={{ lineHeight: '32px', fontSize: 12 }}>
                共 {reportText.length} 字
              </Text>
            </div>
            {aiSummary && (
              <div
                style={{
                  background: '#f0f5ff',
                  border: '1px solid #adc6ff',
                  borderRadius: 6,
                  padding: '12px 16px',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6, color: '#2f54eb' }}>✨ AI 提炼摘要</div>
                <Paragraph
                  style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: 0, lineHeight: 1.7 }}
                >
                  {aiSummary}
                </Paragraph>
              </div>
            )}
            <div
              style={{
                background: '#f5f5f5',
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                padding: '16px',
                maxHeight: 480,
                overflow: 'auto',
              }}
            >
              <Paragraph
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  margin: 0,
                  lineHeight: 1.7,
                }}
              >
                {reportText}
              </Paragraph>
            </div>
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default ReportModal;
