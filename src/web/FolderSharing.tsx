import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { exportAllData } from '../db';
import { importSharedFolder, makeSharedFolder } from '../folderSharing';
import { api, useWebSession } from './session';
import { parseBackup } from '../backup';

const field = { borderWidth: 1, borderColor: '#3C4756', backgroundColor: '#171D25', color: '#F5F8FC', borderRadius: 10, padding: 12, fontSize: 16 };
function Action({ label, onPress, disabled=false }: { label:string; onPress():void; disabled?:boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ backgroundColor: disabled?'#354257':'#0878F9', padding:12,borderRadius:10,alignItems:'center' }}><Text style={{color:'white',fontWeight:'700'}}>{label}</Text></Pressable>;
}
type Share = { id:string; expires_at:string; revoked:boolean; claimed_at:string|null };
export function FolderShareButton({folderId,db,onOpenChange}:{folderId:string;db:SQLiteDatabase;onOpenChange(value:boolean):void}) {
  const session=useWebSession();
  const [open,setOpen]=useState(false),[working,setWorking]=useState(false),[message,setMessage]=useState('');
  const [link,setLink]=useState(''),[shares,setShares]=useState<Share[]>([]);
  useEffect(()=>()=>onOpenChange(false),[onOpenChange]);
  const close=()=>{setOpen(false);onOpenChange(false);};
  const headers={'X-Training-Owner':session.user?.id??''};
  const refresh=async()=>{const data=await api<{shares:Share[]}>(`/api/folder-shares?folder=${encodeURIComponent(folderId)}`,undefined,headers);setShares(data.shares);};
  const run=async(fn:()=>Promise<void>)=>{setWorking(true);setMessage('');try{await fn();}catch(error){setMessage(error instanceof Error?error.message:'Partage indisponible.');}finally{setWorking(false);}};
  return <View style={{marginBottom:12}}>
    <Action label="Partager ce dossier" onPress={()=>{setOpen(true);onOpenChange(true);if(session.authenticated)void run(refresh);}}/>
    <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{if(!working)close();}}>
      <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#000000AA',padding:24}}>
        <ScrollView style={{width:'100%',maxWidth:420,maxHeight:'85%',borderRadius:18,backgroundColor:'#101419',flexGrow:0}} contentContainerStyle={{padding:20,gap:12}} keyboardShouldPersistTaps="handled">
          <Text style={{color:'white',fontSize:20,fontWeight:'700'}}>Partager le dossier</Text>
          <Text style={{color:'#B7C5D6'}}>Une copie des séances et consignes, sans profil ni historique.</Text>
          {!session.authenticated?<Text style={{color:'#FFBD62'}}>Connecte-toi dans Profil pour partager.</Text>:<>
            <Text style={{color:'#B7C5D6'}}>Lien valable 7 jours pour une personne connectée.</Text>
            <Action label="Créer un lien de partage" disabled={working} onPress={()=>{void run(async()=>{
              const folder=makeSharedFolder(parseBackup(await exportAllData(db)),folderId);
              const result=await api<{token:string}>('/api/folder-shares',{action:'create',folder},headers);
              setLink(`${location.origin}/?share=${result.token}`);await refresh();
            });}}/>
            {link?<><TextInput accessibilityLabel="Lien de partage du dossier" style={field} value={link} editable={false} selectTextOnFocus multiline/>
              <Action label="Copier le lien" onPress={()=>{void run(async()=>{await navigator.clipboard.writeText(link);setMessage('Lien copié');});}}/></>:null}
            {shares.map(share=><View key={share.id} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
              <Text style={{color:'#B7C5D6',flex:1}}>{share.revoked?'Lien annulé':share.claimed_at?'Copie récupérée':`Expire le ${new Date(share.expires_at).toLocaleDateString('fr-FR')}`}</Text>
              {!share.revoked&&!share.claimed_at&&<Pressable accessibilityRole="button" disabled={working} onPress={()=>{void run(async()=>{await api('/api/folder-shares',{action:'revoke',id:share.id},headers);setLink('');await refresh();});}}><Text style={{color:'#FFBD62',padding:8}}>Annuler le lien</Text></Pressable>}
            </View>)}
          </>}
          {message?<Text accessibilityRole="alert" style={{color:'#FFBD62'}}>{message}</Text>:null}
          <Action label="Fermer" disabled={working} onPress={close}/>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}

type Preview={id:string;name:string;templates:number;exercises:number;expires_at:string};
function codeFrom(text:string) {
  let code=text.trim();
  if(!/^[A-Za-z0-9_-]{43}$/.test(code)) {try{const url=new URL(code);if(url.origin!==location.origin)throw Error();code=url.searchParams.get('share')??'';}catch{throw new Error('Lien de partage invalide.');}}
  if(!/^[A-Za-z0-9_-]{43}$/.test(code))throw new Error('Lien de partage invalide.');
  return code;
}
export function FolderShareInbox({db,isBusy,onImported}:{db:SQLiteDatabase;isBusy():boolean;onImported():void}) {
  const session=useWebSession();
  const [input,setInput]=useState(()=>new URLSearchParams(location.search).get('share')??'');
  const [preview,setPreview]=useState<Preview|null>(null),[working,setWorking]=useState(false),[message,setMessage]=useState('');
  const headers={'X-Training-Owner':session.user?.id??''};
  const load=async()=>{
    setWorking(true);setMessage('');setPreview(null);
    try{if(!session.authenticated)throw new Error('Connecte-toi pour importer le dossier.');const code=codeFrom(input);setPreview(await api<Preview>(`/api/folder-shares?code=${encodeURIComponent(code)}`,undefined,headers));}
    catch(error){setMessage(error instanceof Error?error.message:'Partage indisponible.');}finally{setWorking(false);}
  };
  useEffect(()=>{
    const timer=setTimeout(()=>{if(session.authenticated&&new URLSearchParams(location.search).has('share'))void load();},0);
    return()=>clearTimeout(timer);
    // Un lien reçu est chargé à la connexion, pas à chaque caractère saisi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[session.authenticated,session.user?.id]);
  const accept=async()=>{
    setWorking(true);setMessage('');
    try{
      if(!session.authenticated)throw new Error('Connecte-toi pour importer.');
      if(isBusy())throw new Error('Ferme le formulaire et termine ta séance avant d’importer.');
      const code=codeFrom(input);
      const shared=await api<{id:string;payload:unknown}>('/api/folder-shares',{action:'claim',code},headers);
      if(isBusy())throw new Error('Réessaie après ta séance. Le dossier partagé reste disponible pour ce compte.');
      await importSharedFolder(db,shared.payload,shared.id);
      const url=new URL(location.href);url.searchParams.delete('share');history.replaceState(null,'',url.pathname+url.search+url.hash);
      setInput('');setPreview(null);onImported();
    }catch(error){setMessage(error instanceof Error?error.message:'Import impossible.');}finally{setWorking(false);}
  };
  return <View style={{gap:10,paddingVertical:12,borderTopWidth:1,borderColor:'#273342'}}>
    <Text style={{color:'white',fontWeight:'700',fontSize:17}}>Dossier partagé</Text>
    <TextInput accessibilityLabel="Lien ou code de dossier partagé" style={field} value={input} autoCapitalize="none" autoCorrect={false} placeholder="Colle le lien de partage" placeholderTextColor="#9AA8BB" onChangeText={text=>{setInput(text);setPreview(null);setMessage('');}}/>
    <Action label="Voir le dossier partagé" disabled={working||!input.trim()} onPress={()=>{void load();}}/>
    {preview?<><Text style={{color:'white'}}>{preview.name}</Text><Text style={{color:'#B7C5D6'}}>{preview.templates} séance(s) · {preview.exercises} exercice(s)</Text>
      <Text style={{color:'#B7C5D6'}}>Une copie indépendante sera ajoutée à tes dossiers.</Text>
      <Action label="Importer une copie" disabled={working} onPress={()=>{void accept();}}/></>:null}
    {message?<Text accessibilityRole="alert" style={{color:'#FFBD62'}}>{message}</Text>:null}
  </View>;
}
