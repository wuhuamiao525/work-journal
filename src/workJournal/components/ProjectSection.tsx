import React, { useState } from 'react';
import { Button, Space, Popconfirm, message, Table, Tabs, Alert, theme as antTheme } from 'antd';
import { PlusOutlined, ArrowRightOutlined, EyeOutlined } from '@ant-design/icons';
import type { Project, ProjectStatus, ProjectCollection } from '../types';
import ProjectModal from '../modals/ProjectModal';
import ProjectDetailDrawer from './ProjectDetailDrawer';

interface ProjectSectionProps {
  projects: ProjectCollection;
  onChange: (projects: ProjectCollection) => void;
}

const labelMap: Record<ProjectStatus, string> = {
  inProgress: '进行中的项目',
  delivered: '已交付的项目',
  accepted: '已验收项目',
};

const moveTargetMap: Partial<Record<ProjectStatus, ProjectStatus>> = {
  inProgress: 'delivered',
  delivered: 'accepted',
};

const ProjectSection: React.FC<ProjectSectionProps> = (props) => {
  const { projects, onChange } = props;
  const { token } = antTheme.useToken();
  const [activeTab, setActiveTab] = useState<ProjectStatus>('inProgress');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);

  const handleViewDetail = (project: Project) => {
    setDetailProject(project);
    setDetailDrawerVisible(true);
  };

  const handleAdd = () => {
    setCurrentProject(null);
    setModalVisible(true);
  };

  const handleEdit = (project: Project) => {
    setCurrentProject(project);
    setModalVisible(true);
  };

  const handleDelete = (project: Project) => {
    const newProjects = { ...projects };
    newProjects[activeTab] = newProjects[activeTab].filter((p) => p.id !== project.id);
    onChange(newProjects);
    message.success('删除成功');
  };

  const handleModalFinish = (project: Project) => {
    const newProjects = { ...projects };
    if (currentProject) {
      newProjects[activeTab] = newProjects[activeTab].map((p) =>
        p.id === project.id ? project : p,
      );
    } else {
      newProjects[activeTab] = [...newProjects[activeTab], project];
    }
    onChange(newProjects);
    setModalVisible(false);
    setCurrentProject(null);
  };

  // 移动单个项目到目标状态
  const handleMoveTo = (project: Project, to: ProjectStatus) => {
    const newProjects = { ...projects };
    newProjects[activeTab] = newProjects[activeTab].filter((p) => p.id !== project.id);
    newProjects[to] = [...newProjects[to], project];
    onChange(newProjects);
    message.success(`已移动到「${labelMap[to]}」`);
  };

  // 批量移动到目标状态
  const handleBatchMoveTo = (to: ProjectStatus) => {
    const newProjects = { ...projects };
    const moving = newProjects[activeTab].filter((p) => selectedRowKeys.includes(p.id));
    newProjects[activeTab] = newProjects[activeTab].filter((p) => !selectedRowKeys.includes(p.id));
    newProjects[to] = [...newProjects[to], ...moving];
    onChange(newProjects);
    setSelectedRowKeys([]);
    message.success(`已将 ${moving.length} 个项目移动到「${labelMap[to]}」`);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as ProjectStatus);
    setSelectedRowKeys([]);
  };

  const columns = [
    {
      title: '编号',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      fixed: 'left' as const,
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      fixed: 'left' as const,
    },
    {
      title: '下一个交付节点',
      dataIndex: 'nextDelivery',
      key: 'nextDelivery',
      width: 150,
    },
    {
      title: '测试人员',
      dataIndex: 'tester',
      key: 'tester',
      width: 120,
    },
    {
      title: '工程引擎人员',
      dataIndex: 'engineEngineer',
      key: 'engineEngineer',
      width: 120,
    },
    {
      title: '研发人员',
      dataIndex: 'developer',
      key: 'developer',
      width: 120,
    },
    {
      title: '工程开发人员',
      dataIndex: 'engineDeveloper',
      key: 'engineDeveloper',
      width: 120,
    },
    {
      title: '硬件负责人',
      dataIndex: 'hardwareLeader',
      key: 'hardwareLeader',
      width: 120,
    },
    {
      title: '产品人员',
      dataIndex: 'productManager',
      key: 'productManager',
      width: 120,
    },
    {
      title: 'PM',
      dataIndex: 'pm',
      key: 'pm',
      width: 100,
    },
    {
      title: '商务',
      dataIndex: 'business',
      key: 'business',
      width: 100,
    },
    {
      title: '对接人',
      dataIndex: 'contact',
      key: 'contact',
      width: 100,
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Project) => {
        const moveTarget = moveTargetMap[activeTab];
        return (
          <Space>
            <a onClick={() => handleViewDetail(record)}>
              <EyeOutlined /> 详情
            </a>
            <a onClick={() => handleEdit(record)}>编辑</a>
            {moveTarget && (
              <a
                style={{ color: token.colorPrimary }}
                onClick={() => handleMoveTo(record, moveTarget)}
              >
                <ArrowRightOutlined /> {labelMap[moveTarget].replace('的项目', '').replace('项目', '')}
              </a>
            )}
            <Popconfirm
              title="确定删除这个项目吗？"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <a style={{ color: token.colorError }}>删除</a>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  };

  const renderTable = (dataSource: Project[]) => (
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      pagination={false}
      scroll={{ x: 1900 }}
      rowSelection={rowSelection}
    />
  );

  const tabItems = [
    {
      key: 'inProgress',
      label: `进行中的项目 (${projects.inProgress.length})`,
      children: renderTable(projects.inProgress),
    },
    {
      key: 'delivered',
      label: `已交付的项目 (${projects.delivered.length})`,
      children: renderTable(projects.delivered),
    },
    {
      key: 'accepted',
      label: `已验收项目 (${projects.accepted.length})`,
      children: renderTable(projects.accepted),
    },
  ];

  const moveTarget = moveTargetMap[activeTab];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建项目
        </Button>
        {selectedRowKeys.length > 0 && moveTarget && (
          <Alert
            type="info"
            style={{ padding: '4px 12px', flex: 1 }}
            message={
              <Space>
                <span>已选 <strong>{selectedRowKeys.length}</strong> 个项目</span>
                <Popconfirm
                  title={`确定将 ${selectedRowKeys.length} 个项目移动到「${labelMap[moveTarget]}」吗？`}
                  onConfirm={() => handleBatchMoveTo(moveTarget)}
                  okText="确定移动"
                  cancelText="取消"
                >
                  <Button size="small" type="primary" icon={<ArrowRightOutlined />}>
                    批量移动到{labelMap[moveTarget].replace('的项目', '').replace('项目', '')}
                  </Button>
                </Popconfirm>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>
                  取消选择
                </Button>
              </Space>
            }
          />
        )}
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
      />
      <ProjectModal
        visible={modalVisible}
        project={currentProject}
        onCancel={() => {
          setModalVisible(false);
          setCurrentProject(null);
        }}
        onFinish={handleModalFinish}
      />
      <ProjectDetailDrawer
        project={detailProject}
        projectStatus={detailProject ? activeTab : null}
        visible={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setDetailProject(null);
        }}
      />
    </>
  );
};

export default ProjectSection;
