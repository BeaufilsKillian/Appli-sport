import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {api,ApiRequestError,useWebSession} from './session';
import {deleteLease,readLease,verifyLease,writeLease,type VerifiedLease} from './accessLease';
import {AdminPanel} from './AdminPanel';
import {AccessLogin} from './AccessLogin';

type State='checking'|'login'|'pending'|'approved'|'denied'|'blocked'|'offline';
type AccessValue={canUse:boolean;isAdmin:boolean;pendingCount:number;refresh():Promise<void>;openAdmin():void};
const Context=createContext<AccessValue|null>(null);
export function useAccess(){const value=useContext(Context);if(!value)throw Error('Autorisation non prête.');return value;}
type ServerAccess={user:{id:string;email:string};status:State;isAdmin:boolean;lease:string|null;pendingCount?:number;requestRevision?:string;pushPublicKey?:string};
export function AccessProvider({children}:{children:React.ReactNode}) {
  const session=useWebSession(),owner=session.user?.id??'';
  const ownerRef=useRef(owner);
  useEffect(()=>{ownerRef.current=owner;},[owner]);
  const [state,setState]=useState<State>('checking'),[lease,setLease]=useState<VerifiedLease|null>(null);
  const [pendingCount,setPendingCount]=useState(0),[pushKey,setPushKey]=useState(''),[open,setOpen]=useState(false);
  const [offline,setOffline]=useState(!navigator.onLine),[now,setNow]=useState(()=>Date.now()),[banner,setBanner]=useState(false);
  const [loaded,setLoaded]=useState('');
  const inFlight=useRef<string|null>(null),lastAttempt=useRef(0),lastSignal=useRef<string|null>(null),serverKnown=useRef('');
  const canUse=!!owner&&lease?.owner===owner&&state==='approved'&&lease.expiresAt>now;
  const isAdmin=canUse&&lease.admin;
  const [initialClock]=useState(()=>({wall:Date.now(),clock:performance.now()}));
  const lastWall=useRef(initialClock.wall),monotonic=useRef(initialClock);
  const refresh=useCallback(async()=>{
    if(!owner||inFlight.current===owner)return;
    inFlight.current=owner;lastAttempt.current=Date.now();
    try{
      const data=await api<ServerAccess>('/api/access');
      if(ownerRef.current!==owner||data.user.id!==owner)return;
      serverKnown.current=owner;
      if(data.status==='approved'&&data.lease){
        const verified=await verifyLease({token:data.lease,lastWall:Date.now()},owner);
        if(ownerRef.current!==owner)return;
        writeLease(owner,{token:data.lease,lastWall:Date.now()});
        monotonic.current={wall:Date.now(),clock:performance.now()};lastWall.current=Date.now();
        setLease(verified);setState('approved');setLoaded(owner);setOffline(false);setNow(Date.now());
        if(data.isAdmin){
          setPendingCount(data.pendingCount??0);setPushKey(data.pushPublicKey??'');
          const badge=navigator as Navigator&{setAppBadge?(count:number):Promise<void>;clearAppBadge?():Promise<void>};
          if((data.pendingCount??0)>0)void badge.setAppBadge?.(data.pendingCount!).catch(()=>{});else void badge.clearAppBadge?.().catch(()=>{});
          if((data.pendingCount??0)>0&&lastSignal.current!==data.requestRevision)setBanner(true);
          lastSignal.current=data.requestRevision??'';
        }else{setPendingCount(0);setPushKey('');setBanner(false);void navigator.serviceWorker?.ready.then(registration=>registration.active?.postMessage({type:'ADMIN_DEVICE',enabled:false}));}
      }else{deleteLease(owner);setLease(null);setState(data.status);setPendingCount(0);setOpen(false);}
    }catch(error){
      if(ownerRef.current!==owner)return;
      setOffline(true);
      if(error instanceof ApiRequestError&&error.status===401){deleteLease(owner);setLease(null);setState('login');}
      else setState(previous=>previous==='approved'?previous:'offline');
    }finally{if(inFlight.current===owner)inFlight.current=null;}
  },[owner]);
  useEffect(()=>{
    let live=true;
    queueMicrotask(()=>{if(live){setLease(null);setState(owner?'checking':'login');setLoaded('');setPendingCount(0);setOpen(false);setBanner(false);}});
    lastSignal.current=null;serverKnown.current='';
    if(owner){
      const stored=readLease(owner);
      if(stored)void verifyLease(stored,owner).then(verified=>{if(live&&ownerRef.current===owner&&serverKnown.current!==owner){setLease(verified);setState('approved');setLoaded(owner);setNow(Date.now());}}).catch(()=>{deleteLease(owner);});
      queueMicrotask(()=>{if(live)void refresh();});
    }
    return()=>{live=false;};
  },[owner,refresh]);
  useEffect(()=>{
    const onOnline=()=>{if(document.visibilityState==='visible')void refresh();};
    const onOffline=()=>setOffline(true);
    const poll=setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine&&Date.now()-lastAttempt.current>(isAdmin?30_000:state==='approved'?300_000:15_000))void refresh();},5000);
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);window.addEventListener('focus',onOnline);document.addEventListener('visibilitychange',onOnline);
    return()=>{clearInterval(poll);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);window.removeEventListener('focus',onOnline);document.removeEventListener('visibilitychange',onOnline);};
  },[refresh,isAdmin,state]);
  useEffect(()=>{
    const tick=()=>{
      const wall=Date.now(),effective=Math.max(wall,monotonic.current.wall+performance.now()-monotonic.current.clock);
      if(wall<lastWall.current-1000){if(owner)deleteLease(owner);setLease(null);setState('offline');}
      lastWall.current=Math.max(lastWall.current,wall);setNow(effective);
      if(owner){const stored=readLease(owner);if(stored)writeLease(owner,{...stored,lastWall:Math.max(stored.lastWall,wall)});}
    };
    const interval=setInterval(tick,15_000);
    const expiry=lease?setTimeout(tick,Math.max(0,Math.min(lease.expiresAt-Date.now()+20,86400_000))):undefined;
    return()=>{clearInterval(interval);clearTimeout(expiry);};
  },[lease,owner]);
  useEffect(()=>{
    const logout=()=>{
      if(owner)deleteLease(owner);setLease(null);setPendingCount(0);setOpen(false);setBanner(false);
      void navigator.serviceWorker?.ready.then(async registration=>{
        registration.active?.postMessage({type:'ADMIN_DEVICE',enabled:false});
        const subscription=await registration.pushManager?.getSubscription();
        if(subscription){await api('/api/access',{action:'unsubscribe',endpoint:subscription.endpoint}).catch(()=>{});await subscription.unsubscribe();}
        await api('/api/access',{action:'lock'}).catch(()=>{});
      });
    };
    window.addEventListener('training-before-logout',logout);return()=>window.removeEventListener('training-before-logout',logout);
  },[owner]);
  useEffect(()=>{
    const show=()=>{if(isAdmin)setOpen(true);};
    const message=(event:MessageEvent)=>{if(event.data?.type==='OPEN_ADMIN')show();};
    navigator.serviceWorker?.addEventListener('message',message);
    if(isAdmin&&new URLSearchParams(location.search).has('admin')){
      queueMicrotask(show);
      const url=new URL(location.href);url.searchParams.delete('admin');history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
    return()=>navigator.serviceWorker?.removeEventListener('message',message);
  },[isAdmin]);
  const locked=canUse?null:(!owner||state==='login')?<AccessLogin ready={session.ready}/>:<View style={screen}>
    <Text style={heading}>{state==='pending'?'Demande envoyée':state==='denied'?'Accès refusé':state==='blocked'?'Accès retiré':state==='checking'?'Vérification de l’accès…':'Connexion Internet nécessaire'}</Text>
    <Text style={body}>{state==='pending'?'Ton compte attend l’accord de l’administrateur. Aucune fonctionnalité n’est accessible avant son acceptation.':state==='checking'?'Vérification de ton autorisation en cours.':state==='denied'||state==='blocked'?'L’administrateur n’a pas autorisé l’utilisation de ce compte.':'L’application devient inutilisable après 24 heures sans vérification par Internet. Retrouve le Wi-Fi ou la 4G/5G pour continuer.'}</Text>
    {session.user&&<Text style={body}>{session.user.email}</Text>}
    <Pressable style={button} onPress={()=>void refresh()}><Text style={buttonText}>Actualiser mon accès</Text></Pressable>
    <Pressable onPress={()=>void session.logout().catch(()=>{})}><Text style={{color:'#82B9FF',marginTop:18}}>Changer de compte</Text></Pressable>
  </View>;
  return <Context.Provider value={{canUse,isAdmin,pendingCount,refresh,openAdmin:()=>setOpen(true)}}><View style={{flex:1,backgroundColor:'#050709'}}>
    {canUse&&offline&&<View accessibilityRole="alert" style={notice}><Text style={{color:'#FFE1AB',fontSize:12}}>Hors connexion : l’application sera bloquée après 24 h sans Internet. Accès jusqu’au {new Date(lease.expiresAt).toLocaleString('fr-FR')}.</Text></View>}
    {isAdmin&&banner&&pendingCount>0&&<View accessibilityRole="alert" style={[notice,{backgroundColor:'#142B46'}]}><Pressable onPress={()=>{setBanner(false);setOpen(true);}}><Text style={{color:'white'}}>{pendingCount} demande{pendingCount>1?'s':''} d’accès à examiner</Text></Pressable><Pressable accessibilityLabel="Fermer la notification" onPress={()=>setBanner(false)}><Text style={{color:'white',paddingLeft:14}}>×</Text></Pressable></View>}
    {loaded===owner&&owner?<div inert={!canUse} aria-hidden={!canUse} style={{display:canUse?'flex':'none',flexDirection:'column',flex:1,minHeight:0,minWidth:0,width:'100%',maxWidth:'100%'}}>{children}</div>:null}
    {locked&&<View style={[screen,{position:'absolute',inset:0,zIndex:100}]}>{locked}</View>}
    {isAdmin&&<AdminPanel open={open} onClose={()=>setOpen(false)} onChanged={refresh} pushKey={pushKey}/>}
  </View></Context.Provider>;
}
export function ProfileRequestBadge(){const access=useAccess();if(!access.isAdmin||access.pendingCount<1)return null;return <View accessibilityLabel={`${access.pendingCount} demandes d’accès`} style={{position:'absolute',right:-13,top:-8,minWidth:19,height:19,borderRadius:10,backgroundColor:'#E44858',paddingHorizontal:4,alignItems:'center',justifyContent:'center'}}><Text style={{color:'white',fontSize:11,fontWeight:'700'}}>{access.pendingCount>99?'99+':access.pendingCount}</Text></View>;}
export function AdminEntry(){const access=useAccess();if(!access.isAdmin)return null;return <Pressable style={button} accessibilityRole="button" onPress={access.openAdmin}><Text style={buttonText}>Administration{access.pendingCount?` · ${access.pendingCount}`:''}</Text></Pressable>;}
const screen={flex:1,backgroundColor:'#050709',justifyContent:'center' as const,alignItems:'center' as const,padding:24,width:'100%' as const};
const heading={color:'white',fontSize:23,fontWeight:'700' as const,marginBottom:16,textAlign:'center' as const};
const body={color:'#B7C5D6',fontSize:15,lineHeight:23,textAlign:'center' as const,marginBottom:18,maxWidth:480};
const button={backgroundColor:'#0878F9',borderRadius:11,padding:14,alignItems:'center' as const,marginTop:8};
const buttonText={color:'white',fontWeight:'700' as const};
const notice={padding:12,backgroundColor:'#3B2D19',flexDirection:'row' as const,justifyContent:'space-between' as const};
