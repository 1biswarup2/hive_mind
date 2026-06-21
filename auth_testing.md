# HiveMind Auth Testing

Multi-tenant JWT (httpOnly cookies) auth.

## Endpoints
- `POST /api/auth/register-org` — `{ org_name, org_domain, admin_name, admin_email, admin_password }`
- `POST /api/auth/register` — `{ org_domain, name, email, password, department? }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

## Seeded credentials (org Acme Corp, domain acme.com)
- admin@acme.com / Admin@123 (role: admin)
- manager@acme.com / Manager@123 (role: manager)
- reviewer@acme.com / Reviewer@123 (role: reviewer)
- priya@acme.com / Priya@123 (role: employee)
- arjun@acme.com / Arjun@123 (role: employee)

## Verify hash / indexes
```
mongosh
use hivemind_db
db.users.findOne({email:"admin@acme.com"}, {password_hash:1, role:1, org_id:1})
db.users.getIndexes()
```
bcrypt hash starts with `$2b$`. Index on `email` unique. TTL index on `password_reset_tokens.expires_at`.

## cURL
```
curl -c c.txt -X POST $BACKEND/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@acme.com","password":"Admin@123"}'
curl -b c.txt $BACKEND/api/auth/me
```
