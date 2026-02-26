import React, { useState } from 'react';
import { Button, Space, Popconfirm, message, Table, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Project, ProjectStatus, ProjectCollection } from '../types';
import ProjectModal from '../modals/ProjectModal';

interface ProjectSectionProps {
  projects: ProjectCollection;
  onChange: (projects: ProjectCollection) => void;
}

const ProjectSection: React.FC<ProjectSectionProps> = (props) => {
  const { projects, onChange } = props;
  const [activeTab, setActiveTab] = useState<ProjectStatus>('inProgress');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

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
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Project) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <Popconfirm
            title="确定删除这个项目吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'inProgress',
      label: '进行中的项目',
      children: (
        <Table
          columns={columns}
          dataSource={projects.inProgress}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1800 }}
        />
      ),
    },
    {
      key: 'delivered',
      label: '已交付的项目',
      children: (
        <Table
          columns={columns}
          dataSource={projects.delivered}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1800 }}
        />
      ),
    },
    {
      key: 'accepted',
      label: '已验收项目',
      children: (
        <Table
          columns={columns}
          dataSource={projects.accepted}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1800 }}
        />
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新建项目
        </Button>
      </div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ProjectStatus)}
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
    </>
  );
};

export default ProjectSection;
