# Known Issues & Solutions

## Issue: Multiple Dependency Points for API Configuration

### Problem Description

The application had **multiple independent dependency points** for API communication instead of a single configuration source. This created several issues:

1. **CORS Failures on Remote Machines**
   - Frontend directly called kafka-api (port 4000) from the browser
   - Browser enforced CORS policy: blocked cross-origin requests
   - Worked on localhost because both services were on the same machine (same origin)
   - Failed when kafka-api was on Machine 1 and Next.js on Machine 2 (different origins)

2. **Multiple Configuration Sources**
   - Environment variable: `NEXT_PUBLIC_API_URL`
   - Config endpoint: `/api/config`
   - Direct fetch calls in components (Dashboard, Table pages)
   - Proxy route files (multiple independent implementations)
   - Each had different initialization points and no unified error handling

3. **Environment Variable Whitespace Issues**
   - When `.env.docker` had trailing/leading spaces in API URLs, they were not trimmed
   - This caused malformed URLs: `http://server:4000/api /strategy` (space in path)
   - Led to 404 errors: `Cannot GET /api%20/strategy`

### Root Cause

**Architecture Problem:**
- Frontend browsers made direct HTTP requests to kafka-api
- No intermediate backend layer to handle cross-origin communication
- Multiple proxy routes read the same env var independently without consistent sanitization

**Configuration Problem:**
- Environment variables were not being sanitized (trimmed) before use
- Multiple code paths reading `process.env.NEXT_PUBLIC_API_URL` without consistent logic
- No single source of truth for API configuration

### Solution Implemented

#### 1. Unified Backend Proxy Layer
Instead of frontend making direct calls to kafka-api, all requests now go through Next.js backend proxy routes:

- **Frontend**: Calls `/api/strategy` (localhost:3000 - same origin, no CORS)
- **Backend Proxy**: Reads environment config and calls kafka-api internally
- **Backend-to-Backend**: No CORS restrictions (server-to-server communication)

This pattern matches how msdb-api was already being called successfully.

#### 2. Proxy Routes Created
New API route files created for all kafka-api endpoints:
- `/api/strategy`
- `/api/positions`
- `/api/provider`
- `/api/execution`
- `/api/risk-monitor`
- `/api/table`

#### 3. Environment Variable Sanitization
All proxy routes now use `.trim()` on the API URL:
```
const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();
```

This ensures trailing/leading whitespace from `.env.docker` doesn't break URLs.

#### 4. Runtime Configuration Loading
The application uses `.dockerignore` to exclude `.env` files from the Docker image, enabling:
- **Build time**: Environment variables are NOT baked into the image
- **Runtime**: When Docker container starts with `--env-file .env.docker`, env vars are injected
- **Result**: Configuration is loaded at runtime, allowing changes without rebuilding

### Why This Works

**On Local Machine (localhost):**
- Both Next.js (port 3000) and kafka-api (port 4000) run on the same machine
- Browser makes request to `/api/strategy` (same origin)
- No CORS issue even if we had direct calls

**On Remote Machine (Multi-machine Deployment):**
- Next.js container on Machine 2 makes request to `/api/strategy` (same origin)
- Backend proxy in Next.js container calls kafka-api on Machine 1 (server-to-server, no CORS)
- CORS policy doesn't apply to backend-to-backend communication
- Works seamlessly

### Configuration Gotchas

#### Whitespace in Environment Variables
If `.env.docker` contains:
```
NEXT_PUBLIC_API_URL=http://server:4000/api 
                                          ^ trailing space
```

The proxy routes now handle this correctly with `.trim()`.

#### Docker .dockerignore
The `.env` file must be in `.dockerignore` for runtime configuration to work:
```
.env
.env.local
.env.*.local
```

If `.env` is NOT excluded, the variables get baked into the build and changes require rebuilding.

### Deployment Checklist

When deploying to remote machines:

1. ✅ Ensure kafka-api is running on the target machine
2. ✅ Update `.env.docker` with correct `NEXT_PUBLIC_API_URL` (no trailing spaces)
3. ✅ Build Docker image with `./build-with-timestamp.sh`
4. ✅ Run container with `--env-file .env.docker`
5. ✅ Verify proxy routes are working (check `/api/strategy` returns data)

### Future Improvements

1. **Centralized Config Service**
   - Create a dedicated configuration management layer
   - Single source of truth for all API endpoints
   - Versioning and validation of configuration

2. **Environment-Specific Configurations**
   - Separate `.env.development`, `.env.staging`, `.env.production`
   - Automated validation of required environment variables at startup

3. **Error Handling**
   - Unified error responses from proxy routes
   - Circuit breaker pattern for failing backends
   - Graceful degradation when kafka-api is unavailable

4. **Monitoring**
   - Log all proxy route calls for debugging
   - Track response times and error rates
   - Alert on configuration mismatches

### References

- **Issue Type**: Architecture / Configuration
- **Affected Components**: Dashboard.tsx, Table pages, Proxy routes
- **Environment**: Multi-machine deployments
- **Related Files**: 
  - `src/app/api/strategy/route.ts`
  - `src/app/api/positions/route.ts`
  - `src/app/components/Dashboard.tsx`
  - `.dockerignore`
  - `build-with-timestamp.sh`
