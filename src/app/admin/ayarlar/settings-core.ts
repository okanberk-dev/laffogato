/**
 * What the settings tabs and their actions share. Client-safe: no
 * "server-only", no database, so the tab forms can import it.
 */

export interface SettingsState {
  message?: string;
  error?: string;
}
