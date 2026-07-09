'use strict';

/*
 * Esquema único del cuestionario IA-OPOSDEP (versión ampliada para PLS-SEM, ~78 ítems).
 * Es la ÚNICA fuente de verdad: el servidor lo usa para validar y para construir el
 * CSV, y el frontend lo consume vía /api/schema para pintar el formulario.
 *
 * Cada ítem se guarda SIEMPRE por su código de escala fijo (PE1, EE3, FC1, AILS25,
 * GAAIS38, OSLQ43, NF51, MK1, ...), nunca por su posición en pantalla, de modo que
 * la exportación CSV sale lista para SmartPLS / R sin renombrar columnas.
 *
 * El número de ítem (num) se asigna automáticamente por orden de bloque al final del
 * archivo; se usa solo para ordenar columnas del CSV y las medias del panel.
 */

const ESCALA_LIKERT = [
  { valor: 1, etiqueta: 'Totalmente en desacuerdo' },
  { valor: 2, etiqueta: 'En desacuerdo' },
  { valor: 3, etiqueta: 'Ni de acuerdo ni en desacuerdo' },
  { valor: 4, etiqueta: 'De acuerdo' },
  { valor: 5, etiqueta: 'Totalmente de acuerdo' }
];

const CCAA = [
  'Andalucía', 'Aragón', 'Principado de Asturias', 'Illes Balears', 'Canarias',
  'Cantabria', 'Castilla-La Mancha', 'Castilla y León', 'Cataluña',
  'Comunitat Valenciana', 'Extremadura', 'Galicia', 'La Rioja',
  'Comunidad de Madrid', 'Región de Murcia', 'Comunidad Foral de Navarra',
  'País Vasco', 'Ceuta', 'Melilla'
];

const BLOQUES = [
  {
    n: 1,
    titulo: 'Bloque 1 · Datos sociodemográficos',
    descripcion: 'Todas las preguntas se recogen en rangos amplios; ninguna permite identificarte.',
    items: [
      { code: 'edad', type: 'single', label: 'Edad', options: ['18-25', '26-35', '36-45', '46-55', '56 o más'] },
      { code: 'genero', type: 'single', label: 'Género', options: ['Mujer', 'Hombre', 'No binario', 'Prefiero no contestar'] },
      { code: 'formacion', type: 'single', label: 'Nivel de formación', options: ['ESO', 'Bachillerato', 'FP Grado Medio', 'FP Grado Superior', 'Grado o Licenciatura', 'Máster', 'Doctorado'] },
      { code: 'ccaa', type: 'single', label: 'Comunidad autónoma', options: CCAA },
      { code: 'tipo_oposicion', type: 'single', label: 'Tipo de oposición que preparas', options: ['Gestor/a deportivo/a (A1)', 'Técnico/a superior (A1-A2)', 'Director/a deportivo/a municipal', 'Coordinador/a', 'Técnico/a (C1)', 'Monitor/a (C2)', 'Personal de oficios', 'Otra'] },
      { code: 'tiempo_preparando', type: 'single', label: 'Tiempo que llevas preparándote', options: ['Menos de 6 meses', '6-12 meses', '1-2 años', '2-3 años', 'Más de 3 años'] },
      { code: 'convocatorias', type: 'single', label: 'Convocatorias a las que te has presentado', options: ['Ninguna', '1', '2', '3', '4 o más'] },
      { code: 'modalidad', type: 'single', label: 'Modalidad de preparación', options: ['Academia presencial', 'Academia online', 'Preparador particular', 'Autodidacta', 'Mixta'] }
    ]
  },
  {
    n: 2,
    titulo: 'Bloque 2 · Hábitos de preparación',
    items: [
      { code: 'horas_semanales', type: 'single', label: 'Horas semanales de estudio', options: ['Menos de 10', '10-20', '20-30', '30-40', 'Más de 40'] },
      { code: 'gasto_mensual', type: 'single', label: 'Gasto mensual en preparación', options: ['0 €', '1-50 €', '51-150 €', '151-300 €', 'Más de 300 €'] },
      { code: 'recursos', type: 'multiple', label: 'Recursos que utilizas (marca todos los que apliquen)', options: ['Temario propio', 'Temario de academia', 'Libros', 'BOE / normativa', 'YouTube', 'Podcasts', 'Grupos de estudio', 'IA generativa', 'Flashcards', 'Simulacros'] }
    ]
  },
  {
    n: 3,
    titulo: 'Bloque 3 · Uso y percepción de la IA (UTAUT2)',
    items: [
      // --- Comportamiento de uso (no Likert) ---
      { code: 'uso_actual_ia', type: 'single', label: 'Uso actual de la IA en tu preparación', options: ['No, nunca', 'La probé pero no la uso', 'Ocasionalmente', 'Habitualmente', 'A diario'] },
      { code: 'UB2', type: 'single', label: '¿Con qué frecuencia usas IA en tu preparación?', options: ['Nunca', 'Menos de una vez por semana', 'Varias veces por semana', 'A diario', 'Varias veces al día'] },
      { code: 'tareas_ia', type: 'multiple', label: 'Tareas para las que usas la IA (marca todas las que apliquen)', options: ['Resumir', 'Hacer esquemas', 'Explicar conceptos', 'Resolver dudas', 'Corregir supuestos', 'Generar tests', 'Simular orales', 'Buscar normativa', 'Traducir', 'No la uso'] },
      // --- Constructos Likert (se aleatorizan en conjunto por participante) ---
      { code: 'PE1', type: 'likert', label: 'Usar IA me resulta útil en mi preparación.' },
      { code: 'PE2', type: 'likert', label: 'Usar IA me ayuda a estudiar más rápido.' },
      { code: 'PE3', type: 'likert', label: 'Usar IA mejora mi comprensión de los temas.' },
      { code: 'EE1', type: 'likert', label: 'Aprender a usar IA es fácil para mí.' },
      { code: 'EE2', type: 'likert', label: 'Interactuar con la IA es claro y comprensible.' },
      { code: 'EE3', type: 'likert', label: 'Manejar herramientas de IA para estudiar me resulta sencillo.' },
      { code: 'SI1', type: 'likert', label: 'Personas importantes para mí piensan que debería usar IA.' },
      { code: 'SI2', type: 'likert', label: 'Otros opositores a mi alrededor usan IA.' },
      { code: 'SI3', type: 'likert', label: 'Los preparadores o academias que valoro recomiendan usar IA en la preparación.' },
      { code: 'HM1', type: 'likert', label: 'Usar IA es entretenido.' },
      { code: 'HM2', type: 'likert', label: 'Disfruto utilizando la IA cuando preparo mi oposición.' },
      { code: 'HM3', type: 'likert', label: 'Usar la IA en el estudio me resulta agradable.' },
      { code: 'FC1', type: 'likert', label: 'Dispongo de los recursos necesarios (dispositivo, conexión, acceso) para usar IA en mi preparación.' },
      { code: 'FC2', type: 'likert', label: 'Tengo los conocimientos necesarios para usar herramientas de IA.' },
      { code: 'FC3', type: 'likert', label: 'Cuando tengo dificultades con la IA, puedo conseguir ayuda de otras personas o recursos.' },
      { code: 'PV1', type: 'likert', label: 'Las herramientas de IA tienen un precio razonable para lo que ofrecen en mi preparación.' },
      { code: 'PV2', type: 'likert', label: 'Teniendo en cuenta su coste, la IA me aporta un buen valor.' },
      { code: 'PV3', type: 'likert', label: 'Al precio actual, la IA es una inversión que merece la pena para preparar la oposición.' },
      { code: 'BI1', type: 'likert', label: 'Tengo intención de seguir usando IA en mi preparación.' },
      { code: 'BI2', type: 'likert', label: 'Recomendaría usar IA a otros opositores.' },
      { code: 'BI3', type: 'likert', label: 'Tengo previsto usar la IA con frecuencia en los próximos meses de preparación.' },
      { code: 'HABIT1', type: 'likert', label: 'Usar IA se ha convertido en un hábito para mí.' },
      { code: 'HABIT2', type: 'likert', label: 'Recurrir a la IA para estudiar es algo que hago de forma automática.' },
      { code: 'HABIT3', type: 'likert', label: 'Usar la IA en mi preparación forma parte de mi rutina.' },
      { code: 'UB3', type: 'likert', label: 'El uso de la IA está muy integrado en mi forma actual de estudiar.' }
    ]
  },
  {
    n: 4,
    titulo: 'Bloque 4 · Alfabetización en IA (AILS)',
    items: [
      { code: 'AILS25', type: 'likert', label: 'Puedo distinguir entre dispositivos con y sin IA.' },
      { code: 'AILS26', type: 'likert', label: 'Entiendo cómo la IA puede ayudarme en mis estudios.' },
      { code: 'AILS27', type: 'likert', label: 'Puedo identificar las limitaciones actuales de la IA.' },
      { code: 'AILS28', type: 'likert', label: 'Sé cómo formular preguntas eficaces a la IA (prompting).' },
      { code: 'AILS29', type: 'likert', label: 'Puedo evaluar críticamente las respuestas de la IA.' },
      { code: 'AILS30', type: 'likert', label: 'Sé detectar cuando la IA se equivoca o "alucina".' },
      { code: 'AILS31', type: 'likert', label: 'Conozco los riesgos éticos de la IA.' },
      { code: 'AILS32', type: 'likert', label: 'Entiendo cómo la IA gestiona mis datos.' }
    ]
  },
  {
    n: 5,
    titulo: 'Bloque 5 · Actitudes hacia la IA (GAAIS)',
    items: [
      { code: 'GAAIS33', type: 'likert', label: 'La IA puede proporcionar nuevas oportunidades de aprendizaje.' },
      { code: 'GAAIS34', type: 'likert', label: 'La IA hará el mundo más eficiente.' },
      { code: 'GAAIS35', type: 'likert', label: 'Hay muchas cosas beneficiosas que se pueden hacer con la IA.' },
      { code: 'GAAIS36', type: 'likert', label: 'La IA puede ahorrarme mucho tiempo.' },
      { code: 'GAAIS37', type: 'likert', label: 'La IA puede ayudar a personas que lo necesitan.' },
      { code: 'GAAIS38', type: 'likert', label: 'Me preocupa el uso futuro de la IA.', inverted: true },
      { code: 'GAAIS39', type: 'likert', label: 'La IA se está usando para espiar a las personas.', inverted: true },
      { code: 'GAAIS40', type: 'likert', label: 'No confío en la IA.', inverted: true },
      { code: 'GAAIS41', type: 'likert', label: 'La IA podría ser peligrosa.', inverted: true },
      { code: 'GAAIS42', type: 'likert', label: 'La IA me produce rechazo.', inverted: true }
    ]
  },
  {
    n: 6,
    titulo: 'Bloque 6 · Autorregulación del aprendizaje (OSLQ)',
    items: [
      { code: 'OSLQ43', type: 'likert', label: 'Me fijo objetivos a corto plazo (diarios o semanales).' },
      { code: 'OSLQ44', type: 'likert', label: 'Me fijo objetivos a largo plazo (mensuales o anuales).' },
      { code: 'OSLQ45', type: 'likert', label: 'Dispongo de un lugar específico para estudiar sin distracciones.' },
      { code: 'OSLQ46', type: 'likert', label: 'Planifico mi tiempo de estudio con antelación.' },
      { code: 'OSLQ47', type: 'likert', label: 'Intento identificar qué método de estudio me funciona mejor.' },
      { code: 'OSLQ48', type: 'likert', label: 'Busco ayuda cuando no entiendo un tema.' },
      { code: 'OSLQ49', type: 'likert', label: 'Me autoevalúo regularmente con tests o simulacros.' },
      { code: 'OSLQ50', type: 'likert', label: 'Reviso mis errores para no repetirlos.' }
    ]
  },
  {
    n: 7,
    titulo: 'Bloque 7 · Necesidades formativas',
    items: [
      { code: 'NF51', type: 'likert', label: 'La IA tiene limitaciones importantes para preparar oposiciones deportivas (normativa desactualizada, errores en citas).' },
      { code: 'NF52', type: 'likert', label: 'Una academia aporta valor que la IA no puede sustituir.' },
      { code: 'NF53', type: 'likert', label: 'Necesito corrección personalizada de supuestos prácticos por un experto humano.' },
      { code: 'NF54', type: 'likert', label: 'Valoraría simulacros orales con tribunal real.' },
      { code: 'NF55', type: 'likert', label: 'Valoraría pertenecer a una comunidad de opositores.' },
      { code: 'NF56', type: 'likert', label: 'Necesito ayuda para mantener el temario actualizado con cambios normativos.' },
      { code: 'servicios_57', type: 'multiple', label: 'Servicios que debería ofrecer tu academia ideal (marca todos los que apliquen)', options: ['Temario actualizado en tiempo real', 'Corrección de supuestos prácticos', 'Simulacros orales', 'Mentoría individual', 'Comunidad de opositores', 'Plan de estudio personalizado', 'IA entrenada con el temario oficial', 'Tests automáticos', 'Preparación psicológica', 'Clases en directo'] },
      { code: 'abierta_58', type: 'open', required: false, label: '¿Qué es lo que echas más en falta en tu preparación? (opcional)' },
      { code: 'abierta_59', type: 'open', required: false, label: '¿Cómo crees que la IA cambiará la preparación de oposiciones en los próximos 5 años? (opcional)' }
    ]
  },
  {
    n: 8,
    titulo: 'Bloque 8 · Recomendación y disposición a pagar',
    items: [
      { code: 'NPS', type: 'nps', label: 'Del 0 al 10, ¿qué probabilidad hay de que recomiendes usar IA a otro opositor?', min: 0, max: 10 },
      { code: 'WTP', type: 'single', label: '¿Cuánto estarías dispuesto/a a pagar al mes por una academia con IA integrada?', options: ['Menos de 30 €', '30-60 €', '61-100 €', '101-150 €', '151-250 €', 'Más de 250 €'] }
    ]
  },
  {
    // Variable marcadora (marker variable) para el control del sesgo de método común.
    // Se presenta con etiqueta neutra y sin revelar su función. Teóricamente no
    // relacionada con los constructos del modelo (puntualidad).
    n: 9,
    titulo: 'Bloque 9 · Sobre ti',
    descripcion: 'Para terminar, unas preguntas generales sobre ti.',
    items: [
      { code: 'MK1', type: 'likert', label: 'En general, me considero una persona puntual en mi vida diaria.' },
      { code: 'MK2', type: 'likert', label: 'Suelo llegar a tiempo a mis citas y compromisos.' },
      { code: 'MK3', type: 'likert', label: 'La puntualidad es un valor importante para mí.' }
    ]
  }
];

// Lista plana de ítems en orden de bloque. El número (num) se asigna aquí, de forma
// que el orden de las columnas del CSV sigue el orden natural del cuestionario.
const ITEMS = BLOQUES.flatMap((b) => b.items);
ITEMS.forEach((it, i) => { it.num = i + 1; });

// Columnas fijas del CSV: metadatos + un código por ítem (orden de bloque).
const CSV_COLUMNS = [
  'id', 'timestamp', 'duracion_segundos', 'flag_rapida',
  ...ITEMS.map((it) => it.code)
];

module.exports = { ESCALA_LIKERT, BLOQUES, ITEMS, CSV_COLUMNS };
