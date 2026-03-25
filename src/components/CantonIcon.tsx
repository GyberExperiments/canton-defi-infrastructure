import React from 'react'

interface CantonIconProps {
  className?: string;
  size?: number;
}

export const CantonIcon: React.FC<CantonIconProps> = ({ className = "w-6 h-6", size }) => {
  return (
    <div 
      className={`flex items-center justify-center font-bold text-white ${className}`}
      style={{ 
        width: size || 24, 
        height: size || 24,
        background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 50%, #06B6D4 100%)',
        borderRadius: '50%',
        fontSize: size ? size * 0.6 : 14
      }}
    >
      CC
    </div>
  )
}

export default CantonIcon
