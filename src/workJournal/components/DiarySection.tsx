import React from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface DiarySectionProps {
  diary: string;
  onChange: (diary: string) => void;
}

const DiarySection: React.FC<DiarySectionProps> = (props) => {
  const { diary, onChange } = props;

  return (
    <TextArea
      value={diary}
      onChange={(e) => onChange(e.target.value)}
      placeholder="请输入今日工作日记..."
      autoSize={{ minRows: 10, maxRows: 30 }}
      style={{ fontSize: 14 }}
    />
  );
};

export default DiarySection;
