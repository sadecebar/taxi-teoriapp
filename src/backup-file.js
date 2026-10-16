import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
const BackupFile = registerPlugin('BackupFile');

export async function saveBackupFile(file) {
  const filename = `taxi-teori-${file.createdAt.replace(/[:.]/g, '-')}.json`;
  const text = JSON.stringify(file, null, 2);
  if (Capacitor.getPlatform() === 'android') {
    await BackupFile.save({filename, data:text});
    return 'saved';
  }
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: `backups/${filename}`, directory: Directory.Cache, data: text, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: 'Taxi Teori', dialogTitle: 'Taxi Teori', files: [uri] });
    return 'shared';
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'download';
}
