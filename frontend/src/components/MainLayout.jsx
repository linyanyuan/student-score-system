import { useState } from 'react'
import { Layout, Menu, Button, Typography, theme } from 'antd'
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
} from '@ant-design/icons'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout

const allMenuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页', roles: ['admin', 'teacher', 'student'] },
  { key: '/classes', icon: <TeamOutlined />, label: '班级管理', roles: ['admin'] },
  { key: '/subjects', icon: <BookOutlined />, label: '科目管理', roles: ['admin'] },
  { key: '/teacher-classes', icon: <UserSwitchOutlined />, label: '教师-班级分配', roles: ['admin'] },
  { key: '/custom-fields', icon: <FormOutlined />, label: '自定义字段管理', roles: ['admin'] },
  { key: '/students', icon: <SolutionOutlined />, label: '学生管理', roles: ['admin', 'teacher'] },
  { key: '/exams', icon: <FileTextOutlined />, label: '考试管理', roles: ['admin'] },
  { key: '/scores', icon: <BarChartOutlined />, label: '成绩管理', roles: ['admin', 'teacher', 'student'] },
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { token: { colorBgContainer } } = theme.useToken()

  const menuItems = allMenuItems
    .filter((item) => item.roles.includes(user?.role))
    .map(({ key, icon, label }) => ({ key, icon, label }))

  const roleLabel = user?.role === 'admin' ? '管理员' : user?.role === 'teacher' ? '教师' : '学生'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div style={{ height: 32, margin: 16, color: '#fff', textAlign: 'center', fontSize: collapsed ? 14 : 16, fontWeight: 'bold', lineHeight: '32px', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ReadOutlined style={{ fontSize: 20 }} />
          {!collapsed && '学生成绩管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Typography.Text>{user?.username} ({roleLabel})</Typography.Text>
            <Button type="text" icon={<LogoutOutlined />} onClick={logout}>
              退出
            </Button>
          </div>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: colorBgContainer, borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
