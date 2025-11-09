import type { DayOfWeek } from './schedule';

// Tipo para profesores
export interface Professor {
  id: string;
  name: string;
  rating?: number; // Opcional: calificación del profesor
}

// Preferencia de profesor para un curso específico
export interface ProfessorPreference {
  courseId: number;
  professorId: string;
}

// Bloque de tiempo bloqueado (no disponible)
export interface BlockedTimeSlot {
  id: string;
  day: DayOfWeek;
  timeSlotId: number;
  reason?: string; // Ej: "Trabajo", "Otro curso", etc.
}

// Tipo de optimización
export type OptimizationType = 
  | 'minimize-gaps'        // Minimizar ventanas entre clases
  | 'morning-classes'      // Preferir clases en la mañana
  | 'afternoon-classes'    // Preferir clases en la tarde
  | 'compact-days'         // Días compactos (pocas ventanas)
  | 'spread-days'          // Distribuir clases en más días
  | 'no-fridays';          // Evitar clases los viernes

// Preferencias del usuario (versión frontend)
export interface UserPreferences {
  // Preferencias de profesores
  professorPreferences: ProfessorPreference[];
  profesoresPreferidos?: string[]; // Nombres de profesores preferidos (para backend)
  profesoresEvitar?: string[]; // Nombres de profesores a evitar (para backend)
  
  // Horarios
  blockedTimeSlots: BlockedTimeSlot[];
  horarios_preferidos: string[]; // Formato "HH:MM-HH:MM" para backend
  
  // Optimizaciones
  optimizations: OptimizationType[];
  maxDailyHours?: number;  // Máximo de horas por día
  preferredDays?: DayOfWeek[]; // Días preferidos para tener clases
  
  // Ranking académico (0.0 - 1.0)
  studentRanking?: number;
  
  // Ramos prioritarios
  ramosPrioritarios: string[]; // Códigos de ramos prioritarios
}

// Preferencias por defecto
export const DEFAULT_PREFERENCES: UserPreferences = {
  professorPreferences: [],
  profesoresPreferidos: [],
  profesoresEvitar: [],
  blockedTimeSlots: [],
  horarios_preferidos: [],
  optimizations: ['minimize-gaps'],
  maxDailyHours: 6,
  preferredDays: undefined,
  studentRanking: 0.5,
  ramosPrioritarios: [],
};

