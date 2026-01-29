import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('zh-HK', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} 秒前`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} 小時前`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} 天前`;
}

export const sourceColors: Record<string, string> = {
  '明報': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  '東方日報': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  'HK01': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100',
  '信報': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
  'SCMP': 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
};
