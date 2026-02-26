import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, message, Row, Col } from 'antd';
import type { Project } from '../types';
import { generateId } from '../types';

interface ProjectModalProps {
  visible: boolean;
  project?: Project | null;
  onCancel: () => void;
  onFinish: (project: Project) => void;
}

const ProjectModal: React.FC<ProjectModalProps> = (props) => {
  const { visible, project, onCancel, onFinish } = props;
  const [form] = Form.useForm();
  const isEdit = !!project;

  useEffect(() => {
    if (visible) {
      if (project) {
        form.setFieldsValue(project);
      } else {
        form.resetFields();
      }
    }
  }, [visible, project, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const newProject: Project = {
        id: project?.id || generateId(),
        index: values.index,
        name: values.name,
        nextDelivery: values.nextDelivery || '',
        tester: values.tester || '',
        engineEngineer: values.engineEngineer || '',
        developer: values.developer || '',
        engineDeveloper: values.engineDeveloper || '',
        hardwareLeader: values.hardwareLeader || '',
        productManager: values.productManager || '',
        pm: values.pm || '',
        business: values.business || '',
        contact: values.contact || '',
        supplier: values.supplier || '',
        amount: values.amount || '',
        createdAt: project?.createdAt || new Date().toISOString(),
      };
      onFinish(newProject);
      message.success(isEdit ? '编辑成功' : '新建成功');
      form.resetFields();
    });
  };

  return (
    <Modal
      title={isEdit ? '编辑项目' : '新建项目'}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={800}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="index"
              label="编号"
              rules={[{ required: true, message: '请输入编号' }]}
            >
              <InputNumber placeholder="请输入编号" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item
              name="name"
              label="项目名称"
              rules={[{ required: true, message: '请输入项目名称' }]}
            >
              <Input placeholder="请输入项目名称" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="nextDelivery" label="下一个交付节点">
              <Input placeholder="请输入下一个交付节点" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="tester" label="测试人员">
              <Input placeholder="请输入测试人员" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="engineEngineer" label="工程引擎人员">
              <Input placeholder="请输入工程引擎人员" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="developer" label="研发人员">
              <Input placeholder="请输入研发人员" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="engineDeveloper" label="工程开发人员">
              <Input placeholder="请输入工程开发人员" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="hardwareLeader" label="硬件负责人">
              <Input placeholder="请输入硬件负责人" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="productManager" label="产品人员">
              <Input placeholder="请输入产品人员" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="pm" label="PM">
              <Input placeholder="请输入PM" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="business" label="商务">
              <Input placeholder="请输入商务" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="contact" label="对接人">
              <Input placeholder="请输入对接人" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="supplier" label="供应商">
              <Input placeholder="请输入供应商" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="amount" label="金额">
              <Input placeholder="请输入金额" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default ProjectModal;
