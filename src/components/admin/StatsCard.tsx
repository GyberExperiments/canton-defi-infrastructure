/**
 * 📊 Stats Card Component
 * Карточка со статистикой для дашборда
 */

'use client';

import { LucideIcon } from 'lucide-react';
import { memo } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

const StatsCard = memo(function StatsCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'bg-blue-500'
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm mt-2 ${
              changeType === 'positive' ? 'text-green-600' :
              changeType === 'negative' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`${iconColor} p-3 rounded-lg shadow-sm`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
});

export default StatsCard;



