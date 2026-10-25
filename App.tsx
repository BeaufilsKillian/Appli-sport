import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AppState, Appearance, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { C as DARK_C, LIGHT_C, durationLabel, fmt, shortDate } from './src/theme';
import { ExerciseMotion } from './src/ExerciseMotion';
import { EXERCISES, MUSCLES, getExercise as getCatalogExercise, type Exercise } from './src/catalogue';
import { techniqueFor, secondaryMusclesFor } from './src/technique';
import { buildWorkoutBlocks, buildWorkoutRounds, type WorkoutBlock } from './src/supersets';
import { COACH_MUSCLES, GOALS, LEVELS, generateWorkout, goalLabel, normalizeGoal, proposeExercise, type Goal, type Experience } from './src/planner';
import {
  addExercise, changeExercisePlan, createFolder, createLoggedSet, createTemplate, createSuggestedTemplate, duplicateTemplate,
  reorderExercise, saveExerciseMax, createCustomExercise, deleteEmptyFolder, deleteLoggedSet, deleteTemplate,
  discardSession, exportAllData, fetchOverview, finishSession, getSettings, initDatabase, moveTemplate, resetStatistics,
  removeExercise, renameFolder, renameTemplate, saveSettings, startSession, updateLoggedSet,
  type Folder, type HistorySet, type LoggedSet, type Session, type Template, type TemplateExercise, type ExerciseMax, type CustomExercise, type SessionExercise,
} from './src/db';

type Tab = 'home' | 'templates' | 'progress' | 'calendar' | 'profile';
type Page = 'tabs' | 'folder' | 'template' | 'library' | 'detail' | 'workout' | 'timer' | 'history' | 'assistant';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Palette = typeof DARK_C;
type UiStyles = ReturnType<typeof createStyles>;
const UIContext = React.createContext<{ C: Palette; styles: UiStyles }>({ C: DARK_C, styles: {} as UiStyles });
const useUI = () => React.useContext(UIContext);

function UiIcon({ name, size, color }: { name: IconName; size: number; color?: string }) {
  const { C } = useUI();
  return <Ionicons name={name} size={size} color={color ?? C.white} />;
}
const ico = (name: IconName, size = 21, color?: string) =>
  <UiIcon name={name} size={size} color={color} />;

const countCompleted = (sets: LoggedSet[]) => sets.filter((s) => s.completed === 1).length;
const volume = (sets: Array<{ completed: number; weight: number; reps: number }>) =>
  sets.reduce((sum, s) => sum + (s.completed ? s.weight * s.reps : 0), 0);

// Courbe native, sans serveur ni accès réseau. Les valeurs représentent la charge
// maximale d'un exercice dans chaque séance.
function ExerciseTrend({ points }: { points: Array<{ value: number; date: string }> }) {
  const { C, styles } = useUI();
  if (!points.length) return <Text style={styles.muted}>Pas encore de données.</Text>;
  const data = points.slice(-9);
  const w = 310; const h = 145; const x0 = 34; const x1 = w - 14; const y0 = 12; const y1 = h - 28;
  const lo = Math.min(0, ...data.map((v) => v.value));
  const hi = Math.max(1, ...data.map((v) => v.value));
  const x = (i: number) => x0 + (x1 - x0) * (data.length === 1 ? .5 : i / (data.length - 1));
  const y = (value: number) => y1 - (value - lo) / Math.max(1, hi - lo) * (y1 - y0);
  const line = data.map((v, i) => `${x(i)},${y(v.value)}`).join(' ');
  return <View style={{ alignItems: 'center' }}>
    <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={155}>
      {[0, .5, 1].map((ratio) => <Line key={ratio} x1={x0} x2={x1} y1={y1 - ratio * (y1-y0)} y2={y1 - ratio * (y1-y0)} stroke={C.line} strokeWidth="1" strokeDasharray="3 4" />)}
      <Polyline points={line} stroke={C.blue} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v.value)} r="3.5" fill={C.blue} />)}
    </Svg>
    <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15 }}>
      <Text style={styles.muted}>{data[0].date}</Text>
      <Text style={styles.muted}>Max. {fmt(hi, 1)} kg</Text>
      <Text style={styles.muted}>{data[data.length - 1].date}</Text>
    </View>
  </View>;
}

function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  const { styles } = useUI();
  return <View style={[styles.panel, style]}>{children}</View>;
}
function H({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  const { styles } = useUI();
  return <View style={styles.headingRow}><Text style={styles.heading}>{children}</Text>{aside}</View>;
}
function Button({ label, onPress, secondary = false, danger = false, icon, compact = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; danger?: boolean; icon?: IconName;
  compact?: boolean; disabled?: boolean;
}) {
  const { C, styles } = useUI();
  return (
    <Pressable disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger,
        compact && styles.buttonCompact, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
    >
      {icon && ico(icon, 17, danger ? C.red : secondary ? C.white : '#FFFFFF')}
      <Text style={[styles.buttonText, secondary && { color: C.white }, danger && { color: C.red }]}>{label}</Text>
    </Pressable>
  );
}
function IconButton({ name, onPress, color, background }: {
  name: IconName; onPress: () => void; color?: string; background?: string;
}) {
  const { C, styles } = useUI();
  return <Pressable onPress={onPress} style={[styles.iconButton, { backgroundColor: background ?? C.surfaceRaised }]}>{ico(name, 20, color ?? C.white)}</Pressable>;
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { C, styles } = useUI();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: C.blue, borderColor: C.blue }]}>
      <Text style={[styles.chipText, active && { color: 'white' }]}>{label}</Text>
    </Pressable>
  );
}
function ExerciseGlyph({ exercise, size = 48 }: { exercise: Exercise; size?: number }) {
  const { C } = useUI();
  const colors: Record<string, string> = {
    Pectoraux: '#1165AF', Dos: '#176D50', Jambes: '#9B6319',
    Épaules: '#7546AC', Biceps: '#8A4B97', Triceps: '#9B463E', Abdos: '#18718A',
  };
  const icons: Record<Exercise['icon'], IconName> = {
    barbell: 'barbell-outline', fitness: 'fitness-outline', body: 'body-outline',
    walk: 'walk-outline', flash: 'flash-outline',
  };
  return (
    <View style={{ width: size, height: size, borderRadius: 11,
      justifyContent: 'center', alignItems: 'center', backgroundColor: colors[exercise.muscle] ?? C.blueSoft }}>
      {ico(icons[exercise.icon], size * 0.53, C.white)}
    </View>
  );
}
function Empty({ title, subtitle, icon }: { title: string; subtitle: string; icon: IconName }) {
  const { C, styles } = useUI();
  return <Panel style={{ alignItems: 'center', paddingVertical: 26, gap: 8 }}>
    {ico(icon, 30, C.muted)}
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={[styles.muted, { textAlign: 'center' }]}>{subtitle}</Text>
  </Panel>;
}
function ScreenTitle({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: () => void; action?: React.ReactNode }) {
  const { styles } = useUI();
  return <View style={styles.screenTitle}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
      {back && <IconButton name="chevron-back" onPress={back} background="transparent" />}
      <View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
      </View>
    </View>{action}
  </View>;
}
function BottomNav({ tab, setTab }: { tab: Tab; setTab: (v: Tab) => void }) {
  const { C, styles } = useUI();
  const tabs: Array<{ key: Tab; icon: IconName; chosen: IconName; label: string }> = [
    { key: 'home', icon: 'home-outline', chosen: 'home', label: 'Accueil' },
    { key: 'templates', icon: 'calendar-outline', chosen: 'calendar', label: 'Séances' },
    { key: 'progress', icon: 'stats-chart-outline', chosen: 'stats-chart', label: 'Stats' },
    { key: 'calendar', icon: 'calendar-outline', chosen: 'calendar', label: 'Calendrier' },
    { key: 'profile', icon: 'person-outline', chosen: 'person', label: 'Profil' },
  ];
  return <View style={styles.navBar}>{tabs.map((item) =>
    <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.navItem}>
      {ico(tab === item.key ? item.chosen : item.icon, 23, tab === item.key ? C.blue : C.muted)}
      <Text style={[styles.navLabel, tab === item.key && { color: C.blue }]}>{item.label}</Text>
    </Pressable>)}</View>;
}

export default function App() {
  return <SafeAreaProvider>
    <SQLiteProvider databaseName="muscu-bleu.db" onInit={initDatabase}>
      <Main />
    </SQLiteProvider>
  </SafeAreaProvider>;
}

function Main() {
  const db = useSQLiteContext();
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const C = useMemo(() => themeMode === 'light' ? LIGHT_C : DARK_C, [themeMode]);
  const styles = useMemo(() => createStyles(C), [C]);
  useEffect(() => { Appearance.setColorScheme(themeMode); }, [themeMode]);
  const [tab, setTab] = useState<Tab>('home');
  const [page, setPage] = useState<Page>('tabs');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [relations, setRelations] = useState<TemplateExercise[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [historySets, setHistorySets] = useState<HistorySet[]>([]);
  const [exerciseMaxes, setExerciseMaxes] = useState<ExerciseMax[]>([]);
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [activeSets, setActiveSets] = useState<LoggedSet[]>([]);
  const [activeSessionExercises, setActiveSessionExercises] = useState<SessionExercise[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [historyReturn, setHistoryReturn] = useState<Tab>('progress');
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('bench');
  const [detailReturn, setDetailReturn] = useState<Page>('library');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [libraryFilter, setLibraryFilter] = useState('Tous');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryLimit, setLibraryLimit] = useState(45);
  const [editingPlanExercise, setEditingPlanExercise] = useState<string | null>(null);
  const [planSets, setPlanSets] = useState('3');
  const [planReps, setPlanReps] = useState('8');
  const [planRest, setPlanRest] = useState('120');
  const [planFailure, setPlanFailure] = useState(false);
  const [planFailureGuide, setPlanFailureGuide] = useState('10');
  const [planSuperset, setPlanSuperset] = useState('0');
  const [planDropset, setPlanDropset] = useState(false);
  const [planNotes, setPlanNotes] = useState('');
  const [maxInput, setMaxInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('Pectoraux');
  const [customEquipment, setCustomEquipment] = useState('Autre');
  const [customDescription, setCustomDescription] = useState('');
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  const [progressFilter, setProgressFilter] = useState('Mois');
  const [statsScope, setStatsScope] = useState<'global' | 'folder' | 'template'>('global');
  const [statsFolder, setStatsFolder] = useState('');
  const [statsTemplate, setStatsTemplate] = useState('');
  const [resetInput, setResetInput] = useState('');
  const [progressExercise, setProgressExercise] = useState('bench');
  const [libraryForTemplate, setLibraryForTemplate] = useState<string | null>(null);
  const [modal, setModal] = useState<'none' | 'create' | 'folder' | 'renameFolder' | 'renameTemplate' | 'moveTemplate' | 'plan' | 'set' | 'profile' | 'max' | 'custom' | 'resetStats'>('none');
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [repsInput, setRepsInput] = useState('');
  const [rpeInput, setRpeInput] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({ username: 'Sportif', weight: '', height: '', goal: 'Progression' });
  const [profileDraft, setProfileDraft] = useState(settings);
  // Coach totalement facultatif : aucun calcul tant que l'ecran n'est pas ouvert.
  const [coachMuscles, setCoachMuscles] = useState<string[]>([]);
  const [coachMinutes, setCoachMinutes] = useState('100');
  const [coachTitle, setCoachTitle] = useState('Séance suggérée');
  const [coachGoal, setCoachGoal] = useState<Goal>('hypertrophy');
  const [coachLevel, setCoachLevel] = useState<Experience>('intermediate');
  const [coachFolder, setCoachFolder] = useState('');
  const [coachReturn, setCoachReturn] = useState<Page>('tabs');
  const [coachPreview, setCoachPreview] = useState<ReturnType<typeof generateWorkout> | null>(null);
  const [coachError, setCoachError] = useState('');
  const [restSeconds, setRestSeconds] = useState(90);
  const [restBase, setRestBase] = useState(120);
  const [restPaused, setRestPaused] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const overview = await fetchOverview(db);
    setFolders(overview.folders);
    setTemplates(overview.templates);
    setRelations(overview.templateExercises);
    setHistory(overview.history);
    setHistorySets(overview.historySets);
    setExerciseMaxes(overview.exerciseMaxes); setCustomExercises(overview.customExercises);
    setActive(overview.active);
    setActiveSets(overview.activeSets);
    setActiveSessionExercises(overview.activeSessionExercises);
  }, [db]);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        const loadedSettings = await getSettings(db);
        setSettings(loadedSettings);
        setThemeMode(loadedSettings.theme === 'light' ? 'light' : 'dark');
      } catch (err) {
        Alert.alert('Erreur de chargement', String(err));
      } finally { setLoading(false); }
    })();
  }, [db, refresh]);

  // Un horodatage absolu permet de reprendre le décompte après mise en veille
  // ou changement d'application, tant qu'Expo Go reste en cours d'exécution.
  useEffect(() => {
    if (page !== 'timer' || restPaused || restEndsAt === null) return;
    const sync = () => setRestSeconds(Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)));
    sync();
    const interval = setInterval(sync, 500);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => { clearInterval(interval); sub.remove(); };
  }, [page, restPaused, restEndsAt]);

  const allExercises: Exercise[] = useMemo(() => [...EXERCISES, ...customExercises.map(c=>({ ...c, pattern: 'cardio' as const, icon: 'fitness' as const }))], [customExercises]);
  const getExercise = (id: string): Exercise => allExercises.find(e => e.id === id) ?? getCatalogExercise(id);
  const maxFor = (id: string) => exerciseMaxes.find(m => m.exercise_id === id)?.weight ?? 0;
  const loadSuggestion = (id: string, count: number, failure = false) => {
    const max = maxFor(id);
    if (max <= 0 || !Number.isFinite(max) || count < 1) return 0;
    return Math.round((max / (1 + (count + (failure ? 0 : 2)) / 30)) / 2.5) * 2.5;
  };
  const workoutBlocks = useMemo(() => buildWorkoutBlocks(activeSessionExercises), [activeSessionExercises]);
  const currentBlock = workoutBlocks[Math.min(exerciseIndex, Math.max(0, workoutBlocks.length - 1))];
  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);
  const templatePlans = relations.filter((r) => r.template_id === selectedTemplate)
    .sort((a, b) => a.position - b.position);
  const templateExercises = templatePlans.map((r) => getExercise(r.exercise_id));
  const activeComplete = countCompleted(activeSets);
  const totalVolume = volume(historySets);
  const sessionsLast7 = history.filter((s) => s.finished_at && s.finished_at > Date.now() - 7 * 86400000);
  const lastSession = history[0];
  const lastSets = historySets.filter((s) => s.session_id === lastSession?.id);
  const lastVolume = volume(lastSets);
  const activeSeconds = active ? Math.max(0, Math.floor((Date.now() - active.started_at) / 1000)) : 0;

  async function safe(action: () => Promise<void>) {
    try { await action(); } catch (err) { Alert.alert('Une erreur est survenue', String(err)); }
  }
  async function beginWorkout(template: Template) {
    if (active) { setPage('workout'); return; }
    const plans = relations.filter((r) => r.template_id === template.id).sort((a, b) => a.position - b.position);
    if (!plans.length) { Alert.alert('Séance vide', 'Ajoute au moins un exercice avant de commencer.'); return; }
    await safe(async () => {
      const result = await startSession(db, template, plans, exerciseMaxes);
      setActive(result.session);
      setActiveSets(result.sets);
      setActiveSessionExercises(result.sessionExercises);
      setExerciseIndex(0);
      setPage('workout');
    });
  }
  function askFinishWorkout() {
    if (!active) return;
    if (activeComplete === 0) { Alert.alert('Aucune série validée', 'Valide au moins une série avant de terminer.'); return; }
    Alert.alert('Terminer la séance ?', 'Les séries cochées seront conservées dans l’historique.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Terminer', onPress: () => void safe(async () => {
        await finishSession(db, active.id);
        await refresh(); setPage('tabs'); setTab('home');
      }) },
    ]);
  }
  function askDiscardWorkout() {
    if (!active) return;
    Alert.alert('Supprimer la séance en cours ?', 'Toutes les séries de cette séance seront perdues.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void safe(async () => {
        await discardSession(db, active.id); await refresh(); setPage('tabs');
      }) },
    ]);
  }
  function beginRest(secondsOverride?: number) {
    const seconds = Math.min(600, Math.max(15, secondsOverride ?? (Number(settings.rest_duration) || 120)));
    setRestBase(seconds); setRestSeconds(seconds); setRestPaused(false);
    setRestEndsAt(Date.now() + seconds * 1000); setPage('timer');
  }
  function toggleRestPause() {
    if (restPaused) { setRestEndsAt(Date.now() + restSeconds * 1000); setRestPaused(false); }
    else { setRestSeconds(Math.max(0, Math.ceil(((restEndsAt ?? Date.now()) - Date.now()) / 1000)));
      setRestEndsAt(null); setRestPaused(true); }
  }
  function shiftRest(delta: number) {
    const remaining = restPaused ? restSeconds : Math.max(0, Math.ceil(((restEndsAt ?? Date.now()) - Date.now()) / 1000));
    const next = Math.max(0, remaining + delta);
    setRestSeconds(next);
    if (!restPaused) setRestEndsAt(Date.now() + next * 1000);
    setRestBase((base) => Math.max(15, base + delta));
  }
  function toggleSet(s: LoggedSet) {
    if (!s.completed && s.reps === 0) {
      Alert.alert('Répétitions à saisir', 'Saisis les répétitions réellement effectuées avant de valider cette série.');
      return;
    }
    void safe(async () => {
      const next = { ...s, completed: s.completed ? 0 : 1 };
      await updateLoggedSet(db, next);
      setActiveSets(items => items.map(item => item.id === s.id ? next : item));
      if (!next.completed || settings.auto_rest !== '1') return;
      // Le repos automatique n'arrive qu'à la fin du tour COMPLET :
      // A1 puis B1 -> repos ; A2 puis B2 -> repos, jamais entre A et B.
      const block = workoutBlocks.find(b=>b.exerciseIds.includes(s.exercise_id));
      if (!block) return;
      const rounds = buildWorkoutRounds(block, activeSets);
      const round = rounds.find(r=>r.rows.some(row=>row.set.id===s.id));
      if (!round) return;
      const complete = round.rows.every(row=>row.set.id===s.id || row.set.completed === 1);
      if (!complete) return;
      // Pas de repos automatique après la dernière série du bloc.
      const hasNext = rounds.some(r=>r.number>round.number && r.rows.some(row=>row.set.completed!==1));
      if (!hasNext) return;
      const seconds = activeSessionExercises.find(p=>p.exercise_id===s.exercise_id)?.rest_seconds ?? 120;
      if (seconds > 0) beginRest(seconds);
    });
  }
  function openSetEditor(s: LoggedSet) {
    setEditingId(s.id); setWeightInput(String(s.weight).replace('.', ','));
    setRepsInput(String(s.reps)); setRpeInput(s.rpe === null ? '' : String(s.rpe).replace('.', ','));
    setModal('set');
  }
  function parseNumber(value: string) { return Number(value.replace(',', '.')); }
  function saveSetChanges() {
    const s = activeSets.find((row) => row.id === editingId);
    if (!s) return;
    const weight = parseNumber(weightInput); const reps = Number(repsInput);
    const rpe = rpeInput.trim() ? parseNumber(rpeInput) : null;
    if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 0 || reps > 1000 ||
      (rpe !== null && (!Number.isFinite(rpe) || rpe < 0 || rpe > 10))) {
      Alert.alert('Valeurs incorrectes', 'Vérifie le poids, les répétitions et le RPE (entre 0 et 10).'); return;
    }
    void safe(async () => {
      const next = { ...s, weight, reps, rpe };
      await updateLoggedSet(db, next);
      setActiveSets((items) => items.map((item) => item.id === s.id ? next : item));
      setModal('none');
    });
  }
  function addSetToExercise(exerciseId: string) {
    if (!active) return;
    void safe(async () => {
      const sets = activeSets.filter(s=>s.exercise_id===exerciseId).sort((a,b)=>a.ordinal-b.ordinal);
      const newest = sets[sets.length - 1];
      const newSet = await createLoggedSet(db, active.id, exerciseId, newest);
      setActiveSets(prev => [...prev, newSet]);
    });
  }
  function removeEditingSet() {
    if (!editingId) return;
    const editing = activeSets.find(s=>s.id===editingId);
    if (!editing) return;
    const count = activeSets.filter(s=>s.exercise_id===editing.exercise_id).length;
    if (count<=1) { Alert.alert('Impossible', 'Conserve au moins une série par exercice.'); return; }
    void safe(async () => {
      await deleteLoggedSet(db, editingId);
      setActiveSets(prev => prev.filter(s=>s.id!==editingId));
      setModal('none');
    });
  }
  function openTemplate(t: Template) { setSelectedTemplate(t.id); setSelectedFolder(t.folder_id || ''); setPage('template'); }
  function openFolder(f: Folder) { setSelectedFolder(f.id); setPage('folder'); }
  function openLibrary(forTemplate: string | null = null) {
    setLibraryForTemplate(forTemplate); setLibraryQuery(''); setLibraryFilter('Tous'); setLibraryLimit(45); setPage('library');
  }
  function openExercise(e: Exercise) { setSelectedExercise(e.id); setDetailReturn(page); setPage('detail'); }
  function createNewTemplate() {
    const title = newTemplateTitle.trim();
    if (!title) { Alert.alert('Nom requis', 'Donne un nom à ta nouvelle séance.'); return; }
    void safe(async () => {
      if (!selectedFolder) { Alert.alert('Choisis un dossier', 'Commence par créer un dossier.'); return; }
      const id = await createTemplate(db, title, selectedFolder);
      await refresh(); setModal('none'); setNewTemplateTitle('');
      setSelectedTemplate(id); setPage('template');
    });
  }
  function createNewFolder() {
    const name = newFolderTitle.trim();
    if (!name) { Alert.alert('Nom requis', 'Indique le nom du dossier.'); return; }
    void safe(async () => {
      const id = await createFolder(db, name);
      await refresh(); setSelectedFolder(id); setNewFolderTitle(''); setModal('none'); setPage('folder');
    });
  }
  function editFolderName() {
    const name = editTitle.trim(); if (!name) return;
    void safe(async () => { await renameFolder(db, selectedFolder, name); await refresh(); setModal('none'); });
  }
  function editTemplateName() {
    const name = editTitle.trim(); if (!name) return;
    void safe(async () => { await renameTemplate(db, selectedTemplate, name); await refresh(); setModal('none'); });
  }
  function askDeleteFolder() {
    if (!selectedFolder) return;
    Alert.alert('Supprimer ce dossier ?', 'Seuls les dossiers vides peuvent être supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void safe(async () => {
        await deleteEmptyFolder(db, selectedFolder); await refresh(); setSelectedFolder(''); setPage('tabs'); setTab('home');
      }) },
    ]);
  }
  function askDeleteTemplate() {
    if (!selectedTemplate) return;
    Alert.alert('Supprimer cette séance ?', 'Les exercices de ce modèle disparaîtront, mais ton historique sera conservé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void safe(async () => {
        await deleteTemplate(db, selectedTemplate); await refresh(); setSelectedTemplate(''); setPage('folder');
      }) },
    ]);
  }
  function copyCurrentTemplate() {
    if (!selectedTemplateData) return;
    void safe(async () => { const id = await duplicateTemplate(db,selectedTemplateData); await refresh();setSelectedTemplate(id); });
  }
  function shiftExercise(exerciseId: string, direction: -1 | 1) {
    void safe(async () => { await reorderExercise(db,selectedTemplate,exerciseId,direction); await refresh(); });
  }
  function transferTemplate() {
    if (!selectedTemplate || !moveTarget) return;
    void safe(async () => { await moveTemplate(db, selectedTemplate, moveTarget); await refresh(); setSelectedFolder(moveTarget); setModal('none'); setPage('folder'); });
  }
  function saveMax() {
    const value = parseNumber(maxInput);
    if (!Number.isFinite(value) || value < 0 || value > 1000) { Alert.alert('1RM invalide','Entre une charge entre 0 et 1 000 kg.'); return; }
    void safe(async () => { await saveExerciseMax(db, selectedExercise, value); await refresh(); setModal('none'); });
  }
  function saveCustomExercise() {
    const name = customName.trim(); if (!name || !customMuscle) { Alert.alert('Champs manquants', 'Indique un nom et un muscle.'); return; }
    void safe(async () => {
      const id = await createCustomExercise(db,name,customMuscle,customEquipment.trim()||'Autre',customDescription.trim());
      await refresh(); setSelectedExercise(id);setModal('none');
    });
  }
  function savePlan() {
    if (!editingPlanExercise) return;
    const sets = Number(planSets), reps = Number(planReps), rest = Number(planRest);
    const guide = Number(planFailureGuide), group = Number(planSuperset);
    if (!Number.isInteger(sets) || sets < 1 || sets > 20 || !Number.isInteger(reps) || reps < 1 || reps > 200 || !Number.isInteger(rest) || rest < 0 || rest > 600 || !Number.isInteger(guide) || guide < 1 || guide > 30 || !Number.isInteger(group) || group < 0 || group > 99) {
      Alert.alert('Valeurs incorrectes', 'Séries : 1-20, répétitions : 1-200, repos : 0-600 secondes.'); return;
    }
    void safe(async () => { await changeExercisePlan(db, selectedTemplate, editingPlanExercise, sets, reps, rest, planFailure, guide, group, planDropset, planNotes.trim().slice(0, 2000)); await refresh(); setModal('none'); });
  }
  function editPlan(plan: TemplateExercise) {
    setEditingPlanExercise(plan.exercise_id); setPlanSets(String(plan.planned_sets));
    setPlanReps(String(plan.planned_reps)); setPlanRest(String(plan.rest_seconds));
    setPlanFailure(!!plan.to_failure); setPlanFailureGuide(String(plan.failure_rep_guide ?? 10));
    setPlanSuperset(String(plan.superset_group ?? 0)); setPlanDropset(!!plan.dropset); setPlanNotes(plan.notes ?? ''); setModal('plan');
  }
  function addToTemplate(exerciseId: string) {
    if (!libraryForTemplate) return;
    void safe(async () => {
      await addExercise(db, libraryForTemplate, exerciseId);
      await refresh(); setPage('template');
    });
  }
  function removeFromTemplate(exerciseId: string) {
    Alert.alert('Retirer cet exercice ?', 'Il sera retiré du programme mais l’historique restera conservé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => void safe(async () => {
        await removeExercise(db, selectedTemplate, exerciseId); await refresh();
      }) },
    ]);
  }
  function openProfileEditor() { setProfileDraft({ ...settings }); setModal('profile'); }
  function openCoach(folderId = '') {
    setCoachReturn(folderId?'folder':'tabs');
    setCoachFolder(folderId || folders[0]?.id || '');
    setCoachGoal(normalizeGoal(settings.goal));
    setCoachLevel(LEVELS.some(l=>l.id===settings.experience) ? settings.experience as Experience : 'intermediate');
    setCoachMuscles([]); setCoachMinutes('100'); setCoachPreview(null); setCoachError('');
    setCoachTitle('Séance suggérée'); setPage('assistant');
  }
  function proposeCoachWorkout() {
    try {
      const ageValue = Number(settings.age);
      const age = Number.isFinite(ageValue) && ageValue>0 ? ageValue : undefined;
      const plan=generateWorkout(allExercises,coachMuscles,Number(coachMinutes),coachGoal,coachLevel,age);
      if (!plan.items.length) { setCoachError('Aucun exercice ne tient dans cette durée. Choisis plus de temps ou moins de muscles.');setCoachPreview(null);return; }
      setCoachPreview(plan);setCoachError('');
    } catch (err) {setCoachPreview(null);setCoachError(String(err instanceof Error?err.message:err));}
  }
  function saveCoachWorkout() {
    if(!coachPreview?.items.length) return;
    const title=coachTitle.trim();
    if (!title) { Alert.alert('Nom requis','Donne un nom à la séance proposée.');return; }
    if (!folders.some(f=>f.id===coachFolder)) {Alert.alert('Dossier requis','Crée ou sélectionne un dossier avant de sauvegarder.');return;}
    void safe(async()=>{
      const templateId=await createSuggestedTemplate(db,title,coachFolder,coachPreview.items);
      await refresh(); setSelectedFolder(coachFolder);setSelectedTemplate(templateId);setCoachPreview(null);setPage('template');
    });
  }
  function saveProfile() {
    const age=profileDraft.age?.trim();
    const height=profileDraft.height?.replace(',','.').trim();
    const weight=profileDraft.weight?.replace(',','.').trim();
    if ((age && (!Number.isInteger(Number(age))||Number(age)<12||Number(age)>110)) ||
      (height && (!Number.isFinite(Number(height))||Number(height)<80||Number(height)>240)) ||
      (weight && (!Number.isFinite(Number(weight))||Number(weight)<20||Number(weight)>350))) {
      Alert.alert('Valeurs à vérifier','Âge : 12–110 ans, taille : 80–240 cm, poids : 20–350 kg. Ces informations restent facultatives.'); return;
    }
    void safe(async () => { await saveSettings(db, profileDraft); setSettings(profileDraft); setModal('none'); });
  }
  async function selectTheme(nextTheme: 'dark' | 'light') {
    await safe(async () => {
      const next = { ...settings, theme: nextTheme };
      await saveSettings(db, next);
      setSettings(next); setThemeMode(nextTheme);
    });
  }
  function confirmResetStatistics() {
    if (resetInput !== 'oui') return;
    void safe(async () => {
      await resetStatistics(db);
      await refresh();
      setResetInput(''); setSelectedHistory(null);
      setModal('none'); setPage('tabs'); setTab('progress');
      Alert.alert('Statistiques réinitialisées', 'Historique supprimé. Tes programmes, notes, dossiers et 1RM sont conservés.');
    });
  }
  const goBackFromDetail = () => setPage(detailReturn);

  const total7Volume = volume(historySets.filter((s) => s.finished_at > Date.now() - 7 * 86400000));
  const templateColors: Record<string, string> = { Push: '#AE4348', Pull: '#177856', Legs: '#9B671A', Upper: '#8550C3', Lower: '#086BC7', Perso: C.blue };

  function FolderCard({ folder }: { folder: Folder }) {
    const list = templates.filter(t => t.folder_id === folder.id);
    const count = list.reduce((acc, t) => acc + relations.filter(r => r.template_id === t.id).length, 0);
    return <Pressable onPress={() => openFolder(folder)} style={[styles.panel, { marginBottom: 11, paddingVertical: 17 }]}>
      <View style={styles.inlineRow}>
        <View style={{ width: 50, height: 53, backgroundColor: '#102744', borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
          {ico('folder-open-outline', 29, C.blue)}
        </View>
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{folder.name}</Text>
          <Text style={styles.muted}>{list.length} séance(s) • {count} exercice(s)</Text></View>
        {ico('chevron-forward', 22, C.muted)}
      </View>
    </Pressable>;
  }

  function homeScreen() {
    return <>
      <Text style={styles.title}>Training Programme</Text>
      <Text style={[styles.muted, { marginBottom: 22 }]}>Mes programmes d'entraînement</Text>
      {active && <Panel style={{ marginBottom: 15 }}>
        <Text style={styles.miniLabel}>SÉANCE EN COURS</Text>
        <Text style={[styles.cardTitle, { marginTop: 7, marginBottom: 5 }]}>{active.template_title}</Text>
        <Text style={styles.muted}>{activeComplete} série(s) enregistrée(s)</Text>
        <View style={{ height: 11 }} /><Button label="Reprendre ma séance" icon="play" onPress={() => setPage('workout')} />
      </Panel>}
      <H>Dossiers <IconButton name="add" background={C.blue} onPress={() => { setNewFolderTitle(''); setModal('folder'); }} /></H>
      {folders.length ? folders.map(f => <FolderCard key={f.id} folder={f} />) :
        <Empty title="Aucun dossier" subtitle="Crée ton premier dossier pour y ranger les séances que tu construiras." icon="folder-open-outline" />}
      <View style={{ height: 12 }} />
      <Button label="Créer un dossier" icon="folder-open-outline" onPress={() => { setNewFolderTitle(''); setModal('folder'); }} />
      <View style={{ height: 23 }} /><H>Ton activité <Text style={styles.muted}>(7 jours)</Text></H>
      <View style={styles.grid3}>
        <Panel style={styles.smallStat}><Text style={styles.statValue}>{sessionsLast7.length}</Text><Text style={styles.smallStatText}>Séances</Text></Panel>
        <Panel style={styles.smallStat}><Text style={styles.statValue}>{fmt(total7Volume)} kg</Text><Text style={styles.smallStatText}>Volume</Text></Panel>
        <Panel style={styles.smallStat}><Text style={styles.statValue}>{historySets.filter(s => s.finished_at > Date.now()-7*86400000).length}</Text><Text style={styles.smallStatText}>Séries</Text></Panel>
      </View>
    </>;
  }

  function templatesScreen() {
    return <>
      <ScreenTitle title="Mes séances" subtitle="Organisées dans tes dossiers"
        action={<IconButton name="add" background={C.blue} onPress={() => { setNewFolderTitle(''); setModal('folder'); }} />} />
      {folders.length ? folders.map(f => <FolderCard key={f.id} folder={f} />) :
        <Empty icon="folder-open-outline" title="Aucune séance" subtitle="Commence par créer ton premier dossier." />}
      <View style={{ height: 8 }} /><Button label="Nouveau dossier" icon="add" secondary onPress={() => { setNewFolderTitle(''); setModal('folder'); }} />
    </>;
  }

  function folderScreen() {
    const folder = folders.find(f => f.id === selectedFolder);
    if (!folder) return <Empty icon="folder-open-outline" title="Dossier introuvable" subtitle="Retourne à l’accueil." />;
    const list = templates.filter(t => t.folder_id === folder.id);
    return <>
      <ScreenTitle title={folder.name} subtitle={`${list.length} séance(s)`} back={() => { setPage('tabs'); setTab('home'); }}
        action={<IconButton name="create-outline" onPress={() => { setEditTitle(folder.name); setModal('renameFolder'); }} />} />
      <H>Mes séances <IconButton name="add" background={C.blue} onPress={() => { setNewTemplateTitle(''); setModal('create'); }} /></H>
      {list.map(t => {
        const plans = relations.filter(r => r.template_id === t.id).sort((a,b)=>a.position-b.position);
        return <Pressable key={t.id} onPress={() => openTemplate(t)} style={[styles.panel,{marginBottom:12,padding:12}]}>
          <View style={styles.inlineRow}>
            <View style={{flex:1}}><Text style={[styles.cardTitle,{fontSize:17}]}>{t.title}</Text>
              <Text style={styles.muted}>{plans.length} exercices</Text></View>
            {ico('chevron-forward',20,C.blue)}
          </View>
          {plans.map(plan => <View key={plan.exercise_id} style={[styles.inlineRow,{marginTop:11}]}>
            {customExercises.some(c=>c.id===plan.exercise_id) ? <ExerciseGlyph exercise={getExercise(plan.exercise_id)} size={64}/> : <ExerciseMotion theme={themeMode} exercise={getExercise(plan.exercise_id)} width={64} />}
            <View style={{flex:1}}><Text style={styles.cardTitle}>{getExercise(plan.exercise_id).name}</Text>
              <Text style={styles.muted}>{plan.planned_sets} × {plan.to_failure ? 'Échec technique' : `${plan.planned_reps} répétitions`} • repos {plan.rest_seconds ? `${plan.rest_seconds} s` : 'libre'} {plan.superset_group ? ` • Superset ${plan.superset_group}` : ''}</Text></View>
          </View>)}
          <View style={{height:12}} /><Button label="Voir / modifier la séance" secondary icon="create-outline" onPress={() => openTemplate(t)} />
        </Pressable>;
      })}
      {!list.length && <Empty title="Ce dossier est vide" subtitle="Ajoute ta première séance, puis ses exercices et objectifs." icon="barbell-outline" />}
      <View style={{height:10}}/><Button label="Créer une séance" icon="add" onPress={() => { setNewTemplateTitle(''); setModal('create'); }} />
      <View style={{height:9}}/><Button label="Séance suggérée (facultatif)" secondary icon="sparkles-outline" onPress={()=>openCoach(folder.id)} />
      {!list.length && <><View style={{height:10}}/><Button label="Supprimer ce dossier vide" icon="trash-outline" secondary onPress={askDeleteFolder} /></>}
    </>;
  }

  function templateScreen() {
    if (!selectedTemplateData) return null;
    return <>
      <ScreenTitle title={selectedTemplateData.title} subtitle="Exercices et objectifs de la séance"
        back={() => setPage('folder')}
        action={<IconButton name="create-outline" onPress={() => { setEditTitle(selectedTemplateData.title); setModal('renameTemplate'); }} />} />
      <H>Exercices ({templateExercises.length})</H>
      {templatePlans.map((plan, i) => {
        const e = getExercise(plan.exercise_id);
        return <Panel key={e.id} style={{ padding: 12, marginBottom: 10 }}>
          <View style={styles.inlineRow}>
            {customExercises.some(c=>c.id===e.id) ? <ExerciseGlyph exercise={e} size={78}/> : <ExerciseMotion theme={themeMode} exercise={e} width={78} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{i+1}. {e.name}</Text>
              <Text style={styles.muted}>{e.muscle} • {e.equipment}</Text>
              <Text style={[styles.blueLink,{marginTop:6}]}>{plan.planned_sets} séries × {plan.to_failure ? 'Échec' : `${plan.planned_reps} rép.`}</Text>
              <Text style={styles.muted}>Repos : {plan.rest_seconds === 0 ? 'libre' : `${plan.rest_seconds} s`} {plan.superset_group ? ` • Superset ${plan.superset_group}` : ''}{plan.dropset ? ' • Dropset final' : ''}</Text>
              {plan.notes?.trim() ? <Text style={[styles.muted,{marginTop:5}]} numberOfLines={3}>📝 {plan.notes}</Text> : null}
            </View>
            <IconButton name="close" color={C.red} background="transparent" onPress={() => removeFromTemplate(e.id)} />
          </View>
          <View style={{height:9}}/><View style={[styles.inlineRow,{justifyContent:'flex-end',marginBottom:9}]}>
            <IconButton name="arrow-up" onPress={() => shiftExercise(e.id,-1)} />
            <IconButton name="arrow-down" onPress={() => shiftExercise(e.id,1)} />
            <Text style={styles.muted}>Ordre</Text>
          </View><View style={styles.grid2}>
            <View style={{flex:1}}><Button label="Séries / repos" compact secondary icon="options-outline" onPress={() => editPlan(plan)} /></View>
            <View style={{flex:1}}><Button label="Animation" compact secondary icon="play-circle-outline" onPress={() => { setLibraryForTemplate(null); openExercise(e); }} /></View>
          </View>
        </Panel>;
      })}
      <View style={{height:8}}/><Button label="Ajouter un exercice" icon="add" secondary onPress={() => openLibrary(selectedTemplate)} />
      <View style={{height:12}}/><Button label="Commencer cette séance" icon="play" onPress={() => void beginWorkout(selectedTemplateData)} />
      <View style={{height:12}}/><Button label="Dupliquer cette séance" icon="copy-outline" secondary onPress={copyCurrentTemplate} />
      <View style={{height:12}}/><Button label="Déplacer vers un dossier" icon="folder-outline" secondary onPress={() => { setMoveTarget(selectedTemplateData.folder_id||''); setModal('moveTemplate'); }} />
      <View style={{height:9}}/><Button label="Supprimer cette séance" icon="trash-outline" danger onPress={askDeleteTemplate}/>
    </>;
  }

  function libraryScreen() {
    const filtered = allExercises.filter((e) =>
      (libraryFilter === 'Tous' || e.muscle === libraryFilter) &&
      (e.name + ' ' + e.muscle + ' ' + e.equipment).toLowerCase().includes(libraryQuery.toLowerCase()));
    return <>
      <ScreenTitle title="Exercices" subtitle={`${allExercises.length} exercices • recherche par muscle et matériel`}
        back={() => setPage(libraryForTemplate ? 'template' : 'tabs')} />
      <View style={{marginBottom:10}}><Button label="Créer mon exercice personnalisé" secondary icon="add-circle-outline" onPress={() => { setCustomName('');setCustomDescription('');setCustomEquipment('Autre');setModal('custom'); }} /></View>
      <View style={styles.searchBox}>{ico('search-outline', 18, C.muted)}
        <TextInput style={styles.searchInput} placeholder="Rechercher un exercice..." placeholderTextColor={C.muted}
          value={libraryQuery} onChangeText={v => {setLibraryQuery(v);setLibraryLimit(45);}} autoCapitalize="none" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={{ flexGrow: 0, marginBottom: 13 }}>
        {MUSCLES.map((m) => <Chip key={m} label={m} active={libraryFilter === m} onPress={() => setLibraryFilter(m)} />)}
      </ScrollView>
      {filtered.slice(0, libraryLimit).map((e) => <Pressable key={e.id} style={styles.listLine} onPress={() => libraryForTemplate ? addToTemplate(e.id) : openExercise(e)}>
        {customExercises.some(c=>c.id===e.id) ? <ExerciseGlyph exercise={e} size={52}/> : <ExerciseMotion theme={themeMode} exercise={e} width={52} animate={false} />}
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{e.name}</Text>
          <Text style={styles.muted}>{e.muscle} • {e.equipment}</Text></View>
        {ico(libraryForTemplate ? 'add-circle-outline' : 'chevron-forward', 22, libraryForTemplate ? C.blue : C.muted)}
      </Pressable>)}
      {filtered.length > libraryLimit && <Button label={`Afficher plus (${filtered.length - libraryLimit} restants)`} secondary onPress={() => setLibraryLimit(v=>v+45)} />}
      {!filtered.length && <Empty title="Aucun résultat" subtitle="Essaie une autre recherche." icon="search-outline" />}
    </>;
  }

  function detailScreen() {
    const ex = getExercise(selectedExercise);
    const hist = historySets.filter((s) => s.exercise_id === ex.id);
    const maxWeight = hist.length ? Math.max(...hist.map((s) => s.weight)) : 0;
    const bestVolume = hist.length ? Math.max(...hist.map((s) => s.weight * s.reps)) : 0;
    const cue = techniqueFor(ex);
    const isCustom = customExercises.some(c=>c.id===ex.id);
    return <>
      <ScreenTitle title="Détails exercice" back={goBackFromDetail} />
      <View style={{ alignItems: 'center', marginVertical: 20 }}>{isCustom ? <ExerciseGlyph exercise={ex} size={110}/> : <ExerciseMotion theme={themeMode} exercise={ex} width={204} showLabel />}</View>
      <Text style={[styles.muted, {textAlign:'center',marginBottom:12}]}>{isCustom ? 'Exercice personnel : aucune animation validée.' : 'Animation schématique de famille : elle ne montre pas forcément les angles exacts de cet exercice.'}</Text>
      <Text style={styles.title}>{ex.name}</Text><Text style={[styles.muted, { marginTop: 5 }]}>{ex.muscle} • {ex.equipment}</Text>
      <View style={{ height: 17 }} /><H>Muscles sollicités</H>
      <Panel><Text style={styles.blueLink}>Principal : {ex.muscle}</Text><Text style={[styles.muted,{marginTop:7}]}>Secondaires (indicatifs) : {secondaryMusclesFor(ex)}</Text></Panel>
      <View style={{ height: 20 }} /><H>Informations</H>
      <Panel><Text style={styles.bodyText}>{ex.description}</Text></Panel>
      <View style={{height:14}}/><H>Repères techniques</H>
      <Panel>
        {([['Position et prise',cue.setup],['Trajectoire et amplitude',cue.amplitude],['Exécution contrôlée',cue.execution],['À surveiller',cue.caution]] as const).map(([label,value]) =>
          <View key={label} style={{marginBottom:13}}><Text style={[styles.blueLink,{marginBottom:4}]}>{label}</Text><Text style={styles.bodyText}>{value}</Text></View>)}
        <Text style={styles.muted}>L'animation illustre une famille de mouvements, pas nécessairement les angles exacts de cette variante. Fais vérifier ta technique en personne si nécessaire.</Text>
      </Panel>
      <View style={{height:13}}/><H>Ma charge de référence</H>
      <Panel><View style={styles.inlineRow}><View style={{flex:1}}><Text style={styles.cardTitle}>1RM : {maxFor(ex.id) ? `${fmt(maxFor(ex.id),1)} kg` : 'non défini'}</Text>
       <Text style={styles.muted}>Estimation Epley, ≈ 2 répétitions en réserve</Text></View>
       <Button compact label="Modifier" secondary onPress={()=>{setMaxInput(String(maxFor(ex.id)||''));setModal('max');}} /></View>
       {maxFor(ex.id)>0 && <Text style={[styles.blueLink,{marginTop:10}]}>Ex. 8 répétitions : ≈ {fmt(loadSuggestion(ex.id,8),1)} kg</Text>}
      </Panel>
      <View style={{ height: 20 }} /><H>Mes records</H>
      <View style={styles.grid2}>
        <Panel style={{ flex: 1 }}><Text style={styles.muted}>Charge max</Text><Text style={styles.bigStat}>{fmt(maxWeight, 1)} kg</Text></Panel>
        <Panel style={{ flex: 1 }}><Text style={styles.muted}>Meilleure série</Text><Text style={styles.bigStat}>{fmt(bestVolume)} kg</Text></Panel>
      </View>
      <View style={{ height: 16 }} />
      {libraryForTemplate && <Button label="Ajouter au programme" icon="add" onPress={() => addToTemplate(ex.id)} />}
    </>;
  }

  function workoutScreen() {
    if (!active) return <Empty title="Aucune séance" subtitle="Démarre une séance pour commencer." icon="barbell" />;
    if (!currentBlock) return <Empty title="Aucun exercice" subtitle="Ce programme ne contient aucun exercice." icon="barbell" />;
    const inBlock = activeSets.filter(s=>currentBlock.exerciseIds.includes(s.exercise_id));
    const rounds = buildWorkoutRounds(currentBlock, inBlock);
    const completedSets = countCompleted(activeSets);
    const isSuperset = currentBlock.group > 0 && currentBlock.exerciseIds.length > 1;
    const headerName = isSuperset ? `Superset ${currentBlock.group}` : getExercise(currentBlock.exerciseIds[0]).name;
    const canGoNext = exerciseIndex < workoutBlocks.length - 1;
    const canGoPrevious = exerciseIndex > 0;
    return <>
      <View style={styles.inlineRow}>
        <IconButton name="chevron-back" background="transparent" onPress={() => { setPage('tabs'); setTab('home'); }} />
        <View style={{flex:1}}><Text style={styles.cardTitle}>{active.template_title}</Text>
          <Text style={styles.muted}>{completedSets}/{activeSets.length} séries validées</Text></View>
        <IconButton name="trash-outline" color={C.red} background="transparent" onPress={askDiscardWorkout} />
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill,
        {width:`${activeSets.length ? 100*completedSets/activeSets.length : 0}%`}]} /></View>
      <Text style={[styles.muted,{marginBottom:14}]}>Bloc {exerciseIndex+1}/{workoutBlocks.length} • {durationLabel(activeSeconds)}</Text>
      <View style={[styles.inlineRow,{marginBottom:10,justifyContent:'space-between'}]}>
        <View style={{flex:1}}><Text style={styles.title}>{headerName}</Text>
          <Text style={styles.muted}>{isSuperset ? `${currentBlock.exerciseIds.length} exercices alternés • sans repos entre eux` : 'Séries de travail'}</Text>
        </View>
        {isSuperset && <Text style={styles.supersetBadge}>SUPERSET</Text>}
      </View>
      {currentBlock.exerciseIds.map((id,i)=>{
        const ex=getExercise(id);
        const plan=activeSessionExercises.find(p=>p.exercise_id===id);
        const originalPlan=relations.find(p=>p.template_id===active.template_id && p.exercise_id===id);
        const last=historySets.find(h=>h.exercise_id===id);
        return <View key={id} style={styles.supersetExercise}>
          {isSuperset && <View style={styles.exerciseLetter}><Text style={styles.exerciseLetterText}>{String.fromCharCode(65+i)}</Text></View>}
          {customExercises.some(c=>c.id===ex.id) ? <ExerciseGlyph exercise={ex} size={54}/> : <ExerciseMotion theme={themeMode} exercise={ex} width={54} />}
          <View style={{flex:1,gap:3}}>
            <Text style={styles.cardTitle}>{ex.name}</Text>
            <Text style={styles.muted}>{ex.muscle} • Repos : {plan?.rest_seconds===0?'libre':`${plan?.rest_seconds??120} s`}</Text>
            {plan?.notes?.trim() ? <View style={styles.noteBox}><Text style={styles.noteTitle}>MES CONSIGNES</Text><Text style={styles.noteText}>{plan.notes}</Text></View> : null}
            {last && <Text style={styles.muted}>Dernière : {fmt(last.weight,1)} kg × {last.reps}</Text>}
            {originalPlan?.to_failure ? <Text style={styles.blueLink}>Objectif : échec technique</Text> : null}
            {maxFor(id)>0 ? <Text style={styles.blueLink}>Charge 1RM suggérée : {fmt(loadSuggestion(id, originalPlan?.to_failure?originalPlan.failure_rep_guide:(originalPlan?.planned_reps??8),!!originalPlan?.to_failure),1)} kg</Text> : null}
            {last && !originalPlan?.to_failure && last.rpe!==null && last.rpe<=8 && last.reps>=(originalPlan?.planned_reps??8) ?
              <Text style={styles.green}>Progression possible : +2,5 kg si exécution maîtrisée</Text> : null}
          </View>
          <IconButton name="information-circle-outline" onPress={()=>{setLibraryForTemplate(null);openExercise(ex);}} />
        </View>;
      })}
      {isSuperset && <Text style={[styles.muted,{marginVertical:11}]}>Enchaîne A → B{currentBlock.exerciseIds.length>2?' → …':''}, puis passe au tour suivant. Appuie sur une charge ou un nombre de répétitions pour les modifier.</Text>}
      <Panel style={{padding:0,overflow:'hidden',marginTop:10,marginBottom:12}}>
        {rounds.map((round,roundIndex)=><View key={`round-${round.number}`}>
          <View style={[styles.roundHeader,roundIndex>0&&{borderTopWidth:1,borderTopColor:C.line}]}>
            <Text style={styles.roundTitle}>{isSuperset ? `TOUR ${round.number}` : `SÉRIE ${round.number}`}</Text>
            <Text style={styles.muted}>{round.rows.filter(row=>row.set.completed===1).length}/{round.rows.length} terminé(s)</Text>
          </View>
          <View style={[styles.tableRow,styles.tableHeader]}>
            <Text style={[styles.tableCell,{flex:0.8}]}>{isSuperset?'Exo':'Série'}</Text>
            <Text style={styles.tableCell}>Charge</Text><Text style={styles.tableCell}>Rép.</Text>
            <Text style={[styles.tableCell,{flex:0.6}]}>✓</Text>
          </View>
          {round.rows.map(({exerciseIndex:exIndex,set:serie})=><View key={serie.id} style={[styles.tableRow,serie.completed===1&&{backgroundColor:themeMode==='light'?'#E6F8EF':'#0E221D'}]}>
            <Pressable style={{flex:0.8,alignItems:'center'}} onPress={()=>openSetEditor(serie)}>
              <Text style={[styles.tableText,isSuperset&&{color:C.blue}]}>{serie.set_kind==='drop'?`${String.fromCharCode(65+exIndex)} D`:isSuperset?String.fromCharCode(65+exIndex):serie.ordinal}</Text>
            </Pressable>
            <Pressable style={styles.cellButton} onPress={()=>openSetEditor(serie)}>
              <Text style={styles.tableText}>{fmt(serie.weight,2)} kg</Text>
            </Pressable>
            <Pressable style={styles.cellButton} onPress={()=>openSetEditor(serie)}>
              <Text style={styles.tableText}>{serie.reps===0?'—':serie.reps}</Text>
            </Pressable>
            <Pressable accessibilityLabel={`Valider série ${serie.ordinal} de ${getExercise(serie.exercise_id).name}`}
              style={{flex:0.6,alignItems:'center'}} onPress={()=>toggleSet(serie)}>
              {ico(serie.completed?'checkmark-circle':'ellipse-outline',23,serie.completed?C.green:C.muted)}
            </Pressable>
          </View>)}
        </View>)}
      </Panel>
      <Text style={[styles.muted,{marginBottom:10}]}>Le chronomètre est manuel par défaut ; l'option automatique se règle dans Profil.</Text>
      {currentBlock.exerciseIds.map((id,i)=><View key={`add-${id}`} style={{marginBottom:7}}>
        <Button label={`+ Série : ${isSuperset?`${String.fromCharCode(65+i)} · `:''}${getExercise(id).name}`}
          secondary compact icon="add" onPress={()=>addSetToExercise(id)}/>
      </View>)}
      <View style={{height:5}} />
      <View style={styles.grid2}>
        <View style={{flex:1}}><Button label="Précédent" icon="arrow-back" secondary disabled={!canGoPrevious} onPress={()=>setExerciseIndex(i=>Math.max(0,i-1))} /></View>
        <View style={{flex:1}}><Button label={canGoNext?'Bloc suivant':'Terminer'} icon={canGoNext?'arrow-forward':'checkmark'}
          onPress={()=>canGoNext?setExerciseIndex(i=>i+1):askFinishWorkout()} /></View>
      </View>
      <View style={{height:12}} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {workoutBlocks.map((block,idx)=><Chip key={block.key}
          label={block.group ? `SS ${block.group} · ${block.exerciseIds.length} exos` : getExercise(block.exerciseIds[0]).name}
          active={idx===exerciseIndex} onPress={()=>setExerciseIndex(idx)} />)}
      </ScrollView>
      <View style={{height:18}}/><Button label="Terminer la séance" icon="flag-outline" secondary onPress={askFinishWorkout}/>
    </>;
  }

  function assistantScreen() {
    return <>
      <ScreenTitle title="Séance suggérée" subtitle="Assistant facultatif • tu gardes le contrôle"
        back={()=>setPage(coachReturn)} />
      <Panel>
        <Text style={styles.cardTitle}>1. Muscles à entraîner</Text>
        <Text style={[styles.muted,{marginTop:7,marginBottom:12}]}>Sélectionne de 1 à 3 groupes musculaires.</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
          {COACH_MUSCLES.map(m=><Chip key={m} label={m} active={coachMuscles.includes(m)}
            onPress={()=>{setCoachPreview(null);setCoachError('');setCoachMuscles(old=>old.includes(m)?old.filter(x=>x!==m):old.length<3?[...old,m]:old);}}/>)}
        </View>
        <Text style={[styles.formLabel,{marginTop:15}]}>Temps disponible (minutes)</Text>
        <TextInput style={styles.field} value={coachMinutes} keyboardType="number-pad" onChangeText={v=>{setCoachMinutes(v);setCoachPreview(null);}} placeholder="Ex : 100 pour 1 h 40" placeholderTextColor={C.muted} />
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8}}>
          {[45,60,75,90,100,120].map(n=><Chip key={n} label={n===100?'1 h 40':`${n} min`}
            active={Number(coachMinutes)===n} onPress={()=>{setCoachMinutes(String(n));setCoachPreview(null);}}/>)}
        </View>
      </Panel>
      <View style={{height:12}}/>
      <Panel>
        <Text style={styles.cardTitle}>2. Objectif de cette séance</Text>
        <Text style={[styles.muted,{marginVertical:8}]}>Par défaut, celui enregistré dans ton profil.</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
          {GOALS.map(g=><Chip key={g.id} label={g.label} active={coachGoal===g.id} onPress={()=>{setCoachGoal(g.id);setCoachPreview(null);}} />)}
        </View>
        <Text style={styles.formLabel}>Niveau d'expérience</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
          {LEVELS.map(l=><Chip key={l.id} label={l.label} active={coachLevel===l.id} onPress={()=>{setCoachLevel(l.id);setCoachPreview(null);}}/>)}
        </View>
        <Text style={[styles.muted,{marginTop:10}]}>Échauffement, séries, repos et transitions sont inclus dans la durée estimée. La durée réelle varie selon ton rythme et les machines disponibles.</Text>
        <View style={{height:15}}/><Button label="Proposer une séance" icon="sparkles-outline" onPress={proposeCoachWorkout}/>
        {coachError? <Text style={[styles.muted,{color:C.red,marginTop:9}]}>{coachError}</Text>:null}
      </Panel>
      {coachPreview && <>
        <View style={{height:18}}/>
        <H>3. Aperçu modifiable</H>
        <Panel>
          <Text style={styles.cardTitle}>{coachPreview.items.length} exercices • environ {coachPreview.estimated_minutes} min / {coachPreview.target_minutes} min</Text>
          <Text style={[styles.muted,{marginTop:7}]}>Échauffement {coachPreview.warmup_minutes} min • retour au calme {coachPreview.cooldown_minutes} min (inclus). Les éventuelles minutes libres sont une marge de sécurité.</Text>
          {coachPreview.items.map((item,i)=><View key={item.exercise_id} style={[styles.settingLine,{alignItems:'flex-start',gap:8}]}>
            <Text style={[styles.blueLink,{minWidth:20}]}>{i+1}.</Text>
            <View style={{flex:1}}><Text style={styles.bodyText}>{item.name}</Text>
              <Text style={styles.muted}>{item.muscle} • {item.sets} séries × {item.reps} rép. • repos {item.rest_seconds} s</Text>
              <Text style={styles.muted}>≈ {item.estimated_minutes.toLocaleString('fr-FR')} min • {item.reason}</Text>
            </View>
          </View>)}
        </Panel>
        <View style={{height:12}}/>
        <Panel>
          <Text style={styles.formLabel}>Nom de la séance</Text>
          <TextInput style={styles.field} value={coachTitle} onChangeText={setCoachTitle} maxLength={80} placeholder="Ex : Pecs Biceps" placeholderTextColor={C.muted}/>
          <Text style={styles.formLabel}>Enregistrer dans le dossier</Text>
          {folders.length ? <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginVertical:8}}>
            {folders.map(f=><Chip key={f.id} label={f.name} active={coachFolder===f.id} onPress={()=>setCoachFolder(f.id)}/>)}
          </View>:<Text style={styles.muted}>Aucun dossier. Crée un dossier depuis l'accueil avant d'enregistrer.</Text>}
          <Text style={[styles.muted,{marginVertical:10}]}>Rien n'est enregistré automatiquement. Tu pourras réorganiser, remplacer, ajouter ou supprimer des exercices et ajuster chaque série après l'enregistrement.</Text>
          <Button label="Enregistrer ce brouillon" icon="save-outline" disabled={!coachFolder||!coachTitle.trim()} onPress={saveCoachWorkout}/>
          <View style={{height:8}}/><Button label="Recalculer la proposition" secondary onPress={proposeCoachWorkout}/>
        </Panel>
      </>}
    </>;
  }

  function timerScreen() {
    const circumference = 2 * Math.PI * 104;
    const fraction = restBase ? Math.min(1, Math.max(0, restSeconds / restBase)) : 0;
    return <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'flex-end', marginBottom: 25 }}>
        <Pressable onPress={() => setPage('workout')}><Text style={styles.blueLink}>Passer</Text></Pressable>
      </View>
      <View style={{ justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <View style={{ width: 260, height: 260, justifyContent: 'center', alignItems: 'center' }}>
          <Svg width={250} height={250} viewBox="0 0 250 250" style={{ position: 'absolute' }}>
            <Circle cx={125} cy={125} r={104} stroke={C.surfaceRaised} strokeWidth={10} fill="none" />
            <Circle cx={125} cy={125} r={104} stroke={C.blue} strokeWidth={10} fill="none"
              strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - fraction)} rotation={-90} origin="125, 125" />
          </Svg>
          <Text style={styles.cardTitle}>Repos</Text>
          <Text style={styles.timerText}>{durationLabel(restSeconds)}</Text>
          <Text style={styles.muted}>/ {durationLabel(restBase)}</Text>
        </View>
        {restSeconds === 0 && <Text style={[styles.green, { marginTop: 17 }]}>C'est reparti ! 💪</Text>}
        <View style={[styles.inlineRow, { marginTop: 25, gap: 16 }]}>
          <IconButton name="remove" onPress={() => shiftRest(-30)} />
          <IconButton name={restPaused ? 'play' : 'pause'} background={C.surfaceSoft}
            onPress={toggleRestPause} />
          <IconButton name="add" onPress={() => shiftRest(30)} />
        </View>
        <View style={styles.inlineRow}><Text style={styles.muted}>−30 s</Text><View style={{ width: 62 }} />
          <Text style={styles.muted}>+30 s</Text></View>
      </View>
      <Panel><Text style={styles.muted}>Prochain exercice</Text>
        <View style={[styles.inlineRow, { marginTop: 9 }]}>
          <ExerciseGlyph exercise={getExercise((workoutBlocks[Math.min(exerciseIndex+1,workoutBlocks.length-1)]?.exerciseIds[0] ?? currentBlock?.exerciseIds[0] ?? 'bench'))} />
          <View><Text style={styles.cardTitle}>{getExercise((workoutBlocks[Math.min(exerciseIndex+1,workoutBlocks.length-1)]?.exerciseIds[0] ?? currentBlock?.exerciseIds[0] ?? 'bench')).name}</Text>
          <Text style={styles.muted}>Continue à ton rythme</Text></View>
        </View>
      </Panel>
      <View style={{ height: 20 }} />
      <Button label="Revenir à la séance" onPress={() => setPage('workout')} />
    </View>;
  }

  function calendarScreen() {
    const now=new Date();const month=new Date(now.getFullYear(),now.getMonth()+calendarOffset,1);
    const year=month.getFullYear(),index=month.getMonth();const days=new Date(year,index+1,0).getDate();
    const leading=(month.getDay()+6)%7;
    const cells=Array.from({length:leading+days},(_,i)=>i-leading+1);
    const byDay=(day:number)=>history.filter(h=>{ const d=new Date(h.finished_at||0);return d.getFullYear()===year && d.getMonth()===index && d.getDate()===day;});
    return <>
      <ScreenTitle title="Calendrier" subtitle="Tes entraînements passés, sans encombrer l'accueil" />
      <Panel>
        <View style={[styles.inlineRow,{justifyContent:'space-between',marginBottom:18}]}>
          <IconButton name="chevron-back" onPress={()=>setCalendarOffset(v=>v-1)}/>
          <Text style={styles.cardTitle}>{month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</Text>
          <IconButton name="chevron-forward" onPress={()=>setCalendarOffset(v=>v+1)}/>
        </View>
        <View style={{flexDirection:'row',justifyContent:'space-around',marginBottom:8}}>{['L','M','M','J','V','S','D'].map((n,i)=><Text key={i} style={styles.muted}>{n}</Text>)}</View>
        <View style={{flexDirection:'row',flexWrap:'wrap'}}>{cells.map((day,i)=>{
          const valid=day>0, items=valid?byDay(day):[];
          return <View key={i} style={{width:'14.285%',height:47,alignItems:'center',justifyContent:'center'}}>
            {valid && <><Text style={[styles.bodyText,items.length>0&&{color:C.blue,fontWeight:'800'}]}>{day}</Text>
              {items.length>0&&<View style={{width:5,height:5,borderRadius:3,backgroundColor:C.blue,marginTop:2}}/>}</>}
          </View>;
        })}</View>
      </Panel>
      <View style={{height:20}}/><H>Séances du mois</H>
      {history.filter(h=>{const d=new Date(h.finished_at||0);return d.getFullYear()===year&&d.getMonth()===index;}).map(h=><Pressable key={h.id} style={styles.listLine} onPress={()=>{setSelectedHistory(h.id);setHistoryReturn('calendar');setPage('history');}}>
       {ico('checkmark-circle',22,C.blue)}<View style={{flex:1}}><Text style={styles.cardTitle}>{h.template_title}</Text><Text style={styles.muted}>{shortDate(h.finished_at||0)}</Text></View>{ico('chevron-forward',18,C.muted)}
      </Pressable>)}
      {!history.some(h=>{const d=new Date(h.finished_at||0);return d.getFullYear()===year&&d.getMonth()===index;})&&<Empty title="Aucune séance" subtitle="Les séances terminées apparaîtront ici." icon="calendar-outline" />}
    </>;
  }

  function progressScreen() {
    const now = Date.now();
    const since = progressFilter === 'Sem.' ? now - 7 * 86400000 : progressFilter === 'Mois' ? now - 30 * 86400000 : progressFilter === 'Année' ? now - 365 * 86400000 : 0;
    const scopeSessions = history.filter((session) => statsScope === 'global' ||
      (statsScope === 'folder' ? (session.folder_id ?? templates.find(t=>t.id===session.template_id)?.folder_id) === statsFolder : session.template_id === statsTemplate));
    const sessions = scopeSessions.filter((s) => (s.finished_at ?? 0) >= since);
    const sessionIds = new Set(sessions.map(s=>s.id));
    const sets = historySets.filter((s) => s.finished_at >= since && sessionIds.has(s.session_id));
    const vol = volume(sets);
    const currentIds = new Set(sessions.map((s) => s.id));
    const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
    const chosenExercise = exerciseIds.includes(progressExercise) ? progressExercise : (exerciseIds[0] ?? 'bench');
    const chosenSets = sets.filter((s) => s.exercise_id === chosenExercise);
    const maxWeight = chosenSets.length ? Math.max(...chosenSets.map((s) => s.weight)) : 0;
    const perSession = sessions.slice(0, 9).reverse().map((s) => ({
      key: s.id, date: shortDate(s.finished_at ?? 0),
      value: volume(sets.filter((x) => x.session_id === s.id)),
    }));
    const maxBar = Math.max(...perSession.map((s) => s.value), 1);
    const muscleCounts = Object.entries(sets.reduce((counts:Record<string,number>,row)=>{
      const muscle=getExercise(row.exercise_id).muscle;
      counts[muscle]=(counts[muscle]||0)+1;
      return counts;
    },{})).sort((a,b)=>b[1]-a[1]);
    return <>
      <ScreenTitle title="Progression" subtitle="Statistiques globales, par dossier ou par séance" />
      <View style={[styles.inlineRow,{marginBottom:12,gap:7}]}>
        {([['global','Global'],['folder','Dossier'],['template','Séance']] as const).map(([key,label])=><View key={key} style={{flex:1}}><Chip label={label} active={statsScope===key} onPress={()=>setStatsScope(key)}/></View>)}
      </View>
      {statsScope === 'folder' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:12}} contentContainerStyle={styles.chipRow}>
        {folders.map(f=><Chip key={f.id} label={f.name} active={statsFolder===f.id} onPress={()=>setStatsFolder(f.id)}/>)}
      </ScrollView> : null}
      {statsScope === 'template' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:12}} contentContainerStyle={styles.chipRow}>
        {templates.map(t=><Chip key={t.id} label={t.title} active={statsTemplate===t.id} onPress={()=>setStatsTemplate(t.id)}/>)}
      </ScrollView> : null}
      {statsScope==='folder' && !statsFolder ? <Text style={[styles.muted,{marginBottom:10}]}>Sélectionne un dossier pour afficher ses statistiques.</Text> : null}
      {statsScope==='template' && !statsTemplate ? <Text style={[styles.muted,{marginBottom:10}]}>Sélectionne une séance pour afficher ses statistiques.</Text> : null}
      <View style={[styles.inlineRow, { gap: 7, marginBottom: 16 }]}>
        {['Sem.', 'Mois', 'Année', 'Tout'].map((f) => <View style={{ flex: 1 }} key={f}>
          <Chip label={f} active={progressFilter === f} onPress={() => setProgressFilter(f)} /></View>)}
      </View>
      <View style={styles.grid2}>
        <Panel style={{ flex: 1 }}><Text style={styles.muted}>Volume total</Text>
          <Text style={styles.bigStat}>{fmt(vol)} kg</Text><Text style={styles.green}>{sets.length} séries</Text></Panel>
        <Panel style={{ flex: 1 }}><Text style={styles.muted}>Séances</Text>
          <Text style={styles.bigStat}>{currentIds.size}</Text><Text style={styles.green}>Enregistrées</Text></Panel>
      </View>
      <View style={[styles.grid2, { marginTop: 10 }]}>
        <Panel style={{ flex: 1 }}><Text style={styles.muted}>Moyenne / séance</Text>
          <Text style={styles.bigStat}>{fmt(sessions.length ? vol / sessions.length : 0)} kg</Text></Panel>
        <Panel style={{ flex: 1 }}><Text style={styles.muted}>Exercices pratiqués</Text>
          <Text style={styles.bigStat}>{new Set(sets.map((s) => s.exercise_id)).size}</Text></Panel>
      </View>
      <View style={{ height: 18 }} /><H>Séries par groupe musculaire</H>
      <Panel>{muscleCounts.length ? muscleCounts.map(([muscle,count])=><View key={muscle} style={{marginBottom:11}}>
        <View style={[styles.inlineRow,{justifyContent:'space-between',marginBottom:5}]}><Text style={styles.bodyText}>{muscle}</Text><Text style={styles.muted}>{count} séries</Text></View>
        <View style={[styles.progressTrack,{marginVertical:0}]}><View style={[styles.progressFill,{width:`${100*count/Math.max(1,muscleCounts[0][1])}%`}]} /></View>
      </View>) : <Text style={styles.muted}>Aucune série terminée sur cette période.</Text>}
      <Text style={styles.muted}>Ces valeurs comptent les muscles principaux des exercices, sans additionner les muscles secondaires.</Text>
      </Panel>
      <View style={{ height: 18 }} /><H>Volume par séance (kg)</H>
      <Panel>
        {perSession.length ? <View style={{ height: 175, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 5 }}>
          {perSession.map((s) => <View key={s.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Text style={{ fontSize: 10, color: C.muted, marginBottom: 4 }} numberOfLines={1}>{fmt(s.value)}</Text>
            <View style={{ width: '72%', minHeight: s.value > 0 ? 5 : 2,
              height: Math.max(2, 120 * s.value / maxBar), backgroundColor: C.blue, borderRadius: 4 }} />
            <Text style={{ color: C.muted, fontSize: 9, marginTop: 6 }}>{s.date}</Text>
          </View>)}
        </View> : <Text style={styles.muted}>Termine ta première séance pour voir les graphiques.</Text>}
      </Panel>
      <View style={{ height: 20 }} /><H>Progression par exercice</H>
      {exerciseIds.length ? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 12 }} contentContainerStyle={styles.chipRow}>
          {exerciseIds.map((id) => <Chip key={id} label={getExercise(id).name} active={chosenExercise === id} onPress={() => setProgressExercise(id)} />)}
        </ScrollView>
        <Panel>
          <Text style={styles.cardTitle}>{getExercise(chosenExercise).name}</Text>
          <Text style={[styles.muted, { marginTop: 7 }]}>Charge maximale enregistrée</Text>
          <Text style={styles.bigStat}>{fmt(maxWeight, 2)} kg</Text>
          <Text style={[styles.muted, { marginTop: 7 }]}>{chosenSets.length} séries sur la période sélectionnée</Text>
          <View style={{ height: 16 }} />
          <ExerciseTrend points={sessions.slice().reverse().map((session) => {
            const best = chosenSets.filter((row) => row.session_id === session.id);
            return best.length ? { date: shortDate(session.finished_at ?? 0), value: Math.max(...best.map((x) => x.weight)) } : null;
          }).filter((x): x is { date: string; value: number } => x !== null)} />
        </Panel>
      </> : <Empty title="Pas encore de record" subtitle="Tes performances apparaîtront après ta première séance." icon="stats-chart-outline" />}
      <View style={{ height: 18 }} /><H>Historique récent</H>
      {sessions.slice(0, 20).map((s) => <Pressable key={s.id} onPress={() => { setSelectedHistory(s.id);setHistoryReturn('progress'); setPage('history'); }}>
        <Panel style={{ marginBottom: 10 }}>
          <View style={styles.inlineRow}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{s.template_title}</Text>
            <Text style={styles.muted}>{shortDate(s.finished_at ?? 0)} • {durationLabel(((s.finished_at ?? 0) - s.started_at) / 1000)}</Text>
          </View><Text style={styles.statValue}>{fmt(volume(sets.filter((x) => x.session_id === s.id)))} kg</Text>
          {ico('chevron-forward', 17, C.muted)}</View>
        </Panel>
      </Pressable>)}
    </>;
  }

  function historyScreen() {
    const session = history.find((h) => h.id === selectedHistory);
    if (!session) return <Empty title="Historique introuvable" subtitle="Retourne aux statistiques." icon="time-outline" />;
    const sets = historySets.filter((s) => s.session_id === session.id);
    const ids = [...new Set(sets.map((s) => s.exercise_id))];
    return <>
      <ScreenTitle title={session.template_title} subtitle={shortDate(session.finished_at ?? 0)}
        back={() => { setPage('tabs'); setTab(historyReturn); }} />
      <Panel style={{ marginBottom: 17 }}>
        <View style={styles.grid3}>
          <View style={{ flex: 1 }}><Text style={styles.bigStat}>{ids.length}</Text><Text style={styles.muted}>Exercices</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.bigStat}>{sets.length}</Text><Text style={styles.muted}>Séries</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.bigStat}>{fmt(volume(sets))}</Text><Text style={styles.muted}>Volume (kg)</Text></View>
        </View>
        <Text style={[styles.muted, { marginTop: 14 }]}>Durée : {durationLabel(((session.finished_at ?? session.started_at) - session.started_at) / 1000)}</Text>
      </Panel>
      {ids.map((exerciseId) => {
        const ex = getExercise(exerciseId);
        const exSets = sets.filter((s) => s.exercise_id === exerciseId).sort((a,b) => a.ordinal - b.ordinal);
        return <Panel key={exerciseId} style={{ marginBottom: 12 }}>
          <View style={[styles.inlineRow, { marginBottom: 11 }]}><ExerciseGlyph exercise={ex} />
            <View><Text style={styles.cardTitle}>{ex.name}</Text><Text style={styles.muted}>{exSets.length} séries validées</Text></View>
          </View>
          {exSets.map((set) => <View key={set.id} style={styles.settingLine}>
            <Text style={styles.muted}>Série {set.ordinal}{set.set_kind==='drop'?' (drop)':''}</Text>
            <Text style={styles.bodyText}>{fmt(set.weight, 2)} kg × {set.reps} reps{set.rpe !== null ? ` • RPE ${set.rpe}` : ''}</Text>
          </View>)}
        </Panel>;
      })}
    </>;
  }

  async function shareExport(kind: 'json' | 'csv') {
    await safe(async () => {
      const snapshot = await exportAllData(db);
      const stamp = new Date().toISOString().slice(0, 10);
      const content = kind === 'json' ? JSON.stringify(snapshot, null, 2) : [
        'Date;Séance;Exercice;Série;Poids (kg);Répétitions;RPE;Volume (kg)',
        ...historySets.slice().reverse().map((s) => {
          const fields = [new Date(s.finished_at).toLocaleDateString('fr-FR'), s.template_title, getExercise(s.exercise_id).name,
            s.ordinal, s.weight, s.reps, s.rpe ?? '', s.weight * s.reps];
          return fields.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(';');
        }),
      ].join('\n');
      if (!(await Sharing.isAvailableAsync())) { Alert.alert('Partage indisponible', 'Le partage de fichier est indisponible sur cet appareil.'); return; }
      // API FileSystem moderne (Expo SDK 58), compatible avec Expo Go.
      const file = new File(Paths.cache, `training-programme-${stamp}.${kind}`);
      await file.write(kind === 'csv' ? '\uFEFF' + content : content);
      await Sharing.shareAsync(file.uri, {
        UTI: kind === 'csv' ? 'public.comma-separated-values-text' : 'public.json',
      });
    });
  }

  function profileScreen() {
    return <>
      <ScreenTitle title="Mon profil" action={<IconButton name="settings-outline" onPress={openProfileEditor} />} />
      <Panel style={{ marginTop: 6 }}>
        <View style={styles.inlineRow}>
          <View style={[styles.avatar]}>{ico('person', 29, C.white)}</View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{settings.username || 'Sportif'}</Text>
            <Text style={styles.muted}>Bienvenue sur Training Programme</Text></View>
        </View>
      </Panel>
      <View style={{ height: 18 }} /><H>Mes infos</H>
      <Panel style={{ paddingVertical: 5 }}>
        {[
          ['Âge', settings.age ? settings.age + ' ans' : 'Non renseigné'],
          ['Poids', settings.weight ? settings.weight + ' kg' : 'Non renseigné'],
          ['Taille', settings.height ? settings.height + ' cm' : 'Non renseignée'],
          ['Objectif', goalLabel(normalizeGoal(settings.goal))],
          ['Niveau', LEVELS.find(x=>x.id===settings.experience)?.label || 'Intermédiaire'],
        ].map(([label, value]) => <View key={label} style={styles.settingLine}>
          <Text style={styles.bodyText}>{label}</Text><Text style={styles.muted}>{value}</Text>
        </View>)}
      </Panel>
      <View style={{ height: 18 }} /><H>Préférences</H>
      <Panel>
        <View style={styles.settingLine}><Text style={styles.bodyText}>Unités</Text><Text style={styles.blueLink}>kg</Text></View>
        <Text style={[styles.bodyText,{marginTop:10}]}>Apparence de l'application</Text>
        <View style={[styles.inlineRow,{marginTop:10,marginBottom:8}]}>
          <View style={{flex:1}}><Button label="Sombre" icon="moon-outline" secondary={themeMode!=='dark'} onPress={()=>void selectTheme('dark')}/></View>
          <View style={{flex:1}}><Button label="Clair" icon="sunny-outline" secondary={themeMode!=='light'} onPress={()=>void selectTheme('light')}/></View>
        </View>
        <View style={styles.settingLine}><Text style={styles.bodyText}>Repos par défaut</Text>
          <Text style={styles.blueLink}>{settings.rest_duration ?? '120'} s</Text></View>
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
          {[60, 90, 120, 180].map((seconds) => <Chip key={seconds} label={`${seconds} s`} active={Number(settings.rest_duration ?? 120) === seconds}
            onPress={() => void safe(async () => { const next = { ...settings, rest_duration: String(seconds) }; await saveSettings(db, next); setSettings(next); })} />)}
        </View>
        <Pressable style={styles.settingLine} onPress={() => void safe(async () => {
          const next = { ...settings, auto_rest: settings.auto_rest === '0' ? '1' : '0' };
          await saveSettings(db, next); setSettings(next);
        })}><Text style={styles.bodyText}>Repos automatique après une série</Text>
          <Text style={styles.blueLink}>{settings.auto_rest === '1' ? 'Oui' : 'Non (défaut)'}</Text></Pressable>
        <View style={styles.settingLine}><Text style={styles.bodyText}>Données</Text><Text style={styles.green}>Stockées sur cet iPhone</Text></View>
      </Panel>
      <View style={{ height: 16 }} />
      <Panel>
        <Text style={styles.cardTitle}>Assistant d’entraînement (facultatif)</Text>
        <Text style={[styles.muted,{marginTop:7,marginBottom:13}]}>Propose une séance selon les muscles, ton objectif et le temps disponible. Tu peux la modifier avant de la lancer.</Text>
        <Button label="Composer une séance suggérée" secondary icon="sparkles-outline" onPress={()=>openCoach()} />
      </Panel>
      <View style={{height:12}}/>
      <Button label="Modifier mon profil" icon="create-outline" onPress={openProfileEditor} />
      <View style={{ height: 20 }} /><H>Exporter mes données</H>
      <Text style={[styles.muted, { marginBottom: 12 }]}>Sauvegarde externe recommandée : enregistre les fichiers dans l'app Fichiers ou sur iCloud Drive.</Text>
      <View style={styles.grid2}>
        <View style={{ flex: 1 }}><Button label="Historique CSV" secondary icon="document-text-outline" onPress={() => void shareExport('csv')} /></View>
        <View style={{ flex: 1 }}><Button label="Sauvegarde JSON" secondary icon="download-outline" onPress={() => void shareExport('json')} /></View>
      </View>
      <View style={{height:20}} /><H>Zone sensible</H>
      <Panel><Text style={styles.bodyText}>Effacer mes statistiques</Text>
        <Text style={[styles.muted,{marginTop:8,marginBottom:12}]}>Supprime l'historique des séances terminées et leurs performances. Les dossiers, programmes, notes, 1RM et réglages sont conservés. Une sauvegarde JSON est fortement conseillée.</Text>
        <Button label="Réinitialiser mes statistiques" danger icon="trash-outline" onPress={()=>{setResetInput('');setModal('resetStats');}}/>
      </Panel>
      <View style={{ height: 20 }} /><Text style={[styles.muted, { textAlign: 'center', fontSize: 12 }]}>Training Programme • V0.8 • Données locales</Text>
    </>;
  }

  function dialog() {
    return <Modal visible={modal !== 'none'} transparent animationType="fade" onRequestClose={() => setModal('none')}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
        <ScrollView style={[styles.dialog,{maxHeight:"88%"}]} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:3}}>
          <View style={styles.headingRow}><Text style={styles.subtitle}>
            {modal === 'folder' ? 'Nouveau dossier' : modal === 'renameFolder' ? 'Renommer le dossier' :
              modal === 'renameTemplate' ? 'Renommer la séance' : modal === 'moveTemplate' ? 'Déplacer la séance' :
              modal === 'plan' ? 'Objectifs de l’exercice' : modal === 'resetStats' ? 'Effacer toutes les statistiques' : modal === 'max' ? 'Ma charge maximale (1RM)' : modal === 'custom' ? 'Mon exercice' : modal === 'create' ? 'Nouvelle séance' : modal === 'set' ? 'Modifier la série' : 'Modifier mon profil'}
          </Text><IconButton name="close" onPress={() => setModal('none')} /></View>
          {modal === 'resetStats' && <>
            <Text style={styles.bodyText}>Cette action supprimera définitivement toutes les séances enregistrées dans l'historique, les volumes et les records calculés.</Text>
            <Text style={[styles.muted,{marginTop:9}]}>Les dossiers, programmes, notes, 1RM et paramètres resteront enregistrés. Il est conseillé d'exporter une sauvegarde JSON avant cette action.</Text>
            <Text style={[styles.formLabel,{marginTop:18}]}>Pour confirmer, tape exactement « oui » :</Text>
            <TextInput style={styles.field} value={resetInput} onChangeText={setResetInput} placeholder="oui" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} />
            <View style={{height:18}}/><Button label="Effacer définitivement mes statistiques" danger disabled={resetInput !== 'oui'} onPress={confirmResetStatistics} />
            <View style={{height:9}}/><Button label="Annuler" secondary onPress={()=>setModal('none')} />
          </>}
          {modal === 'folder' && <>
            <Text style={styles.formLabel}>Nom du dossier</Text>
            <TextInput style={styles.field} value={newFolderTitle} onChangeText={setNewFolderTitle} placeholder="Ex : Programme 5 jours" placeholderTextColor={C.muted} />
            <View style={{height:16}}/><Button label="Créer le dossier" onPress={createNewFolder} />
          </>}
          {(modal === 'renameFolder' || modal === 'renameTemplate') && <>
            <Text style={styles.formLabel}>Nouveau nom</Text>
            <TextInput style={styles.field} value={editTitle} onChangeText={setEditTitle} autoFocus />
            <View style={{height:16}}/><Button label="Enregistrer le nom" onPress={modal === 'renameFolder' ? editFolderName : editTemplateName} />
          </>}
          {modal === 'moveTemplate' && <>
            <Text style={styles.formLabel}>Choisis le dossier de destination :</Text>
            {folders.map(f => <Pressable key={f.id} onPress={()=>setMoveTarget(f.id)} style={[styles.settingLine, {paddingHorizontal:6}]}>
              <Text style={styles.bodyText}>{f.name}</Text>
              {ico(moveTarget===f.id?'radio-button-on':'radio-button-off',20,moveTarget===f.id?C.blue:C.muted)}
            </Pressable>)}
            <View style={{height:16}}/><Button label="Déplacer" onPress={transferTemplate} disabled={!moveTarget} />
          </>}
          {modal === 'plan' && <>
            <Text style={styles.muted}>{getExercise(editingPlanExercise||'bench').name}</Text>
            <Button label="Suggérer séries / reps selon mon objectif" secondary icon="sparkles-outline" onPress={()=>{
              const e=getExercise(editingPlanExercise||'bench');
              const age=Number(settings.age);const suggestion=proposeExercise(e,normalizeGoal(settings.goal),
                LEVELS.some(l=>l.id===settings.experience)?settings.experience as Experience:'intermediate',age>0?age:undefined);
              setPlanSets(String(suggestion.sets));setPlanReps(String(suggestion.reps));setPlanRest(String(suggestion.rest_seconds));setPlanFailure(false);
              Alert.alert('Proposition uniquement','Tu peux ajuster ces valeurs puis les enregistrer. Aucune modification automatique des autres exercices.');
            }}/>
            <Text style={[styles.muted,{marginVertical:7}]}>Optionnel : aucun changement avant « Enregistrer les objectifs ».</Text>
            <Text style={styles.formLabel}>Nombre de séries</Text>
            <TextInput style={styles.field} keyboardType="number-pad" value={planSets} onChangeText={setPlanSets} />
            <Text style={styles.formLabel}>Répétitions visées par série</Text>
            <View style={{flexDirection:'row',gap:8,marginBottom:6}}>
             <Chip label="Nombre de répétitions" active={!planFailure} onPress={()=>setPlanFailure(false)}/>
             <Chip label="Échec technique" active={planFailure} onPress={()=>setPlanFailure(true)}/>
            </View>
            {!planFailure ? <TextInput style={styles.field} keyboardType="number-pad" value={planReps} onChangeText={setPlanReps} /> : <>
              <Text style={styles.muted}>Le nombre réalisé sera saisi pendant la séance. Repère indicatif pour calculer la charge :</Text>
              <TextInput style={styles.field} keyboardType="number-pad" value={planFailureGuide} onChangeText={setPlanFailureGuide}/>
              <Text style={styles.muted}>Arrête-toi avant de perdre le contrôle du mouvement.</Text>
            </>}
            <Text style={styles.formLabel}>Temps de repos (secondes, 0 pour libre)</Text>
            <TextInput style={styles.field} keyboardType="number-pad" value={planRest} onChangeText={setPlanRest} />
            <Text style={styles.formLabel}>Superset (même numéro pour les exercices à enchaîner)</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
              {['0','1','2','3','4'].map(n=><Chip key={n} label={n==='0'?'Aucun':`Groupe ${n}`} active={planSuperset===n} onPress={()=>setPlanSuperset(n)}/>)}
            </View>
            <Pressable style={styles.settingLine} onPress={()=>setPlanDropset(v=>!v)}>
              <Text style={styles.bodyText}>Ajouter un dropset final (-20 % suggéré)</Text>
              {ico(planDropset?'checkbox':'square-outline',22,planDropset?C.blue:C.muted)}
            </Pressable>
            <Text style={styles.formLabel}>Notes / indications personnelles pour cet exercice</Text>
            <TextInput style={[styles.field,{minHeight:100,textAlignVertical:'top',paddingVertical:12}]} multiline value={planNotes} onChangeText={setPlanNotes} maxLength={2000}
              placeholder="Ex : prises neutres, ne pas balancer le buste, contrôler la descente..." placeholderTextColor={C.muted} />
            <Text style={styles.muted}>Ces notes seront visibles pendant la séance, même dans un superset.</Text>
            <View style={{height:13}}/><Button label="Enregistrer les objectifs" onPress={savePlan}/>
          </>}
          {modal === 'create' && <>
            <Text style={styles.formLabel}>Nom du programme</Text>
            <TextInput style={styles.field} value={newTemplateTitle} onChangeText={setNewTemplateTitle} placeholder="Ex : Push A" placeholderTextColor={C.muted} />
            <View style={{ height: 17 }} /><Button label="Créer le programme" onPress={createNewTemplate} />
          </>}
          {modal === 'set' && <>
            <Text style={styles.formLabel}>Poids (kg)</Text>
            <View style={styles.numberRow}>
              <TextInput style={[styles.field, { flex: 1 }]} keyboardType="decimal-pad" value={weightInput} onChangeText={setWeightInput} />
              <IconButton name="remove" onPress={() => setWeightInput(String(Math.max(0, parseNumber(weightInput) - 2.5)).replace('.', ','))} />
              <IconButton name="add" onPress={() => setWeightInput(String((parseNumber(weightInput) || 0) + 2.5).replace('.', ','))} />
            </View>
            <Text style={styles.formLabel}>Répétitions</Text>
            <View style={styles.numberRow}>
              <TextInput style={[styles.field, { flex: 1 }]} keyboardType="number-pad" value={repsInput} onChangeText={setRepsInput} />
              <IconButton name="remove" onPress={() => setRepsInput(String(Math.max(0, (Number(repsInput) || 0) - 1)))} />
              <IconButton name="add" onPress={() => setRepsInput(String((Number(repsInput) || 0) + 1))} />
            </View>
            <Text style={styles.formLabel}>RPE (facultatif, 0 à 10)</Text>
            <TextInput style={styles.field} keyboardType="decimal-pad" placeholder="Ex : 8" placeholderTextColor={C.muted}
              value={rpeInput} onChangeText={setRpeInput} />
            <View style={{ height: 14 }} /><Button label="Enregistrer" onPress={saveSetChanges} />
            <View style={{ height: 9 }} /><Button label="Supprimer cette série" danger onPress={removeEditingSet} />
          </>}
          {modal === 'max' && <>
            <Text style={styles.muted}>{getExercise(selectedExercise).name}</Text>
            <Text style={styles.formLabel}>1RM mesuré ou estimé (kg)</Text>
            <TextInput style={styles.field} keyboardType="decimal-pad" placeholder="Ex : 80" placeholderTextColor={C.muted} value={maxInput} onChangeText={setMaxInput}/>
            <Text style={[styles.muted,{marginVertical:12}]}>La charge calculée n'est qu'une suggestion, pas une prescription. Aucun test maximal n'est nécessaire.</Text>
            <Button label="Enregistrer le 1RM" onPress={saveMax}/>
          </>}
          {modal === 'custom' && <>
            <Text style={styles.formLabel}>Nom</Text><TextInput style={styles.field} value={customName} onChangeText={setCustomName}/>
            <Text style={styles.formLabel}>Groupe musculaire</Text>
            <ScrollView horizontal contentContainerStyle={{gap:5}} style={{flexGrow:0}}>
              {MUSCLES.filter(x=>x!=='Tous').map(m=><Chip key={m} label={m} active={customMuscle===m} onPress={()=>setCustomMuscle(m)}/>)}
            </ScrollView>
            <Text style={styles.formLabel}>Matériel</Text><TextInput style={styles.field} value={customEquipment} onChangeText={setCustomEquipment}/>
            <Text style={styles.formLabel}>Instructions personnelles</Text><TextInput style={styles.field} value={customDescription} onChangeText={setCustomDescription} multiline/>
            <Text style={[styles.muted,{marginVertical:9}]}>Animation schématique générique tant qu'une démonstration validée n'est pas ajoutée.</Text>
            <Button label="Créer mon exercice" onPress={saveCustomExercise}/>
          </>}
          {modal === 'profile' && <>
            {[['username', 'Pseudo', 'Ex : Sportif'], ['age', 'Âge (ans, facultatif)', 'Ex : 20'],
              ['weight', 'Poids (kg, facultatif)', 'Ex : 75'],
              ['height', 'Taille (cm, facultatif)', 'Ex : 180']].map(([key, title, placeholder]) => <View key={key}>
              <Text style={styles.formLabel}>{title}</Text>
              <TextInput style={styles.field} value={profileDraft[key] ?? ''} placeholder={placeholder} placeholderTextColor={C.muted}
                keyboardType={key === 'weight' || key === 'height' ? 'decimal-pad' : key === 'age' ? 'number-pad' : 'default'}
                onChangeText={(value) => setProfileDraft((old) => ({ ...old, [key]: value }))} />
            </View>)}
            <Text style={styles.formLabel}>Mon objectif (facultatif)</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
              {GOALS.map(g=><Chip key={g.id} label={g.label} active={normalizeGoal(profileDraft.goal)===g.id}
                onPress={()=>setProfileDraft(p=>({...p,goal:g.id}))}/>) }
            </View>
            <Text style={styles.formLabel}>Mon niveau (facultatif)</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
              {LEVELS.map(l=><Chip key={l.id} label={l.label} active={(profileDraft.experience||'intermediate')===l.id}
                onPress={()=>setProfileDraft(p=>({...p,experience:l.id}))}/>) }
            </View>
            <Text style={[styles.muted,{marginTop:13}]}>L'âge, le poids et la taille restent sur ton appareil. Le poids et la taille ne suffisent pas à déterminer une charge ou un nombre de séries ; tu restes libre de modifier les propositions.</Text>
            <View style={{ height: 15 }} /><Button label="Enregistrer mon profil" onPress={saveProfile} />
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>;
  }

  const mainTabScreen = tab === 'home' ? homeScreen() : tab === 'templates' ? templatesScreen() :
    tab === 'progress' ? progressScreen() : tab === 'calendar' ? calendarScreen() : profileScreen();
  const nestedScreen = page === 'folder' ? folderScreen() : page === 'template' ? templateScreen() : page === 'library' ? libraryScreen() :
    page === 'detail' ? detailScreen() : page === 'workout' ? workoutScreen() :
    page === 'timer' ? timerScreen() : page === 'history' ? historyScreen() : page === 'assistant' ? assistantScreen() : mainTabScreen;
  const showTabs = page === 'tabs';

  return <UIContext.Provider value={{ C, styles }}><SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
    {loading ? <View style={styles.center}><Text style={styles.title}>Training Programme</Text><Text style={styles.muted}>Chargement...</Text></View> : <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} key={`${page}-${tab}`}>
        {nestedScreen}
      </ScrollView>
      {showTabs && <BottomNav tab={tab} setTab={setTab} />}
      {dialog()}
    </>}
  </SafeAreaView></UIContext.Provider>;
}

function createStyles(C: Palette) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 19, paddingTop: 21, paddingBottom: 34, flexGrow: 1 },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '800', color: C.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: C.white, fontWeight: '700' },
  muted: { color: C.muted, fontSize: 13, lineHeight: 19 },
  miniLabel: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.white },
  panel: { backgroundColor: C.surface, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: C.line },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  button: { minHeight: 45, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  buttonSecondary: { backgroundColor: C.surfaceRaised },
  buttonDanger: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.red },
  buttonCompact: { minHeight: 35 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  iconButton: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  screenTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 19 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { fontSize: 16, color: C.white, fontWeight: '800' },
  statValue: { fontSize: 16, fontWeight: '800', color: C.white },
  smallStat: { flex: 1, paddingHorizontal: 8, minHeight: 68, justifyContent: 'center' },
  smallStatText: { color: C.muted, fontSize: 10, marginTop: 4 },
  bigStat: { color: C.white, fontSize: 21, marginTop: 6, fontWeight: '800' },
  grid3: { flexDirection: 'row', gap: 7 },
  grid2: { flexDirection: 'row', gap: 10 },
  green: { color: C.green, fontWeight: '700', fontSize: 12 },
  blueLink: { color: C.blue, fontWeight: '700', fontSize: 13 },
  chipRow: { gap: 7, paddingRight: 15 },
  chip: { borderRadius: 99, backgroundColor: C.surfaceRaised, borderColor: C.surfaceRaised,
    borderWidth: 1, paddingHorizontal: 13, minHeight: 33, justifyContent: 'center', alignItems: 'center' },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  navBar: { flexDirection: 'row', backgroundColor: C.surface, borderTopColor: C.line, borderTopWidth: 1,
    minHeight: 62, paddingTop: 7 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 3 },
  navLabel: { color: C.muted, fontSize: 10, fontWeight: '600' },
  listLine: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 66, paddingHorizontal: 10,
    borderRadius: 11, backgroundColor: C.surface, marginBottom: 7 },
  searchBox: { backgroundColor: C.surface, borderRadius: 13, height: 44, flexDirection: 'row', alignItems: 'center',
    gap: 9, paddingHorizontal: 13, marginBottom: 13 },
  searchInput: { flex: 1, color: C.white, fontSize: 13 },
  progressTrack: { marginTop: 14, marginBottom: 9, height: 6, borderRadius: 8, backgroundColor: C.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 8, backgroundColor: C.blue },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: 1, borderColor: C.line },
  tableHeader: { backgroundColor: C.surfaceRaised, minHeight: 38 },
  tableCell: { flex: 1, textAlign: 'center', color: C.muted, fontSize: 12, fontWeight: '600' },
  tableText: { color: C.white, fontSize: 14, textAlign: 'center', fontWeight: '600' },
  cellButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  supersetBadge: { color:C.blue, fontSize:10, fontWeight:'800', borderColor:C.blue, borderWidth:1,
    paddingVertical:5, paddingHorizontal:8, borderRadius:7, overflow:'hidden' },
  supersetExercise: { flexDirection:'row', alignItems:'center', gap:9, backgroundColor:C.surface,
    padding:10, borderRadius:12, marginTop:7 },
  noteBox: { backgroundColor:C.blueSoft, paddingHorizontal:10, paddingVertical:9, borderRadius:9, marginTop:5 },
  noteTitle: { color:C.blue, fontSize:10, fontWeight:'800', letterSpacing:0.7, marginBottom:4 },
  noteText: { color:C.white, fontSize:13, lineHeight:18 },
  exerciseLetter: { width:22, height:22, borderRadius:6, backgroundColor:C.blueSoft, alignItems:'center', justifyContent:'center' },
  exerciseLetterText: { fontSize:12, fontWeight:'800', color:C.blue },
  roundHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:12,
    paddingVertical:10, backgroundColor:C.blueSoft },
  roundTitle: { fontSize:12, fontWeight:'800', letterSpacing:1, color:C.blue },
  timerText: { fontWeight: '800', fontSize: 47, color: C.white, letterSpacing: -1.5, marginTop: 7 },
  bodyText: { color: C.white, fontSize: 14, lineHeight: 21 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', backgroundColor: C.blueSoft },
  settingLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line, gap: 10 },
  modalBackdrop: { flex: 1, backgroundColor: '#000B', alignItems: 'center', justifyContent: 'center', padding: 19 },
  dialog: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 20,
    padding: 17, width: '100%', maxWidth: 450 },
  formLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 13, marginBottom: 7 },
  field: { backgroundColor: C.background, borderWidth: 1, borderColor: C.line, color: C.white, borderRadius: 10,
    paddingHorizontal: 12, minHeight: 45, fontSize: 15 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
}); }
