/**
 * 🔍 Centralized Validators
 *
 * Единая система валидации данных для всех endpoints.
 *
 * Функции:
 * - Типизированная валидация
 * - Детальные сообщения об ошибках
 * - Повторное использование валидаторов
 * - Интеграция с ErrorHandler
 */

import { OTCOrder } from '@/config/otc';

/**
 * Результат валидации
 */
export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Базовый валидатор
 */
export abstract class BaseValidator {
  /**
   * Создать ошибку валидации
   */
  protected createError(field: string, message: string): Record<string, string[]> {
    return {
      [field]: [message]
    };
  }

  /**
   * Объединить несколько ошибок
   */
  protected mergeErrors(...errors: (Record<string, string[]> | null)[]): Record<string, string[]> {
    const merged: Record<string, string[]> = {};

    errors.forEach(error => {
      if (error) {
        Object.entries(error).forEach(([field, messages]) => {
          if (!merged[field]) {
            merged[field] = [];
          }
          merged[field].push(...messages);
        });
      }
    });

    return merged;
  }
}

/**
 * Email валидатор
 */
export class EmailValidator extends BaseValidator {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validate(email: string): ValidationResult<string> {
    if (!email || typeof email !== 'string') {
      return {
        valid: false,
        errors: this.createError('email', 'Email is required')
      };
    }

    if (email.length > 255) {
      return {
        valid: false,
        errors: this.createError('email', 'Email is too long (max 255 characters)')
      };
    }

    if (!EmailValidator.EMAIL_REGEX.test(email)) {
      return {
        valid: false,
        errors: this.createError('email', 'Invalid email format')
      };
    }

    return {
      valid: true,
      data: email.toLowerCase()
    };
  }
}

/**
 * Адрес валидатор (для Canton, Ethereum, TRON и других)
 */
export class AddressValidator extends BaseValidator {
  // Canton Network поддерживает несколько форматов
  // 1. HEX::HEX формат (participant_id::party_hint) - САМЫЙ РАСПРОСТРАНЕННЫЙ
  private static readonly CANTON_HEX_HEX_REGEX = /^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$/;
  // 2. Namespace формат с буквенным префиксом (bron::fingerprint)
  private static readonly CANTON_NAMESPACE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$/;
  // 3. Классический формат (name:fingerprint)
  private static readonly CANTON_CLASSIC_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$/;
  // 4. Hex-only формат (чистый fingerprint без разделителя)
  private static readonly CANTON_HEX_REGEX = /^[a-fA-F0-9]{32,80}$/;
  private static readonly ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
  private static readonly TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Z]{33}$/;
  private static readonly SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Z]{43,44}$/;

  validate(address: string, type: 'canton' | 'ethereum' | 'tron' | 'solana' = 'canton'): ValidationResult<string> {
    if (!address || typeof address !== 'string') {
      return {
        valid: false,
        errors: this.createError('address', `${type} address is required`)
      };
    }

    const trimmed = address.trim();

    switch (type) {
      case 'canton':
        // Проверяем все поддерживаемые форматы Canton (в порядке приоритета)
        const isValidCanton = AddressValidator.CANTON_HEX_HEX_REGEX.test(trimmed) ||
                             AddressValidator.CANTON_NAMESPACE_REGEX.test(trimmed) ||
                             AddressValidator.CANTON_CLASSIC_REGEX.test(trimmed) ||
                             AddressValidator.CANTON_HEX_REGEX.test(trimmed);
        if (!isValidCanton) {
          return {
            valid: false,
            errors: this.createError('address', 'Invalid Canton address format')
          };
        }
        break;

      case 'ethereum':
        if (!AddressValidator.ETH_ADDRESS_REGEX.test(trimmed)) {
          return {
            valid: false,
            errors: this.createError('address', 'Invalid Ethereum address format')
          };
        }
        break;

      case 'tron':
        if (!AddressValidator.TRON_ADDRESS_REGEX.test(trimmed)) {
          return {
            valid: false,
            errors: this.createError('address', 'Invalid TRON address format')
          };
        }
        break;

      case 'solana':
        if (!AddressValidator.SOLANA_ADDRESS_REGEX.test(trimmed)) {
          return {
            valid: false,
            errors: this.createError('address', 'Invalid Solana address format')
          };
        }
        break;
    }

    return {
      valid: true,
      data: trimmed
    };
  }
}

/**
 * Количество валидатор
 */
export class AmountValidator extends BaseValidator {
  validate(
    amount: number,
    options: {
      min?: number;
      max?: number;
      decimals?: number;
      fieldName?: string;
    } = {}
  ): ValidationResult<number> {
    const {
      min,
      max,
      decimals = 6,
      fieldName = 'amount'
    } = options;

    if (amount === undefined || amount === null) {
      return {
        valid: false,
        errors: this.createError(fieldName, `${fieldName} is required`)
      };
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      return {
        valid: false,
        errors: this.createError(fieldName, `${fieldName} must be a valid number`)
      };
    }

    if (amount <= 0) {
      return {
        valid: false,
        errors: this.createError(fieldName, `${fieldName} must be greater than 0`)
      };
    }

    if (min !== undefined && amount < min) {
      return {
        valid: false,
        errors: this.createError(fieldName, `${fieldName} must be at least ${min}`)
      };
    }

    if (max !== undefined && amount > max) {
      return {
        valid: false,
        errors: this.createError(fieldName, `${fieldName} must be at most ${max}`)
      };
    }

    // Проверить количество децимальных знаков
    const decimalPart = amount.toString().split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
      return {
        valid: false,
        errors: this.createError(fieldName, `${fieldName} has too many decimal places (max ${decimals})`)
      };
    }

    return {
      valid: true,
      data: amount
    };
  }
}

/**
 * Order Request валидатор
 */
export class OrderValidator extends BaseValidator {
  private emailValidator = new EmailValidator();
  private addressValidator = new AddressValidator();
  private amountValidator = new AmountValidator();

  validateCreateOrder(data: unknown): ValidationResult<Partial<OTCOrder>> {
    const errors: Record<string, string[]> = {};
    
    // Проверяем что data это объект
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: { general: ['Invalid data format'] }
      };
    }
    
    const typedData = data as Record<string, unknown>;

    // Валидация email
    if (typeof typedData.email === 'string') {
      const emailResult = this.emailValidator.validate(typedData.email);
      if (!emailResult.valid) {
        Object.assign(errors, emailResult.errors);
      }
    } else {
      if (!errors['email']) errors['email'] = [];
      errors['email'].push('Email is required');
    }

    // Валидация Canton адреса
    if (typeof typedData.cantonAddress === 'string') {
      const cantonResult = this.addressValidator.validate(typedData.cantonAddress, 'canton');
      if (!cantonResult.valid) {
        Object.assign(errors, cantonResult.errors);
      }
    } else {
      if (!errors['cantonAddress']) errors['cantonAddress'] = [];
      errors['cantonAddress'].push('Canton address is required');
    }

    // Валидация суммы в USDT
    if (typeof typedData.paymentAmount === 'number') {
      const amountResult = this.amountValidator.validate(typedData.paymentAmount, {
        min: 1,
        max: 100000,
        decimals: 6,
        fieldName: 'paymentAmount'
      });
      if (!amountResult.valid) {
        Object.assign(errors, amountResult.errors);
      }
    } else {
      if (!errors['paymentAmount']) errors['paymentAmount'] = [];
      errors['paymentAmount'].push('Payment amount is required');
    }

    // Опциональная валидация refund адреса
    if (typedData.refundAddress && typeof typedData.refundAddress === 'string') {
      const refundResult = this.addressValidator.validate(typedData.refundAddress, 'ethereum');
      if (!refundResult.valid) {
        Object.assign(errors, refundResult.errors);
      }
    }

    // Опциональная валидация контактов
    if (typedData.whatsapp && typeof typedData.whatsapp === 'string' && typedData.whatsapp.length > 20) {
      if (!errors['whatsapp']) errors['whatsapp'] = [];
      errors['whatsapp'].push('WhatsApp is too long');
    }

    if (typedData.telegram && typeof typedData.telegram === 'string' && typedData.telegram.length > 100) {
      if (!errors['telegram']) errors['telegram'] = [];
      errors['telegram'].push('Telegram is too long');
    }

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    // Собираем валидные данные
    const validatedData: Partial<OTCOrder> = {};
    
    if (typeof typedData.email === 'string') {
      validatedData.email = typedData.email;
    }
    
    if (typeof typedData.cantonAddress === 'string') {
      validatedData.cantonAddress = typedData.cantonAddress;
    }
    
    if (typeof typedData.paymentAmount === 'number') {
      validatedData.paymentAmount = typedData.paymentAmount;
    }
    
    if (typeof typedData.refundAddress === 'string') {
      validatedData.refundAddress = typedData.refundAddress;
    }
    
    if (typeof typedData.whatsapp === 'string') {
      validatedData.whatsapp = typedData.whatsapp;
    }
    
    if (typeof typedData.telegram === 'string') {
      validatedData.telegram = typedData.telegram;
    }

    return {
      valid: true,
      data: validatedData
    };
  }

  validateOrderStatus(orderId: string): ValidationResult<string> {
    if (!orderId || typeof orderId !== 'string') {
      return {
        valid: false,
        errors: this.createError('orderId', 'Order ID is required')
      };
    }

    if (orderId.length < 10 || orderId.length > 50) {
      return {
        valid: false,
        errors: this.createError('orderId', 'Invalid order ID format')
      };
    }

    return {
      valid: true,
      data: orderId.trim()
    };
  }
}

/**
 * Admin Settings валидатор
 */
export class AdminSettingsValidator extends BaseValidator {
  private amountValidator = new AmountValidator();

  validateSettingsUpdate(data: unknown): ValidationResult<Record<string, unknown>> {
    const errors: Record<string, string[]> = {};
    const validated: Record<string, unknown> = {};
    
    // Проверяем что data это объект
    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: { general: ['Invalid data format'] }
      };
    }
    
    const typedData = data as Record<string, unknown>;

    // Валидация цен
    if (typedData.cantonCoinBuyPrice !== undefined) {
      if (typeof typedData.cantonCoinBuyPrice === 'number') {
        const priceResult = this.amountValidator.validate(typedData.cantonCoinBuyPrice, {
          min: 0.01,
          max: 1000,
          decimals: 8,
          fieldName: 'cantonCoinBuyPrice'
        });
        if (!priceResult.valid) {
          Object.assign(errors, priceResult.errors);
        } else {
          validated.cantonCoinBuyPrice = priceResult.data;
        }
      } else {
        if (!errors['cantonCoinBuyPrice']) errors['cantonCoinBuyPrice'] = [];
        errors['cantonCoinBuyPrice'].push('Buy price must be a number');
      }
    }

    if (typedData.cantonCoinSellPrice !== undefined) {
      if (typeof typedData.cantonCoinSellPrice === 'number') {
        const priceResult = this.amountValidator.validate(typedData.cantonCoinSellPrice, {
          min: 0.01,
          max: 1000,
          decimals: 8,
          fieldName: 'cantonCoinSellPrice'
        });
        if (!priceResult.valid) {
          Object.assign(errors, priceResult.errors);
        } else {
          validated.cantonCoinSellPrice = priceResult.data;
        }
      } else {
        if (!errors['cantonCoinSellPrice']) errors['cantonCoinSellPrice'] = [];
        errors['cantonCoinSellPrice'].push('Sell price must be a number');
      }
    }

    // Валидация лимитов
    if (typedData.minUsdtAmount !== undefined) {
      if (typeof typedData.minUsdtAmount === 'number') {
        const limitResult = this.amountValidator.validate(typedData.minUsdtAmount, {
          min: 1,
          max: 100000,
          decimals: 2,
          fieldName: 'minUsdtAmount'
        });
        if (!limitResult.valid) {
          Object.assign(errors, limitResult.errors);
        } else {
          validated.minUsdtAmount = limitResult.data;
        }
      } else {
        if (!errors['minUsdtAmount']) errors['minUsdtAmount'] = [];
        errors['minUsdtAmount'].push('Minimum amount must be a number');
      }
    }

    // Валидация email
    if (typedData.supportEmail !== undefined) {
      if (typeof typedData.supportEmail !== 'string' || typedData.supportEmail.length === 0) {
        if (!errors['supportEmail']) errors['supportEmail'] = [];
        errors['supportEmail'].push('Support email is required');
      } else {
        const emailResult = new EmailValidator().validate(typedData.supportEmail);
        if (!emailResult.valid) {
          Object.assign(errors, { supportEmail: ['Invalid support email format'] });
        } else {
          validated.supportEmail = emailResult.data;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      data: validated
    };
  }
}

/**
 * Factory для создания валидаторов
 */
export class ValidatorFactory {
  static createOrderValidator(): OrderValidator {
    return new OrderValidator();
  }

  static createAdminSettingsValidator(): AdminSettingsValidator {
    return new AdminSettingsValidator();
  }

  static createEmailValidator(): EmailValidator {
    return new EmailValidator();
  }

  static createAddressValidator(): AddressValidator {
    return new AddressValidator();
  }

  static createAmountValidator(): AmountValidator {
    return new AmountValidator();
  }
}

/**
 * Глобальный валидатор
 */
export const validators = {
  order: ValidatorFactory.createOrderValidator(),
  adminSettings: ValidatorFactory.createAdminSettingsValidator(),
  email: ValidatorFactory.createEmailValidator(),
  address: ValidatorFactory.createAddressValidator(),
  amount: ValidatorFactory.createAmountValidator()
};
