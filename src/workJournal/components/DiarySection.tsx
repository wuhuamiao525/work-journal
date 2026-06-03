import React, { useState } from 'react';
import { Input, Button, Space, message, Tooltip, theme as antTheme } from 'antd';
import { SaveOutlined, FileTextOutlined } from '@ant-design/icons';
import type { TodoProject } from '../types';

const { TextArea } = Input;

interface DiarySectionProps {
  diary: string;
  onChange: (diary: string) => void;
  onSave?: () => Promise<void>;
  projects?: TodoProject[];
}

function buildDiaryTemplate(projects: TodoProject[]): string {
  const projectLines = projects.length > 0
    ? projects.map((p) => `● ${p.name}：`).join('\n')
    : '● （暂无项目）';

  return `【今日工作内容】
${projectLines}

【明日工作内容】
${projectLines}

【问题与风险】


【其他事项】
`;
}

const DiarySection: React.FC<DiarySectionProps> = (props) => {
  const { diary, onChange, onSave, projects = [] } = props;
  const { token } = antTheme.useToken();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave();
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败，请重试');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInsertTemplate = () => {
    const template = buildDiaryTemplate(projects);
    if (diary.trim()) {
      onChange(diary + '\n\n' + template);
    } else {
      onChange(template);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {/* 工具栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tooltip title="插入日记模板（今日/明日工作内容 + 问题与风险 + 其他事项）">
          <Button size="small" icon={<FileTextOutlined />} onClick={handleInsertTemplate}>
            插入模板
          </Button>
        </Tooltip>
        <span style={{ color: token.colorTextQuaternary, fontSize: 12 }}>{diary.length} 字</span>
      </div>
      <TextArea
        value={diary}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入今日工作日记，或点击「插入模板」快速填写..."
        autoSize={{ minRows: 10, maxRows: 30 }}
        style={{ fontSize: 14 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          保存到数据库
        </Button>
      </div>
    </Space>
  );
};

export default DiarySection;
