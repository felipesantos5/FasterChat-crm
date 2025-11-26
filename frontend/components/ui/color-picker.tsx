'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  { name: 'Roxo', value: '#8B5CF6' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#10B981' },
  { name: 'Amarelo', value: '#F59E0B' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Ciano', value: '#06B6D4' },
  { name: 'Índigo', value: '#6366F1' },
  { name: 'Lima', value: '#84CC16' },
  { name: 'Âmbar', value: '#F59E0B' },
  { name: 'Cinza', value: '#6B7280' },
];

export function ColorPicker({ value, onChange, disabled = false }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value);

  const handlePresetClick = (color: string) => {
    if (!disabled) {
      onChange(color);
      setCustomColor(color);
    }
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => handlePresetClick(color.value)}
            disabled={disabled}
            className={cn(
              'relative h-10 w-10 rounded-md border-2 transition-all hover:scale-110',
              value === color.value ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2' : 'border-gray-200',
              disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
            )}
            style={{ backgroundColor: color.value }}
            title={color.name}
          >
            {value === color.value && (
              <Check className="h-5 w-5 text-white absolute inset-0 m-auto drop-shadow-lg" />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t">
        <label htmlFor="custom-color" className="text-sm font-medium text-gray-700">
          Cor personalizada:
        </label>
        <div className="flex items-center gap-2">
          <input
            id="custom-color"
            type="color"
            value={customColor}
            onChange={handleCustomColorChange}
            disabled={disabled}
            className={cn(
              'h-10 w-16 rounded-md border-2 border-gray-200 cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          <span className="text-sm font-mono text-gray-600">{customColor.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
