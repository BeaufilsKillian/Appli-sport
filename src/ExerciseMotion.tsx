import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Exercise } from './catalogue';
import { C as DARK_C, LIGHT_C } from './theme';
import { EXERCISE_DEMOS } from './exerciseDemos';

// GIF du site demandés par l'utilisateur, enregistrés localement.
// Miniatures fixes dans les listes, animation complète dans la fiche détaillée.
type MotionProps = {
  exercise: Exercise; width?: number; showLabel?: boolean; animate?: boolean; theme?: 'dark' | 'light';
};
export function ExerciseMotion(props: MotionProps) { return <ExerciseMedia key={props.exercise.id} {...props} />; }
function ExerciseMedia({ exercise, width = 88, showLabel = false, animate = true, theme = 'dark' }: MotionProps) {
  const C = theme === 'light' ? LIGHT_C : DARK_C;
  const large = width >= 150;
  const demo = EXERCISE_DEMOS[exercise.id];
  const [showMotion, setShowMotion] = useState(true);
  const [failedExercise, setFailedExercise] = useState<string | null>(null);
  const available = demo && failedExercise !== exercise.id;
  const sourcePage = demo?.page ?? `https://www.docteur-fitness.com/bibliotheque-exercices?q=${encodeURIComponent(exercise.name)}`;
  const openSource = () => {
    void Linking.openURL(sourcePage).catch(() => Alert.alert('Lien indisponible', 'Impossible d’ouvrir Docteur Fitness pour le moment.'));
  };
  const height = demo ? Math.max(width * 0.75, Math.min(width * 1.25, width * demo.height / demo.width)) : width;
  return <View style={{ width, alignItems: 'center' }}>
    {available ? <Image
      key={exercise.id}
      source={large && animate && showMotion ? demo.animation : demo.poster}
      style={{ width, height, borderRadius: 10, backgroundColor: '#FFFFFF' }}
      resizeMode="contain" accessibilityLabel={`Démonstration de ${exercise.name} — Docteur Fitness`}
      onError={() => setFailedExercise(exercise.id)}
    /> : <Pressable onPress={openSource} accessibilityRole="link" accessibilityLabel={`Chercher la démonstration de ${exercise.name} sur Docteur Fitness`}
      style={[styles.empty, { width, height, backgroundColor: C.surfaceRaised }]}>
      <Text style={{ color: C.blue, fontSize: large ? 32 : 20 }}>▶</Text>
      {large ? <Text style={{ color: C.muted, textAlign: 'center', fontSize: 12 }}>Aucune animation correspondante intégrée.{'\n'}Consulter Docteur Fitness</Text> : null}
    </Pressable>}
    {showLabel ? <Text style={{ color: C.blue, fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>
      {exercise.muscle.toUpperCase()} · {exercise.equipment.toUpperCase()}
    </Text> : null}
    {large ? <>
      {available && animate ? <Pressable accessibilityRole="button" onPress={() => setShowMotion(value => !value)}
        style={[styles.control, { backgroundColor: C.surfaceRaised }]}>
        <Text style={{ color: C.white, fontSize: 12, fontWeight: '600' }}>{showMotion ? 'Voir la position initiale' : 'Lire l’animation'}</Text>
      </Pressable> : null}
      <Pressable accessibilityRole="link" onPress={openSource} style={{ paddingVertical: 10 }}>
        <Text style={{ color: C.blue, fontSize: 11, textAlign: 'center' }}>Source : Docteur Fitness ↗</Text>
      </Pressable>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  empty: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8 },
  control: { marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
});
