import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/MainLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import ClassManage from './pages/ClassManage'
import SubjectManage from './pages/SubjectManage'
import TeacherClassManage from './pages/TeacherClassManage'
import CustomFieldManage from './pages/CustomFieldManage'
import StudentManage from './pages/StudentManage'
import ExamManage from './pages/ExamManage'
import ScoreManage from './pages/ScoreManage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/classes" element={<ClassManage />} />
              <Route path="/subjects" element={<SubjectManage />} />
              <Route path="/teacher-classes" element={<TeacherClassManage />} />
              <Route path="/custom-fields" element={<CustomFieldManage />} />
              <Route path="/students" element={<StudentManage />} />
              <Route path="/exams" element={<ExamManage />} />
              <Route path="/scores" element={<ScoreManage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
