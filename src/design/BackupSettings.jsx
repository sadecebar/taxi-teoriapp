import { useRef, useState } from 'react';
import { DownloadSimple, UploadSimple } from '@phosphor-icons/react';
import { storage } from '../storage.js';
import { getInstallationId } from '../installation.js';
import { QUESTIONS } from '../study-data.js';
import { backupSummary, createBackup, MAX_BACKUP_BYTES, parseBackup, restoreBackup } from '../backup.js';
import { saveBackupFile } from '../backup-file.js';
import { cancelAll } from '../notif-platform.js';
import { useStudy } from './context.jsx';
import { Button, Modal, SectionTitle } from './components.jsx';

export function BackupSettings() {
  const { l, dateLocale, checklistSteps } = useStudy();
  const picker = useRef(null), locked = useRef(false);
  const [busy, setBusy] = useState(false), [candidate, setCandidate] = useState(null);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [result, setResult] = useState(null);
  const start = () => {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setError(''); setMessage(''); return true;
  };
  const finish = () => { locked.current = false; setBusy(false); };
  const exportFile = async () => {
    if (!start()) return;
    try {
      await storage.flush();
      const file = createBackup(storage, getInstallationId(), import.meta.env.VITE_APP_VERSION, QUESTIONS, checklistSteps.length);
      const method = await saveBackupFile(file);
      setMessage(method === 'saved'
        ? l('Säkerhetskopian har sparats i den mapp du valde.', 'The backup has been saved in your chosen folder.')
        : method === 'download'
        ? l('Nedladdningen har startat. Spara filen på en plats du hittar igen.', 'The download has started. Keep the file somewhere you can find again.')
        : l('Delningsrutan är stängd. Kontrollera att du sparade filen på den plats du valde.', 'The share sheet is closed. Check that you saved the file in your chosen location.'));
    } catch (e) {
      if (/cancel|dismiss|abort/i.test(e.message)) setMessage(l('Sparandet avbröts.', 'Saving was cancelled.'));
      else setError(l('Det gick inte att skapa säkerhetskopian. Försök igen.', 'Could not create the backup. Please try again.'));
    } finally { finish(); }
  };
  const chooseFile = async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !start()) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw Error('backup-too-large');
      setCandidate(parseBackup(await file.text(), QUESTIONS, checklistSteps.length));
    } catch (e) {
      setError(e.message === 'backup-too-large'
        ? l('Filen är för stor. Välj en säkerhetskopia på högst 2 MB.', 'The file is too large. Choose a backup no larger than 2 MB.')
        : e.message === 'backup-version'
          ? l('Säkerhetskopians format stöds inte. Prova med en uppdaterad version av appen.', 'This backup format is not supported. Try an updated version of the app.')
          : l('Filen är inte en giltig säkerhetskopia för den här versionen av Taxi Teori. Inga framsteg har ändrats.', 'This is not a valid backup for this version of Taxi Teori. No progress has changed.'));
    } finally { finish(); }
  };
  const restore = async () => {
    if (!start()) return;
    try {
      await restoreBackup(storage, getInstallationId(), candidate, QUESTIONS, checklistSteps.length);
      await cancelAll();
      setResult('success');
    } catch { setResult('failed'); }
    finally { finish(); }
  };
  const summary = candidate && backupSummary(candidate);
  return <section className="mt-7">
    <SectionTitle>{l('Säkerhetskopiera framsteg', 'Back up progress')}</SectionTitle>
    <p className="mb-4 text-sm leading-relaxed text-muted">{l('Spara statistik, resultat, sparade frågor, checklista och inställningar i en fil. Flytta dem till en annan enhet utan konto.', 'Save statistics, results, bookmarks, your checklist and settings in a file. Move them to another device without an account.')}</p>
    <div className="flex flex-col gap-3">
      <Button disabled={busy} onClick={exportFile}><DownloadSimple size={22} className="shrink-0"/>{l('Spara säkerhetskopia', 'Save backup')}</Button>
      <Button secondary disabled={busy} onClick={() => picker.current.click()}><UploadSimple size={22} className="shrink-0"/>{l('Läs in säkerhetskopia', 'Load backup')}</Button>
    </div>
    <input ref={picker} type="file" accept=".json,application/json" hidden onChange={chooseFile}/>
    <p className="mt-3 text-xs leading-relaxed text-muted">{l('Pågående pass följer inte med. Filen saknar lösenord. Spara den utanför appen för att behålla den vid ominstallation.', 'Ongoing sessions are not included. The file is not password protected. Save it outside the app to keep it if you reinstall.')}</p>
    <p role="status" className="mt-3 text-sm leading-relaxed">{busy ? l('Arbetar…', 'Working…') : message}</p>
    {error && <p role="alert" className="mt-3 text-sm leading-relaxed text-danger">{error}</p>}
    {candidate && <Modal title={result === 'success' ? l('Framstegen är återställda', 'Progress restored') : result === 'failed' ? l('Återställningen avbröts', 'Restore interrupted') : l('Återställ från fil?', 'Restore from file?')} onClose={() => { if (!locked.current) { if (result) window.location.reload(); else setCandidate(null); } }}>
      {result ? <><p role={result === 'failed' ? 'alert' : 'status'} className="mb-5 text-sm leading-relaxed">{result === 'success'
        ? l('Dina framsteg har sparats. Öppna appen igen för att läsa in dem och dina inställningar.', 'Your progress has been saved. Reopen the app to load it and your settings.')
        : l('Det gick inte att slutföra återställningen. Öppna appen igen så att tidigare uppgifter kan återhämtas innan du fortsätter.', 'The restore could not be completed. Reopen the app so previous data can be recovered before you continue.')}</p><Button className="w-full" onClick={() => window.location.reload()}>{l('Öppna appen igen', 'Reopen app')}</Button></> : <>
        <p className="mb-4 text-sm text-muted">{l('Sparad', 'Saved')} {new Date(candidate.createdAt).toLocaleString(dateLocale)}</p>
        <dl className="mb-5 divide-y divide-line">{[[l('Besvarade frågor', 'Answers given'), summary.attempts], [l('Rätta svar', 'Correct answers'), summary.correct], [l('Sparade frågor', 'Bookmarks'), summary.bookmarks], [l('Genomförda pass', 'Completed sessions'), summary.sessions]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2 text-sm"><dt>{label}</dt><dd className="font-mono">{value}</dd></div>)}</dl>
        <p className="mb-3 text-sm leading-relaxed">{l('Detta ersätter dina nuvarande framsteg och inställningar på den här enheten. Ett pågående pass tas bort. Spara först en egen säkerhetskopia om du vill behålla det du har nu.', 'This replaces current progress and settings on this device and removes any ongoing session. Save a backup first if you want to keep your current data.')}</p>
        <p className="mb-5 text-sm leading-relaxed text-muted">{l('Påminnelser stängs av. Du kan aktivera dem igen i inställningarna.', 'Reminders are turned off. You can enable them again in settings.')}</p>
        <div className="flex flex-col gap-3"><Button disabled={busy} onClick={restore}>{busy ? l('Återställer…', 'Restoring…') : l('Ersätt och återställ', 'Replace and restore')}</Button><Button secondary disabled={busy} onClick={() => setCandidate(null)}>{l('Avbryt', 'Cancel')}</Button></div>
      </>}
    </Modal>}
  </section>;
}
