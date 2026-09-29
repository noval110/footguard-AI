# FootGuard frontend

Responsive React, Vite, TypeScript, Tailwind CSS, and React Router interface for diabetic foot monitoring. Patient and provider clinical screens use the Go API; editorial education content remains local demo content.

## Run with the backend

1. Set up PostgreSQL, apply migrations `001` and `002`, and start the backend as described in `../backend/README.md`.
2. In this directory, copy `.env.example` to `.env` and set `VITE_API_URL` to the backend origin. Its default example is `http://localhost:8080`.
3. Run `npm install` if dependencies are missing, then `npm run dev`. Vite normally serves `http://localhost:5173`, which matches the backend's default `FRONTEND_ORIGIN`. If you choose another frontend port, set `FRONTEND_ORIGIN` on the backend to that exact origin.
4. Run `npm run build` and `npm run lint` for verification.

The backend must be running for registration, login, patient data, examinations, risk results, and reviews. Start the FastAPI service at the backend's `AI_SERVICE_URL` before using Analyze. API failures are shown in Indonesian with retry or correction guidance.

## Vercel deployment

Set the Vercel project's Root Directory to `frontend`, with `dist` as the output directory. The `vercel.json` in this directory rewrites direct requests for React Router paths such as `/login` and `/provider/dashboard` to `index.html`, so refresh and direct links load the app. A matching config at the repository root covers projects configured with that root directory instead. Redeploy after changing the configuration.

## Connected routes

- Public: `/`, `/login`, `/register`
- Patient: `/patient/dashboard`, `/patient/assessment`, `/patient/scan?examination=<id>`, `/patient/result/:id`, `/patient/history`, `/patient/profile`
- Provider: `/provider/dashboard`, `/provider/patients`, `/provider/patients/:id`, `/provider/examinations/:id`
- Editorial demo content: `/education` and `/patient/education`

Patient and provider routes require a JWT and the matching role. Login redirects by the role returned from `/api/profile`. The JWT is stored in localStorage for this MVP; it is cleared on logout or a 401 response. Public registration creates patient accounts only. A provider account must be provisioned through the backend command.

## Current API boundaries

- The scan sends JPEG, PNG, or WebP (up to 10 MiB) and the selected foot side to `POST /api/examinations/:id/analyze` with the existing JWT. The browser lets `FormData` set its own multipart boundary.
- After analysis and persistence, the scan navigates to the existing examination result page. The result and history pages load the saved image, AI values, and overlay from the backend, including after refresh. Private image requests include the JWT.
- The UI displays the model confidence and predicted image pixel area separately from clinical risk and medical review. It does not generate synthetic confidence or clinical values.
- A provider explicitly selects a clinical risk category and enters an explanation. The UI never computes one.
- The provider patient-list endpoint returns each patient's latest examination. It does not expose a full provider-side patient history yet. The UI labels that limitation.
- Education articles are local demo content because the current backend has no education endpoint.

## Manual verification completed

With an isolated PostgreSQL database and a provisioned test provider, browser testing covered patient registration, login, JWT persistence after reload, profile update, assessment creation, examination creation, image URL metadata for both feet, result empty state, history, logout, private-route redirect, provider role guard, provider patient list, clinical risk entry, medical review, patient visibility of the resulting risk/review, and invalid-token clearing. The test browser reported no JavaScript exceptions. This test used port `5174` with `FRONTEND_ORIGIN` set to `http://localhost:5174` because port `5173` was occupied in the test environment.

For the later Analyze integration, `npm run build` and `npm run lint` passed. A separate isolated database API smoke test registered a patient, created an assessment and examination, sent a multipart image with Bearer JWT through Go to the live FastAPI model, and received a 200 response with a JPEG overlay; an unauthenticated request returned 401. A browser smoke test with a temporary API fixture verified file selection, authenticated multipart submission, rendered results and both images, and no JavaScript exceptions or horizontal overflow at 1440, 768, and 390 pixel widths. The browser fixture checked the React interaction; the isolated database test checked the real Go-to-FastAPI path.

For persistence, a new local smoke test used the running PostgreSQL, Go, and FastAPI services without mocks: registration and login, assessment, examination creation, image upload and analysis, detail and history reload, protected original and overlay reads, and denial without JWT. The browser interaction for this new persistence flow was not exercised in that API smoke test.
