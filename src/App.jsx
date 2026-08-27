// 应用路由配置
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Login from './pages/Login';
import LayoutWrapper from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Reminders from './pages/Reminders';
import DailyReport from './pages/DailyReport';
import Quotes from './pages/Quotes';
import WeeklyReport from './pages/WeeklyReport';
import Admin from './pages/Admin';
import ClientLogin from './pages/ClientLogin';
import ClientPortal from './pages/ClientPortal';
import Yunwuyun from './pages/Yunwuyun';
import WechatPush from './pages/WechatPush';
import SalesManagement from './pages/SalesManagement';

function App() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <Login />
      } />
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/portal" element={<ClientPortal />} />
      
      {user ? (
        <>
          <Route path="/" element={
            <LayoutWrapper>
              <Dashboard />
            </LayoutWrapper>
          } />
          <Route path="/customers" element={
            <LayoutWrapper>
              <Customers />
            </LayoutWrapper>
          } />
          <Route path="/customers/:id" element={
            <LayoutWrapper>
              <CustomerDetail />
            </LayoutWrapper>
          } />
          <Route path="/reminders" element={
            <LayoutWrapper>
              <Reminders />
            </LayoutWrapper>
          } />
          <Route path="/daily-report" element={
            <LayoutWrapper>
              <DailyReport />
            </LayoutWrapper>
          } />
          <Route path="/quotes" element={
            <LayoutWrapper>
              <Quotes />
            </LayoutWrapper>
          } />
          <Route path="/weekly-report" element={
            <LayoutWrapper>
              <WeeklyReport />
            </LayoutWrapper>
          } />
          <Route path="/admin" element={
            <LayoutWrapper>
              <Admin />
            </LayoutWrapper>
          } />
          <Route path="/yunwuyun" element={
            <LayoutWrapper>
              <Yunwuyun />
            </LayoutWrapper>
          } />
          <Route path="/wechat" element={
            <LayoutWrapper>
              <WechatPush />
            </LayoutWrapper>
          } />
          <Route path="/sales" element={
            <LayoutWrapper>
              <SalesManagement />
            </LayoutWrapper>
          } />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}

export default App;