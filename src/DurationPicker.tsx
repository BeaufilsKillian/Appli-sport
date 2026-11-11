import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

const ROW = 40;
function Wheel({ value, max, label, color, onChange }: { value: number; max: number; label: string; color: string; onChange: (value: number) => void }) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = useRef(value);
  useEffect(() => { selected.current = value; scroll.current?.scrollTo({ y: value * ROW, animated: false }); }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={{ color, marginBottom: 8 }}>{label}</Text>
    <View style={{ height: ROW * 3, width: '100%' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: ROW, height: ROW, width: '100%', backgroundColor: '#748FFC22', borderRadius: 8 }} />
      <ScrollView ref={scroll} nestedScrollEnabled showsVerticalScrollIndicator={false} snapToInterval={ROW} decelerationRate="fast" contentContainerStyle={{ paddingVertical: ROW }}
        onScroll={event => {
          const next = Math.max(0, Math.min(max, Math.round(event.nativeEvent.contentOffset.y / ROW)));
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            scroll.current?.scrollTo({ y: next * ROW, animated: false });
            if (next !== selected.current) onChange(next);
          }, 120);
        }} scrollEventThrottle={16}>
        {Array.from({ length: max + 1 }, (_, n) => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} ${label}`} accessibilityState={{ selected: n === value }} onPress={() => onChange(n)} style={{ height: ROW, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color, fontSize: 24, opacity: n === value ? 1 : .45, fontWeight: n === value ? '700' : '400' }}>{String(n).padStart(2, '0')}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
  </View>;
}

export function DurationPicker({ seconds, onChange, color }: { seconds: number; onChange: (seconds: number) => void; color: string }) {
  const value = Math.max(0, Math.min(86400, Math.floor(seconds || 0)));
  const hours = Math.floor(value / 3600), minutes = Math.floor(value % 3600 / 60), rest = value % 60;
  return <View style={{ flexDirection: 'row', gap: 8, marginVertical: 12 }}>
    <Wheel label="Heures" value={hours} max={24} color={color} onChange={n => onChange(Math.min(86400, n * 3600 + minutes * 60 + rest))} />
    <Wheel label="Minutes" value={minutes} max={hours === 24 ? 0 : 59} color={color} onChange={n => onChange(hours * 3600 + n * 60 + rest)} />
    <Wheel label="Secondes" value={rest} max={hours === 24 ? 0 : 59} color={color} onChange={n => onChange(hours * 3600 + minutes * 60 + n)} />
  </View>;
}
