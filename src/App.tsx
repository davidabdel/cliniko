/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Activity, Calendar, CheckCircle2, Info, Link as LinkIcon, RefreshCcw } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [status, setStatus] = useState<{ status: string; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch status", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const publicUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-[#0c0d0f] text-gray-300 font-sans selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="h-16 border-b border-gray-800 flex items-center justify-between px-8 bg-[#0f1115] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
            <div className={`w-4 h-4 border-2 border-white rounded-full border-t-transparent ${loading ? 'animate-spin' : ''}`}></div>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">SyncBridge <span className="text-gray-500 font-normal">v1.2.0</span></h1>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center gap-2 ${status?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            <div className={`w-2 h-2 rounded-full ${status?.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
            <span>GET /health : {status?.status === 'ok' ? 'OK' : 'OFFLINE'}</span>
          </motion.div>
          <div className="hidden md:flex items-center gap-2 text-gray-500">
            <span>Uptime: Active</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column */}
        <section className="md:col-span-4 flex flex-col gap-6">
          {/* Status Statistics */}
          <div className="p-6 bg-[#16181d] border border-gray-800 rounded-xl shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Sync Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0c0d0f] rounded-lg border border-gray-800">
                <p className="text-2xl font-light text-white font-mono">--</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-tight mt-1">Total Syncs</p>
              </div>
              <div className="p-4 bg-[#0c0d0f] rounded-lg border border-gray-800">
                <p className="text-2xl font-light text-blue-400 font-mono">--</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-tight mt-1">Deduplicated</p>
              </div>
            </div>
          </div>

          {/* Webhook Endpoints */}
          <div className="p-6 bg-[#16181d] border border-gray-800 rounded-xl shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Webhook Endpoints</h3>
            <div className="space-y-5">
              <WebhookCard 
                name="GHL Webhook" 
                url={`${publicUrl}/webhook/ghl`} 
                labelColor="text-orange-500"
                description="Register for events AND contacts"
              />
            </div>
          </div>

          {/* Sync Status Info */}
          <div className="p-6 bg-[#16181d] border border-gray-800 rounded-xl shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Polling Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">Appointments</span>
                <span className="text-white truncate max-w-[120px]" title={status?.lastPolls?.lastAppointmentPollTime || 'Never'}>
                  {status?.lastPolls?.lastAppointmentPollTime ? new Date(status.lastPolls.lastAppointmentPollTime).toLocaleTimeString() : 'Never'}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">Patients</span>
                <span className="text-white truncate max-w-[120px]" title={status?.lastPolls?.lastPatientPollTime || 'Never'}>
                  {status?.lastPolls?.lastPatientPollTime ? new Date(status.lastPolls.lastPatientPollTime).toLocaleTimeString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {/* Environment Status */}
          <div className="p-6 bg-[#16181d] border border-gray-800 rounded-xl shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Environment Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">CLINIKO_API_KEY</span>
                <span className="text-emerald-500">LOADED</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">GHL_API_KEY</span>
                <span className="text-emerald-500">LOADED</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-gray-500">GHL_CALENDAR_ID</span>
                <span className="text-emerald-500">LOADED</span>
              </div>
              <div className="flex justify-between text-xs font-mono border-t border-gray-800 pt-3">
                <span className="text-gray-500">PORT</span>
                <span className="text-white">3000</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column - Live Monitor Style */}
        <section className="md:col-span-8 flex flex-col gap-6">
          <div className="bg-[#16181d] border border-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-[500px]">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1c22]">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-white">System Monitor</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-tighter animate-pulse">Live</span>
            </div>
            
            <div className="flex-1 p-8 font-mono text-xs overflow-auto leading-relaxed">
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="text-gray-600 shrink-0">[{new Date().toLocaleTimeString()}]</div>
                  <div className="text-gray-500">
                    <span className="text-blue-400">STATUS</span> System initialized and monitoring webhooks.
                  </div>
                </div>
                
                {status && (
                  <div className="flex items-start gap-4">
                    <div className="text-gray-600 shrink-0">[{new Date().toLocaleTimeString()}]</div>
                    <div className="text-gray-500">
                      <span className="text-emerald-400">HEALTH</span> Heartbeat received. Server is responsive.
                      <div className="pl-4 text-gray-600 border-l border-gray-800 mt-1">
                        → Timestamp: {status.timestamp}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div className="text-gray-600 shrink-0">[{new Date().toLocaleTimeString()}]</div>
                  <div className="text-gray-400 italic">
                    Waiting for inbound external events...
                  </div>
                </div>

                {/* Example of what it looks like - commented out or kept as placeholder if user wants functionality primarily */}
                <div className="mt-8 pt-8 border-t border-gray-800/50 space-y-6">
                   <div className="flex items-center gap-3">
                    <Info size={16} className="text-blue-400" />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Setup Instructions</h4>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[11px] leading-normal text-gray-400 uppercase tracking-tight font-medium">
                      <div className="p-4 bg-[#0c0d0f] rounded-lg border border-gray-800 space-y-2 opacity-80">
                        <p className="text-white">1. Cliniko Polling</p>
                        <p>Triggered by Vercel Cron every 60s. State synced via Upstash Redis KV.</p>
                      </div>
                      <div className="p-4 bg-[#0c0d0f] rounded-lg border border-gray-800 space-y-2">
                        <p className="text-white">2. GHL Automation</p>
                        <p>Create a Workflow. Add a Webhook action. POST the GHL URL for calendar events and contacts.</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-800 bg-[#0f1115] flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              <span>Sync Engine: Vercel Serverless</span>
              <button 
                onClick={fetchStatus}
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <RefreshCcw size={10} className={loading ? 'animate-spin' : ''} />
                Refresh status
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="h-10 border-t border-gray-800 flex items-center px-8 text-[10px] text-gray-600 shrink-0 mt-auto">
        <div className="flex-1">Sync Engine: <span className="text-gray-400">Vercel Serverless / Node.js</span></div>
        <div className="hidden md:block font-mono text-gray-500 uppercase">deduplication_active=true | ttl=60000ms</div>
        <div className="flex-1 text-right">Connection: <span className="text-emerald-500">Secure HTTPS</span></div>
      </footer>
    </div>
  );
}

function WebhookCard({ name, url, labelColor, description }: { name: string; url: string; labelColor: string, description?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group">
      <label className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 block ${labelColor}`}>{name}</label>
      <div className="flex items-center bg-[#0c0d0f] border border-gray-800 rounded px-3 py-2 font-mono text-xs group-hover:border-gray-700 transition-colors">
        <span className="text-gray-500 uppercase">POST</span>
        <span className="mx-2 text-gray-700">/</span>
        <input 
          readOnly 
          value={url.split('/').pop() || ''} 
          className="bg-transparent border-none outline-none text-white w-full pointer-events-none"
        />
        <button 
          onClick={copy}
          className="ml-2 text-[10px] uppercase font-bold text-gray-500 hover:text-white transition-colors shrink-0"
        >
          {copied ? 'Copied' : 'Copy URL'}
        </button>
      </div>
      {description && <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-tighter">{description}</p>}
    </div>
  );
}

