import { analytics } from './firebase';
import { logEvent, setConsent } from 'firebase/analytics';

// Check if analytics consent is given
export const hasAnalyticsConsent = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('analyticsConsent') === 'true';
};

// Set analytics consent
export const setAnalyticsConsent = (consent: boolean): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('analyticsConsent', consent.toString());
  
  if (analytics) {
    setConsent({
      analytics_storage: consent ? 'granted' : 'denied',
    });
  }
};

// Initialize analytics with consent
export const initializeAnalyticsWithConsent = (): void => {
  if (!analytics) return;
  
  const consent = hasAnalyticsConsent();
  setConsent({
    analytics_storage: consent ? 'granted' : 'denied',
  });
};

// Analytics event tracking functions
export const trackPageView = (pagePath: string): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'page_view', {
    page_path: pagePath,
  });
};

export const trackAudioPlay = (messageType: 'default' | 'custom', daysRemaining?: number): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'audio_play', {
    message_type: messageType,
    days_remaining: daysRemaining,
  });
};

export const trackCustomization = (charactersUsed: number): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'message_customized', {
    characters_used: charactersUsed,
  });
};

export const trackShare = (platform: 'facebook' | 'native' | 'copy'): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'share', {
    method: platform,
  });
};

export const trackPurchaseIntent = (packageSize: number, price: number): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'purchase_intent', {
    package_size: packageSize,
    price: price,
  });
};

export const trackDownload = (): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'audio_download');
};

export const trackError = (errorType: string, errorMessage: string): void => {
  if (!analytics || !hasAnalyticsConsent()) return;
  
  logEvent(analytics, 'error', {
    error_type: errorType,
    error_message: errorMessage,
  });
};
