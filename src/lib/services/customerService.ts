/**
 * 👥 Customer Service - CRM функционал
 * Управление клиентами, история, аналитика
 */

import { googleSheetsService } from './googleSheets';
import type { OTCOrder } from '@/config/otc';

export interface CustomerProfile {
  email: string;
  totalOrders: number;
  totalVolume: number; // Total USD spent
  averageOrderValue: number;
  lifetimeValue: number; // LTV
  firstOrderDate: number;
  lastOrderDate: number;
  status: 'new' | 'active' | 'vip' | 'inactive';
  completedOrders: number;
  failedOrders: number;
  contactInfo: {
    whatsapp?: string;
    telegram?: string;
  };
  cantonAddresses: string[]; // All addresses used
  preferredTokens: string[]; // Most used tokens
}

export interface CustomerInteraction {
  timestamp: number;
  type: 'order_created' | 'order_completed' | 'order_failed' | 'support_contact';
  orderId?: string;
  note?: string;
}

class CustomerService {
  /**
   * Get customer profile by email
   */
  async getCustomerProfile(email: string): Promise<CustomerProfile | null> {
    try {
      const allRows = await googleSheetsService.getAllOrders();
      const orders = allRows
        .map(row => googleSheetsService['parseRowToOrder'](row))
        .filter(o => o !== null && o.email.toLowerCase() === email.toLowerCase()) as OTCOrder[];

      if (orders.length === 0) {
        return null;
      }

      // Calculate metrics
      const totalOrders = orders.length;
      const completedOrders = orders.filter(o => o.status === 'completed').length;
      const failedOrders = orders.filter(o => o.status === 'failed').length;
      
      const totalVolume = orders.reduce((sum, o) => sum + (o.paymentAmountUSD || o.usdtAmount || 0), 0);
      const averageOrderValue = totalVolume / totalOrders;
      
      const sortedOrders = [...orders].sort((a, b) => a.timestamp - b.timestamp);
      const firstOrderDate = sortedOrders[0].timestamp;
      const lastOrderDate = sortedOrders[sortedOrders.length - 1].timestamp;

      // Determine status
      const daysSinceLastOrder = (Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24);
      let status: CustomerProfile['status'] = 'new';
      if (totalVolume >= 10000) status = 'vip';
      else if (daysSinceLastOrder > 30) status = 'inactive';
      else if (totalOrders >= 3) status = 'active';

      // Extract contact info
      const contactInfo: CustomerProfile['contactInfo'] = {};
      const whatsapp = orders.find(o => o.whatsapp)?.whatsapp;
      const telegram = orders.find(o => o.telegram)?.telegram;
      if (whatsapp) contactInfo.whatsapp = whatsapp;
      if (telegram) contactInfo.telegram = telegram;

      // Canton addresses and tokens
      const cantonAddresses = Array.from(new Set(orders.map(o => o.cantonAddress)));
      const preferredTokens = Array.from(new Set(orders.map(o => o.paymentToken?.symbol || 'USDT')));

      return {
        email,
        totalOrders,
        totalVolume,
        averageOrderValue,
        lifetimeValue: totalVolume, // Same as total volume for now
        firstOrderDate,
        lastOrderDate,
        status,
        completedOrders,
        failedOrders,
        contactInfo,
        cantonAddresses,
        preferredTokens
      };
    } catch (error) {
      console.error('Failed to get customer profile:', error);
      return null;
    }
  }

  /**
   * Get all customer profiles with pagination
   */
  async getAllCustomers(options: {
    page?: number;
    limit?: number;
    sortBy?: 'totalVolume' | 'totalOrders' | 'lastOrderDate';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ customers: CustomerProfile[]; total: number; page: number; totalPages: number }> {
    try {
      const allRows = await googleSheetsService.getAllOrders();
      const orders = allRows
        .map(row => googleSheetsService['parseRowToOrder'](row))
        .filter(o => o !== null) as OTCOrder[];

      // Group by email
      const customerMap = new Map<string, OTCOrder[]>();
      orders.forEach(order => {
        const email = order.email.toLowerCase();
        if (!customerMap.has(email)) {
          customerMap.set(email, []);
        }
        customerMap.get(email)!.push(order);
      });

      // Build profiles
      const customers: CustomerProfile[] = [];
      for (const [email, customerOrders] of customerMap.entries()) {
        const profile = await this.buildProfileFromOrders(email, customerOrders);
        customers.push(profile);
      }

      // Sort
      const sortBy = options.sortBy || 'totalVolume';
      const sortOrder = options.sortOrder || 'desc';
      customers.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
      });

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const startIndex = (page - 1) * limit;
      const paginatedCustomers = customers.slice(startIndex, startIndex + limit);

      return {
        customers: paginatedCustomers,
        total: customers.length,
        page,
        totalPages: Math.ceil(customers.length / limit)
      };
    } catch (error) {
      console.error('Failed to get all customers:', error);
      return { customers: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(): Promise<{
    totalCustomers: number;
    newCustomersThisMonth: number;
    vipCustomers: number;
    inactiveCustomers: number;
    averageLTV: number;
    topCustomers: CustomerProfile[];
  }> {
    try {
      const { customers } = await this.getAllCustomers({ limit: 10000 });

      const now = Date.now();
      const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

      const newCustomersThisMonth = customers.filter(
        c => c.firstOrderDate >= oneMonthAgo
      ).length;

      const vipCustomers = customers.filter(c => c.status === 'vip').length;
      const inactiveCustomers = customers.filter(c => c.status === 'inactive').length;

      const totalLTV = customers.reduce((sum, c) => sum + c.lifetimeValue, 0);
      const averageLTV = customers.length > 0 ? totalLTV / customers.length : 0;

      const topCustomers = [...customers]
        .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
        .slice(0, 10);

      return {
        totalCustomers: customers.length,
        newCustomersThisMonth,
        vipCustomers,
        inactiveCustomers,
        averageLTV,
        topCustomers
      };
    } catch (error) {
      console.error('Failed to get customer analytics:', error);
      return {
        totalCustomers: 0,
        newCustomersThisMonth: 0,
        vipCustomers: 0,
        inactiveCustomers: 0,
        averageLTV: 0,
        topCustomers: []
      };
    }
  }

  /**
   * Build profile from orders (helper)
   */
  private buildProfileFromOrders(email: string, orders: OTCOrder[]): CustomerProfile {
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const failedOrders = orders.filter(o => o.status === 'failed').length;
    
    const totalVolume = orders.reduce((sum, o) => sum + (o.paymentAmountUSD || o.usdtAmount || 0), 0);
    const averageOrderValue = totalVolume / totalOrders;
    
    const sortedOrders = [...orders].sort((a, b) => a.timestamp - b.timestamp);
    const firstOrderDate = sortedOrders[0].timestamp;
    const lastOrderDate = sortedOrders[sortedOrders.length - 1].timestamp;

    const daysSinceLastOrder = (Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24);
    let status: CustomerProfile['status'] = 'new';
    if (totalVolume >= 10000) status = 'vip';
    else if (daysSinceLastOrder > 30) status = 'inactive';
    else if (totalOrders >= 3) status = 'active';

    const contactInfo: CustomerProfile['contactInfo'] = {};
    const whatsapp = orders.find(o => o.whatsapp)?.whatsapp;
    const telegram = orders.find(o => o.telegram)?.telegram;
    if (whatsapp) contactInfo.whatsapp = whatsapp;
    if (telegram) contactInfo.telegram = telegram;

    const cantonAddresses = Array.from(new Set(orders.map(o => o.cantonAddress)));
    const preferredTokens = Array.from(new Set(orders.map(o => o.paymentToken?.symbol || 'USDT')));

    return {
      email,
      totalOrders,
      totalVolume,
      averageOrderValue,
      lifetimeValue: totalVolume,
      firstOrderDate,
      lastOrderDate,
      status,
      completedOrders,
      failedOrders,
      contactInfo,
      cantonAddresses,
      preferredTokens
    };
  }
}

// Export singleton
export const customerService = new CustomerService();
export default customerService;



