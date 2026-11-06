export type ThemePreference = 'Enterprise Light' | 'Modern Dark' | 'Enterprise Slate';
export type DataDensity = 'Compact' | 'Comfortable';

export function getCurrentTheme(): string {
  try {
    const v = localStorage.getItem('vsmart-theme');
    if (v === 'dark') return 'Modern Dark';
    if (v === 'light') return 'Enterprise Light';
    return localStorage.getItem('rm_theme_preference') || 'Modern Dark';
  } catch {
    return 'Modern Dark';
  }
}

export function applyTheme(theme: string) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-modern-dark', 'theme-enterprise-slate');

  const isLight = theme === 'Enterprise Light' || theme === 'light';
  const dataTheme = isLight ? 'light' : 'dark';
  root.setAttribute('data-theme', dataTheme);

  if (!isLight) {
    if (theme === 'Enterprise Slate') {
      root.classList.add('theme-enterprise-slate');
    } else {
      root.classList.add('dark', 'theme-modern-dark');
    }
  }
  try {
    localStorage.setItem('rm_theme_preference', isLight ? 'Enterprise Light' : (theme === 'Enterprise Slate' ? 'Enterprise Slate' : 'Modern Dark'));
    localStorage.setItem('vsmart-theme', dataTheme);
  } catch {}
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: isLight ? 'Enterprise Light' : 'Modern Dark' } }));
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
    let saved = localStorage.getItem('vsmart-theme');
    if (!saved) {
      const rm = localStorage.getItem('rm_theme_preference');
      if (rm) {
        saved = rm === 'Enterprise Light' ? 'light' : 'dark';
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        saved = 'light';
      } else {
        saved = 'dark';
      }
    }
    const themeToApply = saved === 'light' ? 'Enterprise Light' : 'Modern Dark';
    const savedDensity = localStorage.getItem('rm_data_density') || 'Compact';
    applyTheme(themeToApply);
    applyDensity(savedDensity);
  } catch {}
}
