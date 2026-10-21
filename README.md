<div align="center">
  <img src="img/logo-192.png" alt="Génesis Informática Logo" width="120" style="border-radius: 20px;" />
  <h1>Génesis Informática</h1>
  <p><strong>Soluciones tecnológicas y financieras para vos y tu negocio en Corrientes</strong></p>

  <p>
    <a href="https://tobregon1.github.io/genesis-informatica-pagina-web/">
      <img src="https://img.shields.io/badge/Sitio%20Web-Online-success?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Sitio Web">
    </a>
    <img src="https://img.shields.io/badge/Estado-Producci%C3%B3n-blue?style=for-the-badge" alt="Estado">
    <img src="https://img.shields.io/badge/Atenci%C3%B3n-Cita%20Previa-ffc533?style=for-the-badge" alt="Modalidad">
  </p>
</div>

---

## 📌 Acerca de Génesis Informática

Estudio de tecnología y servicios ubicado en **Corrientes Capital**, enfocado en brindar atención personalizada y soluciones a medida tanto para usuarios particulares como para comercios y empresas.

- 📍 **Dirección:** [Asunción 2700, Corrientes, Argentina](https://maps.app.goo.gl/373kDPAMZQAHvNdu7)
- 📲 **WhatsApp:** [+54 9 379 477-5092](https://wa.me/5493794775092)
- ✉️ **Correo:** [tobiobregon87@gmail.com](mailto:tobiobregon87@gmail.com)
- 🕒 **Modalidad:** Atención exclusiva con cita previa.

---

## 🛠️ Servicios Principales

### 1. 💻 Servicio Técnico de PC e Impresoras
- Diagnóstico claro y presupuesto antes de intervenir el equipo.
- Mantenimiento preventivo, limpieza profunda y cambio de pasta térmica.
- Reparación de hardware (fuentes, placas, pantallas, memorias, discos).
- Instalación y optimización de sistemas operativos (Windows / Linux), drivers y programas.
- Service y calibración de impresoras (limpieza de cabezales, reemplazo de partes).

### 2. 🚀 Desarrollo de Software y Diseño Web
- **Sistemas a medida:** Gestión de turnos, control de stock, facturación y paneles administrativos.
- **Sitios Web y Tiendas Online:** Páginas modernas, ultra rápidas y 100% adaptadas a celulares.
- **Bases de datos e integraciones:** Conexión de planillas, WhatsApp y herramientas existentes.
- **Automatizaciones:** Notificaciones automáticas y flujos de trabajo sin intervención manual.

### 3. 🤝 Préstamos con Empeño
- Evaluación a la vista y transparente de artículos de valor (notebooks, celulares, consolas, herramientas).
- Condiciones claras, plazos e importes establecidos por escrito.
- Resguardo seguro de los bienes durante la vigencia del acuerdo.

---

## ⚡ Sistema Automatizado de Turnos

La web cuenta con un sistema completo de agendamiento online integrado sin costo de servidores externos:

```
[ Cliente en la Web ]
         │
         ▼  (POST con datos del turno)
[ Webhook: Google Apps Script ]
         │
         ├──► Registra el pedido en Google Sheets ("Turnos")
         ├──► Crea el evento agendado en Google Calendar con ID único
         └──► Envía aviso por correo electrónico al administrador
         │
         ▼
[ Redirección a WhatsApp para confirmación directa con el cliente ]
```

### Funciones del Backend (`turnos-genesis.gs`)
- **Menú en Google Sheets (`⚡ Génesis Turnos`):**
  - `✅ Confirmar turno seleccionado`: actualiza el estado a verde y remueve la etiqueta *(Por confirmar)* del evento en Google Calendar.
  - `❌ Cancelar turno seleccionado`: marca el estado en rojo y elimina automáticamente el evento de Calendar para liberar la franja horaria.
- **Validaciones Anti-Spam y Choque de Horarios:** evita superposiciones de turnos y envíos duplicados.

---

## 💻 Tecnologías Utilizadas

- **Frontend:**
  - `HTML5` Semántico y accesible.
  - `CSS3` Vanilla moderno con variables personalizadas, soporte automático para Modo Claro / Oscuro (`prefers-color-scheme`) y diseño responsive para móviles, tablets y monitores.
  - `JavaScript` nativo para manejo del DOM, validación de formularios y smooth scrolling.
- **Backend & Automatizaciones:**
  - `Google Apps Script` (REST Webhook via `doPost` y `doGet`).
  - `Google Sheets API` (Base de datos de pedidos y control de estados).
  - `Google Calendar API` (Sincronización automática de agenda de citas).
  - `WhatsApp API` (Confirmación inmediata con mensajes preconfigurados).

---

## 📂 Estructura del Repositorio

```bash
genesis-informatica-pagina-web/
├── img/
│   ├── logo.png             # Logo en alta resolución
│   ├── logo-192.png         # Logo optimizado para favicon y web
│   └── portada.png          # Portada institucional
├── .gitignore               # Archivos ignorados por Git
├── index.html               # Página web principal (HTML, CSS y JS)
├── README.md                # Presentación y documentación del proyecto
└── turnos-genesis.gs        # Script de automatización de Google Apps Script
```

---

## 🌐 Publicación

Este proyecto está alojado de forma gratuita y continua mediante **GitHub Pages**:  
👉 **[Visitar génesis-informatica-pagina-web](https://tobregon1.github.io/genesis-informatica-pagina-web/)**

---

<div align="center">
  <small>© Génesis Informática. Todos los derechos reservados.</small>
</div>
