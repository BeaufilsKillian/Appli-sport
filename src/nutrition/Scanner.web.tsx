import React,{useEffect,useRef,useState} from 'react';
import {BrowserMultiFormatReader,type IScannerControls} from '@zxing/browser';
export function Scanner({onCode}:{onCode(code:string):void}) {
  const video=useRef<HTMLVideoElement>(null),callback=useRef(onCode);
  const [error,setError]=useState('');
  useEffect(()=>{callback.current=onCode;},[onCode]);
  useEffect(()=>{
    let live=true,done=false,controls:IScannerControls|undefined;
    const stop=()=>{controls?.stop();const stream=video.current?.srcObject;if(stream instanceof MediaStream)stream.getTracks().forEach(track=>track.stop());};
    const reader=new BrowserMultiFormatReader(undefined,{delayBetweenScanAttempts:350});
    void reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'}},audio:false},video.current!,result=>{
      if(result&&live&&!done){done=true;stop();callback.current(result.getText());}
    }).then(value=>{controls=value;if(!live||done)stop();}).catch(()=>{if(live)setError('Caméra indisponible ou permission refusée. Saisis le code-barres à la main.');});
    const hidden=()=>{if(document.visibilityState==='hidden'){done=true;stop();if(live)setError('Scan arrêté. Ferme puis rouvre le scanner pour reprendre.');}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{live=false;stop();document.removeEventListener('visibilitychange',hidden);};
  },[]);
  return <div><video ref={video} muted playsInline autoPlay aria-label="Caméra de lecture des codes-barres" style={{width:'100%',maxHeight:350,borderRadius:12}}/><p style={{color:'#FAFAFA'}}>{error||'Place le code-barres ou QR GS1 dans le cadre.'}</p></div>;
}
