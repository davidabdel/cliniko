import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import { Redis } from "@upstash/redis";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const STATE_FILE = path.join(process.cwd(), "state.json");

// Setup Redis if Vercel KV is available
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
  : null;

// State Management
interface State {
  lastAppointmentPollTime: string | null;
  lastPatientPollTime: string | null;
}

async function loadState(): Promise<State> {
  if (redis) {
    const state = await redis.get<State>("app_state");
    if (state) return state;
    return { lastAppointmentPollTime: null, lastPatientPollTime: null };
  }
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Error loading state.json:", err);
  }
  return { lastAppointmentPollTime: null, lastPatientPollTime: null };
}

async function saveState(state: State) {
  if (redis) {
    await redis.set("app_state", state);
    return;
  }
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("Error saving state.json:", err);
  }
}

// Sync loop prevention
class Deduplicator {
  private expiryTime = 60; // seconds
  private syncedIds = new Set<string>();

  async add(id: string) {
    if (redis) {
      await redis.setex(`dedup:${id}`, this.expiryTime, "1");
    } else {
      this.syncedIds.add(id);
      setTimeout(() => this.syncedIds.delete(id), this.expiryTime * 1000);
    }
  }

  async has(id: string): Promise<boolean> {
    if (redis) {
      const val = await redis.get(`dedup:${id}`);
      return !!val;
    }
    return this.syncedIds.has(id);
  }
}

const deduplicator = new Deduplicator();

app.use(express.json());

// Health endpoint
app.get("/api/health", async (req, res) => {
  const state = await loadState();
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    lastPolls: state
  });
});

// APIs
const clinikoApi = axios.create({
  baseURL: "https://api.au1.cliniko.com/v1",
  headers: {
    Authorization: `Basic ${Buffer.from(`${process.env.CLINIKO_API_KEY}:`).toString("base64")}`,
    "User-Agent": "Cliniko-GHL-Sync-App (support@example.com)",
    "Accept": "application/json"
  }
});

const ghlApi = axios.create({
  baseURL: "https://services.leadconnectorhq.com",
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    "Content-Type": "application/json",
    "Version": "2021-04-15"
  }
});

/**
 * Sync Cliniko Patient to GHL
 */
async function syncClinikoPatientToGHL(patient: any) {
  const patientSyncId = `cl_p_${patient.id}`;
  if (await deduplicator.has(patientSyncId)) return null;

  if (!patient.email) return null;

  try {
    const searchRes = await ghlApi.get(`/contacts/search?locationId=${process.env.GHL_LOCATION_ID}&query=${patient.email}`);
    const existing = searchRes.data.contacts?.[0];

    const contactData = {
      locationId: process.env.GHL_LOCATION_ID,
      firstName: patient.first_name,
      lastName: patient.last_name,
      email: patient.email,
      phone: patient.phone_mobile || patient.phone_number
    };

    let contactId;
    if (existing) {
      await ghlApi.put(`/contacts/${existing.id}`, contactData);
      contactId = existing.id;
    } else {
      const createRes = await ghlApi.post("/contacts/", contactData);
      contactId = createRes.data.contact.id;
    }

    await deduplicator.add(patientSyncId);
    return contactId;
  } catch (err: any) {
    console.error(`Sync Cliniko -> GHL Patient Error: ${err.message}`);
    return null;
  }
}

/**
 * Sync GHL Contact to Cliniko
 */
async function syncGHLContactToCliniko(contact: any) {
  const contactSyncId = `ghl_c_${contact.id}`;
  if (await deduplicator.has(contactSyncId)) return null;

  if (!contact.email) return null;

  try {
    const searchRes = await clinikoApi.get(`/patients?q=email:${contact.email}`);
    const existing = searchRes.data.patients?.[0];

    const patientData = {
      first_name: contact.firstName || contact.first_name,
      last_name: contact.lastName || contact.last_name,
      email: contact.email,
      phone_mobile: contact.phone || contact.phone_number
    };

    let patientId;
    if (existing) {
      await clinikoApi.put(`/patients/${existing.id}`, patientData);
      patientId = existing.id;
    } else {
      const createRes = await clinikoApi.post("/patients", patientData);
      patientId = createRes.data.id;
    }

    await deduplicator.add(contactSyncId);
    return patientId;
  } catch (err: any) {
    console.error(`Sync GHL -> Cliniko Patient Error: ${err.message}`);
    return null;
  }
}

/**
 * Cliniko Pollers
 */
async function pollCliniko() {
  const state = await loadState();
  const now = new Date().toISOString();

  // 1. Poll Appointments
  try {
    let url = "/appointments?sort=updated_at:desc";
    if (state.lastAppointmentPollTime) {
      url += `&updated_since=${state.lastAppointmentPollTime}`;
    }
    const res = await clinikoApi.get(url);
    const appointments = res.data.appointments || [];

    for (const appt of appointments) {
      const syncId = `cl_a_${appt.id}`;
      if (await deduplicator.has(syncId)) continue;
      if (appt.deleted_at) continue; // Basic handling

      // Get patient details for GHL
      const pRes = await clinikoApi.get(`/patients/${appt.patient_id}`);
      const contactId = await syncClinikoPatientToGHL(pRes.data);

      if (contactId) {
        await ghlApi.post("/calendars/events", {
          calendarId: process.env.GHL_CALENDAR_ID,
          locationId: process.env.GHL_LOCATION_ID,
          contactId,
          startTime: appt.starts_at,
          endTime: appt.ends_at,
          title: appt.appointment_type.name,
          description: `Cliniko ID: ${appt.id}`
        });
        await deduplicator.add(syncId);
      }
    }
    state.lastAppointmentPollTime = now;
  } catch (err: any) {
    console.warn("Cliniko Appointments Poll Error (likely empty or rate limit):", err.message);
  }

  // 2. Poll Patients
  try {
    let url = "/patients?sort=updated_at:desc";
    if (state.lastPatientPollTime) {
      url += `&updated_since=${state.lastPatientPollTime}`;
    }
    const res = await clinikoApi.get(url);
    const patients = res.data.patients || [];

    for (const patient of patients) {
      await syncClinikoPatientToGHL(patient);
    }
    state.lastPatientPollTime = now;
  } catch (err: any) {
    console.warn("Cliniko Patients Poll Error:", err.message);
  }

  await saveState(state);
}

/**
 * Webhook: GHL -> Cliniko
 */
app.post("/webhook/ghl", async (req, res) => {
  try {
    const payload = req.body;
    
    // Case 1: Calendar Event (Created/Updated/Cancelled)
    if (payload.calendarId || payload.startTime) {
      const ghlEventId = `ghl_e_${payload.id}`;
      if (await deduplicator.has(ghlEventId)) return res.status(200).send("Duplicate");

      if (payload.status === "cancelled") {
        console.log(`GHL Event Cancelled: ${payload.id}`);
        return res.status(200).send("Deletion skipped (polling logic handles native deletions)");
      }

      const typesRes = await clinikoApi.get("/appointment_types");
      const typeMatch = typesRes.data.appointment_types.find((t: any) => 
        t.name.toLowerCase() === (payload.title || "").toLowerCase()
      );

      if (typeMatch) {
        const patientId = await syncGHLContactToCliniko({
          id: payload.contactId,
          email: payload.contactEmail,
          firstName: payload.contactFirstName,
          lastName: payload.contactLastName,
          phone: payload.contactPhone
        });

        if (patientId) {
          await deduplicator.add(ghlEventId);
          await clinikoApi.post("/appointments", {
            patient_id: patientId,
            appointment_type_id: typeMatch.id,
            starts_at: payload.startTime,
            ends_at: payload.endTime,
            notes: `GHL ID: ${payload.id}`
          });
        }
      }
    }
    // Case 2: Contact updated
    else if (payload.email) {
      await syncGHLContactToCliniko(payload);
    }

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("GHL Webhook Error:", err.message);
    res.status(500).send("Error");
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    // Start Pollers
    setInterval(pollCliniko, 60000);
    pollCliniko(); // Run immediately
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export { app, pollCliniko };
