export type ThemePreference = 'Enterprise Light' | 'Modern Dark' | 'Enterprise Slate';
export type DataDensity = 'Compact' | 'Comfortable';

export function getCurrentTheme(): string {
  try {
    return localStorage.getItem('rm_theme_preference') || 'Enterprise Light';
  } catch {
    return 'Enterprise Light';
  }
}

export function applyTheme(theme: string) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-modern-dark', 'theme-enterprise-slate');

  if (theme === 'Modern Dark') {
    root.classList.add('dark', 'theme-modern-dark');
  } else if (theme === 'Enterprise Slate') {
    root.classList.add('theme-enterprise-slate');
  }
  try {
    localStorage.setItem('rm_theme_preference', theme);
  } catch {}
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
}

export function applyDensity(density: string) {
  const root = document.documentElement;
  root.classList.remove('density-compact', 'density-comfortable');

  if (density === 'Comfortable') {
    root.classList.add('density-comfortable');
  } else {
    root.classList.add('density-compact');
  }
  try {
    localStorage.setItem('rm_data_density', density);
  } catch {}
}

export function initThemeAndDensity() {
  try {
    const savedTheme = localStorage.getItem('rm_theme_preference') || 'Enterprise Light';
    const savedDensity = localStorage.getItem('rm_data_density') || 'Compact';
    applyTheme(savedTheme);
    applyDensity(savedDensity);
  } catch {}
}
