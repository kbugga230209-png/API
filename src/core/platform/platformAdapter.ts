import { isRunningInNativeIOSShell } from '../ios/pencilKitBridge';

export type RuntimePlatform =
  | 'iPadOS'
  | 'iOS'
  | 'macOS'
  | 'Windows'
  | 'Android'
  | 'Web';

export type AppleWindowFormFactor =
  | 'iphone-compact'
  | 'ipad-slide-over'
  | 'ipad-split-view'
  | 'ipad-stage-regular'
  | 'desktop';

export interface PlatformCapabilities {
  platform: RuntimePlatform;
  formFactor: AppleWindowFormFactor;
  supportsPointerEvents: boolean;
  supportsCoalescedEvents: boolean;
  supportsPredictedEvents: boolean;
  supportsTouch: boolean;
  hasFineTrackpadOrMouse: boolean;
  isStandalonePwa: boolean;
  isNativeIOSShell: boolean;
  isOnline: boolean;
}

/**
 * Computes the active iPadOS / iOS windowing form factor across:
 * - iPhone portrait/landscape
 * - iPad Slide Over / 1/3 Split View (~320–430pt)
 * - iPad 1/2 Split View / Portrait (~431–834pt)
 * - iPad Landscape / Stage Manager Regular (>834pt)
 */
export function resolveWindowFormFactor(
  viewportWidth: number,
  platform: RuntimePlatform
): AppleWindowFormFactor {
  if (platform === 'iOS' || viewportWidth < 440) {
    return platform === 'iPadOS' ? 'ipad-slide-over' : 'iphone-compact';
  }
  if (viewportWidth <= 700) {
    return 'ipad-split-view';
  }
  if (platform === 'iPadOS' || viewportWidth <= 1180) {
    return 'ipad-stage-regular';
  }
  return 'desktop';
}

/**
 * Detects runtime OS/device capabilities across iPadOS (including iPadOS 13+ desktop-class UA),
 * iOS (iPhone), macOS, Windows, Android, and Web browsers without coupling core model code to DOM APIs.
 */
export function detectPlatformCapabilities(): PlatformCapabilities {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'Web',
      formFactor: 'desktop',
      supportsPointerEvents: false,
      supportsCoalescedEvents: false,
      supportsPredictedEvents: false,
      supportsTouch: false,
      hasFineTrackpadOrMouse: true,
      isStandalonePwa: false,
      isNativeIOSShell: false,
      isOnline: true,
    };
  }

  const ua = navigator.userAgent || '';
  const maxTouch = navigator.maxTouchPoints || 0;
  let platform: RuntimePlatform = 'Web';

  if (/iPhone|iPod/i.test(ua)) {
    platform = 'iOS';
  } else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1)) {
    platform = 'iPadOS';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    platform = 'macOS';
  } else if (/Windows/i.test(ua)) {
    platform = 'Windows';
  } else if (/Android/i.test(ua)) {
    platform = 'Android';
  }

  const supportsPointerEvents = typeof window.PointerEvent !== 'undefined';
  const supportsCoalescedEvents =
    supportsPointerEvents &&
    typeof window.PointerEvent.prototype.getCoalescedEvents === 'function';
  const supportsPredictedEvents =
    supportsPointerEvents &&
    typeof (
      window.PointerEvent.prototype as PointerEvent & {
        getPredictedEvents?: () => PointerEvent[];
      }
    ).getPredictedEvents === 'function';

  const hasFineTrackpadOrMouse =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(any-pointer: fine)').matches
      : true;

  const isStandalonePwa =
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  const width = window.innerWidth || 1024;

  return {
    platform,
    formFactor: resolveWindowFormFactor(width, platform),
    supportsPointerEvents,
    supportsCoalescedEvents,
    supportsPredictedEvents,
    supportsTouch: maxTouch > 0,
    hasFineTrackpadOrMouse,
    isStandalonePwa,
    isNativeIOSShell: isRunningInNativeIOSShell(),
    isOnline: navigator.onLine !== false,
  };
}

/**
 * Requests durable local IndexedDB storage (`navigator.storage.persist()`) so Safari/iPadOS
 * and Chromium never evict local notebooks under storage pressure.
 */
export async function requestDurableLocalStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

export function resolveEffectiveTheme(
  setting: 'light' | 'dark' | 'system'
): 'light' | 'dark' {
  if (setting === 'light' || setting === 'dark') return setting;
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}
