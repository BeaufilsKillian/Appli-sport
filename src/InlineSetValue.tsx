import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Alert } from './alerts';
import { parseSetValue } from './setEditing';
import { formatSetDuration } from './setInputs';

export function InlineSetValue({ value, previous, field, label, color, borderColor, onText }: {
  value: string; previous?: number; field: 'weight' | 'reps' | 'duration'; label: string; color: string; borderColor: string; onText(value: string): void;
}) {
  const format = (number: number) => field === 'duration' ? formatSetDuration(number) : String(number).replace('.', ',');
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value); }, [value]);
  return <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
    <TextInput accessibilityLabel={label} value={text} selectTextOnFocus
      placeholder={previous === undefined ? '—' : format(previous)} placeholderTextColor={`${color}78`} maxLength={40}
      keyboardType={field === 'duration' ? 'numbers-and-punctuation' : field === 'weight' ? 'decimal-pad' : 'number-pad'}
      style={{ color, fontSize: 16, textAlign: 'center', minWidth: 44, maxWidth: 95, flexShrink: 1, minHeight: 44, borderBottomWidth: 1, borderColor, paddingHorizontal: 4 }}
      onFocus={() => { focused.current = true; }}
      onChangeText={next => { setText(next); onText(next); }}
      onBlur={() => {
        focused.current = false;
        const parsed = parseSetValue(text, field);
        if (parsed === null && text.trim()) {
          Alert.alert('Valeur incorrecte', field === 'duration' ? 'Indique des secondes ou min:ss, jusqu’à 24 h.' : field === 'weight' ? 'Indique une charge positive ou nulle.' : 'Indique un nombre entier entre 0 et 1 000.');
        }
      }} />
    {field === 'weight' && <Text style={{ color, fontSize: 12 }}>kg</Text>}
  </View>;
}
