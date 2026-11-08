import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function shareFile(name: string, content: string, kind: 'json' | 'csv') {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Partage indisponible sur cet appareil.');
  const file = new File(Paths.cache, name); await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: kind === 'json' ? 'application/json' : 'text/csv', dialogTitle: 'Exporter mes données', UTI: kind === 'json' ? 'public.json' : 'public.comma-separated-values-text' });
}
