# Firestore Security Specification

## Data Invariants
1. **Tool Integrity**: A tool must have a name, downloadUrl, section, and timestamps.
2. **Category Whitelist**: The `section` field must be one of the authorized categories (`fivem`, `spoofers`, `cheats`, `tweaks`, `grabbers`).
3. **Admin Exclusivity**: Only the authorized admin (`rxtools1@gmail.com`) can write to `tools` or `settings`.
4. **Public Readability**: Anyone (authenticated or not) can read the tools and settings.

## The "Dirty Dozen" Payloads (Targeting Rejection)

1. **Spoofed Authorship**: Creating a tool with a future `createdAt` date.
2. **Category Injection**: Setting `section` to "python" (blocked by whitelist).
3. **Identity Poisoning**: Using a 2KB string as a `toolId`.
4. **Member Bypass**: Deleting a tool as a non-admin user.
5. **Shadow Update**: Adding a field `isPremium: true` to a tool (unauthorized field).
6. **State Shortcutting**: Modifying `createdAt` during an update.
7. **Resource Poisoning**: Uploading a tool with a 1MB description string.
8. **Settings Tamper**: Changing the `discordWebhookUrl` as a guest.
9. **Category Lockout**: Deleting the `settings/categories` document.
10. **Orphaned Tool**: Creating a tool with an invalid section format.
11. **Mass Extraction Attack**: Attempting to read `/settings/config` without being signed in (if we restrict it).
12. **Self-Promotion**: Authenticated user trying to add themselves to an admin collection.

## Test Runner Plan
I'll verify these using a combination of manual logic analysis and standard rule validation.
