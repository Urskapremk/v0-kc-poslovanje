// Shared utility functions for Komba Cabana app

export const DEFAULT_RATE = 4800;

// Utility functions
export const today = () => new Date().toISOString().slice(0, 10);
export const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
export const eur = (value: unknown) => `${num(value).toFixed(2)} EUR`;
export const ar = (value: unknown) => `${Math.round(num(value)).toLocaleString("fr-FR")} Ar`;
export const arToEur = (arValue: unknown, rate: number) => num(arValue) / rate;
export const eurToAr = (eurValue: unknown, rate: number) => Math.round(num(eurValue) * rate);
