import type {TemplateExercise} from './db';
import {EXERCISES} from './catalogue.js';

export type LoadSuggestion={weight:number;reason:string};
export type ProgressionSession={session_id:string;template_id:string;exercise_id:string;started_at:number;finished_at:number;progression_key:string|null;set_count:number;completed_count:number;distinct_sets:number;first_set:number|null;last_set:number|null;first_weight:number|null;min_weight:number|null;max_weight:number|null;min_reps:number|null};
export const validLoadStep=(value:number)=>Number.isFinite(value)&&value>=.1&&value<=100&&Math.abs(value*100-Math.round(value*100))<1e-8;

export function progressionKey(plan:TemplateExercise,plans:TemplateExercise[]):string|null {
  const exercise=EXERCISES.find(item=>item.id===plan.exercise_id);
  if(plan.planned_duration_seconds!=null||plan.to_failure||exercise&&(/assist/i.test(exercise.name)||exercise.equipment==='Élastique'))return null;
  const min=plan.planned_reps_min,max=plan.planned_reps_max;
  if(!Number.isInteger(min)||!Number.isInteger(max)||min!<1||max!<min!||max!>200)return null;
  const group=plan.superset_group?plans.filter(item=>item.superset_group===plan.superset_group).sort((a,b)=>a.position-b.position).map(item=>[item.exercise_id,item.planned_sets,item.rest_seconds]):[];
  const key=JSON.stringify([1,plan.template_id,plan.exercise_id,plan.position,plan.planned_sets,min,max,plan.rest_seconds,plan.superset_group,plan.dropset,group]);
  return key.length<=10000?key:null;
}

export function recommendLoad(plan:TemplateExercise,plans:TemplateExercise[],history:ProgressionSession[],initial:LoadSuggestion,step:number):LoadSuggestion {
  const key=progressionKey(plan,plans);if(!key||!validLoadStep(step))return initial;
  const sessions=history.filter(row=>row.template_id===plan.template_id&&row.exercise_id===plan.exercise_id).sort((a,b)=>b.finished_at-a.finished_at||b.started_at-a.started_at||b.session_id.localeCompare(a.session_id));
  const latest=sessions[0];if(!latest||latest.progression_key!==key)return initial;
  const base=latest.first_weight;
  if(base==null||!Number.isFinite(base)||base<=0||base>1000)return initial;
  const complete=(row:ProgressionSession)=>row.progression_key===key&&row.set_count===plan.planned_sets&&row.completed_count===plan.planned_sets&&row.distinct_sets===plan.planned_sets&&row.first_set===1&&row.last_set===plan.planned_sets;
  if(!complete(latest))return {weight:base,reason:'Séance incomplète ou séries modifiées : charge maintenue.'};
  if(latest.min_weight!==base||latest.max_weight!==base)return {weight:base,reason:'Charges différentes entre séries : ajustement manuel.'};
  const label=String(step).replace('.',',');
  const adjust=(direction:1|-1,reason:string)=>{
    const weight=Math.round((base+direction*step)*100)/100;
    return weight>0&&weight<=1000?{weight,reason}:{weight:base,reason:'Palier incompatible avec cette charge : ajuste le réglage.'};
  };
  if(latest.min_reps!==null&&latest.min_reps>=plan.planned_reps_max!)return adjust(1,`Maximum atteint sur toutes les séries : +${label} kg.`);
  if(latest.min_reps!==null&&latest.min_reps<plan.planned_reps_min!){
    const previous=sessions[1];
    if(previous&&complete(previous)&&previous.min_weight===base&&previous.max_weight===base&&previous.min_reps!==null&&previous.min_reps<plan.planned_reps_min!)return adjust(-1,`Sous le minimum sur deux séances : −${label} kg.`);
    return {weight:base,reason:'Sous le minimum une fois : charge maintenue.'};
  }
  return {weight:base,reason:'Plage en cours : même charge, progresse en répétitions.'};
}
