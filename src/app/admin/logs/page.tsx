/**
 * 📝 Admin Logs Page
 * Мониторинг и логи системы
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import LogsPageContent from './LogsPageContent';

// Принудительно делаем страницу динамической
export const dynamic = 'force-dynamic';

export default async function AdminLogsPage() {
  const session = await auth();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminLayout user={session.user}>
      <LogsPageContent />
    </AdminLayout>
  );
}



