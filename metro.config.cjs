const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
// Les imports ESM partagés avec Vercel nomment .js ; leurs sources restent en TypeScript.
config.resolver.resolveRequest=(context,name,platform)=>{
  try{return context.resolveRequest(context,name,platform);}
  catch(error){
    if(name.startsWith('.')&&name.endsWith('.js'))return context.resolveRequest(context,name.slice(0,-3),platform);
    throw error;
  }
};
module.exports=config;
