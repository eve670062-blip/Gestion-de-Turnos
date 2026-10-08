# App de Gestión de Atención al Cliente

Aplicación de turnos inspirada en el flujo de la imagen:

1. El cliente solicita un turno.
2. El sistema genera un número consecutivo.
3. Existen 4 mesas disponibles.
4. Si una mesa está ocupada, no recibe otro turno.
5. Cuando una mesa termina la atención, el siguiente turno en espera se asigna automáticamente.
6. Angular consulta el estado periódicamente; no se usan WebSockets ni una base de datos en tiempo real.
7. El estado se mantiene en memoria del backend. Al reiniciar Django, los turnos se reinician.

## Tecnologías

- Backend: Python + Django + Django REST Framework
- Frontend: Angular
- Comunicación: HTTP/REST
- Tiempo real: polling cada 1 segundo desde Angular
- Base de datos: ninguna para el estado de turnos

## Estructura

```text
app_atencion_clientes/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/
│   └── turnos/
└── frontend/
    ├── package.json
    ├── angular.json
    ├── tsconfig.json
    └── src/
```

## Ejecutar backend

Windows:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```

Linux/macOS:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```

API:

- `GET /api/estado/`
- `POST /api/turnos/`
- `POST /api/mesas/<id>/atender/`
- `POST /api/mesas/<id>/finalizar/`
- `POST /api/reiniciar/`

## Ejecutar Angular

Requiere Node.js y npm.

```bash
cd frontend
npm install
npm start
```

Abrir:

```text
http://localhost:4200
```

El backend debe estar disponible en:

```text
http://localhost:8000
```

## Flujo

- `Solicitar turno`: crea el siguiente turno.
- Si existe una mesa libre, el turno entra directamente a una mesa.
- Si las 4 mesas están ocupadas, el turno queda en espera.
- `Atender siguiente`: permite ocupar una mesa con el siguiente turno.
- `Finalizar`: libera la mesa y automáticamente asigna el siguiente turno en espera.
- Angular actualiza la pantalla cada segundo.

## Nota

Esta versión no utiliza una base de datos ni WebSockets. Es adecuada para una demostración, prototipo o práctica. Para producción convendría usar PostgreSQL y WebSockets/SSE, además de autenticación y control de concurrencia.
