/**
 * ⚙️ Settings Page Content Component
 * Управление настройками системы
 */

'use client';

import { useEffect, useState } from 'react';
import { DISCOUNT_TIERS } from '@/config/otc';
import { RefreshCw, Server, Database, Bell, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

interface Settings {
  // New separate prices (вычисляемые или статичные)
  cantonCoinBuyPrice: number;
  cantonCoinSellPrice: number;
  // Legacy single price for backward compatibility
  cantonCoinPrice: number;
  // Динамическое ценообразование
  useDynamicPricing?: boolean;
  buyMarkupPercent?: number;
  sellMarkupPercent?: number;
  // Updated limits
  minAmount: number;
  maxAmount: number | null;
  // Canton limits
  minCantonAmount: number;
  maxCantonAmount: number | null;
  supportedTokens: Array<{
    symbol: string;
    name: string;
    network: string;
    networkName: string;
    icon: string;
    priceUSD: number;
    minAmount: number;
    maxAmount: number;
  }>;
  businessHours: string;
  telegram: {
    botUsername: string;
    configured: boolean;
  };
  googleSheets: {
    configured: boolean;
  };
  // DEX настройки
  dexFeePercent?: number;
  swapFeePercent?: number;
  bridgeFeePercent?: number;
  dexFeeRecipient?: string;
  minSwapAmount?: number;
  maxSwapAmount?: number | null;
  enabledTokens?: string[];
  enabledChains?: string[];
  // Service commission
  serviceCommission?: number;
}

export default function SettingsPageContent() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<Settings>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (settings) {
      setEditValues({
        cantonCoinBuyPrice: settings.cantonCoinBuyPrice,
        cantonCoinSellPrice: settings.cantonCoinSellPrice,
        useDynamicPricing: settings.useDynamicPricing ?? false,
        buyMarkupPercent: settings.buyMarkupPercent ?? 0,
        sellMarkupPercent: settings.sellMarkupPercent ?? 0,
        minAmount: settings.minAmount,
        maxAmount: settings.maxAmount,
        // DEX настройки
        dexFeePercent: settings.dexFeePercent ?? 0.3,
        swapFeePercent: settings.swapFeePercent ?? 0.3,
        bridgeFeePercent: settings.bridgeFeePercent ?? 0.5,
        dexFeeRecipient: settings.dexFeeRecipient ?? '',
        minSwapAmount: settings.minSwapAmount ?? 0.1,
        maxSwapAmount: settings.maxSwapAmount ?? null,
        serviceCommission: settings.serviceCommission ?? 1,
      });
      setEditing(true);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditValues({});
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editValues),
      });

      const data = await response.json();

      if (response.ok) {
        // ✅ ОБНОВЛЯЕМ ЛОКАЛЬНЫЙ STATE с новыми значениями
        setSettings(prev => {
          if (!prev) return prev;
          
          const updatedSellPrice = editValues.cantonCoinSellPrice ?? prev.cantonCoinSellPrice;
          const updatedMinAmount = editValues.minAmount ?? prev.minAmount;
          
          return {
            ...prev,
            cantonCoinBuyPrice: editValues.cantonCoinBuyPrice ?? prev.cantonCoinBuyPrice,
            cantonCoinSellPrice: updatedSellPrice,
            // ✅ Обновляем новые поля динамического ценообразования
            useDynamicPricing: editValues.useDynamicPricing ?? prev.useDynamicPricing ?? false,
            buyMarkupPercent: editValues.buyMarkupPercent ?? prev.buyMarkupPercent ?? 0,
            sellMarkupPercent: editValues.sellMarkupPercent ?? prev.sellMarkupPercent ?? 0,
            minAmount: updatedMinAmount,
            maxAmount: editValues.maxAmount ?? prev.maxAmount,
            // Обновляем serviceCommission
            serviceCommission: editValues.serviceCommission ?? prev.serviceCommission ?? 1,
            // Пересчитываем Canton лимиты
            minCantonAmount: updatedSellPrice > 0
              ? Math.ceil(updatedMinAmount / updatedSellPrice)
              : prev.minCantonAmount,
            maxCantonAmount: editValues.maxAmount && updatedSellPrice > 0
              ? Math.floor(editValues.maxAmount / updatedSellPrice)
              : prev.maxCantonAmount
          };
        });
        
        // ✅ НЕМЕДЛЕННО ОБНОВЛЯЕМ ВСЕ КОМПОНЕНТЫ через broadcast event
        window.dispatchEvent(new CustomEvent('config-updated', {
          detail: {
            buyPrice: editValues.cantonCoinBuyPrice,
            sellPrice: editValues.cantonCoinSellPrice,
            timestamp: Date.now()
          }
        }));
        
        console.log('🔔 Broadcast config-updated event to all components');
        
        // ✅ ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ конфигурации через API
        try {
          const refreshResponse = await fetch('/api/config/refresh', {
            method: 'POST',
            headers: {
              'Cache-Control': 'no-cache'
            }
          });
          
          if (refreshResponse.ok) {
            console.log('✅ Configuration forcibly refreshed after price update');
            
            // Дополнительное broadcast событие для гарантии
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('config-updated', {
                detail: {
                  buyPrice: editValues.cantonCoinBuyPrice,
                  sellPrice: editValues.cantonCoinSellPrice,
                  timestamp: Date.now(),
                  forced: true
                }
              }));
            }, 500);
          } else {
            console.warn('⚠️ Failed to refresh configuration after price update');
          }
        } catch (refreshError) {
          console.error('❌ Error refreshing configuration:', refreshError);
        }
        
        // Show appropriate notification based on result
        if (data.success && data.configMap) {
          toast.success('Settings updated in ConfigMap and applied instantly! ⚡');
        } else if (data.success && data.warning) {
          toast.success('Settings updated locally (development mode)');
        } else {
          toast.success('Settings updated!');
        }
        
        setEditing(false);
        setEditValues({});
        
        // Show detailed information
        if (data.instructions) {
          console.log('📊 Instructions:', data.instructions);
        }
        
        if (data.configMap) {
          console.log('🔧 ConfigMap updated:', data.configMap);
        }
      } else {
        toast.error(data.error || 'Failed to update settings');
        if (data.details) {
          console.error('Validation errors:', data.details);
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Не удалось загрузить настройки</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Настройки системы</h1>
          <p className="text-gray-600 mt-1">Конфигурация OTC обменника</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSettings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Обновить
          </button>
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <DollarSign className="h-4 w-4" />
              Редактировать
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Exchange Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Курсы и лимиты</h2>
          </div>

          <div className="space-y-4">
            {/* Separate Buy/Sell Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="buy-price" className="block text-sm font-medium text-gray-700 mb-2">
                  Buy Price (USD)
                </label>
                <input
                  id="buy-price"
                  type="number"
                  value={editing ? (editValues.cantonCoinBuyPrice ?? '') : settings.cantonCoinBuyPrice}
                  onChange={(e) => setEditValues(prev => ({ ...prev, cantonCoinBuyPrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing || (settings.useDynamicPricing ?? false)}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing && !(settings.useDynamicPricing ?? false)
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {settings.useDynamicPricing 
                    ? `💰 Динамическая цена (рыночная + ${settings.buyMarkupPercent ?? 0}%) - рассчитывается автоматически`
                    : 'Цена покупки Canton Coin (статичная)'
                  }
                </p>
              </div>
              <div>
                <label htmlFor="sell-price" className="block text-sm font-medium text-gray-700 mb-2">
                  Sell Price (USD)
                </label>
                <input
                  id="sell-price"
                  type="number"
                  value={editing ? (editValues.cantonCoinSellPrice ?? '') : settings.cantonCoinSellPrice}
                  onChange={(e) => setEditValues(prev => ({ ...prev, cantonCoinSellPrice: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing || (settings.useDynamicPricing ?? false)}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing && !(settings.useDynamicPricing ?? false)
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {settings.useDynamicPricing 
                    ? `💰 Динамическая цена (рыночная - ${settings.sellMarkupPercent ?? 0}%) - рассчитывается автоматически`
                    : 'Цена продажи Canton Coin (статичная)'
                  }
                </p>
              </div>
            </div>

            {/* Legacy single price (read-only) */}
            <div>
              <label htmlFor="legacy-price" className="block text-sm font-medium text-gray-700 mb-2">
                Legacy Price (USD) - Read Only
              </label>
              <input
                id="legacy-price"
                type="number"
                value={settings.cantonCoinPrice}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">
                Устаревшая единая цена. Используется для обратной совместимости.
              </p>
            </div>

            {/* Dynamic Pricing Settings */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <input
                  id="use-dynamic-pricing"
                  type="checkbox"
                  checked={editing ? (editValues.useDynamicPricing ?? false) : (settings.useDynamicPricing ?? false)}
                  onChange={(e) => setEditValues(prev => ({ ...prev, useDynamicPricing: e.target.checked }))}
                  disabled={!editing}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="use-dynamic-pricing" className="text-sm font-medium text-gray-900">
                  Использовать динамическое ценообразование (рыночная цена из API)
                </label>
              </div>
              
              {(editing ? (editValues.useDynamicPricing ?? false) : (settings.useDynamicPricing ?? false)) && (
                <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <label htmlFor="buy-markup" className="block text-sm font-medium text-gray-700 mb-2">
                      Наценка при покупке (%)
                    </label>
                    <input
                      id="buy-markup"
                      type="number"
                      value={editing ? (editValues.buyMarkupPercent ?? '') : (settings.buyMarkupPercent ?? '')}
                      onChange={(e) => setEditValues(prev => ({ ...prev, buyMarkupPercent: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      disabled={!editing}
                      className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                        editing 
                          ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      step="0.1"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Процент прибавляется к рыночной цене при покупке
                    </p>
                  </div>
                  <div>
                    <label htmlFor="sell-markup" className="block text-sm font-medium text-gray-700 mb-2">
                      Наценка при продаже (%)
                    </label>
                    <input
                      id="sell-markup"
                      type="number"
                      value={editing ? (editValues.sellMarkupPercent ?? '') : (settings.sellMarkupPercent ?? '')}
                      onChange={(e) => setEditValues(prev => ({ ...prev, sellMarkupPercent: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      disabled={!editing}
                      className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                        editing 
                          ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                          : 'border-gray-300 bg-gray-50'
                      }`}
                      step="0.1"
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Процент вычитается из рыночной цены при продаже
                    </p>
                  </div>
                  <div className="col-span-2 mt-2">
                    <p className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                      💡 При включенном динамическом ценообразовании цены рассчитываются автоматически: 
                      Рыночная цена ± процент наценки. Статичные цены используются как fallback при недоступности API.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="min-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Min Amount (USD)
                </label>
                <input
                  id="min-amount"
                  type="number"
                  value={editing ? (editValues.minAmount ?? '') : settings.minAmount}
                  onChange={(e) => setEditValues(prev => ({ ...prev, minAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="max-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Amount (USD)
                </label>
                <input
                  id="max-amount"
                  type="number"
                  value={editing ? (editValues.maxAmount || '') : (settings.maxAmount || '')}
                  onChange={(e) => setEditValues(prev => ({ ...prev, maxAmount: e.target.value ? parseFloat(e.target.value) : null }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  min="0"
                  placeholder="Без ограничений"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Оставьте пустым для снятия ограничений
                </p>
              </div>
            </div>

            {/* Canton Limits (calculated, read-only) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="min-canton-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Min Canton Amount
                </label>
                <input
                  id="min-canton-amount"
                  type="number"
                  value={settings.minCantonAmount}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Рассчитывается автоматически
                </p>
              </div>
              <div>
                <label htmlFor="max-canton-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Canton Amount
                </label>
                <input
                  id="max-canton-amount"
                  type="text"
                  value={settings.maxCantonAmount ? settings.maxCantonAmount.toString() : 'Без ограничений'}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Рассчитывается автоматически
                </p>
              </div>
            </div>

            {/* Service Commission */}
            <div className="border-t pt-4 mt-4">
              <div>
                <label htmlFor="service-commission" className="block text-sm font-medium text-gray-700 mb-2">
                  Service Commission (%)
                </label>
                <input
                  id="service-commission"
                  type="number"
                  value={editing ? (editValues.serviceCommission ?? '') : (settings.serviceCommission ?? 1)}
                  onChange={(e) => setEditValues(prev => ({ ...prev, serviceCommission: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.1"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Комиссия вычитается из суммы получателя при успешном завершении ордера
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Server className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Интеграции</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Google Sheets</p>
                  <p className="text-xs text-gray-600">Хранение заказов</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                settings.googleSheets.configured
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {settings.googleSheets.configured ? 'Активно' : 'Не настроено'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="font-medium text-gray-900">Telegram Bot</p>
                  <p className="text-xs text-gray-600">{settings.telegram.botUsername}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                settings.telegram.configured
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {settings.telegram.configured ? 'Активно' : 'Не настроено'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Discount Tiers */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-2xl">💎</span>
          Прогрессивная система скидок
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DISCOUNT_TIERS.map((tier) => (
            <div
              key={tier.label}
              className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">{tier.label}</h3>
                <span className="text-2xl font-black text-blue-600">
                  {tier.discount > 0 ? `+${(tier.discount * 100).toFixed(0)}%` : '0%'}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{tier.description}</p>
              <p className="text-xs text-gray-500">
                ${tier.minAmount.toLocaleString()} - ${tier.maxAmount === Infinity ? '∞' : tier.maxAmount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900 font-medium">
            💡 <strong>Как это работает:</strong> Чем больше сумма обмена, тем больше бонусных токенов получает клиент. 
            Скидки применяются автоматически при расчёте обмена.
          </p>
        </div>
      </div>

      {/* Supported Tokens */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Поддерживаемые токены
        </h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Token
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price (USD)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Min/Max
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {settings.supportedTokens.map((token) => (
                <tr key={`${token.symbol}-${token.network}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{token.icon}</span>
                      <span className="font-medium text-gray-900">{token.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      {token.networkName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${token.priceUSD}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {token.minAmount} - {token.maxAmount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DEX Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">DEX настройки</h2>
        </div>

        <div className="space-y-6">
          {/* Комиссии */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Комиссии DEX</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="swap-fee" className="block text-sm font-medium text-gray-700 mb-2">
                  Swap комиссия (%)
                </label>
                <input
                  id="swap-fee"
                  type="number"
                  value={editing ? (editValues.swapFeePercent ?? '') : (settings.swapFeePercent ?? 0.3)}
                  onChange={(e) => setEditValues(prev => ({ ...prev, swapFeePercent: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Комиссия за swap операцию (0.3% = 0.3)
                </p>
              </div>
              <div>
                <label htmlFor="bridge-fee" className="block text-sm font-medium text-gray-700 mb-2">
                  Bridge комиссия (%)
                </label>
                <input
                  id="bridge-fee"
                  type="number"
                  value={editing ? (editValues.bridgeFeePercent ?? '') : (settings.bridgeFeePercent ?? 0.5)}
                  onChange={(e) => setEditValues(prev => ({ ...prev, bridgeFeePercent: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Комиссия за bridge операцию (0.5% = 0.5)
                </p>
              </div>
              <div>
                <label htmlFor="dex-fee" className="block text-sm font-medium text-gray-700 mb-2">
                  Общая комиссия (%)
                </label>
                <input
                  id="dex-fee"
                  type="number"
                  value={editing ? (editValues.dexFeePercent ?? '') : (settings.dexFeePercent ?? 0.3)}
                  onChange={(e) => setEditValues(prev => ({ ...prev, dexFeePercent: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                  max="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Общая комиссия DEX (используется если swap/bridge не заданы)
                </p>
              </div>
            </div>
          </div>

          {/* Fee Recipient */}
          <div>
            <label htmlFor="fee-recipient" className="block text-sm font-medium text-gray-700 mb-2">
              Получатель комиссий (NEAR account)
            </label>
            <input
              id="fee-recipient"
              type="text"
              value={editing ? (editValues.dexFeeRecipient ?? '') : (settings.dexFeeRecipient ?? '')}
              onChange={(e) => setEditValues(prev => ({ ...prev, dexFeeRecipient: e.target.value }))}
              disabled={!editing}
              placeholder="your-account.near"
              className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                editing 
                  ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                  : 'border-gray-300 bg-gray-50'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">
              NEAR account ID для получения комиссий с каждого swap/bridge
            </p>
          </div>

          {/* Swap Limits */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Лимиты Swap</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="min-swap" className="block text-sm font-medium text-gray-700 mb-2">
                  Минимальная сумма swap
                </label>
                <input
                  id="min-swap"
                  type="number"
                  value={editing ? (editValues.minSwapAmount ?? '') : (settings.minSwapAmount ?? 0.1)}
                  onChange={(e) => setEditValues(prev => ({ ...prev, minSwapAmount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  disabled={!editing}
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="max-swap" className="block text-sm font-medium text-gray-700 mb-2">
                  Максимальная сумма swap
                </label>
                <input
                  id="max-swap"
                  type="number"
                  value={editing ? (editValues.maxSwapAmount || '') : (settings.maxSwapAmount || '')}
                  onChange={(e) => setEditValues(prev => ({ ...prev, maxSwapAmount: e.target.value ? parseFloat(e.target.value) : null }))}
                  disabled={!editing}
                  placeholder="Без ограничений"
                  className={`w-full px-4 py-2 border rounded-lg text-gray-900 ${
                    editing 
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                      : 'border-gray-300 bg-gray-50'
                  }`}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-900 font-medium">
              💡 <strong>DEX комиссии:</strong> Настройте размер комиссии и адрес получателя. 
              Комиссия взимается с каждого успешного swap/bridge и отправляется на указанный NEAR account.
            </p>
          </div>
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Рабочее время
        </h2>
        <p className="text-gray-600">
          <strong>Текущее:</strong> {settings.businessHours}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Настраивается через переменную окружения BUSINESS_HOURS
        </p>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Важно:</strong> Настройки автоматически обновляются в GitHub Secrets и развертываются через CI/CD пайплайн. 
          Изменения применяются автоматически без ручного перезапуска сервера.
        </p>
      </div>
    </div>
  );
}

