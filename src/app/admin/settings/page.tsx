/**
 * ⚙️ Admin Settings Page
 * Настройки системы OTC обменника
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import SettingsPageContent from './SettingsPageContent';

// Принудительно делаем страницу динамической
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const session = await auth();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminLayout user={session.user}>
      <SettingsPageContent />
    </AdminLayout>
  );
}



