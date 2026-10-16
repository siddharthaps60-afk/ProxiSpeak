# ProxiSpeak Backend

Backend development for ProxiSpeak — Geospatial Proximity Audio Ecosystem.

## Responsibilities
- Express.js backend development
- MongoDB database integration
- Real-time communication using Socket.IO
- Geospatial proximity detection

## Initial Setup
- Initialized the backend Node.js project.
- Installed initial backend dependencies.
- Created the initial backend folder structure.

## Next Steps
- Set up the Express server.
- Configure the database connection.
- Explore the project's proximity and real-time communication requirements.
### Update User Profile

**Endpoint:** `PATCH /api/auth/me`

**Authentication:** Required — JWT Bearer token

**Request body:**
```json
{
  "name": "Updated Test User"
}
```

**Success response:** `200 OK`

Returns the updated user's profile.

**Validation:** A non-empty name is required.

**Error responses:**
- `400 Bad Request` — Invalid name
- `401 Unauthorized` — Missing or invalid token
- `404 Not Found` — User not found