const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
const source=ts.createSourceFile('App.tsx',fs.readFileSync('App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const declarations=['BottomNav','createStyles'].map(name=>{const node=source.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text===name);assert(node,name);return node.getText(source);}).join('\n');
const javascript=ts.transpileModule(declarations+'\nmodule.exports={BottomNav,createStyles};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
let width=320,ui;
const mod={exports:{}};new Function('React','View','Pressable','Text','StyleSheet','useUI','useWindowDimensions','ico','ProfileRequestBadge','module',javascript)(React,'View','Pressable','Text',{create:value=>value},()=>ui,()=>({width}),(name,size,color)=>React.createElement('Icon',{name,size,color}),()=>null,mod);
ui={C:{blue:'#0878F9',muted:'#AAA'},styles:mod.exports.createStyles({})};
const keys=['home','templates','progress','calendar','nutrition','profile'],labels=['Accueil','Séances','Stats','Calendrier','Nutrition','Profil'];
for(width of [320,375,390,430,768])for(const selected of keys){
  let destination;const bar=mod.exports.BottomNav({tab:selected,setTab:value=>{destination=value;}}),tabs=bar.props.children;
  assert.equal(bar.props.accessibilityRole,'tablist');assert.equal(tabs.length,6);
  assert.equal(Object.assign({},...bar.props.style).maxWidth,width,'largeur de barre plafonnée à celle de la fenêtre');
  tabs.forEach((tab,index)=>{assert.equal(tab.props.accessibilityRole,'tab');assert.equal(tab.props.accessibilityLabel,labels[index]);assert.equal(tab.props.accessibilityState.selected,keys[index]===selected);tab.props.onPress();assert.equal(destination,keys[index]);});
}
console.log('OK navigation : six onglets, noms, sélection, clics et plafond de largeur pour 320/375/390/430/768 px. Contrôle structurel sans navigateur, sans mesure du rendu.');
