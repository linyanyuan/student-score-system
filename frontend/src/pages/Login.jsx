import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Title } = Typography

export default function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const onFinish = async (values) => {
    setLoading(true)
    const hideLoading = message.loading('登录中...', 0)
    try {
      await login(values.username, values.password)
      hideLoading()
      message.success('登录成功', 2)
      navigate('/', { replace: true })
    } catch (err) {
      hideLoading()
      // 判断错误类型
      if (!err.response) {
        // 网络错误
        message.error('网络连接失败，请检查网络后重试', 2)
      } else if (err.response?.status === 401 || err.response?.status === 400) {
        // 认证错误
        message.error('账号或密码错误，请重新输入', 2)
      } else {
        // 其他错误
        message.error('登录失败，请稍后重试', 2)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 30 }}>
          学生成绩管理系统
        </Title>
        <Form onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
