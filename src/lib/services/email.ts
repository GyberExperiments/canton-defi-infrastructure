/**
 * 📧 Email Service
 * Production-ready email sending с Nodemailer
 * Fallback для уведомлений когда Telegram/Intercom не доступны
 */

import { OTCOrder } from '@/config/otc';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

class EmailService {
  private config: EmailConfig | null = null;
  private transporter: any = null;
  
  constructor() {
    this.initializeConfig();
  }
  
  private initializeConfig() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM;
    
    if (!host || !port || !user || !password || !from) {
      console.warn('📧 Email service not configured (stub mode)');
      return;
    }
    
    this.config = {
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      user,
      password,
      from
    };
    
    console.log('📧 Email service configured:', {
      host,
      port,
      from,
      secure: this.config.secure
    });
  }
  
  /**
   * Ленивая инициализация transporter
   */
  private async getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }
    
    if (!this.config) {
      throw new Error('Email service not configured');
    }
    
    try {
      // Динамический импорт nodemailer
      const nodemailer = await import('nodemailer');
      
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.password
        }
      });
      
      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email transporter initialized and verified');
      
      return this.transporter;
    } catch (error) {
      console.error('❌ Failed to initialize email transporter:', error);
      throw error;
    }
  }
  
  /**
   * Отправка уведомления о статусе заявки
   */
  async sendStatusUpdate(
    order: OTCOrder,
    status: string,
    message: string
  ): Promise<boolean> {
    // Stub mode - только логируем
    if (!this.config) {
      console.log('📧 Email service (stub) - would send:', {
        to: order.email,
        subject: `Canton OTC - Order ${order.orderId} - ${status}`,
        message: message.substring(0, 100) + '...'
      });
      return false;
    }
    
    try {
      const transporter = await this.getTransporter();
      
      const exchangeDirection = (order as unknown as { exchangeDirection?: 'buy' | 'sell' }).exchangeDirection || 'buy';
      const isBuying = exchangeDirection === 'buy';
      
      const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 20px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; }
    .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏛️ Canton OTC Exchange</h1>
    </div>
    
    <div class="content">
      <h2>✅ Ваша заявка принята!</h2>
      
      <p><strong>Order ID:</strong> ${order.orderId}</p>
      <p><strong>Статус:</strong> ${status}</p>
      
      <p><strong>Детали:</strong></p>
      <ul>
        <li><strong>Тип:</strong> ${isBuying ? 'Покупка' : 'Продажа'} Canton Coin</li>
        <li><strong>Сумма:</strong> $${order.paymentAmountUSD || order.usdtAmount || 0} USDT</li>
        <li><strong>Canton Amount:</strong> ${order.cantonAmount} CC</li>
      </ul>
      
      <p>${message}</p>
      
      <p style="margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/order/${order.orderId}" class="button">
          Просмотреть заявку
        </a>
      </p>
    </div>
    
    <div class="footer">
      <p>Canton OTC Exchange - Безопасный обмен Canton Coin</p>
      <p>Если у вас есть вопросы, свяжитесь с нами через чат поддержки</p>
    </div>
  </div>
</body>
</html>
      `.trim();
      
      const mailOptions = {
        from: this.config.from,
        to: order.email,
        subject: `Canton OTC - Order ${order.orderId} - ${status}`,
        text: message, // Plain text fallback
        html: emailContent
      };
      
      await transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully:', {
        to: order.email,
        orderId: order.orderId,
        status
      });
      
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', {
        orderId: order.orderId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Проверка доступности сервиса
   */
  isAvailable(): boolean {
    return this.config !== null;
  }
  
  /**
   * Тест подключения
   */
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      console.log('📧 Email service not configured');
      return false;
    }
    
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      console.log('✅ Email service connection successful');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
export default emailService;
