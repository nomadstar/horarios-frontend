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

      // Convertir horarios bloqueados a formato "HH:MM-HH:MM"
      const horariosPreferidos: string[] = [];
      if (preferences.optimizations.includes('morning-classes')) {
        horariosPreferidos.push('08:30-12:50');
      }
      if (preferences.optimizations.includes('afternoon-classes')) {
        horariosPreferidos.push('13:00-18:45');
      }

      // Construir filtros del backend
      const filtros: BackendUserFilters = {
        dias_horarios_libres: {
          habilitado: preferences.optimizations.includes('no-fridays'),
          dias_libres_preferidos: preferences.optimizations.includes('no-fridays') ? ['VI'] : undefined,
          minimizar_ventanas: preferences.optimizations.includes('minimize-gaps'),
          ventana_ideal_minutos: preferences.optimizations.includes('minimize-gaps') ? 30 : undefined,
        },
        ventana_entre_actividades: {
          habilitado: preferences.optimizations.includes('minimize-gaps'),
          minutos_entre_clases: preferences.optimizations.includes('minimize-gaps') ? 15 : undefined,
        },
        preferencias_profesores: {
          habilitado: ((preferences.profesoresPreferidos && preferences.profesoresPreferidos.length > 0) ||
                      (preferences.profesoresEvitar && preferences.profesoresEvitar.length > 0)) || false,
          profesores_preferidos: preferences.profesoresPreferidos,
          profesores_evitar: preferences.profesoresEvitar,
        },
      };

      // Construir request para el backend
      const request: BackendSolveRequest = {
        email: user?.primaryEmailAddress?.emailAddress || '',
        ramos_pasados: approvedCourseCodes,
        ramos_prioritarios: preferences.ramosPrioritarios || [],
        horarios_preferidos: horariosPreferidos,
        malla: 'MC2020.xlsx', // TODO: hacer esto configurable
        sheet: undefined,
        student_ranking: preferences.studentRanking || 0.5,
        filtros,
      };

      console.log('Enviando request al backend:', request);

      // Llamar al backend
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
            onContinue={() => handleGenerateSchedules(userPreferences)}
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
