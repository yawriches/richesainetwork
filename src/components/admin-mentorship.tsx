"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, RefreshCw, Save, Search, UserRound } from "lucide-react";
import { asArray, formatDate, getData, humanize, postAction, text } from "@/lib/ui";

const statuses = ["NEW", "REVIEWING", "NEEDS_INFO", "ACCEPTED", "DECLINED", "WITHDRAWN"];

export function MentorshipControlCenter({ search = "" }: { search?: string }) {
  const [state, setState] = useState<any>({ loading: true });
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("NEW");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setState((current: any) => ({ ...current, loading: true, error: "" }));
    getData("admin_mentorship")
      .then((result) => setState({ loading: false, ...(result.data || {}) }))
      .catch(() => setState({ loading: false, error: "Mentorship applications could not be loaded." }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const applications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return asArray(state.applications).filter((application: any) =>
      !query || [application.name, application.email, application.phone, application.primary_goal]
        .some((value) => String(value || "").toLowerCase().includes(query)),
    );
  }, [state.applications, search]);
  const selected = applications.find((application: any) => application.id === selectedId) || applications[0] || null;
  const events = selected ? asArray(state.events).filter((event: any) => event.application_id === selected.id) : [];

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status || "NEW");
    setNote("");
  }, [selected?.id, selected?.status]);

  async function saveReview() {
    if (!selected) return;
    setSaving(true);
    setNotice("");
    const result = await postAction("mentorship_application_update", {
      application_id: selected.id,
      status,
      note,
    });
    setSaving(false);
    setNotice(result.ok ? result.message || "Mentorship application updated." : result.error);
    if (result.ok) load();
  }

  if (state.loading) return <p className="loading">Loading mentorship applications…</p>;
  if (state.error) return <div className="form-alert" role="alert">{state.error}</div>;

  const counts = statuses.reduce((all, value) => ({ ...all, [value]: applications.filter((application: any) => application.status === value).length }), {} as Record<string, number>);
  return (
    <div className="mentorship-admin-console">
      <div className="community-admin-intro">
        <div>
          <span className="eyebrow">Private selection</span>
          <h2 className="font-display">AI-to-Income Mentorship applications.</h2>
          <p className="muted">Applications are a review queue, not payments. An administrator must make every status change deliberately; this area never creates an order or confirms a place automatically.</p>
        </div>
        <button type="button" className="btn btn-outline btn-small" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      {notice && <p className="field-hint" role="status">{notice}</p>}

      <section className="community-admin-stats mentorship-admin-stats">
        <div className="card"><span>New</span><strong>{counts.NEW || 0}</strong></div>
        <div className="card"><span>Reviewing</span><strong>{counts.REVIEWING || 0}</strong></div>
        <div className="card"><span>Needs info</span><strong>{counts.NEEDS_INFO || 0}</strong></div>
        <div className="card"><span>Accepted manually</span><strong>{counts.ACCEPTED || 0}</strong></div>
      </section>

      <div className="mentorship-admin-grid">
        <section className="card mentorship-admin-list">
          <div className="community-admin-heading"><div><span className="eyebrow">Application queue</span><h2 className="font-display">Applicants</h2></div><Search size={17} /></div>
          {applications.length ? applications.map((application: any) => (
            <button type="button" className={`mentorship-admin-app ${selected?.id === application.id ? "is-selected" : ""}`} onClick={() => setSelectedId(application.id)} key={application.id}>
              <span className={`mentorship-status status-${String(application.status || "NEW").toLowerCase()}`}>{humanize(application.status || "NEW")}</span>
              <strong>{text(application.name, "Applicant")}</strong>
              <small>{application.email} · {formatDate(application.created_at)}</small>
              <p>{text(application.primary_goal, "No goal supplied")}</p>
            </button>
          )) : <p className="field-hint">No applications match this view yet.</p>}
        </section>

        <section className="card mentorship-admin-detail">
          {selected ? <>
            <div className="community-admin-heading"><div><span className="eyebrow">Applicant detail</span><h2 className="font-display">{selected.name}</h2></div><UserRound size={18} /></div>
            <div className="mentorship-admin-contact">
              <span>{selected.email}</span><span>{selected.phone}</span><span>{selected.country_code}</span><span>Applied {new Date(selected.created_at).toLocaleString()}</span>
            </div>
            <div className="mentorship-admin-answers">
              <Answer label="Current situation" value={selected.current_situation} />
              <Answer label="AI experience" value={humanize(selected.ai_experience || "")} />
              <Answer label="Weekly time available" value={humanize(selected.weekly_hours || "")} />
              <Answer label="Six-week goal" value={selected.primary_goal} />
              <Answer label="Project, offer, or idea" value={selected.project_idea} />
              <Answer label="Why now" value={selected.motivation} />
              <Answer label="Support needs" value={selected.support_needs} />
            </div>
            <div className="mentorship-admin-review">
              <label><span>Application status</span><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
              <label><span>Private note (optional)</span><textarea className="textarea" rows={4} value={note} maxLength={2000} placeholder="Record a reason, follow-up context, or next-step note. This is never shown to the applicant." onChange={(event) => setNote(event.target.value)} /></label>
              <button type="button" className="btn" disabled={saving || (status === selected.status && !note.trim())} onClick={saveReview}><Save size={15} /> {saving ? "Saving…" : "Save review"}</button>
            </div>
          </> : <p className="field-hint">Choose an application to review its details.</p>}
        </section>
      </div>

      <section className="card mentorship-admin-history">
        <div className="community-admin-heading"><div><span className="eyebrow">Private history</span><h2 className="font-display">Application events</h2></div><FileText size={17} /></div>
        {selected && events.length ? <div className="table-wrap"><table><thead><tr><th>Event</th><th>Status change</th><th>Internal note</th><th>When</th></tr></thead><tbody>{events.map((event: any) => <tr key={event.id}><td><span className="badge">{humanize(event.event_type)}</span></td><td>{event.from_status || "—"}{event.to_status ? ` → ${event.to_status}` : ""}</td><td>{event.note || "—"}</td><td>{new Date(event.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="field-hint">{selected ? "No additional private events are recorded yet." : "Choose an application to view its event history."}</p>}
      </section>
    </div>
  );
}

function Answer({ label, value }: { label: string; value: unknown }) {
  return <div><strong>{label}</strong><p>{text(value, "—")}</p></div>;
}
