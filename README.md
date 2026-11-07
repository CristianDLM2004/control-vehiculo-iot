# Control IoT · Excavadora (Práctica 4.1)

Frontend de CONTROL: HTML5 + CSS3 + Bootstrap 5 + JavaScript (módulos ES). Consume la API FastAPI existente en AWS (REST + WebSocket).

## Estructura
- `index.html`, `favicon.svg`
- `css/style.css`
- `js/config.js` (URLs; único archivo a editar) · `api.js` (cliente REST) · `socket.js` (WebSocket + reconexión)
- `js/status.js` (indicadores WebSocket / API AWS / RDS) · `joystick.js` · `controls.js` (envío de comandos, DETENER) · `demos.js` · `main.js`

## Ejecutar en local
Los módulos ES requieren servidor: abre la carpeta en VS Code y usa **Live Server** (`http://127.0.0.1:5500`). Edita `SERVER` en `js/config.js`.

## Puntos de integración
`GET /vehiculos/{id}`, `GET /vehiculos/{id}/comandos`, `GET /vehiculos/{id}/demos`, `POST /vehiculos/{id}/movimientos`, `POST /vehiculos/{id}/demos/{id_demo}/iniciar`; WebSocket `/api/vehiculos/{id}/ws` (cancelar DEMO: texto `CANCELAR`). Salud de la API: `/openapi.json`. RDS: «Sin verificar» (no hay diagnóstico autorizado).

## Prueba independiente de WebSocket
Conecta Thunder Client / Postman a la URL `WS_URL` de `config.js`, acciona un control en la página y observa `MOV_INDIVIDUAL`; para DEMO: `INICIO_DEMO`, `MOV_DEMO` (N veces), `FIN_DEMO` o `CANCELADO`. Ver un evento confirma su publicación por el backend, no el movimiento físico.

## Publicar
GitHub → Settings → Pages → rama `main`, carpeta `/ (root)`. Desde Pages la API debe ser HTTPS/WSS.
