import React, { useEffect, useState } from 'react';
import { Modal, Input, Button, Space, Tooltip } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { Meeting } from '../types';

const { TextArea } = Input;

const MEETING_TEMPLATE = `【参会人】
（请填写参会人员名单）

【议题】
1. 

【决议】
1. 

【行动项】
| 负责人 | 行动项 | 截止日期 |
|--------|--------|----------|
|        |        |          |
`;

interface MinutesModalProps {
  visible: boolean;
  meeting: Meeting | null;
  onCancel: () => void;
  onSave: (meeting: Meeting, minutes: string) => void;
}

const MinutesModal: React.FC<MinutesModalProps> = (props) => {
  const { visible, meeting, onCancel, onSave } = props;
  const [minutes, setMinutes] = useState('');

  useEffect(() => {
    if (visible && meeting) {
      setMinutes(meeting.minutes || '');
    }
  }, [visible, meeting]);

  const handleOk = () => {
    if (!meeting) return;
    onSave(meeting, minutes);
  };

  const handleCancel = () => {
    setMinutes('');
    onCancel();
  };

  const handleInsertTemplate = () => {
    if (minutes.trim()) {
      // 已有内容则追加，空行分隔
      setMinutes((prev) => prev + '\n\n' + MEETING_TEMPLATE);
    } else {
      setMinutes(MEETING_TEMPLATE);
    }
  };

  const handleClearTemplate = () => {
    setMinutes('');
  };

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          {`会议纪要 - ${meeting?.name || ''}`}
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={720}
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
        <Tooltip title="插入标准会议纪要模板（参会人、议题、决议、行动项）">
          <Button size="small" icon={<FileTextOutlined />} onClick={handleInsertTemplate}>
            插入模板
          </Button>
        </Tooltip>
        {minutes && (
          <Button size="small" danger onClick={handleClearTemplate}>
            清空
          </Button>
        )}
        <span style={{ color: '#999', fontSize: 12, lineHeight: '24px' }}>
          {minutes.length} 字
        </span>
      </div>
      <TextArea
        placeholder="请输入会议纪要内容，或点击「插入模板」快速填写..."
        rows={16}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 13 }}
      />
    </Modal>
  );
};

export default MinutesModal;
