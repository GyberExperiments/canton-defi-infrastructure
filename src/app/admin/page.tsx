/**
 * 📊 Admin Dashboard Page
 * Главная страница админ-панели с реальной статистикой
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import DashboardContent from './DashboardContent';

// Принудительно делаем страницу динамической
export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminLayout user={session.user}>
      <DashboardContent />
    </AdminLayout>
  );
}



