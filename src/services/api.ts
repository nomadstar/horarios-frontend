// Servicio para comunicarse con el backend

import type { BackendSolveRequest, BackendSolveResponse } from '@/types/backend';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export class ApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Llama al endpoint /rutacritica/run del backend para generar horarios
 * (POST /solve con body JSON según openapi.json)
 */
export async function solveSchedule(
  request: BackendSolveRequest
): Promise<BackendSolveResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/rutacritica/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `Error ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    const data: BackendSolveResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.',
        0,
        error
      );
    }

    throw new ApiError(
      'Error inesperado al comunicarse con el servidor',
      0,
      error
    );
  }
}

/**
 * Obtiene la lista de archivos de mallas disponibles
 */
export async function getAvailableDatafiles(): Promise<{
  mallas: string[];
  ofertas: string[];
  porcentajes: string[];
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/datafiles`);
    
    if (!response.ok) {
      throw new ApiError(`Error ${response.status}: ${response.statusText}`, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Error al obtener archivos de malla', 0, error);
  }
}

/**
 * Obtiene el contenido de una malla específica
 */
export async function getMallaContent(mallaName: string, sheet?: string): Promise<unknown> {
  try {
    const url = new URL(`${API_BASE_URL}/datafiles/content`);
    url.searchParams.append('malla', mallaName);
    if (sheet) {
      url.searchParams.append('sheet', sheet);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new ApiError(`Error ${response.status}: ${response.statusText}`, response.status);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Error al obtener contenido de la malla', 0, error);
  }
}

/**
 * Llama al endpoint /solve usando query params (GET) según openapi.json
 */
export async function solveScheduleQuery(params: {
  email?: string;
  ramos_pasados?: string[];
  ramos_prioritarios?: string[];
  horarios_preferidos?: string[];
  malla?: string;
  sheet?: string;
}): Promise<BackendSolveResponse> {
  try {
    const url = new URL(`${API_BASE_URL}/solve`);
    if (params.email) url.searchParams.append('email', params.email);
    if (params.ramos_pasados && params.ramos_pasados.length) url.searchParams.append('ramos_pasados', params.ramos_pasados.join(','));
    if (params.ramos_prioritarios && params.ramos_prioritarios.length) url.searchParams.append('ramos_prioritarios', params.ramos_prioritarios.join(','));
    if (params.horarios_preferidos && params.horarios_preferidos.length) url.searchParams.append('horarios_preferidos', params.horarios_preferidos.join(','));
    if (params.malla) url.searchParams.append('malla', params.malla);
    if (params.sheet) url.searchParams.append('sheet', params.sheet);

    const response = await fetch(url.toString(), { method: 'GET' });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.error || `Error ${response.status}: ${response.statusText}`, response.status, errorData);
    }

    const data: BackendSolveResponse = await response.json();
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Error al ejecutar /solve', 0, err);
  }
}

/**
 * Obtiene los horarios más recomendados desde /analithics/horarios_mas_recomendados
 */
export async function getAnalithicsHorariosMasRecomendados(limit = 10): Promise<Array<{ horario: string; score?: number }>> {
  try {
    const url = new URL(`${API_BASE_URL}/analithics/horarios_mas_recomendados`);
    url.searchParams.append('limit', String(limit));
    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      throw new ApiError(`Error ${response.status}: ${response.statusText}`, response.status);
    }
    const data = await response.json();
    return data as Array<{ horario: string; score?: number }>;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Error al obtener horarios recomendados', 0, err);
  }
}

