import { useEffect, useState } from 'react';

export type Route = 'ozet' | 'harcamalar' | 'yatirimlar' | 'ayarlar';
const ROUTES: Route[] = ['ozet', 'harcamalar', 'yatirimlar', 'ayarlar'];

function parse(): { route: Route; sub: string } {
  const [head = '', sub = ''] = window.location.hash.replace(/^#\/?/, '').split('/');
  const route = (ROUTES as string[]).includes(head) ? (head as Route) : 'ozet';
  return { route, sub };
}

/** Basit hash yönlendirmesi (#/harcamalar) — sayfa yenilenince aynı bölüm açık kalır. */
export function useHashRoute() {
  const [loc, setLoc] = useState(parse);
  useEffect(() => {
    const on = () => {
      setLoc(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

export const href = (route: Route, sub?: string) => `#/${route}${sub ? `/${sub}` : ''}`;
