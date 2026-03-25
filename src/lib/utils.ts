import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, decimals: number = 2): string {
  if (value === 0) return '0';
  
  // ✅ Для маленьких значений (< 0.01) показываем точное значение с нужным количеством знаков
  // Это важно для токенов с низкой ценой (например Canton Coin ~0.000368 USD)
  if (value < 0.01) {
    // Определяем оптимальное количество знаков после запятой
    // Для цен < 0.001 показываем 6 знаков, для 0.001-0.01 показываем 4 знака
    const precision = value < 0.001 ? 6 : 4;
    return value.toFixed(precision);
  }
  
  return value.toFixed(decimals);
}

export function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  if (num === Infinity) return '∞';
  if (num === -Infinity) return '-∞';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`.toUpperCase();
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Network address validation functions
export function validateEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Ethereum addresses: 0x followed by 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

export function validateBSCAddress(address: string): boolean {
  // BSC uses same format as Ethereum
  return validateEthereumAddress(address);
}

export function validateTronAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // TRON addresses: T followed by 33 alphanumeric characters
  return /^T[A-Za-z1-9]{33}$/.test(trimmed);
}

export function validateCantonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  const trimmed = address.trim();
  
  // Canton Network поддерживает несколько форматов:
  // 1. HEX::HEX формат: 04286df6fb621ddf3949a799a53e2fdc::1220da95ae5ff1535f5ca2d0797c1cc1a57c76b72bb7a0a2bc5f880eb61ed34f7ba8 (САМЫЙ РАСПРОСТРАНЕННЫЙ)
  // 2. Namespace формат: bron::1220... (с буквенным префиксом)
  // 3. Классический формат: name:fingerprint
  // 4. Hex-only формат: длинный hex string без разделителя
  if (trimmed.length < 32 || trimmed.length > 150) return false;
  
  // Проверяем HEX::HEX формат (participant_id::party_hint) - приоритет 1
  const hexHexPattern = /^[a-fA-F0-9]{32,}::[a-fA-F0-9]{32,}$/;
  if (hexHexPattern.test(trimmed)) return true;
  
  // Проверяем namespace формат Canton (bron::...)
  const namespacePattern = /^[a-zA-Z][a-zA-Z0-9_]*::[a-fA-F0-9]{32,}$/;
  if (namespacePattern.test(trimmed)) return true;
  
  // Проверяем классический формат Canton Network: name:fingerprint
  const cantonPattern = /^[a-zA-Z][a-zA-Z0-9_-]{2,49}::[a-fA-F0-9]{32,80}$/;
  if (cantonPattern.test(trimmed)) return true;
  
  // Проверяем hex-only формат (чистый fingerprint, может быть до 80 символов)
  const hexOnlyPattern = /^[a-fA-F0-9]{32,80}$/;
  if (hexOnlyPattern.test(trimmed)) return true;
  
  return false;
}

// Network-agnostic payment address validation
export function validatePaymentAddress(address: string, network: 'ETHEREUM' | 'BSC' | 'TRON'): boolean {
  switch (network) {
    case 'ETHEREUM':
      return validateEthereumAddress(address);
    case 'BSC':
      return validateBSCAddress(address);
    case 'TRON':
      return validateTronAddress(address);
    default:
      return false;
  }
}
