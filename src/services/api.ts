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
 * Llama al endpoint /solve del backend para generar horarios
 */
export async function solveSchedule(
  request: BackendSolveRequest
): Promise<BackendSolveResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/solve`, {
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

