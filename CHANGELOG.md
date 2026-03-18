# Changelog — Criminalidad España

Registro de cambios aplicados al proyecto.

---

## [2026-03-18] Fix: Botón "Aplicar filtros" no visible en Android

**Problema:** El botón "Aplicar filtros" del panel de filtros del Mapa no era visible en navegadores Android, aunque sí funcionaba en navegador de escritorio y en iPhone.

**Causa:** En Android Chrome, `height: 100vh` incluye el espacio de la barra de dirección y la barra de navegación del sistema (gestos), haciendo que el sidebar se extienda más allá del área visible. El `.sidebar-footer` (que contiene el botón) quedaba cortado por debajo de la pantalla.

**Solución aplicada (`frontend/index.html`):**
- Se añadió `height: 100dvh` como complemento de `height: 100vh` en `.sidebar`. La unidad `dvh` (dynamic viewport height) se actualiza dinámicamente excluyendo el chrome del navegador.
- Se añadió `padding-bottom: env(safe-area-inset-bottom)` al `.sidebar-footer` para respetar la zona de gestos de navegación de Android (y el notch inferior de iPhone).

**Archivos modificados:** `frontend/index.html`

---

## [2026-03-18] Fix: Botón "Aplicar filtros" no visible en Android — página Evolución

**Problema:** Mismo problema que en Mapa: el botón del panel de filtros de la página Evolución no era visible en Android al desplegar el menú.

**Solución aplicada (`frontend/comparativa.html`):**
- Se añadió `height: 100dvh` en `.sidebar`.
- Se añadió `padding-bottom: max(16px, calc(16px + env(safe-area-inset-bottom)))` en `.sidebar-footer`.

**Archivos modificados:** `frontend/comparativa.html`
