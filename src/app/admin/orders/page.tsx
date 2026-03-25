/**
 * 📦 Admin Orders Page
 * Управление заказами с фильтрацией и редактированием
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import OrdersPageContent from './OrdersPageContent';

// Принудительно делаем страницу динамической
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const session = await auth();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <AdminLayout user={session.user}>
      <OrdersPageContent />
    </AdminLayout>
  );
}



