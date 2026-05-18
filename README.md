# Cliniko & GoHighLevel Two-Way Calendar Sync

This application provides a two-way sync bridge between Cliniko and GoHighLevel (GHL).

## How it Works

1.  **Cliniko -> GHL (Polling)**: The app polls the Cliniko API every 60 seconds for new or updated appointments and patients. These are then synced to GHL as contacts and calendar events.
2.  **GHL -> Cliniko (Webhook)**: When an event or contact is created/updated in GHL, it sends a webhook to this app, which updates Cliniko.
3.  **Automatic Client Sync**: Patients and Contacts are automatically matched by email address to ensure data integrity across both systems.
4.  **Deduplication**: To prevent "sync loops", the app tracks recently synced IDs in memory for 60 seconds and skips processing if an ID is present in the set.
5.  **State Persistence**: Last poll timestamps are stored in `state.json` to ensure the server picks up where it left off after restarts.

## Environment Variables

| Variable | Description |
| :--- | :--- |
| `CLINIKO_API_KEY` | Your Cliniko API key (with Administrator access). |
| `GHL_API_KEY` | Your GHL API Bearer token. |
| `GHL_CALENDAR_ID` | The specific GHL Calendar ID to sync to. |
| `GHL_LOCATION_ID` | The GHL Location ID. |
| `PORT` | (Optional) Defaults to 3000. |

## Setup

### 1. Register GHL Webhook
- Create a new **Automation Workflow** in GHL.
- **Trigger**: "Appointment Status", "Calendar Event Created", or "Contact Created/Updated".
- **Action**: "Webhook".
- **Method**: POST
- **URL**: `https://your-app-url.com/webhook/ghl` (available in the dashboard).

### 2. No Cliniko Webhook Needed
- This app uses **polling** for Cliniko and does not require you to register webhooks in the Cliniko settings.

## Limitations
- **No Persistence (Deduplication)**: The deduplication set is in-memory. If the server restarts, very recent syncs might re-trigger once.
- **Appointment Type Matching**: GHL event titles must exactly match the Name of the Appointment Type in Cliniko.
- **Mapping**: Currently a single calendar bridge. Multi-practitioner mapping is not supported in this simple version.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
