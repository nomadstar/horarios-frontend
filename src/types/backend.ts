// Tipos para la comunicación con el backend

export interface BackendSeccion {
  codigo: string;
  nombre: string;
  profesor: string;
  horarios: BackendHorario[];
  cupos_disponibles: number;
  cupos_totales: number;
  seccion: string;
}

export interface BackendHorario {
  dia: string;
  inicio: string;
  fin: string;
  sala: string;
}

export interface BackendSolution {
  total_score: number;
  secciones: BackendSeccion[];
}

export interface BackendSolveResponse {
  documentos_leidos: number;
  soluciones_count: number;
  soluciones: BackendSolution[];
}

// Filtros del usuario (mapeo al backend)
export interface BackendUserFilters {
  dias_horarios_libres?: {
    habilitado: boolean;
    dias_libres_preferidos?: string[];
    minimizar_ventanas?: boolean;
    ventana_ideal_minutos?: number;
  };
  ventana_entre_actividades?: {
    habilitado: boolean;
    minutos_entre_clases?: number;
  };
  preferencias_profesores?: {
    habilitado: boolean;
    profesores_preferidos?: string[];
    profesores_evitar?: string[];
  };
  balance_lineas?: {
    habilitado: boolean;
    lineas?: {
      [key: string]: number;
    };
  };
}

// Request que se envía al backend
export interface BackendSolveRequest {
  email: string;
  ramos_pasados: string[];
  ramos_prioritarios: string[];
  horarios_preferidos: string[];
  malla: string;
  sheet?: string;
  student_ranking?: number;
  filtros?: BackendUserFilters;
}

