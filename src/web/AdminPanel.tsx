import React,{useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {api,ApiRequestError} from './session';
type Entry={id:string;email:string;status:'pending'|'approved'|'denied'|'blocked'};
type Decision={entry:Entry;decision:'approved'|'denied'};
export function AdminPanel({open,onClose,onChanged,pushKey}:{open:boolean;onClose():void;onChanged():Promise<void>;pushKey:string}) {
  const [password,setPassword]=useState(''),[unlocked,setUnlocked]=useState(false),[expires,setExpires]=useState(0);
  const [working,setWorking]=useState(false),[message,setMessage]=useState(''),[entries,setEntries]=useState<Entry[]>([]);
  const [decision,setDecision]=useState<Decision|null>(null),[confirmation,setConfirmation]=useState('');
  const [notifications,setNotifications]=useState(false);
  const load=async()=>{const data=await api<{requests:Entry[]}>('/api/access?view=admin');setEntries(data.requests);};
  const run=async(fn:()=>Promise<void>)=>{setWorking(true);setMessage('');try{await fn();}catch(error){if(error instanceof ApiRequestError&&error.status===401)setUnlocked(false);setMessage(error instanceof Error?error.message:'Action impossible.');}finally{setWorking(false);}};
  useEffect(()=>{
    if(!open)return;
    queueMicrotask(()=>{setUnlocked(false);setPassword('');setMessage('');setDecision(null);setConfirmation('');});
    return()=>{void api('/api/access',{action:'lock'}).catch(()=>{});};
  },[open]);
  useEffect(()=>{
    if(!open||!unlocked)return;
    const timer=setTimeout(()=>{setUnlocked(false);setMessage('Administration verrouillée. Saisis à nouveau le mot de passe.');},Math.max(0,expires-Date.now()));
    return()=>clearTimeout(timer);
  },[open,unlocked,expires]);
  useEffect(()=>{
    if(!open||!unlocked)return;
    let live=true;
    const check=()=>{if(document.visibilityState==='visible')void api<{requests:Entry[]}>('/api/access?view=admin').then(data=>{if(live)setEntries(data.requests);}).catch(()=>{});};
    const timer=setInterval(check,30_000);
    return()=>{live=false;clearInterval(timer);};
  },[open,unlocked]);
  const unlock=()=>void run(async()=>{
    try {const result=await api<{expiresAt:number}>('/api/access',{action:'unlock',password});setExpires(result.expiresAt);await load();setUnlocked(true);}finally{setPassword('');}
  });
  const enableNotifications=()=>void run(async()=>{
    if(!('Notification'in window)||!('PushManager'in window)||!navigator.serviceWorker)throw Error('Ouvre l’application installée sur ton écran d’accueil pour activer les notifications.');
    // Cette permission est demandée uniquement après le geste de l'administrateur.
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('Autorise les notifications dans les réglages du téléphone ou du navigateur.');
    if(!pushKey)throw Error('Notifications non configurées.');
    const registration=await navigator.serviceWorker.ready;
    if(registration.waiting)throw Error('Installe d’abord la mise à jour de l’application, puis active les notifications.');
    const key=Uint8Array.from(atob(pushKey.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
    const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await api('/api/access',{action:'subscribe',subscription:subscription.toJSON()});
    registration.active?.postMessage({type:'ADMIN_DEVICE',enabled:true});
    setNotifications(true);setMessage('Notifications administrateur activées sur cet appareil.');
  });
  const close=()=>{if(working)return;setPassword('');setConfirmation('');setUnlocked(false);onClose();};
  const pending=entries.filter(item=>item.status==='pending');
  const group=(title:string,items:Entry[])=> <View style={{gap:10,marginTop:18}}><Text style={{color:'white',fontWeight:'700',fontSize:18}}>{title}</Text>{items.length?items.map(entry=><View key={entry.id} style={{backgroundColor:'#17212E',padding:14,borderRadius:12,gap:12}}>
    <Text selectable style={{color:'white',fontSize:15}}>{entry.email}</Text>
    <View style={{flexDirection:'row',gap:9}}>
      {entry.status!=='approved'&&<Action label="Accepter" disabled={working} onPress={()=>{setDecision({entry,decision:'approved'});setConfirmation('');}}/>}
      {['pending','approved'].includes(entry.status)&&<Action label={entry.status==='pending'?'Refuser':'Retirer l’accès'} secondary disabled={working} onPress={()=>{setDecision({entry,decision:'denied'});setConfirmation('');}}/>}
    </View>
  </View>):<Text style={{color:'#AAB9CB'}}>Aucune demande.</Text>}</View>;
  return <Modal visible={open} transparent animationType="fade" onRequestClose={close}><View style={{flex:1,backgroundColor:'#000C',padding:18,alignItems:'center',justifyContent:'center'}}><View style={{width:'100%',maxWidth:520,maxHeight:'92%',backgroundColor:'#0E151F',borderRadius:18,padding:20,gap:12}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{color:'white',fontSize:23,fontWeight:'800'}}>Administration</Text><Pressable accessibilityRole="button" accessibilityLabel="Fermer l’administration" onPress={close}><Text style={{color:'white',fontSize:26}}>×</Text></Pressable></View>
    {!unlocked?<><Text style={{color:'#B7C5D6'}}>Mot de passe administrateur</Text><TextInput accessibilityLabel="Mot de passe administrateur" style={field} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" onSubmitEditing={unlock}/><Action label="Déverrouiller" disabled={working||!password} onPress={unlock}/></>:
      decision?<><Text style={{color:'white'}}>{decision.entry.email}</Text><Text style={{color:'#D1DBE8'}}>Écris « {decision.decision==='approved'?'accepter':'refuser'} » pour confirmer.</Text><TextInput accessibilityLabel="Confirmation de la décision" style={field} value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" autoCorrect={false}/><Action label="Confirmer" disabled={working||confirmation!==(decision.decision==='approved'?'accepter':'refuser')} onPress={()=>void run(async()=>{await api('/api/access',{action:'decide',id:decision.entry.id,decision:decision.decision,expectedStatus:decision.entry.status,confirmation});setDecision(null);setConfirmation('');await load();await onChanged();})}/><Action label="Annuler" secondary disabled={working} onPress={()=>setDecision(null)}/></>:
      <ScrollView keyboardShouldPersistTaps="handled"><Action label="Actualiser les demandes" disabled={working} onPress={()=>void run(async()=>{await load();await onChanged();})}/>{group('Demandes en attente',pending)}{group('Accès acceptés',entries.filter(item=>item.status==='approved'))}{group('Accès refusés ou retirés',entries.filter(item=>['denied','blocked'].includes(item.status)))}<View style={{marginTop:22,gap:10}}><Action label={notifications?'Notifications activées':'Activer mes notifications'} disabled={working} onPress={enableNotifications}/><Text style={{color:'#AAB9CB',fontSize:12,lineHeight:18}}>Sur iPhone : ouvre la PWA installée sur l’écran d’accueil. Seul ce compte reçoit les demandes.</Text><Action label="Envoyer une notification de test" secondary disabled={working||!notifications} onPress={()=>void run(async()=>{await api('/api/access',{action:'test-notification'});setMessage('Notification de test envoyée.');})}/></View></ScrollView>}
    {!!message&&<Text accessibilityRole="alert" style={{color:'#FFD395',lineHeight:20}}>{message}</Text>}
  </View></View></Modal>;
}
function Action({label,onPress,disabled=false,secondary=false}:{label:string;onPress():void;disabled?:boolean;secondary?:boolean}){return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{backgroundColor:secondary?'#29374B':'#0878F9',padding:12,borderRadius:10,alignItems:'center',opacity:disabled?0.5:1}}><Text style={{color:'white',fontWeight:'700'}}>{label}</Text></Pressable>;}
const field={backgroundColor:'#192433',borderWidth:1,borderColor:'#42536A',borderRadius:10,padding:13,color:'white',fontSize:16};
