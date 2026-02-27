import React, { useState } from 'react';
import { Input, Button, Space, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';

const { TextArea } = Input;

interface DiarySectionProps {
  diary: string;
  onChange: (diary: string) => void;
  onSave?: () => Promise<void>;
}

const DiarySection: React.FC<DiarySectionProps> = (props) => {
  const { diary, onChange, onSave } = props;
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

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <TextArea
        value={diary}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入今日工作日记..."
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
