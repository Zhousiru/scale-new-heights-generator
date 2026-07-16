import { cn as cnfast, type ClassValue } from 'cnfast'

export function cn(...inputs: ClassValue[]): string {
  return cnfast(...inputs)
}
