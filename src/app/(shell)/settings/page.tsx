import { requireShellUserId } from '@/lib/shell-user';
import { AppearanceSettings } from '@/shell/appearance-settings';
import { SignOutButton } from '@/shell/sign-out-button';
import styles from '@/shell/settings.module.css';

export default async function SettingsPage() {
  const userId = await requireShellUserId();
  const guest = userId.startsWith('guest-');
  return <div className={styles.page}><h1>Settings</h1><AppearanceSettings/><section className={styles.account}><h2>Account</h2>{guest ? <><p>You are using the local demo. Demo entries will not transfer to an account.</p><a href="/login?from=demo">Sign in or create an account</a></> : <SignOutButton/>}</section></div>;
}
