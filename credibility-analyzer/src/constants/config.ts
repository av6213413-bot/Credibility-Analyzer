// Helper to ensure API URL has proper protocol
const getApiUrl = (): string => {
  const url = import.meta.env.VITE_API_URL;
  // If not set or empty, use same-origin (combined deployment)
  if (url === undefined || url === '') {
    return '';
  }
  // Relative paths (e.g., /api) are used for same-origin combined deployments
  if (url.startsWith('/')) {
    return url;
  }
  // If URL doesn't have protocol, add https:// for production
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};

export const config = {
  apiBaseUrl: getApiUrl(),
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
  maxTextLength: parseInt(import.meta.env.VITE_MAX_TEXT_LENGTH || '10000', 10),
  itemsPerPage: parseInt(import.meta.env.VITE_ITEMS_PER_PAGE || '10', 10),
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
};
