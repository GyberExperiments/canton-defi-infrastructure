/**
 * 👥 Admin Customers Page (CRM)
 * Управление клиентами
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import CustomersPageContent from './CustomersPageContent';

// Принудительно делаем страницу динамической
export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const session = await auth();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminLayout user={session.user}>
      <CustomersPageContent />
    </AdminLayout>
  );
}



