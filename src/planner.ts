// Assistant local et facultatif, sans API, reseau ni donnees partagees.
// Heuristiques prudentes et adaptables : ce n'est pas une prescription medicale.
import type { Exercise } from './catalogue';

export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'cut';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type SuggestedExercise = {
  exercise_id: string; name: string; muscle: string; sets: number; reps: number;
  rest_seconds: number; estimated_minutes: number; reason: string;
};
export type SuggestedWorkout = {
  items: SuggestedExercise[]; target_minutes: number; estimated_minutes: number;
  warmup_minutes: number; cooldown_minutes: number; goal: Goal;
};

export const GOALS: Array<{id:Goal; label:string}> = [
  {id:'strength',label:'Force'},
  {id:'hypertrophy',label:'Prise de masse musculaire'},
  {id:'endurance',label:'Endurance musculaire'},
  {id:'cut',label:'Sèche (maintien musculaire)'},
];
export const LEVELS: Array<{id:Experience;label:string}> = [
  {id:'beginner',label:'Débutant'}, {id:'intermediate',label:'Intermédiaire'},
  {id:'advanced',label:'Avancé'},
];
export function normalizeGoal(value?:string): Goal {
  const x=(value??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (x.includes('force') || x==='strength') return 'strength';
  if (x.includes('endurance')) return 'endurance';
  if (x.includes('seche') || x==='cut') return 'cut';
  return 'hypertrophy';
}
export function goalLabel(goal:Goal) {return GOALS.find(x=>x.id===goal)?.label??GOALS[1].label;}

const PRIORITY:Record<string,string[]>={
  'Pectoraux':['bench','incline','fly','ex030','ex034','ex041','ex020','ex039','ex026','ex035'],
  'Dos':['latpull','row','pullup','rowbar','ex060','ex063','ex071','ex076','ex062','ex054'],
  'Biceps':['curl','curlhammer','ex117','ex123','ex113','ex120','ex114','ex115','ex121','ex125'],
  'Triceps':['triceps','ex137','ex141','ex132','ex146','ex144','ex151','ex133'],
  'Épaules':['shoulder','lateral','rear','ex093','ex090','ex102','ex086','ex105'],
  'Jambes':['squat','rdl','legpress','ex194','legcurl','calves','ex168','ex176','ex185','ex200','ex209'],
  'Quadriceps':['ex153','ex156','ex168','ex176','ex165','ex152','ex172','ex169'],
  'Ischio-jambiers':['rdl','ex185','ex181','ex187','ex189','ex192','ex188'],
  'Fessiers':['ex194','ex200','ex204','ex198','ex195','ex206','ex201'],
  'Abdos':['plank','ex218','ex221','ex225','ex230','ex235','ex237'],
  'Avant-bras':['ex243','ex239','ex241','ex244','ex245','ex246'],
};
export const COACH_MUSCLES=Object.keys(PRIORITY);

export function proposeExercise(exercise:Pick<Exercise,'id'|'name'|'muscle'|'pattern'>, goal:Goal,
  level:Experience='intermediate', age?:number): Omit<SuggestedExercise,'estimated_minutes'> {
  const compound=['press','pull','row','squat','hinge','overhead','lunge'].includes(exercise.pattern);
  const novice=level==='beginner';
  const youth=age!==undefined && age>=1 && age<18;
  let sets:number, reps:number,rest_seconds:number;
  if (goal==='strength') {
    // Aucun effort maximal demande aux mineurs ni sur les accessoires.
    sets=novice?2:3; reps=compound && !youth && !novice ? 5 : 8;
    rest_seconds=compound?180:90;
  } else if (goal==='endurance') {
    sets=novice?2:3; reps=15; rest_seconds=60;
  } else {
    sets=novice?2:3; reps=compound?8:12;
    rest_seconds=compound?120:75;
  }
  if (youth) { reps=Math.max(reps,8); sets=Math.min(sets,2); rest_seconds=Math.max(rest_seconds,90); }
  // Sèche : conserver une prescription de resistance proche de l'hypertrophie.
  return {exercise_id:exercise.id,name:exercise.name,muscle:exercise.muscle,sets,reps,rest_seconds,
    reason: youth?'Repères modérés ; encadrement recommandé':goal==='cut'?'Travail de résistance pour préserver la masse musculaire':
    compound?'Mouvement polyarticulaire':'Mouvement complémentaire'};
}

export function estimateExerciseMinutes(sets:number,reps:number,restSeconds:number):number {
  // Par serie : installation/transition + execution; temps de repos entre series.
  const working=sets*(Math.max(30,Math.min(100,reps*3+15))/60);
  return +(working+Math.max(0,sets-1)*restSeconds/60+2).toFixed(1);
}

export function generateWorkout(exercises:Exercise[], chosenMuscles:string[], targetMinutes:number,
  goal:Goal, level:Experience='intermediate', age?:number): SuggestedWorkout {
  const minutes=Math.round(Number(targetMinutes));
  if (!Number.isFinite(minutes)||minutes<25||minutes>180) throw new Error('La duree doit etre comprise entre 25 et 180 minutes.');
  const muscles=Array.from(new Set(chosenMuscles.filter(m=>COACH_MUSCLES.includes(m))));
  if (!muscles.length||muscles.length>3) throw new Error('Choisis de 1 a 3 groupes musculaires.');
  const warmup=minutes<50?6:10;
  const cooldown=minutes<50?3:5;
  const candidates=muscles.map(m=>{
    const pool=exercises.filter(e=>(e.muscle===m || (m==='Jambes' && ['Quadriceps','Ischio-jambiers','Fessiers','Mollets'].includes(e.muscle))) && e.pattern!=='cardio');
    return pool.sort((a,b)=>{
      const pref=PRIORITY[m]??[];
      const ai=pref.indexOf(a.id);const bi=pref.indexOf(b.id);
      return (ai<0?1000:ai)-(bi<0?1000:bi) || a.name.localeCompare(b.name);
    });
  });
  const items:SuggestedExercise[]=[];
  let spent=warmup+cooldown;
  let round=0;
  const limit=Math.min(12,Math.max(4,Math.ceil(minutes/12)));
  while (items.length<limit && round<12) {
    let added=false;
    for (let i=0;i<muscles.length && items.length<limit;i++) {
      if (round>=candidates[i].length) continue;
      const e=candidates[i][round];
      if (items.some(x=>x.exercise_id===e.id)) continue;
      const plan=proposeExercise(e,goal,level,age);
      const dur=estimateExerciseMinutes(plan.sets,plan.reps,plan.rest_seconds);
      if (spent+dur>minutes) continue;
      items.push({...plan,estimated_minutes:dur});spent+=dur;added=true;
    }
    round++;
    if (!added && round>=Math.max(...candidates.map(c=>c.length))) break;
  }
  // Mieux occuper le temps disponible en ajoutant une serie, sans volume excessif.
  let changed=true;
  while (changed) {
    changed=false;
    for (const item of items) {
      const maxSets=level==='beginner'?3:4;
      if(item.sets>=maxSets) continue;
      const newDur=estimateExerciseMinutes(item.sets+1,item.reps,item.rest_seconds);
      const extra=+(newDur-item.estimated_minutes).toFixed(1);
      if(spent+extra<=minutes){item.sets++;item.estimated_minutes=newDur;spent+=extra;changed=true;}
    }
  }
  return {items,target_minutes:minutes,estimated_minutes:Math.ceil(spent),warmup_minutes:warmup,cooldown_minutes:cooldown,goal};
}
