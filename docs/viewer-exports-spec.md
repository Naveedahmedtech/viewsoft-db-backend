# Viewer Exports Spec

## Goal

Support these backend flows for viewer exports:

1. Register the latest exported file after save/export completes.
2. Download a previously registered exported file later by `fileId` or `sourceFileUrl`.
3. Download multiple previously registered exported files later in one request.

This document defines the contract and implementation plan only. It does not require code changes by itself.

## Implementation Checklist

- [completed] Add tracked implementation checklist and keep statuses current
- [completed] Add `viewer_export` Sequelize model
- [completed] Register `viewer_export` in the shared DB model index
- [completed] Implement `POST /api/viewer/exports/register`
- [completed] Implement `POST /api/viewer/exports/download`
- [completed] Implement `POST /api/viewer/exports/download-batch`
- [completed] Add filename sanitization and remote download retry/timeout handling
- [completed] Wire routes into the main API router
- [completed] Add `archiver` dependency for batch zip creation
- [completed] Run basic verification and document any remaining gaps

Verification note:

- static syntax checks passed for the changed JS files
- batch zip runtime remains dependent on installing `archiver` into `node_modules`

## Core Rules

- `exportedUrl` is required when registering an export.
- At least one of `fileId` or `sourceFileUrl` is required when registering an export.
- `fileId` is optional.
- `sourceFileUrl` is optional.
- Both `fileId` and `sourceFileUrl` must be supported as lookup keys for later download.
- `fileId` should be treated as the viewer cache id when available.
- Store only the latest exported URL per logical file unless versioning is introduced later.
- If a later register call provides more identity data than an older row, update the same row instead of creating a duplicate when possible.

## Recommended Data Model

Use a dedicated table for viewer exports instead of reusing `user_pdf`.

Table name:

- `viewer_export`

Recommended columns:

- `id`: internal primary key
- `file_id`: nullable string
- `file_name`: nullable string
- `source_file_url`: nullable text
- `exported_url`: required text
- `created_at`
- `updated_at`

Notes:

- Do not make `file_id` the primary key, because registration must also work when only `sourceFileUrl` is provided.
- Prefer resolving uniqueness in application logic instead of relying only on nullable unique indexes because behavior differs across database engines.

## Identity Resolution

Registration and later download must support both identifiers:

- `fileId`
- `sourceFileUrl`

Matching rules for register:

1. Validate `exportedUrl`.
2. Validate that at least one of `fileId` or `sourceFileUrl` is present.
3. Search for an existing row by:
   - `fileId` if provided
   - `sourceFileUrl` if provided
4. If no row exists, create one.
5. If one row exists, update it.
6. If one identifier matches an existing row and the other identifier is empty in that row, backfill it.
7. If multiple different rows match, return `409 Conflict` because the identity is ambiguous and should not be silently merged.

Result:

- latest `exportedUrl` replaces the previous one
- `updatedAt` changes on every successful register
- `createdAt` is set only on first insert

## API Surface

All routes below are intended to live under the existing `/api` router.

### 1. Register Export

Endpoint:

- `POST /api/viewer/exports/register`

Purpose:

- Save or update the latest exported file location for a logical source file.

Request body:

```json
{
  "fileId": "cacheid-123",
  "fileName": "drawing-01.pdf",
  "sourceFileUrl": "https://example.com/original.pdf",
  "exportedUrl": "https://example.com/exported.pdf"
}
```

Validation:

- `exportedUrl` is required
- at least one of `fileId` or `sourceFileUrl` is required

Success response:

```json
{
  "success": true,
  "record": {
    "id": 12,
    "fileId": "cacheid-123",
    "fileName": "drawing-01.pdf",
    "sourceFileUrl": "https://example.com/original.pdf",
    "exportedUrl": "https://example.com/exported.pdf",
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T10:05:00.000Z"
  }
}
```

Failure responses:

- `400` if `exportedUrl` is missing
- `400` if both `fileId` and `sourceFileUrl` are missing
- `409` if registration matches multiple conflicting rows
- `500` for unexpected persistence errors

### 2. Download Single Export

Endpoint:

- `POST /api/viewer/exports/download`

Purpose:

- Download one previously registered exported file by `fileId` or `sourceFileUrl`.

Request body examples:

```json
{
  "fileId": "cacheid-123"
}
```

```json
{
  "sourceFileUrl": "https://example.com/original.pdf"
}
```

Validation:

- require at least one of `fileId` or `sourceFileUrl`

Behavior:

1. Resolve a single stored export record.
2. Fetch `exportedUrl`.
3. Stream the file back to the caller.
4. Set download headers using `fileName` when available.

Response:

- file stream, typically `application/pdf` or the remote content type

Failure responses:

- `400` if no lookup key is provided
- `404` if no record exists
- `502` or `504` if remote download fails or times out

### 3. Download Batch Exports

Endpoint:

- `POST /api/viewer/exports/download-batch`

Purpose:

- Download multiple previously registered exported files in one response.

Recommended request shape:

```json
{
  "items": [
    { "fileId": "cacheid-123" },
    { "sourceFileUrl": "https://example.com/original-2.pdf" },
    {
      "fileId": "cacheid-789",
      "sourceFileUrl": "https://example.com/original-3.pdf"
    }
  ]
}
```

Reason for using `items`:

- clearer than overloading a single `fileIds` array
- supports both lookup types cleanly
- supports future metadata additions without breaking shape

Validation:

- `items` must be a non-empty array
- each item must include at least one of `fileId` or `sourceFileUrl`

Behavior:

1. Resolve records for all requested items.
2. Deduplicate matched records.
3. Download each `exportedUrl`.
4. Package them into one zip archive.
5. Return the zip as an attachment.

Response headers:

- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="viewer-exports.zip"`

Why zip is recommended:

- one HTTP response naturally maps to one downloaded file
- users can download multiple exports in a single action
- frontend stays simpler than triggering many separate browser downloads

## Frontend Behavior

### Register

After viewer save/export completes, frontend should send:

```json
{
  "fileId": "cacheid",
  "fileName": "name.pdf",
  "sourceFileUrl": "original url",
  "exportedUrl": "generated exported url"
}
```

Notes:

- `fileId` may be omitted if not available
- `sourceFileUrl` may be omitted if not available
- one of them must exist

### Download Single

Frontend calls the single download endpoint and treats the response as a file download.

### Download Batch

Frontend calls the batch endpoint, receives a zip blob, and triggers a browser download.

Important:

- the backend does not directly save to the user's Downloads folder
- the backend returns a file response
- the browser handles saving that response to the user's machine

## Download Reliability Rules

When fetching remote `exportedUrl` files:

- use request timeout
- use limited retry logic
- log failed downloads with enough context to trace the affected record
- sanitize output filenames before placing them into download headers or zip entries

Suggested safeguards:

- default timeout for each remote fetch
- 1 to 3 retries for transient failures
- skip invalid or empty `exportedUrl`

## Missing File Policy

Two valid policies exist for batch download:

1. Fail the entire request if any requested file is missing or cannot be downloaded.
2. Skip missing or failed files and include a manifest describing what succeeded and what failed.

Recommended policy:

- skip failed items
- include `manifest.json` inside the zip

Why:

- more resilient for user-driven batch downloads
- avoids losing all successful files because one remote file is unavailable

Suggested manifest shape:

```json
{
  "generatedAt": "2026-03-30T10:10:00.000Z",
  "requested": 3,
  "included": 2,
  "skipped": [
    {
      "fileId": "cacheid-456",
      "sourceFileUrl": "https://example.com/original-2.pdf",
      "reason": "Record not found"
    }
  ]
}
```

## Authentication Decision

This codebase currently mounts most routes behind the existing JWT middleware, but JWT is disabled in the current config.

Implementation should explicitly decide whether viewer export endpoints will:

- follow the standard authenticated route pattern, or
- be intentionally open for trusted viewer callbacks

Recommendation:

- keep them consistent with existing `/api` routes unless there is a confirmed viewer integration reason not to

## Implementation Plan

1. Add a new Sequelize model for `viewer_export`.
2. Register that model in the shared model index.
3. Add a dedicated controller for viewer export registration and download flows.
4. Add routes:
   - `POST /api/viewer/exports/register`
   - `POST /api/viewer/exports/download`
   - `POST /api/viewer/exports/download-batch`
5. Add request validation for identifier rules.
6. Add identity resolution logic for upsert-like behavior.
7. Add remote file download logic with timeout and retry support.
8. Add zip packaging for batch download.
9. Add filename sanitization.
10. Add Swagger docs for all endpoints.

## Dependency Note

Current backend dependencies already include `axios`.

Batch zip download will require adding a zip library such as:

- `archiver`

## Open Decisions To Confirm Before Coding

- Should viewer export routes require JWT or remain callable without auth?
- Should batch download skip failures with a manifest, or fail the whole zip?
- Should single download infer content type from the remote response, or force download as attachment always?
- Should `fileName` be updated on every register when a new value is provided, or only filled when missing?
