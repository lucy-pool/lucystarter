# Database Schema

```mermaid
erDiagram
    users {
        string clerkId "Clerk subject ID"
        string name "Optional display name"
        string email "Email address"
        string avatarUrl "Optional profile image URL"
        array roles "user | admin"
        number createdAt "Unix timestamp ms"
        number updatedAt "Unix timestamp ms"
    }

    fileMetadata {
        string fileName "Original file name"
        string storageKey "S3 object key"
        string mimeType "MIME type"
        number size "Size in bytes"
        string fileType "audio | document | image"
        id createdBy "FK → users._id"
        number createdAt "Unix timestamp ms"
    }

    aiMessages {
        id userId "FK → users._id"
        string role "user | assistant"
        string content "Message text"
        string model "Optional model name"
        number createdAt "Unix timestamp ms"
    }

    notes {
        string title "Note title"
        string body "Note content"
        id authorId "FK → users._id"
        boolean isPublic "Visible to all users"
        number createdAt "Unix timestamp ms"
        number updatedAt "Unix timestamp ms"
    }

    users ||--o{ notes : "authorId"
    users ||--o{ fileMetadata : "createdBy"
    users ||--o{ aiMessages : "userId"
```

## Indexes

| Table | Index | Fields | Purpose |
|-------|-------|--------|---------|
| users | by_clerk_id | clerkId | Clerk auth lookup |
| users | by_email | email | Email lookup |
| fileMetadata | by_created_by | createdBy | User's files |
| fileMetadata | by_file_type | fileType | Filter by type |
| aiMessages | by_user | userId | User's chat history |
| notes | by_author | authorId | User's own notes |
| notes | by_public | isPublic | Public notes feed |

## Roles

| Role | Description |
|------|-------------|
| user | Default role for all new users |
| admin | Full access, can manage user roles |

## Validators (exported from schema.ts)

| Validator | Values |
|-----------|--------|
| `roleValidator` | `"user"` \| `"admin"` |
| `fileTypeValidator` | `"audio"` \| `"document"` \| `"image"` |
