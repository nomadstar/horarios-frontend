import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { BackendSolution, BackendSeccion } from '@/types/backend';

interface ScheduleViewProps {
  solutions: BackendSolution[];
  onBack: () => void;
}

// Mapeo de días en español a abreviaciones
const DAY_MAP: Record<string, string> = {
  'LU': 'Lunes',
  'MA': 'Martes',
  'MI': 'Miércoles',
  'JU': 'Jueves',
  'VI': 'Viernes',
  'SA': 'Sábado',
  'DO': 'Domingo',
};

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Horarios estándar UDP
const TIME_SLOTS = [
  { id: 1, start: '08:30', end: '09:50' },
  { id: 2, start: '10:00', end: '11:20' },
  { id: 3, start: '11:30', end: '12:50' },
  { id: 4, start: '13:00', end: '14:20' },
  { id: 5, start: '14:30', end: '15:50' },
  { id: 6, start: '16:00', end: '17:20' },
  { id: 7, start: '17:25', end: '18:45' },
  { id: 8, start: '18:50', end: '20:10' },
  { id: 9, start: '20:15', end: '21:35' },
];

export function ScheduleView({ solutions, onBack }: ScheduleViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(true);

  if (!solutions || solutions.length === 0) {
    return (
      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold mb-2">❌ No se encontraron horarios</CardTitle>
          <p className="text-gray-600 text-base">
            No se pudo generar ningún horario con tus preferencias actuales.
            <br />
            Intenta ajustar tus filtros o ramos prioritarios.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Button onClick={onBack}>
              ← Volver a Configuración
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentSolution = solutions[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(solutions.length - 1, prev + 1));
  };

  // Función para parsear horario y ubicarlo en la grilla
  const parseScheduleBlock = (seccion: BackendSeccion | any) => {
    const blocks: Array<{
      day: string;
      timeSlotId: number;
      seccion: BackendSeccion;
    }> = [];

    // Validar que seccion es un objeto válido
    if (!seccion || typeof seccion !== 'object') {
      console.warn('Sección inválida:', seccion);
      return blocks;
    }

    // Verificar que tiene al menos un código o nombre
    if (!seccion.codigo && !seccion.nombre) {
      console.warn('Sección sin código ni nombre:', seccion);
      return blocks;
    }

    // Verificar que horario existe y es un array
    if (!seccion.horario || !Array.isArray(seccion.horario) || seccion.horario.length === 0) {
      console.warn(`Sección ${seccion.codigo || seccion.nombre || 'desconocida'} no tiene horario válido:`, seccion.horario);
      return blocks;
    }

    seccion.horario.forEach((horarioStr: string) => {
      if (!horarioStr || horarioStr === "Sin horario") return;

      // Parsear strings como "LU MA JU 10:00 - 11:20" o "MI 10:00 - 11:20"
      const parts = horarioStr.split(' ').filter(Boolean);
      if (parts.length < 2) return;

      // Encontrar dónde termina la lista de días y comienza la hora
      // Los días son códigos de 2 letras (LU, MA, MI, JU, VI, SA, DO)
      let dayEndIndex = 0;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Si no es un código de día de 2 letras, entonces es parte de la hora
        if (part.length !== 2 || !DAY_MAP[part]) {
          dayEndIndex = i;
          break;
        }
      }

      if (dayEndIndex === 0) return; // No se encontraron días válidos

      // Extraer los códigos de día
      const dayCodes = parts.slice(0, dayEndIndex);
      // Extraer la hora (todo lo que queda)
      const timeRange = parts.slice(dayEndIndex).join(' ');
      const [startTime] = timeRange.split(' - ');

      // Crear un bloque para cada día
      dayCodes.forEach(dayCode => {
        const dayName = DAY_MAP[dayCode] || dayCode;

        // Buscar el time slot que corresponde al horario
        const matchingSlot = TIME_SLOTS.find(slot => {
          const slotStart = slot.start.replace(':', '');
          const horarioStart = startTime.replace(':', '');
          return slotStart === horarioStart;
        });

        if (matchingSlot) {
          blocks.push({
            day: dayName,
            timeSlotId: matchingSlot.id,
            seccion,
          });
        }
      });
    });

    return blocks;
  };

  // Generar todos los bloques del horario actual
  // Desempacar secciones si vienen en wrapper (con prioridad)
  const unwrappedSecciones = currentSolution.secciones.map(item => {
    // Si el item tiene una propiedad 'seccion' anidada, es un wrapper
    if ('seccion' in item && typeof item.seccion === 'object' && item.seccion !== null) {
      return (item as any).seccion;
    }
    // Si no, es una sección directa
    return item;
  });

  const allBlocks = unwrappedSecciones.flatMap(seccion => parseScheduleBlock(seccion));

  // Función para obtener el bloque en un día y horario específico
  const getBlockAt = (day: string, timeSlotId: number) => {
    return allBlocks.find(block => block.day === day && block.timeSlotId === timeSlotId);
  };

  return (
    <>
      {/* Modal de Advertencia */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              Advertencia Importante
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong className="text-orange-700">⚠️ Ten en cuenta:</strong> Dependiendo de tu 
                  <strong> ranking académico</strong>, tendrás una ventana de tiempo específica para inscribir tus cursos.
                </p>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-700">
                  <strong>¿Qué significa esto?</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-2 ml-2">
                  <li>
                    Los estudiantes con <strong>mejor ranking</strong> tienen prioridad y pueden inscribirse primero
                  </li>
                  <li>
                    Algunos cursos populares podrían <strong>llenarse antes</strong> de tu ventana de inscripción
                  </li>
                  <li>
                    Es posible que <strong>no puedas tomar exactamente este horario</strong> si los cupos se agotan
                  </li>
                  <li>
                    Te recomendamos tener <strong>horarios alternativos</strong> preparados
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-gray-700">
                  <strong className="text-blue-700">💡 Recomendación:</strong> Revisa todos los horarios generados 
                  ({solutions.length} disponibles) y prepara alternativas para aumentar tus posibilidades de inscripción exitosa.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              onClick={() => setShowWarningModal(false)}
              className="w-full"
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contenido del horario */}
      <Card className="w-full border-0 shadow-none bg-transparent">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold mb-2">📅 Horarios Generados</CardTitle>
          <p className="text-gray-600 text-base mb-4">
            {currentSolution.secciones.length} cursos • Score: {currentSolution.total_score}
          </p>
          
          {/* Navegación entre horarios */}
          <div className="flex justify-center items-center gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="text-sm font-medium">
              Horario {currentIndex + 1} de {solutions.length}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNext}
              disabled={currentIndex === solutions.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={onBack}>
              ← Volver a Configuración
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-sm font-semibold text-gray-700 w-32">
                    Horario
                  </th>
                  {DAYS_OF_WEEK.map(day => (
                    <th key={day} className="border border-gray-300 p-3 text-sm font-semibold text-gray-700">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(timeSlot => (
                  <tr key={timeSlot.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3 text-xs text-gray-600 font-medium bg-gray-50">
                      <div className="text-center">
                        <div className="font-semibold">{timeSlot.id}</div>
                        <div className="mt-1">{timeSlot.start}</div>
                        <div>{timeSlot.end}</div>
                      </div>
                    </td>
                    {DAYS_OF_WEEK.map(day => {
                      const block = getBlockAt(day, timeSlot.id);
                      
                      return (
                        <td 
                          key={`${day}-${timeSlot.id}`} 
                          className="border border-gray-300 p-2"
                        >
                          {block ? (
                            <div className="bg-blue-100 border-l-4 border-blue-500 rounded p-2 h-full">
                              <div className="font-bold text-xs text-blue-900">
                                {block.seccion.codigo}
                              </div>
                              <div className="text-xs text-blue-700 mt-1 line-clamp-2">
                                {block.seccion.nombre}
                              </div>
                              <div className="text-xs text-blue-600 mt-1">
                                Sección: {block.seccion.seccion}
                              </div>
                              {block.seccion.profesor && (
                                <div className="text-xs text-blue-600 mt-1 font-medium">
                                  👨‍🏫 {block.seccion.profesor}
                                </div>
                              )}
                              {block.seccion.codigo_box && (
                                <div className="text-xs text-blue-500 mt-1">
                                  Código: {block.seccion.codigo_box}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="h-16"></div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumen de cursos */}
          <div className="mt-6 p-5 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-base mb-3 text-gray-700">📚 Cursos en este horario</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unwrappedSecciones.map((seccion, idx) => (
                <div key={idx} className="bg-white p-3 rounded border border-blue-200">
                  <div className="font-semibold text-sm text-blue-900">
                    {seccion.codigo || 'N/A'} - Sección {seccion.seccion || 'N/A'}
                  </div>
                  {seccion.nombre && (
                    <div className="text-xs text-gray-600 mt-1">
                      {seccion.nombre}
                    </div>
                  )}
                  {seccion.profesor && (
                    <div className="text-xs text-gray-500 mt-2">
                      Profesor: {seccion.profesor}
                    </div>
                  )}
                  {seccion.codigo_box && (
                    <div className="text-xs text-gray-500 mt-1">
                      Código: {seccion.codigo_box}
                    </div>
                  )}
                  {seccion.horario && Array.isArray(seccion.horario) && seccion.horario.length > 0 && (
                    <div className="mt-2">
                      {seccion.horario.map((horarioStr: string, hIdx: number) => (
                        <Badge key={hIdx} variant="outline" className="mr-1 mb-1 text-xs">
                          {horarioStr}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Estadísticas */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {currentSolution.secciones.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Cursos</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className="text-2xl font-bold text-green-600">
                {currentSolution.total_score}
              </div>
              <div className="text-sm text-gray-600 mt-1">Score de optimización</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {allBlocks.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Bloques semanales</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
