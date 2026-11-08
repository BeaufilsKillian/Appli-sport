import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

export function UpdatePrompt({ blocked, installUpdate }: { blocked: boolean; installUpdate(): Promise<void> }) {
  const [available, setAvailable] = useState(!!window.trainingUpdate || !!window.trainingUpdateDownloading);
  const [downloading, setDownloading] = useState(!!window.trainingUpdateDownloading);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const ready = () => { setAvailable(true); setDownloading(false); setDismissed(false); };
    const download = () => { setAvailable(true); setDownloading(true); setDismissed(false); };
    const failed = () => { setDownloading(false); setAvailable(!!window.trainingUpdate); };
    const launch = () => {
      if (document.visibilityState !== 'visible') return;
      setDismissed(false);
      if (window.trainingUpdate) setAvailable(true);
      if (window.trainingUpdateDownloading) download();
      void window.trainingCheckUpdate?.().then(result => { if (result === 'ready') setAvailable(true); }).catch(() => {});
    };
    window.addEventListener('training-update', ready);
    window.addEventListener('training-update-downloading', download); window.addEventListener('training-update-failed', failed);
    // Le téléchargement peut avoir fini avant le montage de React.
    if (window.trainingUpdate) ready();
    launch();
    window.addEventListener('pageshow', launch); window.addEventListener('focus', launch); document.addEventListener('visibilitychange', launch);
    return () => { window.removeEventListener('training-update', ready); window.removeEventListener('training-update-downloading', download); window.removeEventListener('training-update-failed', failed); window.removeEventListener('pageshow', launch); window.removeEventListener('focus', launch); document.removeEventListener('visibilitychange', launch); };
  }, []);
  const install = async () => {
    if (blocked || installing || downloading) return;
    setInstalling(true); setError('');
    try {
      await installUpdate();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Installation impossible.'); setInstalling(false); }
  };
  return <Modal visible={available && !dismissed && !blocked} transparent animationType="fade" onRequestClose={() => { if (!installing) setDismissed(true); }}>
    <View style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, backgroundColor: '#171D25', gap: 18 }}>
        <Text accessibilityRole="header" style={{ color: '#F5F8FC', fontSize: 22, fontWeight: '700' }}>Mise à jour disponible</Text>
        <Text style={{ color: '#B7C5D6', fontSize: 16 }}>Ta séance et tes saisies seront conservées.</Text>
        <Pressable accessibilityRole="button" disabled={installing || downloading} onPress={() => { void install(); }} style={{ backgroundColor: '#0878F9', padding: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{installing ? 'Installation…' : downloading ? 'Téléchargement…' : 'Installer la mise à jour'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={installing} onPress={() => setDismissed(true)} style={{ padding: 8, alignItems: 'center' }}>
          <Text style={{ color: '#B7C5D6', fontSize: 16 }}>Plus tard</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={{ color: '#FFBD62' }}>{error}</Text> : null}
      </View>
    </View>
  </Modal>;
}
