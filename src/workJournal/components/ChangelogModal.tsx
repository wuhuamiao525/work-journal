import React from 'react';
import {
  Modal, Tag, Typography, List, Collapse, Divider, Badge,
  theme as antTheme,
} from 'antd';
import { RocketOutlined, HistoryOutlined } from '@ant-design/icons';
import { CHANGELOG } from '../constants/changelog';

const { Text, Title } = Typography;

interface ChangelogModalProps {
  visible: boolean;
  onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ visible, onClose }) => {
  const { token } = antTheme.useToken();

  const current = CHANGELOG[0];
  const history = CHANGELOG.slice(1);

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RocketOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>版本说明</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      {/* ===== 当前版本 ===== */}
      <div
        style={{
          background: token.colorPrimaryBg,
          border: `1px solid ${token.colorPrimaryBorder}`,
          borderRadius: token.borderRadiusLG,
          padding: '16px 20px',
          marginBottom: 20,
        }}
      >
        {/* 版本号行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Tag
            color="blue"
            style={{ fontSize: 15, padding: '2px 10px', fontWeight: 700, margin: 0 }}
          >
            v{current.version}
          </Tag>
          <Badge
            count="最新"
            style={{
              backgroundColor: token.colorSuccess,
              fontSize: 11,
              padding: '0 6px',
              height: 18,
              lineHeight: '18px',
              borderRadius: 9,
            }}
          />
          <Text type="secondary" style={{ fontSize: 13, marginLeft: 4 }}>
            {current.date}
          </Text>
        </div>

        {/* 更新内容 */}
        <List
          size="small"
          dataSource={current.changes}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', border: 'none' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: token.colorPrimary, flexShrink: 0, marginTop: 2 }}>●</span>
                <Text style={{ fontSize: 13, lineHeight: '20px' }}>{item}</Text>
              </div>
            </List.Item>
          )}
        />
      </div>

      {/* ===== 历史版本 ===== */}
      {history.length > 0 && (
        <>
          <Divider style={{ margin: '0 0 12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: token.colorTextSecondary }}>
              <HistoryOutlined />
              历史版本
            </span>
          </Divider>

          <Collapse
            ghost
            size="small"
            items={history.map((entry) => ({
              key: entry.version,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag style={{ margin: 0, fontWeight: 600 }}>v{entry.version}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{entry.date}</Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                    · {entry.changes.length} 项更新
                  </Text>
                </div>
              ),
              children: (
                <List
                  size="small"
                  dataSource={entry.changes}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '3px 0', border: 'none' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: token.colorTextTertiary, flexShrink: 0, marginTop: 2 }}>●</span>
                        <Text style={{ fontSize: 13, lineHeight: '20px', color: token.colorTextSecondary }}>
                          {item}
                        </Text>
                      </div>
                    </List.Item>
                  )}
                />
              ),
            }))}
          />
        </>
      )}

      {/* 底部提示 */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          每日工作日记 · 当前版本 v{__APP_VERSION__}
        </Text>
      </div>
    </Modal>
  );
};

export default ChangelogModal;
