import React,{useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {useWebSession} from './session';
export function AccessLogin({ready}:{ready:boolean}) {
  const session=useWebSession();
  const [signup,setSignup]=useState(true),[email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [working,setWorking]=useState(false),[message,setMessage]=useState('');
  const token=new URLSearchParams(location.search).get('token');
  const run=async(fn:()=>Promise<void>)=>{setWorking(true);setMessage('');try{await fn();}catch(error){setMessage(error instanceof Error?error.message:'Connexion impossible.');}finally{setPassword('');setWorking(false);}};
  if(!ready)return <Text style={{color:'white'}}>Vérification du compte…</Text>;
  return <ScrollView style={{width:'100%'}} contentContainerStyle={{flexGrow:1,justifyContent:'center',alignItems:'center'}} keyboardShouldPersistTaps="handled"><View style={{width:'100%',maxWidth:420,gap:14}}>
    <Text style={{color:'white',fontSize:28,fontWeight:'800'}}>Training Programme</Text>
    <Text style={{color:'white',fontSize:20,fontWeight:'700'}}>{token?'Nouveau mot de passe':signup?'Créer mon compte':'Me connecter'}</Text>
    {!token&&<><Text style={{color:'#B7C5D6',lineHeight:21}}>Un compte et l’accord de l’administrateur sont nécessaires pour utiliser l’application.</Text><TextInput accessibilityLabel="Adresse e-mail" style={field} value={email} onChangeText={setEmail} placeholder="Adresse e-mail" placeholderTextColor="#A3B0C2" keyboardType="email-address" autoCapitalize="none"/></>}
    <TextInput accessibilityLabel={token?'Nouveau mot de passe':'Mot de passe'} style={field} value={password} onChangeText={setPassword} secureTextEntry placeholder="Mot de passe" placeholderTextColor="#A3B0C2"/>
    <Pressable accessibilityRole="button" style={[button,{opacity:working||!session.configured?0.5:1}]} disabled={working||!session.configured} onPress={()=>void run(async()=>{if(token){await session.resetPassword(password,token);setMessage('Mot de passe modifié. Tu peux te connecter.');}else await session.login(email.trim(),password,signup);})}><Text style={{color:'white',fontWeight:'700'}}>{working?'Patiente…':token?'Enregistrer le mot de passe':signup?'Créer mon compte':'Me connecter'}</Text></Pressable>
    {!token&&<><Pressable accessibilityRole="button" onPress={()=>{setSignup(!signup);setMessage('');}}><Text style={{color:'#82B9FF'}}>{signup?'J’ai déjà un compte':'Créer un compte'}</Text></Pressable><Pressable accessibilityRole="button" disabled={working||!email.trim()} onPress={()=>void run(async()=>{await session.reset(email.trim());setMessage('Si ce compte existe, un e-mail a été envoyé.');})}><Text style={{color:'#82B9FF'}}>Mot de passe oublié</Text></Pressable></>}
    {!session.configured&&<Text style={{color:'#FFD395'}}>Connexion au service indisponible. Réessaie avec Internet.</Text>}
    {!!message&&<Text accessibilityRole="alert" style={{color:'#FFD395',lineHeight:21}}>{message}</Text>}
  </View></ScrollView>;
}
const field={borderWidth:1,borderColor:'#3C4756',backgroundColor:'#151C25',borderRadius:10,padding:13,color:'white',fontSize:16};
const button={backgroundColor:'#0878F9',padding:15,borderRadius:11,alignItems:'center' as const};
