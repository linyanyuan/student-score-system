import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import MainLayout from './components/MainLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import ClassManage from './pages/ClassManage'
import SubjectManage from './pages/SubjectManage'
import TeacherClassManage from './pages/TeacherClassManage'
import StudentManage from './pages/StudentManage'
import ExamManage from './pages/ExamManage'
import ScoreManage from './pages/ScoreManage'
import SeatManage from './pages/SeatManage'
import SchoolManage from './pages/SchoolManage'
import AccountManage from './pages/AccountManage'
import ScheduleManage from './pages/ScheduleManage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/schools" element={<SchoolManage />} />
              <Route path="/accounts" element={<AccountManage />} />
              <Route path="/classes" element={<ClassManage />} />
              <Route path="/subjects" element={<SubjectManage />} />
              <Route path="/teacher-classes" element={<TeacherClassManage />} />
              <Route path="/students" element={<StudentManage />} />
              <Route path="/exams" element={<ExamManage />} />
              <Route path="/scores" element={<ScoreManage />} />
              <Route path="/seats" element={<SeatManage />} />
              <Route path="/schedule-manage" element={<ScheduleManage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
