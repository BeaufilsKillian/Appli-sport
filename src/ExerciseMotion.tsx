import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import type { Exercise } from './catalogue';
import { C as DARK_C, LIGHT_C } from './theme';

// Dessin vectoriel original, hors ligne. Ces mouvements sont des schémas
// simplifiés, pas des démonstrations vidéo anatomiquement détaillées.
const listeners = new Set<(tick: number) => void>();
let interval: ReturnType<typeof setInterval> | null = null;
let sharedTick = 0;
function subscribe(callback: (tick: number) => void) {
  listeners.add(callback);
  if (!interval) interval = setInterval(() => {
    sharedTick = (sharedTick + 1) % 4096;
    listeners.forEach((fn) => fn(sharedTick));
  }, 80);
  return () => {
    listeners.delete(callback);
    if (!listeners.size && interval) { clearInterval(interval); interval = null; }
  };
}
function useTick(enabled: boolean) {
  const [tick, setTick] = useState(sharedTick);
  useEffect(() => enabled ? subscribe(setTick) : undefined, [enabled]);
  return tick;
}

export function ExerciseMotion({ exercise, width = 88, showLabel = false, animate = true, theme = 'dark' }: {
  exercise: Exercise; width?: number; showLabel?: boolean; animate?: boolean; theme?: 'dark' | 'light';
}) {
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(true);
  const tick = useTick(animate && !paused);
  const p = .5 - .5 * Math.cos(2 * Math.PI * tick / (slow ? 64 : 32));
  const C = theme === 'light' ? LIGHT_C : DARK_C;
  const large = width >= 150;
  const benchProfile = ['bench','ex020','ex021','ex022','ex023','ex024','ex025'].includes(exercise.id);
  const squatProfile = exercise.id === 'squat';
  const palette = theme === 'light' ? { bg: '#E7F0FF', ink: '#26384E', faint: '#8A9BAB', floor: '#CBDDEC' }
    : { bg: '#101D2C', ink: '#D6E0EB', faint: '#7C8999', floor: '#263848' };
  const pattern = exercise.pattern;
  const lower = ['squat', 'lunge', 'hinge', 'legcurl', 'legextension', 'bridge', 'abduction', 'kickback', 'calf'].includes(pattern);
  const color = C.blue;
  const ink = palette.ink;
  const base = palette.faint;

  // Position des articulations : chaque famille possède son cycle distinct.
  let shoulderY = 35, hipY = 65, kneeY = 82, headY = 18;
  // REGRESSION V0.4/V0.5 : rightElbow undefined provoquait
  // "Cannot convert undefined value to object" sur la ligne du bras droit.
  // Les DEUX coudes doivent toujours avoir des coordonnées valides.
  let leftElbow: [number, number] = [31, 50], rightElbow: [number, number] = [69, 50];
  let leftHand: [number, number] = [26, 68], rightHand: [number, number] = [74, 68];
  let leftKnee: [number, number] = [43, 84], rightKnee: [number, number] = [57, 84];
  let leftFoot: [number, number] = [40, 103], rightFoot: [number, number] = [60, 103];
  if (['squat', 'lunge'].includes(pattern)) {
    const shift = p * (pattern === 'squat' ? 11 : 7);
    headY += shift; shoulderY += shift; hipY += shift;
    leftKnee = [35 - 3 * p, 84 + p * 2]; rightKnee = [66 + 6 * p, 84 + 2 * p];
    if (pattern === 'lunge') { leftFoot = [25, 103]; rightFoot = [78, 103]; }
  }
  if (pattern === 'hinge') { shoulderY += 10 * p; headY += 11 * p; hipY -= 2 * p; }
  if (pattern === 'bridge') { hipY -= 11 * p; }
  if (pattern === 'calf') { hipY -= 8 * p; shoulderY -= 8 * p; headY -= 8 * p; }
  if (pattern === 'curl') {
    leftHand = [35, 68 - 24 * p]; rightHand = [65, 68 - 24 * p];
  }
  if (['overhead', 'overtriceps'].includes(pattern)) {
    leftElbow = [31, 41 - p * 14]; rightElbow = [69, 41 - p * 14];
    leftHand = [33, 26 - p * 17]; rightHand = [67, 26 - p * 17];
  }
  if (pattern === 'press') {
    leftElbow = [30, 40 - p * 9]; rightElbow = [70, 40 - p * 9];
    leftHand = [36, 38 - p * 22]; rightHand = [64, 38 - p * 22];
  }
  if (['raise', 'fly', 'abduction'].includes(pattern)) {
    leftElbow = [29 - 10 * p, 46 - 9 * p]; rightElbow = [71 + 10 * p, 46 - 9 * p];
    leftHand = [23 - 18 * p, 64 - 28 * p]; rightHand = [77 + 18 * p, 64 - 28 * p];
  }
  if (['row', 'pull', 'pullover', 'facepull'].includes(pattern)) {
    leftElbow = [28 + 6 * p, 49 - 10 * p]; rightElbow = [72 - 6 * p, 49 - 10 * p];
    leftHand = [21 + 18 * p, 34 + 15 * p]; rightHand = [79 - 18 * p, 34 + 15 * p];
  }
  if (pattern === 'triceps') {
    leftHand = [31, 46 + 24 * p]; rightHand = [69, 46 + 24 * p];
  }
  if (pattern === 'dip' || pattern === 'pushup') {
    headY += 8 * p; shoulderY += 8 * p; hipY += 8 * p;
    leftHand = [25, 65]; rightHand = [75, 65];
  }
  if (pattern === 'legcurl') {
    leftFoot = [42 - 13 * p, 101 - 20 * p]; rightFoot = [58 + 13 * p, 101 - 20 * p];
  }
  if (pattern === 'legextension') {
    leftFoot = [40 - 17 * p, 103 - 15 * p]; rightFoot = [60 + 17 * p, 103 - 15 * p];
  }
  if (pattern === 'kickback') rightFoot = [60 + 21 * p, 103 - 20 * p];
  if (pattern === 'cardio') {
    leftElbow = [30, 49 + 7 * p]; rightElbow = [70, 49 + 7 * (1-p)];
    leftFoot = [40 + 8 * p, 101 - 7 * p]; rightFoot = [60 - 8 * p, 101 - 7 * (1-p)];
  }
  if (pattern === 'crunch') { headY += 8 * p; shoulderY += 5 * p; }
  if (pattern === 'rotation') { leftHand = [30 + 16 * p, 52]; rightHand = [70 - 16 * p, 52]; }

  const primary = exercise.muscle;
  const chest = primary === 'Pectoraux';
  const back = primary === 'Dos';
  const shoulders = primary === 'Épaules';
  const arms = ['Biceps', 'Triceps', 'Avant-bras'].includes(primary);
  const legs = ['Jambes', 'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets'].includes(primary);
  const core = primary === 'Abdos';
  const line = (key: string, x1: number, y1: number, x2: number, y2: number, stroke = ink, sw = 5) =>
    <Line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />;
  return <View style={[styles.frame, { width, minHeight: width * 1.18 }]}>
    <Svg width={width} height={width * 1.12} viewBox="0 0 100 112">
      <Rect x={1} y={1} width={98} height={110} rx={12} fill={palette.bg} />
      <Ellipse cx={50} cy={109} rx={33} ry={3} fill={palette.floor} />
      {large ? <>
        <Line x1={13} y1={109} x2={87} y2={109} stroke={palette.faint} strokeWidth={1} strokeDasharray="3 3"/>
        <Line x1={50} y1={8} x2={50} y2={105} stroke={palette.faint} strokeWidth={0.45} strokeDasharray="2 4" opacity={0.55}/>
      </> : null}
      {benchProfile ? <>
        {/* Développé couché : vue latérale dédiée, banc et barre visibles. */}
        <Rect x={20} y={74} width={60} height={5} rx={2} fill={palette.faint}/>
        <Line x1={29} y1={78} x2={29} y2={107} stroke={palette.faint} strokeWidth={3}/>
        <Line x1={68} y1={78} x2={68} y2={107} stroke={palette.faint} strokeWidth={3}/>
        <Circle cx={27} cy={63} r={8} fill={ink}/>
        <Line x1={38} y1={68} x2={65} y2={68} stroke={ink} strokeWidth={11} strokeLinecap="round"/>
        <Line x1={65} y1={68} x2={76} y2={83} stroke={ink} strokeWidth={6} strokeLinecap="round"/>
        <Line x1={76} y1={83} x2={82} y2={104} stroke={ink} strokeWidth={5} strokeLinecap="round"/>
        <Ellipse cx={45} cy={68} rx={13} ry={7} fill={color} opacity={.85}/>
        <Line x1={43} y1={65} x2={47 + p*3} y2={58-12*p} stroke={ink} strokeWidth={5} strokeLinecap="round"/>
        <Line x1={47+p*3} y1={58-12*p} x2={53} y2={55-31*p} stroke={ink} strokeWidth={5} strokeLinecap="round"/>
        <Line x1={15} y1={55-31*p} x2={88} y2={55-31*p} stroke={C.gold} strokeWidth={3} strokeLinecap="round"/>
        <Rect x={16} y={47-31*p} width={5} height={16} rx={2} fill={C.gold}/>
        <Rect x={81} y={47-31*p} width={5} height={16} rx={2} fill={C.gold}/>
        {large ? <Line x1={92} y1={54} x2={92} y2={22} stroke={C.gold} strokeDasharray="2 3" strokeWidth={1.4}/> : null}
      </> : squatProfile ? <>
        {/* Squat barre : repère latéral et pieds en appui. */}
        <Line x1={25} y1={107} x2={87} y2={107} stroke={palette.faint} strokeWidth={2}/>
        <Circle cx={51+6*p} cy={20+11*p} r={8} fill={ink}/>
        <Line x1={50+7*p} y1={34+10*p} x2={47-7*p} y2={65+10*p} stroke={ink} strokeWidth={11} strokeLinecap="round"/>
        <Ellipse cx={52+3*p} cy={45+10*p} rx={8} ry={14} fill={color} opacity={.7}/>
        <Line x1={47-7*p} y1={65+10*p} x2={60+4*p} y2={84+1*p} stroke={ink} strokeWidth={8} strokeLinecap="round"/>
        <Line x1={60+4*p} y1={84+p} x2={59} y2={102} stroke={ink} strokeWidth={7} strokeLinecap="round"/>
        <Line x1={59} y1={102} x2={77} y2={102} stroke={ink} strokeWidth={6} strokeLinecap="round"/>
        <Ellipse cx={57-2*p} cy={78+4*p} rx={8} ry={12} fill={color} opacity={.75}/>
        <Line x1={26} y1={36+10*p} x2={82} y2={36+10*p} stroke={C.gold} strokeWidth={3}/>
        <Line x1={54+6*p} y1={36+10*p} x2={50+6*p} y2={56+10*p} stroke={ink} strokeWidth={5}/>
      </> : <>
      {legs && <>
        <Ellipse cx={43} cy={78} rx={9} ry={15} fill={color} opacity={0.4} />
        <Ellipse cx={57} cy={78} rx={9} ry={15} fill={color} opacity={0.4} />
      </>}
      {line('spine', 50, shoulderY, 50, hipY, ink, 10)}
      {core && <Rect x={41} y={45} width={18} height={18} rx={6} fill={color} opacity={0.85} />}
      {(chest || back) && <Ellipse cx={50} cy={42} rx={15} ry={10} fill={color} opacity={0.85} />}
      {shoulders && <>{<Circle cx={37} cy={37} r={7} fill={color}/>}<Circle cx={63} cy={37} r={7} fill={color}/></>}
      <Circle cx={50} cy={headY} r={9} fill={ink}/>
      {line('shoulders', 37, shoulderY, 63, shoulderY, ink, 7)}
      {line('armL1', 37, shoulderY, ...leftElbow, arms ? color : ink)}
      {line('armL2', ...leftElbow, ...leftHand, arms ? color : ink)}
      {line('armR1', 63, shoulderY, ...rightElbow, arms ? color : ink)}
      {line('armR2', ...rightElbow, ...rightHand, arms ? color : ink)}
      {line('legL1', 46, hipY, ...leftKnee, legs ? color : base, 6)}
      {line('legL2', ...leftKnee, ...leftFoot, legs ? color : base, 6)}
      {line('legR1', 54, hipY, ...rightKnee, legs ? color : base, 6)}
      {line('legR2', ...rightKnee, ...rightFoot, legs ? color : base, 6)}
      {['Barre','Barre EZ','Smith'].includes(exercise.equipment) ?
        <>{line('barre', leftHand[0] - 6, leftHand[1], rightHand[0] + 6, rightHand[1], C.gold, 3)}</> : null}
      {exercise.equipment === 'Haltères' ? <>
        <Rect x={leftHand[0]-5} y={leftHand[1]-2} width={10} height={4} rx={1} fill={C.gold}/>
        <Rect x={rightHand[0]-5} y={rightHand[1]-2} width={10} height={4} rx={1} fill={C.gold}/>
      </> : null}
      {large ? <>
        <Circle cx={leftHand[0]} cy={leftHand[1]} r={2.4} fill={C.gold} stroke={palette.bg} strokeWidth={0.5}/>
        <Circle cx={rightHand[0]} cy={rightHand[1]} r={2.4} fill={C.gold} stroke={palette.bg} strokeWidth={0.5}/>
        <Circle cx={leftKnee[0]} cy={leftKnee[1]} r={2} fill={palette.faint}/>
        <Circle cx={rightKnee[0]} cy={rightKnee[1]} r={2} fill={palette.faint}/>
      </> : null}
      {pattern === 'plank' && <Path d="M20 102 L80 102" stroke={C.blue} strokeWidth={3} strokeDasharray="3 4" />}
      </>}
    </Svg>
    {showLabel ? <Text style={[styles.caption,{color:C.blue}]} numberOfLines={1}>{primary.toUpperCase()} · {exercise.equipment.toUpperCase()}</Text> : null}
    {large ? <View style={{alignItems:'center',paddingBottom:8,gap:6}}>
      <Text style={{fontSize:11,fontWeight:'600',color:C.muted}}>{animate ? (paused?'Mouvement en pause':'Cycle de mouvement ralenti') : 'Schéma du mouvement'}</Text>
      <View style={{flexDirection:'row',gap:8}}>
        <Pressable onPress={()=>setPaused(v=>!v)} accessibilityRole="button"
          style={{paddingVertical:7,paddingHorizontal:12,borderRadius:9,backgroundColor:C.surfaceRaised}}>
          <Text style={{color:C.white,fontSize:11,fontWeight:'700'}}>{paused?'▶ Reprendre':'Ⅱ Pause'}</Text>
        </Pressable>
        <Pressable onPress={()=>setSlow(v=>!v)} accessibilityRole="button"
          style={{paddingVertical:7,paddingHorizontal:12,borderRadius:9,backgroundColor:C.surfaceRaised}}>
          <Text style={{color:C.white,fontSize:11,fontWeight:'700'}}>{slow?'Vitesse ×1':'Vitesse lente'}</Text>
        </Pressable>
      </View>
      <Text style={{fontSize:10,textAlign:'center',color:C.muted,paddingHorizontal:8}}>Schéma pédagogique : les angles, équipements et postures exacts varient selon la variante.</Text>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  caption: { fontSize: 9, fontWeight: '800', color: C.blue, paddingBottom: 7 },
});
