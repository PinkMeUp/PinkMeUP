# PinkMeUP Frontend API Guide

This file summarizes the backend API used by the frontend application.

Base URL: `/api/v1`

## Authentication

### POST /auth/register
- Public
- Body: `{ firstName, lastName, email, password, phone }`
- Response includes `{ success, message, data: { user }, timestamp }`
- Backend sets HTTP-only `token` cookie on success.

### POST /auth/login
- Public
- Body: `{ email, password }`
- Response includes `{ success, message, data: { user }, timestamp }`
- Backend sets HTTP-only `token` cookie on success.

### POST /auth/forgot-password
- Public
- Body: `{ email }`
- Triggers password reset email.

### POST /auth/reset-password
- Public
- Body: `{ token, newPassword }`
- Resets password when token is valid.

### GET /auth/profile
- Authenticated
- Returns current user profile.

### PUT /auth/profile
- Authenticated
- Body: `{ firstName?, lastName?, phone? }`
- Updates user profile.

### PUT /auth/change-password
- Authenticated
- Body: `{ currentPassword, newPassword }`

### POST /auth/logout
- Authenticated
- Clears auth cookie.

### GET /auth/google
- Public
- Redirects to Google OAuth login page.

### GET /auth/google/callback
- Public
- Handles OAuth callback and redirects to frontend dashboard.
- Sets `token` cookie on success.

---

## Booking

### GET /bookings/my
- Authenticated
- Query: `{ status?, page?, limit? }`
- Returns user bookings.

### GET /bookings/:id
- Authenticated
- Path param: booking ID
- Returns booking details for customer, stylist, or admin.

### POST /bookings
- Authenticated
- Body: `{ serviceIds, stylistId, date, startTime, notes? }`

### PUT /bookings/:id/cancel
- Authenticated
- Body: `{ reason? }`

### PUT /bookings/:id/reschedule
- Authenticated
- Body: `{ date, startTime }`

### GET /bookings/all
- Admin only
- Query: `{ status?, startDate?, endDate?, page?, limit? }`

---

## Services

### GET /services
- Public
- Query: `{ category?, isActive?, page?, limit? }`

### GET /services/categories
- Public
- Returns list of service categories.

### GET /services/:id
- Public
- Returns service details.

### POST /services
- Admin only
- Body: `{ name, description, price, duration, category }`

### PUT /services/:id
- Admin only
- Body: `{ name?, description?, price?, duration?, category?, isActive? }`

### DELETE /services/:id
- Admin only

---

## Stylists

### GET /stylists
- Public
- Query: `{ isAvailable?, page?, limit? }`

### GET /stylists/:id
- Public
- Returns stylist profile.

### GET /stylists/:id/availability
- Public
- Returns stylist availability.

### POST /stylists
- Admin only
- Body: `{ userId, specialties }`

### PUT /stylists/:id
- Admin only
- Body: `{ specialties?, isAvailable?, rating? }`

### DELETE /stylists/:id
- Admin only

---

## User Management (Admin)

### GET /users
- Admin only
- Query: `{ role?, page?, limit? }`

### GET /users/customers
- Admin only

### GET /users/stylists
- Admin only

### GET /users/:id
- Admin only

### PUT /users/:id
- Admin only
- Body: `{ firstName?, lastName?, phone?, role?, isActive? }`

### DELETE /users/:id
- Admin only

---

## Admin Dashboard

### Settings
- `GET /admin/settings`
- `PUT /admin/settings`
  - Body: `{ businessHours?, slotInterval?, maxBookingsPerSlot?, bookingLeadTime?, cancellationWindow?, timezone?, businessName? }`
- `POST /admin/settings/reset`
- `GET /admin/settings/hours`
- `PUT /admin/settings/hours`
  - Body: `{ businessHours }`

### Bookings
- `GET /admin/bookings`
- `GET /admin/bookings/stylist/:id`

### Availability
- `GET /admin/availability`
  - Query: `{ stylistId?, date?, serviceIds? }`
- `GET /admin/availability/slots`
  - Query: `{ date, serviceIds? }`
- `GET /admin/availability/time-slots`
  - Query: `{ stylistId, date, serviceIds? }`

### Reports
- `GET /admin/reports/booking-trends`
  - Query: `{ startDate?, endDate? }`
- `GET /admin/reports/service-popularity`
  - Query: `{ startDate?, endDate? }`
- `GET /admin/reports/stylist-performance`
  - Query: `{ startDate?, endDate? }`
- `GET /admin/reports/revenue`
  - Query: `{ startDate?, endDate? }`
- `GET /admin/reports/dashboard`

---

## Frontend Notes

- API uses HTTP-only `token` auth cookie.
- Include credentials in fetch requests when calling the backend.
- Example fetch options:
  ```js
  fetch('/api/v1/auth/profile', {
    method: 'GET',
    credentials: 'include'
  });
  ```

## Response Format

### Success
```json
{
  "success": true,
  "message": "...",
  "data": {...},
  "timestamp": "..."
}
```

### Error
```json
{
  "success": false,
  "message": "...",
  "errors": null,
  "timestamp": "..."
}
```
