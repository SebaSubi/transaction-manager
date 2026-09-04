/**
 * A controllable `window.matchMedia` for jsdom, which ships none.
 *
 * Only `(prefers-color-scheme: dark)` is modelled — that is the sole query the
 * app issues. The returned handle can flip the OS preference and notify the
 * registered listeners, which is what proves the 'system' theme follows a LIVE
 * OS change rather than only reading it once at mount.
 */
export interface MatchMediaStub {
  /** Flips the OS preference and dispatches `change` to every listener. */
  setPrefersDark(prefersDark: boolean): void;
  /** How many listeners are currently registered (proves cleanup on unmount). */
  listenerCount(): number;
  /** Restores whatever `window.matchMedia` was before installation. */
  restore(): void;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function installMatchMedia(initialPrefersDark: boolean): MatchMediaStub {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let prefersDark = initialPrefersDark;

  const original = Object.getOwnPropertyDescriptor(window, "matchMedia");

  const matchMedia = (query: string): MediaQueryList => {
    const matches = query === DARK_QUERY ? prefersDark : false;

    const list = {
      media: query,
      matches,
      onchange: null,
      addEventListener: (type: string, listener: EventListener) => {
        if (type === "change" && query === DARK_QUERY) {
          listeners.add(listener as (event: MediaQueryListEvent) => void);
        }
      },
      removeEventListener: (type: string, listener: EventListener) => {
        if (type === "change") {
          listeners.delete(listener as (event: MediaQueryListEvent) => void);
        }
      },
      // Deprecated MediaQueryList API, kept so the shape stays assignable.
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };

    return list as unknown as MediaQueryList;
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    setPrefersDark(next: boolean) {
      prefersDark = next;
      for (const listener of listeners) {
        listener({ matches: next, media: DARK_QUERY } as MediaQueryListEvent);
      }
    },
    listenerCount: () => listeners.size,
    restore() {
      listeners.clear();
      if (original) {
        Object.defineProperty(window, "matchMedia", original);
      } else {
        Reflect.deleteProperty(window, "matchMedia");
      }
    },
  };
}
