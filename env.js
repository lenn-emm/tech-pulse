// Tech Pulse — Public-Frontend-Konfiguration.
// Wird von index.html und archive.html VOR app.js geladen und setzt
// window.ENV. Hier nur PUBLIC keys (Anon). Service-Role-Key bleibt in
// GitHub Secrets / Workflow-ENV.

window.ENV = {
  SUPABASE_URL: "https://rjmyjuejdhcnijerwwwe.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqbXlqdWVqZGhjbmlqZXJ3d3dlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjg4NDMsImV4cCI6MjA5MjAwNDg0M30.21k5mfWbccw8wI4wbilQdt0Vp6qA2-3Ki-pOGkmDHJw"
};
