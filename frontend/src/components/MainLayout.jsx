import { useState } from 'react'
import { Layout, Menu, Button, Typography, Modal } from 'antd'
import {
  HomeOutlined,
  TeamOutlined,
  BookOutlined,
  UserSwitchOutlined,
  FormOutlined,
  SolutionOutlined,
  FileTextOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  ReadOutlined,
  TableOutlined,
  BankOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout

const allMenuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页', roles: ['admin', 'school_admin', 'teacher', 'student'] },
  { key: '/schools', icon: <BankOutlined />, label: '学校管理', roles: ['admin'] },
  { key: '/accounts', icon: <UserOutlined />, label: '账户管理', roles: ['admin'] },
  { key: '/classes', icon: <TeamOutlined />, label: '班级管理', roles: ['school_admin'] },
  { key: '/subjects', icon: <BookOutlined />, label: '科目管理', roles: ['school_admin'] },
  { key: '/exams', icon: <FileTextOutlined />, label: '考试管理', roles: ['school_admin'] },
  { key: '/teacher-classes', icon: <UserSwitchOutlined />, label: '教师管理', roles: ['school_admin'] },
  { key: '/custom-fields', icon: <FormOutlined />, label: '自定义字段', roles: ['school_admin'] },
  { key: '/students', icon: <SolutionOutlined />, label: '学生管理', roles: ['school_admin', 'teacher'] },
  { key: '/scores', icon: <BarChartOutlined />, label: '成绩管理', roles: ['school_admin', 'teacher', 'student'] },
  { key: '/seats', icon: <TableOutlined />, label: '座位管理', roles: ['teacher'] },
  { key: '/schedule-manage', icon: <TableOutlined />, label: '排课管理', roles: ['school_admin'] },
]

const roleLabel = {
  admin: '管理员',
  school_admin: '学校管理员',
  teacher: '教师',
  student: '学生',
}

function normalizeRole(value) {
  const raw = String(value || '').trim()
  const lowered = raw.toLowerCase()
  if (lowered === 'school_admin' || lowered === 'school-admin' || lowered === 'schooladmin' || lowered === 'school admin') {
    return 'school_admin'
  }
  if (raw === '学校管理员') {
    return 'school_admin'
  }
  if (lowered === 'admin' || raw === '管理员') {
    return 'admin'
  }
  if (lowered === 'teacher' || raw === '教师') {
    return 'teacher'
  }
  if (lowered === 'student' || raw === '学生') {
    return 'student'
  }
  return lowered
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const normalizedRole = normalizeRole(user?.role)

  const menuItems = allMenuItems
    .filter((item) => item.roles.includes(normalizedRole))
    .map(({ key, icon, label }) => ({ key, icon, label }))

  return (
    <Layout className="workspace-shell">
      <Sider className="workspace-sider" trigger={null} collapsible 
        collapsed={collapsed}>
        <div className={`workspace-sider-brand${collapsed ? ' is-collapsed' : ''}`}>
          <ReadOutlined className="workspace-sider-logo" />
          {!collapsed && <span>学生成绩管理系统</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="workspace-sider-menu"
        />
      </Sider>
      <Layout className="workspace-main">
        <Header className="workspace-topbar">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="workspace-topbar-trigger"
          />
          <div className="workspace-topbar-actions">
            <Typography.Text className="workspace-topbar-user">
              {user?.username} ({roleLabel[normalizedRole] || user?.role})
            </Typography.Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              className="workspace-topbar-logout"
              onClick={() => {
                Modal.confirm({
                  title: '退出系统',
                  content: '确定要退出系统吗？',
                  okText: '确定',
                  cancelText: '取消',
                  onOk: logout,
                })
              }}
            >
              退出
            </Button>
          </div>
        </Header>
        <Content className="workspace-content-shell">
          <div className="workspace-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
