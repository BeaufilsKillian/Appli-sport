import type { Exercise } from './catalogue';

// Repères pédagogiques textuels. Les variantes (prises, machines, amplitudes,
// morphologies) ne peuvent pas être traitées comme des animations universelles.
export type Technique = {setup: string; amplitude: string; execution: string; caution: string};
const generic: Technique = {
  setup: 'Régle le matériel à ta taille, stabilise ton appui et garde une prise confortable.',
  amplitude: 'Travaille dans une amplitude active, contrôlée et indolore ; adapte-la à ta mobilité et au matériel.',
  execution: 'Bouge sans élan, contrôle la descente et garde la trajectoire régulière.',
  caution: 'Un schéma ne remplace pas une démonstration adaptée à cet exercice. Évite toute douleur articulaire.'
};
const perPattern: Record<Exercise['pattern'], Partial<Technique>> = {
  press: {setup:'Sur le banc, pieds stables, épaules stabilisées ; prends la charge avec les poignets alignés.', amplitude:'Descends dans une amplitude maîtrisée sans laisser les épaules rouler vers l’avant ; remonte sans rebond.', execution:'Pousse la charge de façon fluide, avant-bras proches de la verticale lorsque possible.', caution:'N’écarte pas excessivement les coudes et évite de décoller les fesses du banc.'},
  fly: {setup:'Buste stable, poignets neutres et coudes légèrement fléchis sans modifier leur angle.', amplitude:'Ouvre jusqu’à un étirement confortable sans forcer l’articulation ; rapproche les bras devant toi.', execution:'Dessine un arc avec les mains en contrôlant la phase de retour.', caution:'Évite de tendre brutalement les coudes ou de dépasser ton amplitude confortable.'},
  overhead:{setup:'Tronc gainé, pieds stables, mains légèrement plus larges que les épaules selon le matériel.', amplitude:'Monte les bras au-dessus de la tête sans cambrure excessive ; redescends à la hauteur confortable.', execution:'Garde une trajectoire proche du corps et contrôle le retour.', caution:'Évite de compenser par le bas du dos.'},
  raise:{setup:'Haltères le long du corps, épaules basses, coudes légèrement fléchis.', amplitude:'Élève les bras sur les côtés jusqu’à environ la hauteur des épaules selon ton confort.', execution:'Monte sans balancier, redescends lentement.', caution:'Ne hausse pas les épaules pour soulever plus lourd.'},
  triceps:{setup:'Coudes près du corps, poignets alignés, tronc stable face à la poulie.', amplitude:'Étends les coudes sans les verrouiller violemment ; remonte sans avancer les épaules.', execution:'Garde les bras proches du buste, seuls les avant-bras se déplacent principalement.', caution:'Évite de jeter le torse vers l’avant.'},
  overtriceps:{setup:'Bras près de la tête, cage thoracique contrôlée ; adapte la poignée à tes poignets.', amplitude:'Plie puis tends les coudes dans ton amplitude confortable.', execution:'Conserve les coudes orientés de façon stable et une descente lente.', caution:'Ne cambre pas pour déplacer plus de charge.'},
  pull:{setup:'Prise confortable, épaules abaissées, gainage engagé et pieds ou assise stables.', amplitude:'Tire vers le haut de la poitrine dans une amplitude où tu contrôles l’épaule.', execution:'Pense à rapprocher les coudes du buste sans te balancer.', caution:'Évite les tirages derrière la nuque et les à-coups.'},
  row:{setup:'Colonne neutre, pieds ou appuis fixes, prise sans casser les poignets.', amplitude:'Tire vers l’abdomen ou le bas des côtes suivant la variante, puis allonge les bras avec contrôle.', execution:'Initie le tirage avec le dos et les coudes, sans mouvement brusque du tronc.', caution:'Évite d’arrondir ou d’hyperétendre le dos sous charge.'},
  facepull:{setup:'Poulie placée environ à hauteur du visage, prise stable et buste gainé.', amplitude:'Ramène les poignées vers le visage et ouvre les mains à côté des tempes.', execution:'Garde les coudes hauts mais confortables, reviens doucement.', caution:'Ne force pas une rotation d’épaule douloureuse.'},
  curl:{setup:'Coudes près du corps, poignets neutres ou tournés selon la variante, pieds stables.', amplitude:'Fléchis les coudes sans lever les bras ; redescends complètement dans l’amplitude contrôlée.', execution:'Garde la tension et évite de balancer le buste.', caution:'Réduis la charge si tu tires avec le dos.'},
  squat:{setup:'Pieds stables, largeur adaptée aux hanches, colonne neutre et genoux orientés avec les orteils.', amplitude:'Descends aussi bas que tu peux sans douleur ni perte de stabilité.', execution:'Fléchis hanches et genoux ensemble ; remonte en poussant le sol.', caution:'Pas de rebond en bas ni de décollage des talons.'},
  hinge:{setup:'Garde le poids près des jambes, pieds stables, genoux légèrement fléchis et colonne neutre.', amplitude:'Recule les hanches jusqu’à sentir l’étirement des ischio-jambiers sans arrondir le bas du dos.', execution:'Pousse les hanches vers l’arrière puis reviens en contractant les fessiers.', caution:'Ne cherche pas absolument à toucher le sol.'},
  legcurl:{setup:'Aligne le pivot de la machine avec ton genou et règle le boudin sur le bas des jambes.', amplitude:'Fléchis les genoux sur toute l’amplitude contrôlée, puis tends progressivement.', execution:'Garde le bassin calé sur le siège.', caution:'Évite de donner des à-coups avec les hanches.'},
  legextension:{setup:'Assis dos calé ; axe de rotation de la machine aligné avec les genoux.', amplitude:'Étends les jambes dans une amplitude indolore, puis redescends lentement.', execution:'Reste fixé sur le siège, mouvement initié aux genoux.', caution:'N’hyperétends pas le genou en fin de course.'},
  calf:{setup:'Appui sur l’avant-pied, chevilles alignées, genoux selon la variante.', amplitude:'Descends les talons puis monte sur la pointe des pieds dans la mobilité confortable.', execution:'Monte en contrôlant la cheville sans rebond.', caution:'Ne tourne pas les chevilles vers l’extérieur sous charge.'},
  lunge:{setup:'Grand pas adapté à ton équilibre, genoux alignés avec la direction des pieds.', amplitude:'Descends verticalement jusqu’à une amplitude stable, remonte sans impulsion.', execution:'Pousse dans le sol avec la jambe avant.', caution:'Conserve le bassin stable ; utilise un support si besoin.'},
  bridge:{setup:'Dos ou épaules posés selon la variante, pieds stables et genoux souples.', amplitude:'Lève les hanches jusqu’à aligner tronc et cuisses sans cambrure supplémentaire.', execution:'Contracte les fessiers, descends doucement.', caution:'Ne cherche pas la hauteur en cassant les lombaires.'},
  abduction:{setup:'Bassin fixé, pieds et genoux placés selon la machine.', amplitude:'Écarte les jambes de manière fluide dans la course confortable.', execution:'Contrôle le retour sans laisser les charges claquer.', caution:'N’augmente pas l’amplitude en faisant rouler le bassin.'},
  kickback:{setup:'Buste fixe, pelvis stable, membre mobile bien orienté.', amplitude:'Étends la hanche sans exagérer la cambrure.', execution:'Pousse avec les fessiers, reviens lentement.', caution:'Évite le balancier lombaire.'},
  crunch:{setup:'Bas du dos stable, tête dans le prolongement de la colonne.', amplitude:'Enroule légèrement le haut du tronc, sans tirer sur la nuque.', execution:'Expire pendant la flexion ; reviens lentement.', caution:'Ne tire pas le cou avec les mains.'},
  plank:{setup:'Coudes sous les épaules, corps gainé en ligne des épaules aux talons.', amplitude:'Maintien statique, sans laisser tomber ni lever excessivement le bassin.', execution:'Respire régulièrement et engage le tronc.', caution:'Arrête la série avant que les lombaires ne s’affaissent.'},
  rotation:{setup:'Bassin stable, charge légère et prise sécurisée.', amplitude:'Tourne le tronc dans ta mobilité confortable sans forcer le bas du dos.', execution:'Rotation fluide, contrôlée, sans élan.', caution:'Évite les torsions explosives sous charge.'},
  pushup:{setup:'Mains au sol environ sous ou légèrement au-delà des épaules, corps gainé.', amplitude:'Descends la poitrine vers le sol sans relâcher le bassin, puis repousse.', execution:'Coudes orientés de façon confortable, trajet régulier.', caution:'Ne laisse pas les hanches s’affaisser.'},
  dip:{setup:'Prise ferme sur barres stables, épaules contrôlées et tronc gainé.', amplitude:'Descends dans une amplitude tolérée par les épaules avant de repousser.', execution:'Contrôle surtout la descente.', caution:'Ne descends pas si une douleur apparaît à l’avant de l’épaule.'},
  pullover:{setup:'Allongé, poignets alignés, coudes souples et bassin stable.', amplitude:'Passe la charge au-dessus de la tête tant que les épaules restent stables et sans douleur.', execution:'Garde le mouvement lent et les côtes contrôlées.', caution:'Évite de cambrer pour gagner de l’amplitude.'},
  shrug:{setup:'Bras le long du corps, charge contrôlable, colonne neutre.', amplitude:'Monte les épaules verticalement, puis redescends complètement.', execution:'Hausse sans rouler les épaules.', caution:'Évite les rotations rapides et les charges qui te font pencher.'},
  carry:{setup:'Prise solide, épaules stables, tête droite et dos neutre.', amplitude:'Marche avec une foulée naturelle.', execution:'Garde la charge équilibrée sans te pencher.', caution:'Arrête si la préhension ou la posture faiblit.'},
  cardio:{setup:'Ajuste les réglages et échauffe-toi progressivement.', amplitude:'Choisis une amplitude confortable et stable.', execution:'Garde un rythme régulier et une respiration contrôlée.', caution:'Ralentis dès qu’une douleur apparaît.'},
};
// Repères plus spécifiques pour les mouvements classiques. Adaptables aux
// sensations, à la morphologie et au matériel ; ce ne sont pas des prescriptions.
const perExercise: Record<string, Partial<Technique>> = {
  bench: {
    setup: 'Allonge-toi sur le banc, pieds fermement au sol, épaules placées et poignets au-dessus des avant-bras. Positionne les mains à une largeur confortable permettant des avant-bras approximativement verticaux en bas.',
    amplitude: 'Descends la barre de façon contrôlée vers la poitrine sans rebond, dans une amplitude tolérée par tes épaules. Remonte en gardant le contrôle de la trajectoire.',
    execution: 'Maintiens les appuis du bassin et des pieds. Stabilise les omoplates et évite de casser les poignets. Utilise des sécurités ou un partenaire pour les séries proches de l’échec.',
    caution: 'Ne recherche pas une largeur ou une amplitude identique à celle d’autrui ; une douleur d’épaule ou de poignet impose un ajustement.'
  },
  incline: {
    setup: 'Régle le banc à une inclinaison modérée et garde les pieds stables. Porte les haltères de chaque côté des épaules avec des poignets alignés.',
    amplitude: 'Descends les haltères latéralement jusqu’à une amplitude confortable, puis pousse au-dessus du haut de la poitrine sans les heurter.',
    execution: 'Contrôle chaque haltère séparément, garde la tête appuyée et évite de tendre brutalement les coudes.',
  },
  lateral: {
    setup: 'Debout, genoux souples, haltères près des cuisses. Garde les coudes légèrement fléchis et les poignets neutres.',
    amplitude: 'Lève les bras sur les côtés autour du plan des épaules, jusqu’à une hauteur confortable, puis redescends lentement.',
    execution: 'Conduis le geste avec les bras sans hausser exagérément les épaules ni donner d’élan avec le bassin.'
  },
  curlhammer: {
    setup: 'Paumes face à face du début à la fin. Coudes proches du buste et poignets alignés.',
    amplitude: 'Plie principalement les coudes pour remonter les haltères vers les épaules, puis redescends sans balancer.',
    execution: 'Garde le buste stable et utilise une charge te permettant de contrôler le retour.'
  },
  curl: {
    setup: 'Mains en supination (paumes plutôt vers l’avant selon la variante), poignets alignés, coudes près du corps.',
    amplitude: 'Remonte sans avancer fortement les coudes, puis laisse les bras se tendre de manière contrôlée.',
    execution: 'Limite les compensations du dos ; si tu dois donner de l’élan, réduis la charge.'
  },
  triceps: {
    setup: 'Place la poulie suffisamment haut, mains sur la poignée et coudes près des flancs.',
    amplitude: 'Tends les avant-bras vers le bas sans projeter les épaules vers l’avant, puis remonte en contrôlant.',
    execution: 'Les coudes restent aussi stables que possible. Adapte la prise et la trajectoire à la poignée utilisée.'
  },
  squat: {
    setup: 'Répartis ton poids sur l’ensemble des pieds. Place la barre sur une zone stable du haut du dos, selon ta variante, et gaine le tronc.',
    amplitude: 'Fléchis les hanches et les genoux tant que tu conserves l’appui et le contrôle du dos ; remonte sans laisser les genoux s’effondrer.',
    execution: 'Conserve la barre au-dessus de la zone d’appui des pieds autant que possible. Utilise des sécurités en charge lourde.'
  },
  rdl: {
    setup: 'Prends la barre devant les cuisses avec les mains à largeur confortable. Fléchis légèrement les genoux et garde la charge près des jambes.',
    amplitude: 'Recule les hanches en laissant la barre longer les cuisses puis les tibias selon ta mobilité. Stoppe avant de perdre la position neutre du dos.',
    execution: 'Remonte grâce à l’extension des hanches, sans donner d’à-coup ou exagérer la cambrure.'
  },
  legpress: {
    setup: 'Régle le siège pour garder le bassin soutenu, pieds sur la plateforme à un écart adapté, genoux orientés comme les pieds.',
    amplitude: 'Fléchis les genoux tant que le bas du dos reste stable contre le dossier, puis pousse sans verrouiller violemment les genoux.',
    execution: 'Ne décolle pas les hanches ni les talons ; sécurise la machine avant de quitter le siège.'
  },
  pullup: {
    setup: 'Suspends-toi à une barre solide, prise pronation confortable, omoplates et tronc contrôlés.',
    amplitude: 'Tire en abaissant les coudes jusqu’à ta hauteur contrôlable, puis redescends sans relâcher brutalement les épaules.',
    execution: 'Évite de balancer les jambes pour gagner une répétition. Utilise de l’assistance si nécessaire.'
  },
  latpull: {
    setup: 'Calage stable sur le siège, prise de la barre à largeur tolérée par les épaules.',
    amplitude: 'Tire vers le haut de la poitrine avec les coudes qui descendent, puis accompagne la remontée de la barre.',
    execution: 'Garde un léger mouvement naturel du buste mais sans balancer ni tirer derrière la nuque.'
  },
  row: {
    setup: 'Assieds-toi, pieds calés, bassin et rachis stables. Prends la poignée avec poignets alignés.',
    amplitude: 'Tire les coudes vers l’arrière près du corps jusqu’à l’abdomen, puis laisse les bras s’allonger sous contrôle.',
    execution: 'Conserve le tronc relativement stable et dose l’étirement final sans arrondir le dos.'
  },
  rowbar: {
    setup: 'Buste incliné selon ta mobilité, dos neutre, genoux souples, barre tenue près des jambes.',
    amplitude: 'Tire vers le ventre ou les côtes basses suivant l’angle et la prise, puis redescends lentement.',
    execution: 'Évite de redresser brusquement le buste pour remonter la barre.'
  },
  fly: {
    setup: 'Place les poulies à hauteur adaptée, une jambe légèrement en avant si besoin, épaules contrôlées.',
    amplitude: 'Décris un arc vers l’avant du buste, avec les coudes souples, sans chercher une extension extrême en arrière.',
    execution: 'Rapproche les mains en conservant un angle de coude à peu près constant et contrôle le retour.'
  },
  plank: {
    setup: 'Place les coudes sous les épaules, avant-bras au sol et pieds en appui. Tronc droit sans exagérer la cambrure.',
    amplitude: 'Maintien isométrique sans aller-retour, jusqu’à ce que le gainage commence à faiblir.',
    execution: 'Respire naturellement et conserve le bassin à hauteur stable.'
  }
};
export function techniqueFor(exercise: Exercise): Technique {
  return {...generic, ...(perPattern[exercise.pattern]||{}), ...(perExercise[exercise.id]||{})};
}

const assisting: Partial<Record<Exercise['pattern'],string>> = {
  press:'Triceps et deltoïdes antérieurs', fly:'Deltoïdes antérieurs (stabilisation)',
  overhead:'Triceps et partie supérieure des pectoraux', raise:'Trapèzes selon l’amplitude',
  triceps:'Stabilisateurs de l’épaule', overtriceps:'Stabilisateurs de l’épaule',
  pull:'Biceps et muscles scapulaires', row:'Biceps, deltoïdes postérieurs et muscles scapulaires',
  facepull:'Coiffe des rotateurs et trapèzes', curl:'Brachial et muscles de l’avant-bras',
  squat:'Fessiers, adducteurs et stabilisateurs du tronc', hinge:'Fessiers, ischio-jambiers et érecteurs du rachis',
  legcurl:'Mollets selon l’angle du genou', legextension:'', calf:'Muscles de la cheville',
  lunge:'Fessiers, quadriceps et muscles stabilisateurs', bridge:'Ischio-jambiers et gainage',
  abduction:'Moyen fessier et petit fessier', kickback:'Ischio-jambiers selon l’amplitude',
  crunch:'Obliques selon la variante', plank:'Fessiers, épaules et muscles du tronc',
  rotation:'Obliques et muscles stabilisateurs du tronc', pushup:'Triceps et épaules',
  dip:'Pectoraux et triceps (selon inclinaison)', pullover:'Pectoraux, grand dorsal et triceps (selon variante)',
  shrug:'Muscles de la ceinture scapulaire', carry:'Avant-bras et gainage', cardio:'Variable selon le mouvement'
};
export const secondaryMusclesFor = (exercise: Exercise) => assisting[exercise.pattern] || 'Variable selon la variante et la morphologie';
