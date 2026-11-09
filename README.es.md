# AtelierRoot

[![CI](https://github.com/Arphael/AtelierRoot/actions/workflows/ci.yml/badge.svg)](https://github.com/Arphael/AtelierRoot/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Arphael/AtelierRoot/actions/workflows/codeql.yml/badge.svg)](https://github.com/Arphael/AtelierRoot/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Arphael/AtelierRoot/badge)](https://scorecard.dev/viewer/?uri=github.com/Arphael/AtelierRoot)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

_[Read in English](README.md)_

Un editor Markdown **local-first**: **cada documento es un archivo `.md` en una carpeta de tu computadora** y todo se guarda solo.
**Sin nube, sin cuentas, sin internet.** Nada sale de tu máquina.

## Funciones

|                                 |                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Escribes y se formatea**      | Los atajos de Markdown se convierten en formato al escribir: encabezados, listas, tareas, citas, bloques de código, tablas, líneas divisorias |
| **Archivos normales**           | Cada documento es un `.md` que puedes abrir con cualquier editor o versionar con git                                                          |
| **Guardado automático**         | Los cambios se escriben solos; lo no guardado sobrevive a un cierre inesperado                                                                |
| **Seguro con cambios externos** | Lo que cambies desde otros programas se recarga; si hay conflicto se conservan las dos versiones                                              |
| **Organiza**                    | Carpetas, arrastrar y soltar, enlaces `[[nombre]]` entre documentos, esquema, vista dividida, papelera                                        |
| **Escribe más rápido**          | Paleta de comandos, buscar y reemplazar, modo enfoque, plegar secciones, marcadores `[EN_MAYÚSCULAS]`                                         |
| **Pensado para código**         | Resaltado de ~45 lenguajes; rutas y URLs se detectan solas                                                                                    |
| **Privado**                     | Sin cuenta, sin telemetría, sin peticiones a internet                                                                                         |

## Descarga

| Opción                                                                                          | Para                                                   | Necesita                                  |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| **App de escritorio**: `AtelierRoot.exe` en [Releases](https://github.com/Arphael/AtelierRoot/releases) | Todo el mundo (primero Windows; después macOS y Linux) | Nada (WebView2 ya viene en Windows 11)    |
| **Un archivo HTML**: `AtelierRoot.html` en Releases (o la página de GitHub Pages)                | Cualquier sistema, nada que instalar                   | Chrome o Edge para guardar en una carpeta |

**App de escritorio**: descarga `AtelierRoot.exe`, haz doble clic y elige la carpeta de tus notas. Un solo archivo, nada que instalar; recuerda la carpeta.

**Un archivo HTML**: haz doble clic en `AtelierRoot.html` (se abre en tu navegador) y pulsa **«Abrir una carpeta...»**. El navegador pide permiso una vez por sesión. Sin carpeta, AtelierRoot funciona en **modo temporal** (los documentos quedan en ese navegador).

Las dos son la misma app: el ejecutable lleva dentro exactamente el `AtelierRoot.html` de la misma versión.

¿Primera vez? Lee la [guía de usuario](docs/USER_GUIDE.md). ¿Problemas? Mira el [FAQ](docs/FAQ.md). (Ambos en inglés.)

## Cómo se guardan tus documentos

```
Mis notas/
|-- Intro.md          <- un documento (el nombre del archivo es el nombre)
|-- Proyectos/        <- una carpeta de AtelierRoot es una carpeta del disco
|   `-- Plan.md
`-- .atelierroot/         <- lo que Markdown no puede guardar (oculto, se puede versionar)
    |-- state.json    <- orden, carpetas abiertas, anchos de columna, pliegues, valores de marcadores
    `-- trash/        <- lo que eliminas (se puede restaurar durante 30 días)
```

- **Abrir** nunca reescribe un archivo. **Editar** guarda Markdown normalizado (por ejemplo `*` pasa a `-`).
- Los archivos que no son `.md` se ignoran y **nunca se tocan**.
- Formato y reglas de sincronización: [docs/CONTRACT.md](docs/CONTRACT.md).

## Seguridad

- La app de escritorio solo lee y escriben archivos `.md` y `.atelierroot/` dentro de la carpeta que elegiste.
- La app no hace peticiones a internet y funciona con una Content-Security-Policy estricta.
- Un `.md` ajeno no puede ejecutar nada: el HTML crudo se muestra como texto; enlaces e imágenes solo admiten `http(s)`, `mailto`, `tel`, `data:image` o rutas relativas.
- Reporta vulnerabilidades en privado: [SECURITY.md](SECURITY.md).

## Para desarrolladores

El repositorio contiene todo el código: la app (`src/`), un servidor Node solo para desarrollo y pruebas (`server/`, los usuarios nunca lo descargan) y el backend en Rust de la app de escritorio (`src-tauri/`).

```bash
git clone https://github.com/Arphael/AtelierRoot.git && cd AtelierRoot
npm start            # sirve src/ con ./notas en http://localhost:4321, sin compilar
npm test             # check + servidor + pruebas de navegador
npm run build        # dist/ (~520 KB)
```

Compilar el ejecutable: [docs/BUILDING.md](docs/BUILDING.md). Empieza por [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [CONTRIBUTING.md](CONTRIBUTING.md). Toda la documentación: [docs/](docs/README.md).

## Limitaciones conocidas

- Se leen todos los documentos al empezar: con miles de archivos grandes tardará.
- En modo solo navegador los cambios externos se detectan cada 3 s.
- Aún no verificado en macOS, Firefox ni Safari.
- El archivo HTML abre carpetas en Chrome y Edge; en Brave solo tras activar `brave://flags/#file-system-access-api`; nunca en el navegador integrado de VS Code (ahí usa la app de escritorio).
- Las imágenes pegadas se guardan dentro del `.md` como `data:`.
- Los primeros ejecutables no están firmados (Windows SmartScreen avisa una vez).

## Comunidad

[Contribuir](CONTRIBUTING.md) · [Código de conducta](CODE_OF_CONDUCT.md) · [Soporte](SUPPORT.md) · [Cambios](CHANGELOG.md)

## Licencia y marcas

[MIT](LICENSE). Incluye [Prism](https://prismjs.com) (MIT) en `src/vendor/prism/`.

AtelierRoot es un proyecto independiente de código abierto, sin relación ni afiliación con otros productos o marcas de nombre parecido.
