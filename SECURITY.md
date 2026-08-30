# Chess Arena Security

## Production security requirements

Chess Arena has two parts: a Vite frontend and an Express/Socket.IO backend. The Netlify site should host the frontend only. The API and Socket.IO server must run on a persistent Node host with HTTPS/WSS.

### Secrets

Never commit owner passwords, API keys, session secrets, database credentials, or `.env` files. Configure these through the backend host's environment variables.

Required production variables include:

- `OWNER_EMAIL`
- `OWNER_USERNAME`
- `OWNER_INITIAL_PASSWORD` (only for first-time owner seeding)
- `FRONTEND_ORIGIN` (the exact Netlify origin)
- `PORT`

After initial owner setup, rotate the bootstrap password and remove any bootstrap credential from deployment configuration where possible.

### Authentication

- Do not use one-click credential login in the public UI.
- Login and owner verification must be rate limited.
- Owner/admin actions must be authorized server-side.
- Sensitive owner actions should require recent re-verification.
- Sessions must expire and be invalidated on logout.

### API authorization

Every endpoint that changes data must validate the authenticated user and the specific object being changed. Never trust client-supplied role, rating, game result, puzzle rating, or ownership fields.

### Abuse and DDoS protection

Netlify provides automatic DDoS protection for the frontend. Backend protection must also include provider-level DDoS protection, HTTPS/WSS, request rate limits, connection limits, payload limits, and monitoring/alerting. Netlify rate limiting can additionally protect frontend paths where available.

### Reporting

If a security issue is discovered, do not publish credentials or exploit details in a public issue. Rotate exposed secrets first and use GitHub's private security reporting workflow when available.
