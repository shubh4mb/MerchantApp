import React, { useState } from 'react';
import { View, Text, TextInput, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import { AlertCircle, AlertTriangle } from 'lucide-react-native';

interface ProductTitleInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string; // External error from form validation
}

export const ProductTitleInput: React.FC<ProductTitleInputProps> = ({ value, onChange, error }) => {
  const [localError, setLocalError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const promotionalWords = [
    'best', 'premium', 'new arrival', 'trending', 'sale', 
    'discount', 'original', 'no.1', 'cheapest'
  ];

  const validate = (val: string) => {
    const trimmedVal = val.trim();
    
    // Warning for promotional words
    const lowerVal = val.toLowerCase();
    const hasPromotional = promotionalWords.some(word => lowerVal.includes(word));
    if (hasPromotional) {
      setWarning('Use descriptive product names instead of promotional words.');
    } else {
      setWarning(null);
    }

    // Error for numbers/symbols only
    const justLetters = val.replace(/[^a-zA-Z]/g, '');
    if (trimmedVal.length > 0 && justLetters.length === 0) {
      setLocalError('Product title cannot consist only of numbers or symbols.');
    } 
    // Error for min length
    else if (trimmedVal.length > 0 && trimmedVal.length < 20) {
      setLocalError('Minimum length is 20 characters.');
    } 
    else {
      setLocalError(null);
    }
  };

  const handleChangeText = (val: string) => {
    if (val.length <= 100) {
      onChange(val);
      validate(val);
    }
  };

  const handleBlur = () => {
    // Trim leading/trailing spaces and collapse multiple consecutive spaces
    const formattedVal = value.trim().replace(/\s+/g, ' ');
    if (formattedVal !== value) {
      onChange(formattedVal);
    }
    validate(formattedVal);
  };

  const displayError = error || localError;

  return (
    <View className="w-full">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-sm font-semibold text-gray-700">Product Title</Text>
        <Text className={`text-xs font-medium ${value.length >= 100 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
          ({value.length}/100)
        </Text>
      </View>
      
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        placeholder="e.g. Oversized Cotton T-Shirt with Graphic Print"
        maxLength={100}
        className={`w-full px-4 py-3 border rounded-xl bg-gray-50 text-base
          ${displayError 
            ? 'border-red-300' 
            : warning 
              ? 'border-amber-300'
              : 'border-gray-200 focus:border-blue-500'
          }`}
      />
      
      <Text className="mt-2 text-xs text-gray-500 font-medium">
        Describe the product using its fit, material, style, or key design feature. Avoid promotional words.
      </Text>
      
      {/* Warning message (non-blocking) */}
      {warning && !displayError && (
        <View className="mt-2 flex-row items-start bg-amber-50 p-3 rounded-xl border border-amber-100">
          <AlertTriangle color="#d97706" size={16} className="mr-2 mt-0.5" />
          <Text className="text-amber-600 text-xs flex-1">{warning}</Text>
        </View>
      )}
      
      {/* Error message (blocking submission) */}
      {displayError && (
        <View className="mt-2 flex-row items-start bg-red-50 p-3 rounded-xl border border-red-100">
          <AlertCircle color="#dc2626" size={16} className="mr-2 mt-0.5" />
          <Text className="text-red-600 text-xs flex-1">{displayError}</Text>
        </View>
      )}
    </View>
  );
};
