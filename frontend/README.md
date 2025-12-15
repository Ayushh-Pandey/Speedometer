# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

# Speedometer Frontend - Environment Configuration

## Environment Variables

The frontend uses environment variables to configure the backend connection URL.

### Configuration Priority

1. **Docker Compose** (Highest Priority)
   - Set in `docker-compose.yml` under `frontend.environment`
   - Used when running with `docker-compose up`

2. **.env file** (Default/Fallback)
   - Located at `frontend/.env`
   - Used for local development
   - Committed to repository for default local setup

3. **Hardcoded Fallback** (Lowest Priority)
   - `http://localhost:3000` in `App.jsx`
   - Only used if no other configuration exists

### Available Variables

#### `VITE_BACKEND_URL`
- **Description**: WebSocket URL for the backend server
- **Default**: `http://localhost:3000`
- **Docker**: `http://localhost:3000` (browser connects to host's exposed port)
- **Production**: Set to your production backend URL

**Important**: Must start with `VITE_` prefix for Vite to expose it to the client-side code.

## Running the Frontend

### Local Development
```bash
cd frontend
npm install
npm run dev
# Connects to http://localhost:3000 (from .env file)
```

### Docker Development
```bash
# From project root
docker-compose up frontend
# Browser connects to http://localhost:3000 (from docker-compose.yml)
# Access frontend at http://localhost:3001
```

### Production Build
```bash
cd frontend
VITE_BACKEND_URL=https://your-backend.com npm run build
npm run preview
```

## How It Works

1. Vite reads environment variables at **runtime** in dev mode
2. Variables starting with `VITE_` are exposed to client code
3. Access via `import.meta.env.VITE_BACKEND_URL`
4. Docker environment variables override `.env` file values

## Troubleshooting

### Frontend can't connect to backend in Docker

**Problem**: Frontend shows "disconnected" status

**Solution**: Make sure `VITE_BACKEND_URL` in docker-compose.yml points to `http://localhost:3000` (not `http://backend:3000`)

**Reason**: Frontend runs in the browser (client-side), so it connects to the host machine's exposed port, not the Docker internal network.

### Environment variable not updating

**Problem**: Changed `.env` but nothing happens

**Solutions**:
1. Restart Vite dev server: `Ctrl+C` then `npm run dev`
2. In Docker: rebuild with `docker-compose up --build frontend`
3. Clear browser cache (for old builds)
