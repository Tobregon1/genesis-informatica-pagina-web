/**
 * Génesis Informática: recepción de turnos desde la web
 *
 * Recibe el formulario de la página (webhook), lo registra en esta planilla
 * y crea el evento en Google Calendar.
 *
 * PASOS DE INSTALACIÓN
 * 1. Creá una planilla de Google (por ejemplo "Turnos Génesis") y abrí Extensiones > Apps Script.
 * 2. Borrá el código que aparece, pegá este archivo completo y guardá.
 * 3. Zona horaria: en Configuración del proyecto (engranaje) tildá "Mostrar el archivo de manifiesto
 *    appsscript.json en el editor". Abrí appsscript.json y dejá "timeZone": "America/Argentina/Buenos_Aires".
 * 4. Elegí la función "configurar" y tocá Ejecutar. Aceptá los permisos (planilla, calendario y
 *    correo; el correo solo se usa si completás EMAIL_AVISO).
 * 5. Implementar > Nueva implementación > tipo "Aplicación web".
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona. Copiá la URL que termina en /exec.
 * 6. Pegá esa URL en CFG.webhook del HTML de la página.
 * 7. Para probar sin la web, ejecutá "probarTurno" y revisá la hoja y el calendario
 *    (después borrá la fila y el evento de prueba).
 *
 * Si más adelante cambiás el código: Implementar > Administrar implementaciones > Editar >
 * Versión nueva. La URL no cambia.
 */

// ====== CONFIGURACIÓN: editá solo esta parte ======
const CONFIG = {
  NOMBRE_NEGOCIO: 'Génesis Informática',
  DIRECCION: 'Asunción 2700, Corrientes',
  HOJA: 'Turnos',                // pestaña donde se registran los pedidos
  ID_PLANILLA: '',               // vacío = la planilla donde está este script
  ID_CALENDARIO: '',             // vacío = tu calendario principal
  DURACION_MIN: 60,              // duración de cada turno en minutos
  RECORDATORIO_MIN: 60,          // aviso emergente antes del turno
  // Estos dos tienen que ser iguales a CFG.slots y CFG.closed de la página:
  HORARIOS: ['09:00', '10:00', '11:00', '12:00', '16:00', '17:00', '18:00', '19:00'],
  DIAS_CERRADOS: [0],            // 0 = domingo, 1 = lunes ... 6 = sábado
  MAX_PEDIDOS_POR_DIA: 40,       // freno anti-spam
  EMAIL_AVISO: 'tobiobregon87@gmail.com',               // tu correo para recibir un aviso por cada pedido (vacío = sin aviso)
  INVITAR_CLIENTE: true         // true = si dejó su correo, recibe la invitación de Calendar
};

const ESTADO = {
  PENDIENTE: 'Por confirmar',
  CONFIRMADO: 'Confirmado',
  CANCELADO: 'Cancelado',
  OCUPADO: 'Horario ocupado: reprogramar'
};
const PREFIJO_EVENTO = '(Por confirmar) ';  // sacalo del título cuando confirmes el turno
const COLUMNAS = ['Registrado', 'Nombre', 'WhatsApp', 'Correo', 'Servicio', 'Día', 'Horario', 'Detalle', 'Estado', 'ID evento'];

// ====== PUNTOS DE ENTRADA ======

/** Recibe el POST del formulario web. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const datos = leerDatos_(e);
    const resultado = registrarTurno_(datos);
    return json_({ ok: true, estado: resultado.estado });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/** Sirve para comprobar que la implementación está activa (abrí la URL /exec en el navegador). */
function doGet() {
  return json_({ ok: true, servicio: 'Turnos ' + CONFIG.NOMBRE_NEGOCIO });
}

// ====== LÓGICA PRINCIPAL ======

function registrarTurno_(d) {
  const tz = Session.getScriptTimeZone();
  const inicio = fechaHora_(d.fecha, d.hora);
  if (inicio < new Date()) throw new Error('La fecha y la hora ya pasaron');
  if (CONFIG.DIAS_CERRADOS.indexOf(inicio.getDay()) !== -1) throw new Error('Ese día no hay atención');
  const fin = new Date(inicio.getTime() + CONFIG.DURACION_MIN * 60000);

  const hoja = obtenerHoja_();
  if (pedidosDeHoy_(hoja, tz) >= CONFIG.MAX_PEDIDOS_POR_DIA) {
    throw new Error('Se alcanzó el límite diario de pedidos');
  }

  // Si ya hay algo en ese horario, no se crea el evento para no duplicar turnos.
  const cal = obtenerCalendario_();
  // Los eventos de día completo (cumpleaños, recordatorios) no cuentan como ocupado.
  const choques = cal.getEvents(inicio, fin).filter(function (ev) {
    return !ev.isAllDayEvent();
  });
  const repetido = choques.some(function (ev) {
    return (ev.getDescription() || '').indexOf(d.telefono) !== -1;
  });
  if (repetido) return { estado: 'Duplicado' };  // mismo cliente, mismo horario (doble envío)

  let estado = ESTADO.PENDIENTE;
  let idEvento = '';
  if (choques.length) {
    estado = ESTADO.OCUPADO;
  } else {
    idEvento = crearEvento_(cal, d, inicio, fin).getId();
  }

  try {
    hoja.appendRow([
      new Date(),
      paraPlanilla_(d.nombre),
      paraPlanilla_(d.telefono),
      paraPlanilla_(d.email),
      paraPlanilla_(d.servicio),
      new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()),
      d.hora,
      paraPlanilla_(d.detalle),
      estado,
      idEvento
    ]);
    if (estado === ESTADO.OCUPADO) {
      hoja.getRange(hoja.getLastRow(), 1, 1, COLUMNAS.length).setBackground('#fde2e1');
    }
  } catch (err) {
    // Si falló el registro, no dejamos un evento huérfano.
    if (idEvento) cal.getEventById(idEvento).deleteEvent();
    throw err;
  }

  avisar_(d, estado);
  return { estado: estado };
}

function crearEvento_(cal, d, inicio, fin) {
  const descripcion = [
    'Cliente: ' + d.nombre,
    'WhatsApp: ' + d.telefono,
    'Correo: ' + (d.email || '-'),
    'Servicio: ' + d.servicio,
    'Detalle: ' + (d.detalle || '-'),
    'Origen: formulario web'
  ].join('\n');

  const opciones = { description: descripcion, location: CONFIG.DIRECCION };
  if (CONFIG.INVITAR_CLIENTE && d.email) {
    opciones.guests = d.email;
    opciones.sendInvites = true;
  }

  const ev = cal.createEvent(PREFIJO_EVENTO + d.servicio + ' - ' + d.nombre, inicio, fin, opciones);
  ev.removeAllReminders();
  ev.addPopupReminder(CONFIG.RECORDATORIO_MIN);
  return ev;
}

function avisar_(d, estado) {
  if (!CONFIG.EMAIL_AVISO) return;
  try {
    MailApp.sendEmail({
      to: CONFIG.EMAIL_AVISO,
      subject: 'Nuevo pedido de turno: ' + d.servicio + ' - ' + d.nombre,
      body: [
        'Estado: ' + estado,
        'Día y horario: ' + d.fecha + ' ' + d.hora,
        'Nombre: ' + d.nombre,
        'WhatsApp: ' + d.telefono,
        'Correo: ' + (d.email || '-'),
        'Servicio: ' + d.servicio,
        'Detalle: ' + (d.detalle || '-')
      ].join('\n')
    });
  } catch (err) {
    console.error('No se pudo enviar el aviso: ' + err);
  }
}

// ====== VALIDACIÓN Y UTILIDADES ======

function leerDatos_(e) {
  const p = (e && e.parameter) || {};
  const d = {
    nombre: limpiar_(p.nombre, 80),
    telefono: limpiar_(p.telefono, 30),
    email: limpiar_(p.email, 100),
    servicio: limpiar_(p.servicio, 60) || 'Consulta',
    fecha: limpiar_(p.fecha, 10),
    hora: limpiar_(p.hora, 5),
    detalle: limpiar_(p.detalle, 500)
  };
  if (!d.nombre || !d.telefono) throw new Error('Faltan el nombre o el teléfono');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) throw new Error('Fecha inválida');
  if (CONFIG.HORARIOS.indexOf(d.hora) === -1) throw new Error('Horario inválido');
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) d.email = '';
  return d;
}

/** Saca caracteres de control y corta al largo máximo. */
function limpiar_(valor, max) {
  return String(valor == null ? '' : valor)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Evita que un texto que empieza con = + - @ se interprete como fórmula en la planilla. */
function paraPlanilla_(texto) {
  return /^[=+\-@]/.test(texto) ? "'" + texto : texto;
}

function fechaHora_(fecha, hora) {
  const f = fecha.split('-').map(Number);
  const h = hora.split(':').map(Number);
  const resultado = new Date(f[0], f[1] - 1, f[2], h[0], h[1]);
  if (resultado.getMonth() !== f[1] - 1) throw new Error('Fecha inexistente');
  return resultado;
}

function pedidosDeHoy_(hoja, tz) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return 0;
  const desde = Math.max(2, ultima - 199);
  const hoy = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  return hoja.getRange(desde, 1, ultima - desde + 1, 1).getValues().filter(function (fila) {
    return fila[0] instanceof Date && Utilities.formatDate(fila[0], tz, 'yyyy-MM-dd') === hoy;
  }).length;
}

function obtenerHoja_() {
  const ss = CONFIG.ID_PLANILLA
    ? SpreadsheetApp.openById(CONFIG.ID_PLANILLA)
    : SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(CONFIG.HOJA);
  if (!hoja) hoja = ss.insertSheet(CONFIG.HOJA);
  if (hoja.getLastRow() === 0) prepararHoja_(hoja);
  return hoja;
}

function prepararHoja_(hoja) {
  hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS])
    .setFontWeight('bold').setBackground('#0a3340').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
  hoja.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');
  hoja.getRange('F:F').setNumberFormat('dd/mm/yyyy');
  hoja.getRange('G:G').setNumberFormat('@');
  hoja.autoResizeColumns(1, COLUMNAS.length);
}

function obtenerCalendario_() {
  const cal = CONFIG.ID_CALENDARIO
    ? CalendarApp.getCalendarById(CONFIG.ID_CALENDARIO)
    : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('No se encontró el calendario');
  return cal;
}

function json_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// ====== MENÚ EN GOOGLE SHEETS ======
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ Génesis Turnos')
    .addItem('✅ Confirmar turno seleccionado', 'confirmarTurnoSeleccionado')
    .addItem('❌ Cancelar turno seleccionado', 'cancelarTurnoSeleccionado')
    .addToUi();
}

/** Cambia el estado a Confirmado y le quita el prefijo "(Por confirmar)" al evento en Google Calendar. */
function confirmarTurnoSeleccionado() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getActiveSheet();
  const fila = hoja.getActiveCell().getRow();

  if (fila < 2) {
    ss.toast('Seleccioná la fila del turno que querés confirmar.', 'Aviso', 5);
    return;
  }

  const valores = hoja.getRange(fila, 1, 1, COLUMNAS.length).getValues()[0];
  const estadoActual = valores[8];
  const idEvento = String(valores[9] || '').trim();

  if (estadoActual === ESTADO.CONFIRMADO) {
    ss.toast('Este turno ya estaba confirmado.', 'Aviso', 5);
    return;
  }

  if (idEvento) {
    try {
      const cal = obtenerCalendario_();
      const ev = cal.getEventById(idEvento);
      if (ev) {
        let titulo = ev.getTitle();
        if (titulo.indexOf(PREFIJO_EVENTO) === 0) {
          titulo = titulo.replace(PREFIJO_EVENTO, '');
          ev.setTitle(titulo);
        }
      }
    } catch (err) {
      console.error('Error al actualizar el evento en Calendar: ' + err);
    }
  }

  hoja.getRange(fila, 9)
    .setValue(ESTADO.CONFIRMADO)
    .setBackground('#d4edda')
    .setFontColor('#155724')
    .setFontWeight('bold');

  ss.toast('Turno confirmado y actualizado en Google Calendar.', 'Éxito', 5);
}

/** Cancela el turno en la planilla y borra el evento de Google Calendar. */
function cancelarTurnoSeleccionado() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getActiveSheet();
  const fila = hoja.getActiveCell().getRow();

  if (fila < 2) {
    ss.toast('Seleccioná la fila del turno que querés cancelar.', 'Aviso', 5);
    return;
  }

  const valores = hoja.getRange(fila, 1, 1, COLUMNAS.length).getValues()[0];
  const idEvento = String(valores[9] || '').trim();

  if (idEvento) {
    try {
      const cal = obtenerCalendario_();
      const ev = cal.getEventById(idEvento);
      if (ev) {
        ev.deleteEvent();
      }
    } catch (err) {
      console.error('Error al eliminar evento de Calendar: ' + err);
    }
  }

  hoja.getRange(fila, 9)
    .setValue(ESTADO.CANCELADO)
    .setBackground('#f8d7da')
    .setFontColor('#721c24')
    .setFontWeight('bold');

  ss.toast('Turno cancelado y quitado de Google Calendar.', 'Aviso', 5);
}

// ====== FUNCIONES PARA EJECUTAR A MANO DESDE EL EDITOR ======

/** Ejecutala una vez: crea la hoja y pide los permisos. */
function configurar() {
  obtenerHoja_();
  obtenerCalendario_();
  Logger.log('Listo. Ahora implementá el script como Aplicación web (paso 5).');
}

/** Simula un pedido de la web para el próximo día con atención. Borrá después la fila y el evento. */
function probarTurno() {
  const dia = new Date();
  dia.setDate(dia.getDate() + 1);
  while (CONFIG.DIAS_CERRADOS.indexOf(dia.getDay()) !== -1) dia.setDate(dia.getDate() + 1);
  const e = {
    parameter: {
      nombre: 'Prueba Web',
      telefono: '3794000000',
      email: '',
      servicio: 'Servicio técnico',
      fecha: Utilities.formatDate(dia, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      hora: CONFIG.HORARIOS[0],
      detalle: 'Turno de prueba, borralo.'
    }
  };
  Logger.log(doPost(e).getContent());
}


