/**
 * ⚠️ LEGACY MODE
 * Google Sheets используется только для backward compatibility
 * PRIMARY STORAGE: Supabase (см. create-order/route.ts)
 * 
 * НЕ используйте этот сервис для критичных операций!
 * 
 * 📊 Real Google Sheets Integration
 * Production-ready service for logging OTC orders
 */

import { google, sheets_v4 } from 'googleapis';
import type { OTCOrder } from '@/config/otc';
import { SUPPORTED_TOKENS } from '@/config/otc';

interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
  sheetName: string;
}

class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private config: GoogleSheetsConfig | null = null;

  constructor() {
    this.initializeConfig();
  }

  private initializeConfig() {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    // ✅ ИСПРАВЛЕНИЕ: Улучшенная обработка приватного ключа для Kubernetes
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      // Обрабатываем различные форматы переносов строк
      privateKey = privateKey
        .replace(/\\n/g, '\n')           // Стандартные \n
        .replace(/\\\\n/g, '\n')         // Двойные \\n
        .replace(/\r\n/g, '\n')          // Windows \r\n
        .replace(/\r/g, '\n')            // Mac \r
        .trim();                         // Убираем лишние пробелы
    }
    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Лист1';

    // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА отсутствующих переменных
    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Google Sheets конфигурация отсутствует!');
      console.error('❌ Отсутствующие переменные окружения:', {
        GOOGLE_SHEET_ID: {
          present: !!spreadsheetId,
          value: spreadsheetId ? `${spreadsheetId.substring(0, 10)}...` : 'ОТСУТСТВУЕТ'
        },
        GOOGLE_SERVICE_ACCOUNT_EMAIL: {
          present: !!serviceAccountEmail,
          value: serviceAccountEmail ? `${serviceAccountEmail.substring(0, 20)}...` : 'ОТСУТСТВУЕТ'
        },
        GOOGLE_PRIVATE_KEY: {
          present: !!privateKey,
          length: privateKey ? privateKey.length : 0,
          hasBeginMarker: privateKey ? privateKey.includes('-----BEGIN PRIVATE KEY-----') : false,
          hasEndMarker: privateKey ? privateKey.includes('-----END PRIVATE KEY-----') : false
        },
        GOOGLE_SHEET_NAME: sheetName
      });
      console.error('⚠️ Google Sheets сервис будет отключен. Ордера НЕ будут сохраняться в таблицу!');
      return;
    }

    // ✅ ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ: Проверяем формат приватного ключа
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Неверный формат приватного ключа!');
      console.error('❌ Отсутствуют маркеры BEGIN/END в приватном ключе');
      console.error('❌ Превью ключа (первые 150 символов):', privateKey.substring(0, 150));
      console.error('❌ Длина ключа:', privateKey.length, 'символов');
      console.error('⚠️ Google Sheets сервис будет отключен. Ордера НЕ будут сохраняться в таблицу!');
      return;
    }

    this.config = {
      spreadsheetId,
      serviceAccountEmail,
      privateKey,
      sheetName,
    };

    console.log('✅ Google Sheets конфигурация успешно инициализирована:', {
      spreadsheetId: `${spreadsheetId.substring(0, 10)}...`,
      sheetName,
      serviceAccountEmail: `${serviceAccountEmail.substring(0, 20)}...`,
      privateKeyLength: privateKey.length
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.config) {
      const error = new Error('Google Sheets not configured - credentials missing');
      console.error('❌ Попытка аутентификации без конфигурации');
      throw error;
    }

    try {
      console.log('🔐 Аутентификация с Google Sheets API...');
      console.log('🔐 Service Account Email:', this.config.serviceAccountEmail);
      console.log('🔐 Spreadsheet ID:', this.config.spreadsheetId);
      console.log('🔐 Sheet Name:', this.config.sheetName);
      console.log('🔐 Private Key Format Valid:', this.config.privateKey.includes('-----BEGIN PRIVATE KEY-----'));

      const auth = new google.auth.JWT({
        email: this.config.serviceAccountEmail,
        key: this.config.privateKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      console.log('🔐 Выполняется авторизация...');
      await auth.authorize();
      this.sheets = google.sheets({ version: 'v4', auth });
      console.log('✅ Google Sheets аутентификация успешна');
    } catch (error) {
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Google Sheets аутентификация провалилась!');
      console.error('❌ Детали ошибки:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        code: (error as Record<string, unknown>)?.code,
        library: (error as Record<string, unknown>)?.library,
        reason: (error as Record<string, unknown>)?.reason,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Дополнительная диагностика для типичных ошибок
      if (error instanceof Error) {
        if (error.message.includes('invalid_grant') || error.message.includes('Invalid credentials')) {
          console.error('❌ ПРОБЛЕМА: Неверные credentials (проверьте Service Account email и private key)');
        } else if (error.message.includes('permission') || error.message.includes('access')) {
          console.error('❌ ПРОБЛЕМА: Проблемы с доступом (проверьте что Service Account имеет доступ к таблице)');
        } else if (error.message.includes('spreadsheet') || error.message.includes('not found')) {
          console.error('❌ ПРОБЛЕМА: Таблица не найдена (проверьте GOOGLE_SHEET_ID)');
        }
      }

      throw error;
    }
  }

  /**
   * Save order to Google Sheets
   * ⚠️ LEGACY MODE: Supabase is primary storage
   */
  async saveOrder(order: OTCOrder): Promise<boolean> {
    console.warn('⚠️ [LEGACY] Google Sheets save - Supabase is primary storage');
    
    try {
      // 🔍 ДЕТАЛЬНАЯ ДИАГНОСТИКА: Проверяем конфигурацию перед попыткой сохранения
      if (!this.config) {
        console.warn('⚠️ Google Sheets не настроен (legacy, non-critical):', order.orderId);
        console.warn('⚠️ Отсутствующие переменные окружения:', {
          GOOGLE_SHEET_ID: !!process.env.GOOGLE_SHEET_ID,
          GOOGLE_SERVICE_ACCOUNT_EMAIL: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
          GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME || 'Лист1 (default)'
        });
        return false; // Не кидаем ошибку, это legacy
      }

      console.log('🔍 Начинаем сохранение ордера в Google Sheets:', {
        orderId: order.orderId,
        spreadsheetId: this.config.spreadsheetId,
        sheetName: this.config.sheetName,
        serviceAccountEmail: this.config.serviceAccountEmail
      });

      await this.authenticate();

      if (!this.sheets) {
        console.error('❌ Google Sheets client не инициализирован после аутентификации');
        throw new Error('Failed to initialize Google Sheets client');
      }

      // Prepare row data with unique address support
      const rowData = [
        order.orderId,
        new Date(order.timestamp).toISOString(),
        order.usdtAmount || order.paymentAmountUSD || 0, // Use legacy field or new field
        order.cantonAmount,
        order.cantonAddress,
        order.refundAddress || '',
        order.email,
        order.whatsapp || '',
        order.telegram || '',
        order.status,
        order.txHash || '',
        new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }), // GMT+3
        // NEW FIELDS for unique addresses
        (order as OTCOrder & { uniqueAddress?: string }).uniqueAddress || '', // Unique payment address
        (order as OTCOrder & { addressPath?: string }).addressPath || '', // HD wallet path
        (order as OTCOrder & { paymentToken?: { network: string } }).paymentToken?.network || 'TRON', // Payment network
        (order as OTCOrder & { paymentToken?: { symbol: string } }).paymentToken?.symbol || 'USDT' // Payment token
      ];

      console.log('📝 Подготовлены данные для сохранения:', {
        orderId: order.orderId,
        rowDataLength: rowData.length,
        range: `${this.config.sheetName}!A:P`
      });

      // 🔧 ИСПРАВЛЕНИЕ: Находим последнюю заполненную строку в колонке A для корректной записи
      // Это гарантирует, что данные всегда записываются последовательно, 
      // даже если в таблице есть данные в других колонках (например, справа)
      const lastRowResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:A`, // Проверяем только колонку A
      });

      const rows = lastRowResponse.data.values || [];
      // Находим последнюю непустую строку с данными (пропускаем заголовок если есть)
      let lastRowIndex = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        const cellValue = rows[i] && rows[i][0] ? rows[i][0].toString().trim() : '';
        // Пропускаем заголовок (обычно "Order ID") и пустые строки
        // Если значение не пустое и не "Order ID", то это строка с данными
        if (cellValue !== '' && cellValue.toLowerCase() !== 'order id') {
          lastRowIndex = i + 1; // +1 потому что строки начинаются с 1 в Google Sheets
          break;
        }
      }

      // Если не нашли строку с данными, значит таблица пустая (только заголовок в строке 1)
      // Записываем в строку 2
      // Если lastRowIndex = 1 (заголовок), то nextRowIndex = 2
      const nextRowIndex = lastRowIndex <= 1 ? 2 : lastRowIndex + 1;

      // Записываем в конкретную строку (а не используем append, который может найти неправильную строку)
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A${nextRowIndex}:P${nextRowIndex}`, // Конкретная строка от A до P
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData],
        },
      });

      console.log('✅ Ордер успешно сохранен в Google Sheets:', {
        orderId: order.orderId,
        updatedCells: response.data.updatedCells,
        updatedRange: response.data.updatedRange,
        spreadsheetId: response.data.spreadsheetId,
        rowIndex: nextRowIndex
      });
      return true;

    } catch (error) {
      // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ОШИБОК для диагностики
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА при сохранении в Google Sheets:', {
        orderId: order.orderId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        configPresent: !!this.config,
        configDetails: this.config ? {
          spreadsheetId: this.config.spreadsheetId,
          sheetName: this.config.sheetName,
          serviceAccountEmail: this.config.serviceAccountEmail,
          privateKeyPresent: !!this.config.privateKey,
          privateKeyLength: this.config.privateKey?.length
        } : null,
        googleApiError: error && typeof error === 'object' && 'code' in error ? {
          code: (error as any).code,
          message: (error as any).message,
          response: (error as any).response?.data
        } : null
      });
      // Don't throw error - continue processing even if sheets fail
      return false;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string, txHash?: string): Promise<boolean> {
    try {
      if (!this.config || !this.sheets) {
        console.log('📊 Google Sheets disabled - cannot update status');
        return false;
      }

      await this.authenticate();

      // Find row by order ID
      const searchResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:K`,
      });

      const rows = searchResponse.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === orderId);

      if (rowIndex === -1) {
        console.error('❌ Order not found in sheets:', orderId);
        return false;
      }

      // Update status (column J) and txHash (column K) if provided
      const updates: Array<{ range: string; values: string[][] }> = [];
      
      updates.push({
        range: `${this.config.sheetName}!J${rowIndex + 1}`, // Status column
        values: [[status]]
      });

      if (txHash) {
        updates.push({
          range: `${this.config.sheetName}!K${rowIndex + 1}`, // TxHash column
          values: [[txHash]]
        });
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });

      console.log('📊 Order status updated in Google Sheets:', orderId, status);
      return true;

    } catch (error) {
      console.error('❌ Failed to update status in Google Sheets:', error);
      return false;
    }
  }

  /**
   * Initialize sheet with headers (run once)
   */
  async initializeSheet(): Promise<void> {
    try {
      if (!this.config) {
        console.log('📊 Google Sheets disabled');
        return;
      }

      await this.authenticate();

      if (!this.sheets) {
        throw new Error('Failed to initialize Google Sheets client');
      }

      const headers = [
        'Order ID',
        'Timestamp',
        'USDT Amount',
        'Canton Amount', 
        'Canton Address',
        'Refund Address',
        'Email',
        'WhatsApp',
        'Telegram',
        'Status',
        'TX Hash',
        'Created At (GMT+3)',
        // NEW HEADERS for unique addresses
        'Unique Payment Address',
        'HD Wallet Path',
        'Payment Network',
        'Payment Token'
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A1:P1`, // Extended to P column
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });

      console.log('📊 Google Sheets initialized with headers');

    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Get all orders from sheet
   */
  async getAllOrders(): Promise<string[][]> {
    try {
      if (!this.config) {
        return [];
      }

      await this.authenticate();

      if (!this.sheets) {
        return [];
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A2:P`, // Skip header row, extended to P column
      });

      return response.data.values || [];

    } catch (error) {
      console.error('❌ Failed to get orders from Google Sheets:', error);
      return [];
    }
  }

  /**
   * 📊 Admin Panel Methods - Full CRUD Operations
   */

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<OTCOrder | null> {
    try {
      const rows = await this.getAllOrders();
      const orderRow = rows.find(row => row[0] === orderId);

      if (!orderRow) {
        return null;
      }

      return this.parseRowToOrder(orderRow);
    } catch (error) {
      console.error('❌ Failed to get order by ID:', error);
      return null;
    }
  }

  /**
   * Get orders with pagination and filters
   */
  async getOrdersPaginated(options: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: 'timestamp' | 'usdtAmount';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ orders: OTCOrder[]; total: number; page: number; totalPages: number }> {
    try {
      const rows = await this.getAllOrders();
      let orders = rows.map(row => this.parseRowToOrder(row)).filter(o => o !== null) as OTCOrder[];

      // Apply filters
      if (options.status) {
        orders = orders.filter(o => o.status === options.status);
      }

      if (options.search) {
        const search = options.search.toLowerCase();
        orders = orders.filter(o => 
          o.orderId.toLowerCase().includes(search) ||
          o.email.toLowerCase().includes(search) ||
          o.cantonAddress.toLowerCase().includes(search)
        );
      }

      // Sort
      const sortBy = options.sortBy || 'timestamp';
      const sortOrder = options.sortOrder || 'desc';
      orders.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
      });

      // Pagination
      const page = options.page || 1;
      const limit = options.limit || 20;
      const startIndex = (page - 1) * limit;
      const paginatedOrders = orders.slice(startIndex, startIndex + limit);

      return {
        orders: paginatedOrders,
        total: orders.length,
        page,
        totalPages: Math.ceil(orders.length / limit)
      };
    } catch (error) {
      console.error('❌ Failed to get paginated orders:', error);
      return { orders: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  /**
   * Delete order by ID
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      if (!this.config || !this.sheets) {
        console.error('Google Sheets not configured');
        return false;
      }

      await this.authenticate();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:K`,
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === orderId);

      if (rowIndex === -1) {
        console.error('Order not found:', orderId);
        return false;
      }

      // Delete row using batchUpdate
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.config.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0, // Assuming first sheet
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }]
        }
      });

      console.log('✅ Order deleted:', orderId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete order:', error);
      return false;
    }
  }

  /**
   * Update order details
   */
  async updateOrder(orderId: string, updates: Partial<OTCOrder>): Promise<boolean> {
    try {
      if (!this.config || !this.sheets) {
        return false;
      }

      await this.authenticate();

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:L`,
      });

      const rows = response.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === orderId);

      if (rowIndex === -1) {
        return false;
      }

      const currentRow = rows[rowIndex];
      
      // Update specific columns based on what's provided
      const updateRequests: Array<{ range: string; values: string[][] }> = [];

      if (updates.status) {
        updateRequests.push({
          range: `${this.config.sheetName}!J${rowIndex + 1}`,
          values: [[updates.status]]
        });
      }

      if (updates.txHash) {
        updateRequests.push({
          range: `${this.config.sheetName}!K${rowIndex + 1}`,
          values: [[updates.txHash]]
        });
      }

      if (updates.cantonAddress && updates.cantonAddress !== currentRow[4]) {
        updateRequests.push({
          range: `${this.config.sheetName}!E${rowIndex + 1}`,
          values: [[updates.cantonAddress]]
        });
      }

      if (updateRequests.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.config.spreadsheetId,
          requestBody: {
            valueInputOption: 'RAW',
            data: updateRequests
          }
        });
      }

      console.log('✅ Order updated:', orderId);
      return true;
    } catch (error) {
      console.error('❌ Failed to update order:', error);
      return false;
    }
  }

  /**
   * Get statistics for dashboard
   */
  async getStatistics(): Promise<{
    totalOrders: number;
    totalVolume: number;
    completedOrders: number;
    pendingOrders: number;
    failedOrders: number;
    todayOrders: number;
    todayVolume: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    recentOrders: OTCOrder[];
  }> {
    try {
      const rows = await this.getAllOrders();
      const orders = rows.map(row => this.parseRowToOrder(row)).filter(o => o !== null) as OTCOrder[];

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const todayOrders = orders.filter(o => o.timestamp > oneDayAgo);
      
      const ordersByStatus: Record<string, number> = {};
      orders.forEach(order => {
        ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
      });

      const totalVolume = orders.reduce((sum, o) => sum + (o.paymentAmountUSD || o.usdtAmount || 0), 0);
      const todayVolume = todayOrders.reduce((sum, o) => sum + (o.paymentAmountUSD || o.usdtAmount || 0), 0);

      return {
        totalOrders: orders.length,
        totalVolume,
        completedOrders: orders.filter(o => o.status === 'completed').length,
        pendingOrders: orders.filter(o => o.status !== 'completed' && o.status !== 'failed').length,
        failedOrders: orders.filter(o => o.status === 'failed').length,
        todayOrders: todayOrders.length,
        todayVolume,
        averageOrderValue: orders.length > 0 ? totalVolume / orders.length : 0,
        ordersByStatus,
        recentOrders: orders.slice(0, 10)
      };
    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
      return {
        totalOrders: 0,
        totalVolume: 0,
        completedOrders: 0,
        pendingOrders: 0,
        failedOrders: 0,
        todayOrders: 0,
        todayVolume: 0,
        averageOrderValue: 0,
        ordersByStatus: {},
        recentOrders: []
      };
    }
  }

  /**
   * Add note to existing order
   */
  async addOrderNote(orderId: string, note: string): Promise<boolean> {
    try {
      if (!this.config) {
        console.log('📊 Google Sheets disabled - logging note locally');
        console.log(`📝 Order ${orderId} note: ${note}`);
        return false;
      }

      await this.authenticate();
      
      // Find the order row
      const response = await this.sheets!.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: `${this.config.sheetName}!A:A`,
      });

      const orderIds = response.data.values || [];
      const orderRowIndex = orderIds.findIndex((row: string[]) => row[0] === orderId);
      
      if (orderRowIndex === -1) {
        console.warn(`Order ${orderId} not found in Google Sheets`);
        return false;
      }

      // Add note to the last column (column Q = index 16)
      const noteRange = `${this.config.sheetName}!Q${orderRowIndex + 1}`;
      
      await this.sheets!.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: noteRange,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[note]]
        }
      });

      console.log(`✅ Note added to order ${orderId} in Google Sheets`);
      return true;

    } catch (error) {
      console.error('❌ Failed to add order note:', error);
      return false;
    }
  }

  /**
   * Parse row data to OTCOrder object with unique address support
   */
  private parseRowToOrder(row: string[]): OTCOrder | null {
    try {
      // Row structure: OrderId, Timestamp, UsdtAmount, CantonAmount, CantonAddress, RefundAddress, Email, WhatsApp, Telegram, Status, TxHash, CreatedAt, UniqueAddress, AddressPath, Network, Token
      const [orderId, timestampStr, usdtAmountStr, cantonAmountStr, cantonAddress, refundAddress, email, whatsapp, telegram, status, txHash, , uniqueAddress, addressPath, network, token] = row;

      if (!orderId) return null;

      const timestamp = new Date(timestampStr).getTime();
      const usdtAmount = parseFloat(usdtAmountStr) || 0;
      const cantonAmount = parseFloat(cantonAmountStr) || 0;

      // Get token config - use network and token from row if available
      // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем правильный импорт вместо require
      
      // 🔧 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем что SUPPORTED_TOKENS определен
      if (!SUPPORTED_TOKENS || !Array.isArray(SUPPORTED_TOKENS)) {
        console.error('❌ SUPPORTED_TOKENS is undefined or not an array:', SUPPORTED_TOKENS);
        return null;
      }
      
      let paymentToken = SUPPORTED_TOKENS.find((t: { symbol: string; network: string }) => 
        t.symbol === (token || 'USDT') && t.network === (network || 'TRON')
      );
      
      // Fallback to default USDT TRC-20
      if (!paymentToken) {
        paymentToken = SUPPORTED_TOKENS.find((t: { symbol: string; network: string }) => t.symbol === 'USDT' && t.network === 'TRON');
      }

      const order: OTCOrder = {
        orderId,
        timestamp,
        paymentToken: paymentToken || SUPPORTED_TOKENS[0],
        paymentAmount: usdtAmount,
        paymentAmountUSD: usdtAmount,
        cantonAmount,
        cantonAddress,
        refundAddress: refundAddress || undefined,
        email,
        whatsapp: whatsapp || undefined,
        telegram: telegram || undefined,
        status: (status as import('@/config/otc').OrderStatus) || 'awaiting-deposit',
        txHash: txHash || undefined,
        usdtAmount // Legacy
      };

      // Add unique address fields if available
      if (uniqueAddress) {
        (order as OTCOrder & { uniqueAddress?: string }).uniqueAddress = uniqueAddress;
      }
      if (addressPath) {
        (order as OTCOrder & { addressPath?: string }).addressPath = addressPath;
      }

      return order;
    } catch (error) {
      console.error('Failed to parse row:', error);
      return null;
    }
  }
}

// Export singleton instance
export const googleSheetsService = new GoogleSheetsService();
export default googleSheetsService;
