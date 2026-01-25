const getApiBaseUrl = (): string => {
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || 'https://petwash-api-signinpetwash.me-west1.run.app';
  }
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

export const getApiUrl = (path: string): string => {
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
};
