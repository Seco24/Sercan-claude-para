import { useEffect, useState } from 'react';
import { todayISO } from '../domain/dates';

/** Bugünün tarihini döndürür; gece yarısı ve sekme tekrar görünür olduğunda kendiliğinden güncellenir. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        setToday(todayISO());
        schedule();
      }, next.getTime() - now.getTime());
    };
    const onVisible = () => document.visibilityState === 'visible' && setToday(todayISO());
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return today;
}

/** Belirli aralıkla yeniden çizim için şimdiki zaman (göreli "5 dk önce" metinleri) */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
