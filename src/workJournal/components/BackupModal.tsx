import React, { useState } from 'react';
import {
  Modal, Button, Upload, Progress, Space, Typography, Divider, Radio,
  message, Alert, Statistic, Row, Col,
} from 'antd';
import {
  CloudDownloadOutlined, CloudUploadOutlined, InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { DailyWorkJournal } from '../types';
import { WorkJournalStorage } from '../services/storage';

const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface BackupFile {
  version: string;
  exportedAt: string;
  count: number;
  data: DailyWorkJournal[];
}

interface BackupModalProps {
  visible: boolean;
  onClose: () => void;
}

const BackupModal: React.FC<BackupModalProps> = ({ visible, onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [pendingData, setPendingData] = useState<DailyWorkJournal[] | null>(null);
  const [importPreview, setImportPreview] = useState<{ count: number; minDate: string; maxDate: string } | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'overwrite'>('merge');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // ---- 导出 ----
  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const dates = await WorkJournalStorage.getAllDates();
      const data: DailyWorkJournal[] = [];
      for (let i = 0; i < dates.length; i++) {
        const d = await WorkJournalStorage.get(dates[i]);
        if (d) data.push(d);
        setExportProgress(Math.round(((i + 1) / dates.length) * 100));
      }

      const backup: BackupFile = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        count: data.length,
        data,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rijiji-backup-${dayjs().format('YYYY-MM-DD')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已导出 ${data.length} 条记录`);
    } catch (err) {
      message.error('导出失败');
      console.error(err);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  // ---- 读取导入文件 ----
  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        // 支持两种格式：BackupFile 或直接的 DailyWorkJournal[]
        let records: DailyWorkJournal[] = [];
        if (Array.isArray(raw)) {
          records = raw;
        } else if (raw.data && Array.isArray(raw.data)) {
          records = raw.data;
        } else {
          message.error('文件格式不正确，请选择有效的备份文件');
          return;
        }

        // 校验每条记录有 date 字段
        const valid = records.every((r) => typeof r.date === 'string' && r.date.match(/^\d{4}-\d{2}-\d{2}$/));
        if (!valid) {
          message.error('备份数据格式有误，部分记录缺少 date 字段');
          return;
        }

        const dates = records.map((r) => r.date).sort();
        setPendingData(records);
        setImportPreview({
          count: records.length,
          minDate: dates[0],
          maxDate: dates[dates.length - 1],
        });
      } catch {
        message.error('文件解析失败，请确认是有效的 JSON 备份文件');
      }
    };
    reader.readAsText(file, 'utf-8');
    return false; // 阻止自动上传
  };

  // ---- 执行导入 ----
  const handleImport = async () => {
    if (!pendingData) return;
    setImporting(true);
    setImportProgress(0);
    try {
      if (mergeMode === 'overwrite') {
        await WorkJournalStorage.clearAll();
      }

      for (let i = 0; i < pendingData.length; i++) {
        const record = pendingData[i];
        if (mergeMode === 'merge') {
          const existing = await WorkJournalStorage.get(record.date);
          if (existing) {
            setImportProgress(Math.round(((i + 1) / pendingData.length) * 100));
            continue; // 合并模式：跳过已有日期
          }
        }
        await WorkJournalStorage.save(record);
        setImportProgress(Math.round(((i + 1) / pendingData.length) * 100));
      }

      message.success(`导入完成！共处理 ${pendingData.length} 条记录`);
      setPendingData(null);
      setImportPreview(null);
      setImportProgress(0);
    } catch (err) {
      message.error('导入过程中出现错误');
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  const handleCancelImport = () => {
    setPendingData(null);
    setImportPreview(null);
    setImportProgress(0);
  };

  return (
    <Modal
      title={
        <Space>
          <CloudDownloadOutlined />
          数据备份与恢复
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      {/* 导出区 */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 15 }}>
          <CloudDownloadOutlined style={{ marginRight: 6, color: '#1677ff' }} />
          导出备份
        </Text>
        <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 12 }}>
          将所有日记数据导出为 JSON 文件，可用于备份或迁移。
        </Paragraph>
        <Button
          type="primary"
          icon={<CloudDownloadOutlined />}
          onClick={handleExport}
          loading={exporting}
        >
          导出 JSON 备份
        </Button>
        {exporting && exportProgress > 0 && (
          <Progress percent={exportProgress} size="small" style={{ marginTop: 8 }} />
        )}
      </div>

      <Divider />

      {/* 导入区 */}
      <div>
        <Text strong style={{ fontSize: 15 }}>
          <CloudUploadOutlined style={{ marginRight: 6, color: '#52c41a' }} />
          导入恢复
        </Text>
        <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 12 }}>
          从备份文件恢复数据。支持「合并」（保留已有记录）或「覆盖」（清空后全量恢复）两种模式。
        </Paragraph>

        {!importPreview ? (
          <Dragger
            accept=".json"
            beforeUpload={handleFileRead}
            showUploadList={false}
            style={{ padding: '8px 0' }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#52c41a', fontSize: 32 }} />
            </p>
            <p className="ant-upload-text">点击或拖拽备份文件到此区域</p>
            <p className="ant-upload-hint">仅支持 .json 格式的备份文件</p>
          </Dragger>
        ) : (
          <div>
            <Alert
              type="success"
              showIcon
              message="文件解析成功"
              description={
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}>
                    <Statistic title="记录总数" value={importPreview.count} suffix="条" />
                  </Col>
                  <Col span={8}>
                    <Statistic title="最早日期" value={importPreview.minDate} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="最晚日期" value={importPreview.maxDate} />
                  </Col>
                </Row>
              }
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 12 }}>
              <Text strong>导入模式：</Text>
              <Radio.Group
                value={mergeMode}
                onChange={(e) => setMergeMode(e.target.value)}
                style={{ marginLeft: 12 }}
              >
                <Radio value="merge">
                  合并导入
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>（跳过本地已有日期）</Text>
                </Radio>
                <Radio value="overwrite">
                  完全覆盖
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 4, color: '#ff4d4f' }}>（清空后重新导入，不可撤销）</Text>
                </Radio>
              </Radio.Group>
            </div>

            {importing && (
              <Progress percent={importProgress} size="small" style={{ marginBottom: 12 }} />
            )}

            <Space>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={handleImport}
                loading={importing}
                danger={mergeMode === 'overwrite'}
              >
                {mergeMode === 'overwrite' ? '覆盖导入（不可恢复）' : '开始合并导入'}
              </Button>
              <Button onClick={handleCancelImport} disabled={importing}>
                重新选择文件
              </Button>
            </Space>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BackupModal;
