const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const listeners={},cache=new Map(),notifications=[],sent=[];let badges=0,closed=0,focused=0,navigated=0;
const self={location:{origin:'https://app.example.test'},navigator:{setAppBadge:async n=>{badges=n;},clearAppBadge:async()=>{badges=0;}},addEventListener:(name,fn)=>listeners[name]=fn,
 registration:{showNotification:async(title,data)=>notifications.push({title,...data}),getNotifications:async()=>[{close(){closed++;}}]},
 clients:{matchAll:async()=>[{url:'https://app.example.test/',postMessage(value){sent.push(value);},navigate(){navigated++;},focus(){focused++;}}],openWindow(){throw Error('pas de nouvelle fenêtre attendue');}}};
vm.runInNewContext(fs.readFileSync('scripts/service-worker.js','utf8').replace('__VERSION__','"test"').replace('__CORE__','[]').replace('__MEDIA__','[]'),{self,URL,Response,caches:{open:async()=>({match:async k=>cache.get(k),put:async(k,v)=>cache.set(k,v),delete:async k=>cache.delete(k)})}});
async function send(name,data){let pending;listeners[name]({...data,waitUntil(value){pending=value;}});await pending;}
(async()=>{
 const push={data:{json:()=>({type:'access-request',count:2,url:'https://attacker.example'})}};
 await send('push',push);assert.equal(notifications.length,0,'aucune notification sans appareil administrateur activé');
 await send('message',{data:{type:'ADMIN_DEVICE',enabled:true}});await send('push',push);assert.equal(notifications.length,1);assert.equal(badges,2);assert.equal(notifications[0].data.url,'/?admin=1','destination fixe et privée');
 await send('notificationclick',{notification:{close(){closed++;}}});assert.equal(navigated,0,'ouvrir l’administration ne recharge pas une séance');assert.equal(focused,1);assert.equal(sent[0].type,'OPEN_ADMIN');
 await send('message',{data:{type:'ADMIN_DEVICE',enabled:false}});await send('push',push);assert.equal(notifications.length,1,'déconnexion : aucune nouvelle notification sur cet appareil');assert.equal(badges,0);assert.ok(closed>0);
 console.log('OK notifications : administrateur seul, badge, déconnexion, URL fixe et séance conservée au clic.');
})().catch(error=>{console.error(error);process.exitCode=1;});
