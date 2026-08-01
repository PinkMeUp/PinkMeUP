# PinkMeUP Backend API Summary

Base path: `/api/v1`

## Authentication

### POST /auth/register
- Public
- Body: `{ firstName, lastName, email, password, phone }`
- Response: `{ success, message, data: { user }, timestamp }`
- Sets `token` cookie on success.

### POST /auth/login
- Public
- Body: `{ email, password }`
- Response: `{ success, message, data: { user }, timestamp }`
- Sets `token` cookie on success.

### POST /auth/forgot-password
- Public
- Body: `{ email }`
- Sends password reset email.

### POST /auth/reset-password
- Public
- Body: `{ token, newPassword }`
- Resets password when token is valid.

### GET /auth/profile
- Authenticated
- Response: current user profile.

### PUT /auth/profile
- Authenticated
- Body: `{ firstName?, lastName?, phone? }`
- Updates current user profile.

### PUT /auth/change-password
- Authenticated
- Body: `{ currentPassword, newPassword }`

### POST /auth/logout
- Authenticated
- Clears auth cookie.

### GET /auth/google
- Public
- Redirects to Google OAuth consent.

### GET /auth/google/callback
- Public (OAuth callback)
- Handles Google login and sets `token` cookie.
- Redirects to frontend dashboard.

---

## Booking

### GET /bookings/my
- Authenticated
- Query: `{ status?, page?, limit? }`
- Returns bookings for current customer.

### GET /bookings/:id
- Authenticated
- Path: booking ID
- Returns booking detail if owned by user, stylist, or admin.

### POST /bookings
- Authenticated
- Body: `{ serviceIds, stylistId, date, startTime, notes? }`
- Creates a new booking.

### PUT /bookings/:id/cancel
- Authenticated
- Body: `{ reason? }`
- Cancels a booking.

### PUT /bookings/:id/reschedule
- Authenticated
- Body: `{ date, startTime }`
- Reschedules a booking.

### GET /bookings/all
- Admin only
- Query: `{ status?, startDate?, endDate?, page?, limit? }`
- Returns all bookings.

---

## Services

### GET /services
- Public
- Query: `{ category?, isActive?, page?, limit? }`
- Returns paginated service list.

### GET /services/categories
- Public
- Returns distinct service categories.

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
- Returns paginated stylist list.

### GET /stylists/:id
- Public
- Returns stylist profile.

### GET /stylists/:id/availability
- Public
- Returns stylist availability status.

### POST /stylists
- Admin only
- Body: `{ userId, specialties }`

### PUT /stylists/:id
- Admin only
- Body: `{ specialties?, isAvailable?, rating? }`

### DELETE /stylists/:id
- Admin only

---

## Users

### GET /users
- Admin only
- Query: `{ role?, page?, limit? }`
- Returns paginated user list.

### GET /users/customers
- Admin only
- Returns all customers.

### GET /users/stylists
- Admin only
- Returns all stylist users.

### GET /users/:id
- Admin only
- Returns user details.

### PUT /users/:id
- Admin only
- Body: `{ firstName?, lastName?, phone?, role?, isActive? }`

### DELETE /users/:id
- Admin only

---

## Admin Dashboard / Management

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

## Auth / Security Notes

- Authentication is cookie-based with `token` set as an HTTP-only cookie.
- Protected endpoints require `authenticate` middleware.
- Admin-only routes require `authorize('admin')`.

## Response Schema

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
