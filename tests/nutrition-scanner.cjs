const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
const {QRCodeWriter,BarcodeFormat,QRCodeReader,RGBLuminanceSource,HybridBinarizer,BinaryBitmap}=require('@zxing/library');
(async()=>{
 const code='3017620422003',matrix=new QRCodeWriter().encode(code,BarcodeFormat.QR_CODE,240,240,new Map());
 const pixels=new Int32Array(matrix.getWidth()*matrix.getHeight());for(let y=0;y<matrix.getHeight();y++)for(let x=0;x<matrix.getWidth();x++)pixels[y*matrix.getWidth()+x]=matrix.get(x,y)?0:0xffffff;
 const result=new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels,matrix.getWidth(),matrix.getHeight()))));assert.equal(result.getText(),code);
 let effect,callback,resolve,hidden,stopped=0,closed=0,received=0,index=0;
 class Stream{getTracks(){return [{stop(){closed++;}}];}}
 const video={current:{srcObject:new Stream()}};
 const fakeReact={...React,useRef(initial){return index++===0?video:{current:initial};},useState(){return ['',()=>{}];},useEffect(fn){effect=fn;}};
 const document={visibilityState:'visible',addEventListener(name,fn){hidden=fn;},removeEventListener(){}};
 const mockReader=class{decodeFromConstraints(constraints,target,fn){assert.equal(constraints.audio,false);callback=fn;return new Promise(done=>{resolve=done;});}};
 const source=ts.transpileModule(fs.readFileSync('src/nutrition/Scanner.web.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports','document','MediaStream',source)(name=>name==='react'?fakeReact:{BrowserMultiFormatReader:mockReader},mod,mod.exports,document,Stream);
 mod.exports.Scanner({onCode(){received++;}});const cleanup=effect();document.visibilityState='hidden';hidden();callback({getText:()=>code});assert.equal(received,0,'pas de détection après passage en arrière-plan');
 resolve({stop(){stopped++;}});await new Promise(setImmediate);assert(stopped>0&&closed>0,'une caméra obtenue tardivement est arrêtée');cleanup();
 console.log('OK scanner : décodage QR, audio désactivé, arrêt en arrière-plan, fermeture et démarrage tardif. Caméra physique non sollicitée.');
})().catch(error=>{console.error(error);process.exitCode=1;});
