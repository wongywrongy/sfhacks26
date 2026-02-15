# CommonGround

## Setup

### Environment Variables

Create `server/.env`:

```
MONGODB_URI=mongodb://localhost:27017/commonground
GEMINI_API_KEY=your-gemini-api-key
CRS_USERNAME=your-crs-username
CRS_PASSWORD=your-crs-password
```

### Install Dependencies

```bash
cd server && npm install
cd client && npm install
```

### Seed Demo Data

```bash
cd server && node src/seed.js
```

### Run

Terminal 1 — server:

```bash
cd server && npm run dev
```

Terminal 2 — client:

```bash
cd client && npm run dev
```

Server runs on `http://localhost:3000`, client on `http://localhost:5173`.
