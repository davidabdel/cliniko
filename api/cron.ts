import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pollCliniko } from "../app";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await pollCliniko();
    return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("Cron failed:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
