import { useState } from 'react';
import { SignedIn, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { InvalidEmailModal } from './components/InvalidEmailModal';
import { MallaGrid } from './components/MallaGrid';
import { PreferencesConfig } from './components/PreferencesConfig';
import { ScheduleView } from './components/ScheduleView';
import { useEmailValidation } from './hooks/use-email-validation';
import { DEFAULT_PREFERENCES } from './types/preferences';
import { solveSchedule, ApiError } from './services/api';
import type { UserPreferences } from './types/preferences';
import type { BackendSolution, BackendSolveRequest, BackendUserFilters } from './types/backend';
import { mallaData } from './data/malla';
import { TIME_SLOTS } from './types/schedule';
import { Alert, AlertDescription } from './components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

type AppView = 'malla' | 'preferences' | 'schedule';

export default function App() {
  const { isLoaded, isValidEmail, isSignedIn } = useEmailValidation();
  const { user } = useUser();
  
  // Estado de la aplicación
  const [currentView, setCurrentView] = useState<AppView>('malla');
  const [approvedCourses, setApprovedCourses] = useState<Set<number>>(new Set());
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [generatedSolutions, setGeneratedSolutions] = useState<BackendSolution[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handlers
  const handleApprovedCoursesChange = (courses: Set<number>) => {
    setApprovedCourses(courses);
  };

  const handleStartConfiguration = () => {
    setCurrentView('preferences');
    setError(null);
  };

  const handleBackToMalla = () => {
    setCurrentView('malla');
    setError(null);
  };

  const handleBackToPreferences = () => {
    setCurrentView('preferences');
    setError(null);
  };

  const handleGenerateSchedules = async (preferences: UserPreferences) => {
    setUserPreferences(preferences);
    setIsGenerating(true);
    setError(null);

    try {
      // Obtener códigos de ramos aprobados
      const approvedCourseCodes = Array.from(approvedCourses)
        .map(id => mallaData.find(c => c.id === id)?.code)
        .filter(Boolean) as string[];

      // Convertir horarios bloqueados a bloques prohibidos en formato "LU 08:30 - 10:00"
      // Agrupamos slots por día y fusionamos secuencias de ids contiguos en un solo bloque.
      const dayMap: Record<string, string> = {
        'Lunes': 'LU',
        'Martes': 'MA',
        'Miércoles': 'MI',
        'Jueves': 'JU',
        'Viernes': 'VI',
      };

      const horariosPreferidos: string[] = [];
      if (preferences.optimizations.includes('morning-classes')) {
        horariosPreferidos.push('08:30-12:50');
      }
      if (preferences.optimizations.includes('afternoon-classes')) {
        horariosPreferidos.push('13:00-18:45');
      }

      // Construir bloques prohibidos a partir de blockedTimeSlots
      // ESTRATEGIA: Consolidar múltiples días con LA MISMA FRANJA HORARIA en un solo bloque
      // Por ejemplo: LU 08:30-09:50, MA 08:30-09:50, MI 08:30-09:50 -> "LU MA MI 08:30 - 09:50"
      const horariosProhibidos: string[] = [];
      if (preferences.blockedTimeSlots && preferences.blockedTimeSlots.length > 0) {
        // Agrupar por FRANJA HORARIA (start-end), no por día
        const franjaMap: Record<string, { days: Set<string>; start: string; end: string }> = {};
        
        preferences.blockedTimeSlots.forEach((b: any) => {
          const slot = TIME_SLOTS.find(s => s.id === b.timeSlotId);
          if (slot) {
            const franjaKey = `${slot.start}-${slot.end}`;
            const dayCode = dayMap[b.day] || b.day;
            
            if (!franjaMap[franjaKey]) {
              franjaMap[franjaKey] = {
                days: new Set(),
                start: slot.start,
                end: slot.end,
              };
            }
            franjaMap[franjaKey].days.add(dayCode);
          }
        });

        // Convertir cada franja consolidada a string "LU MA MI 08:30 - 09:50"
        Object.values(franjaMap).forEach((franja) => {
          const daysStr = Array.from(franja.days).sort().join(' ');
          horariosProhibidos.push(`${daysStr} ${franja.start} - ${franja.end}`);
        });
      }

      // Construir filtros basado en las preferencias del usuario
      const buildFiltros = (): BackendUserFilters => {
        const filtros: BackendUserFilters = {};

        // 1. Dias y horarios libres - BASADO EN HORARIOS BLOQUEADOS
        if (preferences.blockedTimeSlots && preferences.blockedTimeSlots.length > 0) {
          const diasLibres = new Set<string>();
          
          // Mapear nombres de días al formato de código de día (LU, MA, MI, JU, VI)
          const dayMap: Record<string, string> = {
            'Lunes': 'LU',
            'Martes': 'MA',
            'Miércoles': 'MI',
            'Jueves': 'JU',
            'Viernes': 'VI',
          };
          
          preferences.blockedTimeSlots.forEach((slot: any) => {
            const dayCode = dayMap[slot.day];
            if (dayCode) {
              diasLibres.add(dayCode);
            }
          });

          filtros.dias_horarios_libres = {
            habilitado: true,
            dias_libres_preferidos: Array.from(diasLibres),
            minimizar_ventanas: preferences.optimizations.includes('minimize-gaps'),
            ventana_ideal_minutos: 30,
          };
        }

        // 2. Ventana entre actividades
        if (preferences.optimizations.includes('minimize-gaps')) {
          filtros.ventana_entre_actividades = {
            habilitado: true,
            minutos_entre_clases: 15,
          };
        }

        // 3. Preferencias de profesores (si las hay)
        if (preferences.professorPreferences && preferences.professorPreferences.length > 0) {
          filtros.preferencias_profesores = {
            habilitado: true,
            profesores_preferidos: preferences.professorPreferences.map((p: any) => p.professorId),
            profesores_evitar: [],
          };
        }

        return filtros;
      };

      const filtros = buildFiltros();

      // Construir request para el backend
      const request: BackendSolveRequest = {
        email: user?.primaryEmailAddress?.emailAddress || '',
        ramos_pasados: approvedCourseCodes,
        ramos_prioritarios: preferences.ramosPrioritarios || [],
        horarios_preferidos: horariosPreferidos,
        horarios_prohibidos: horariosProhibidos.length > 0 ? horariosProhibidos : undefined,
        malla: 'MC2020.xlsx', // TODO: hacer esto configurable
        sheet: undefined,
        student_ranking: preferences.studentRanking || 0.5,
        filtros: Object.keys(filtros).length > 0 ? filtros : undefined,
      };

      console.log('Enviando request al backend:', request);

      // Llamar al backend: POST /rutacritica/run (según openapi.json)
      const response = await solveSchedule(request);

      console.log('Response del backend:', response);

      if (!response.soluciones || response.soluciones.length === 0) {
        setError('No se encontraron horarios que cumplan con tus preferencias. Intenta ajustar tus filtros o ramos prioritarios.');
        setIsGenerating(false);
        return;
      }

      setGeneratedSolutions(response.soluciones);
      setCurrentView('schedule');
    } catch (err) {
      console.error('Error al generar horarios:', err);
      
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Error inesperado al generar horarios. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Si el usuario no está autenticado, mostrar página de login
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Malla Curricular UDP</h1>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Accede con tu cuenta institucional para ver y planificar tu malla curricular
          </p>
          <SignInButton />
        </div>
      </div>
    );
  }

  // Si el usuario está autenticado pero no tiene email válido
  if (!isValidEmail) {
    return <InvalidEmailModal isOpen={true} />;
  }

  // Usuario autenticado con email válido - mostrar aplicación completa
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Generador de Horarios UDP</h1>
          <div className="flex items-center gap-4">
            <SignedIn>
              <div className="flex items-center gap-2">
                <UserButton />
                {user && (
                  <div className="text-sm text-gray-600">
                    {user.firstName} {user.lastName}
                  </div>
                )}
              </div>
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="w-full px-4 py-4">
        {/* Mostrar error si existe */}
        {error && (
          <div className="max-w-7xl mx-auto mb-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Mostrar indicador de carga */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <div className="text-lg font-semibold">Generando horarios...</div>
              <div className="text-sm text-gray-600">Esto puede tomar unos segundos</div>
            </div>
          </div>
        )}

        {currentView === 'malla' && (
          <MallaGrid
            approvedCourses={approvedCourses}
            onApprovedCoursesChange={handleApprovedCoursesChange}
            onStartCourseSelection={handleStartConfiguration}
          />
        )}

        {currentView === 'preferences' && (
          <PreferencesConfig
              approvedCourses={approvedCourses}
              preferences={userPreferences}
              onPreferencesChange={setUserPreferences}
              onContinue={(prefs) => handleGenerateSchedules(prefs)}
              onBack={handleBackToMalla}
            />
        )}

        {currentView === 'schedule' && (
          <ScheduleView
            solutions={generatedSolutions}
            onBack={handleBackToPreferences}
          />
        )}
      </main>
    </div>
  );
}
