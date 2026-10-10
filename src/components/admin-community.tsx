"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Flag, RefreshCw, Save, ShieldAlert, Trash2 } from "lucide-react";
import { getData, postAction, text } from "@/lib/ui";

const initialSettings = {
  enabled: true,
  membership_required: true,
  posts_per_day: 5,
  comments_per_day: 20,
  post_cooldown_seconds: 300,
  max_active_posts: 20,
  max_post_length: 2000,
  max_comment_length: 1000,
  image_size_mb: 10,
  video_enabled: true,
  video_posts_per_day: 1,
  max_active_videos: 3,
  max_video_upload_mb: 250,
  max_video_duration_seconds: 180,
};

export function CommunityControlCenter({ search = "" }: { search?: string }) {
  const [state, setState] = useState<any>({ loading: true });
  const [settings, setSettings] = useState<any>(initialSettings);
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [blockUntil, setBlockUntil] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setState((current: any) => ({ ...current, loading: true, error: undefined }));
    getData("admin_community", search ? { search } : {})
      .then((result) => {
        if (result.error) {
          setState({ loading: false, error: result.error });
          return;
        }
        setState({ loading: false, ...(result.data || {}) });
        setSettings({ ...initialSettings, ...(result.data?.settings || {}) });
      })
      .catch(() => setState({ loading: false, error: "Community operations could not be loaded." }));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function saveSettings() {
    setSaving("settings");
    setNotice("");
    const result = await postAction("community_settings_update", settings);
    setNotice(result.ok ? result.message || "Community settings updated." : result.error);
    if (result.ok) load();
    setSaving("");
  }

  async function controlMember(userId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED", temporaryBlock = false) {
    setSaving(`member:${userId}`);
    setNotice("");
    const result = await postAction("community_member_control", {
      user_id: userId,
      status,
      posting_blocked_until: temporaryBlock && blockUntil[userId] ? new Date(blockUntil[userId]).toISOString() : null,
      reason: reason[userId] || (status === "ACTIVE" ? "Community access restored by administrator." : "Community access changed by administrator."),
    });
    setNotice(result.ok ? result.message || "Member control updated." : result.error);
    if (result.ok) load();
    setSaving("");
  }

  async function moderatePost(postId: string, status: "PUBLISHED" | "HIDDEN" | "DELETED") {
    setSaving(`post:${postId}`);
    const result = await postAction("community_post_moderate", {
      post_id: postId,
      status,
      reason: "Moderated from the Community Control Center.",
    });
    setNotice(result.ok ? result.message || "Post moderation saved." : result.error);
    if (result.ok) load();
    setSaving("");
  }

  async function moderateComment(commentId: string, status: "PUBLISHED" | "HIDDEN" | "DELETED") {
    setSaving(`comment:${commentId}`);
    const result = await postAction("community_comment_moderate", {
      comment_id: commentId,
      status,
      reason: "Moderated from the Community Control Center.",
    });
    setNotice(result.ok ? result.message || "Comment moderation saved." : result.error);
    if (result.ok) load();
    setSaving("");
  }

  async function moderateVideo(videoId: string, status: "READY" | "HIDDEN" | "DELETED") {
    setSaving(`video:${videoId}`);
    const result = await postAction("community_video_moderate", {
      video_id: videoId,
      status,
      reason: "Moderated from the Community Control Center.",
    });
    setNotice(result.ok ? result.message || "Video moderation saved." : result.error);
    if (result.ok) load();
    setSaving("");
  }

  async function resolveReport(reportId: string, status: "REVIEWED" | "DISMISSED") {
    setSaving(`report:${reportId}`);
    const result = await postAction("community_report_resolve", {
      report_id: reportId,
      status,
      reason: status === "REVIEWED" ? "Report reviewed by administrator." : "Report dismissed by administrator.",
    });
    setNotice(result.ok ? result.message || "Report resolved." : result.error);
    if (result.ok) load();
    setSaving("");
  }

  if (state.loading) return <p className="loading">Loading community controls…</p>;
  if (state.error) return <div className="form-alert" role="alert">{state.error}</div>;
  const members = state.members || [];
  const reports = state.reports || [];
  const posts = state.posts || [];
  const comments = state.comments || [];
  const videos = state.videos || [];
  const actions = state.actions || [];
  const activeReports = reports.filter((report: any) => report.status === "OPEN").length;
  const suspended = members.filter((member: any) => ["SUSPENDED", "BANNED"].includes(member.control?.status)).length;

  return (
    <div className="community-admin-console">
      <div className="community-admin-intro">
        <div>
          <span className="eyebrow">Paid-member operations</span>
          <h2 className="font-display">Keep the community useful and well-managed.</h2>
          <p className="muted">Access, posting limits, moderation, and audit history are enforced on the server—not just in this dashboard.</p>
        </div>
        <button type="button" className="btn btn-outline btn-small" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      {notice && <p className="field-hint" role="status">{notice}</p>}

      <section className="community-admin-stats">
        <div className="card"><span>Members shown</span><strong>{members.length}</strong></div>
        <div className="card"><span>Open reports</span><strong>{activeReports}</strong></div>
        <div className="card"><span>Restricted members</span><strong>{suspended}</strong></div>
        <div className="card"><span>Posts loaded</span><strong>{posts.length}</strong></div>
        <div className="card"><span>Videos loaded</span><strong>{videos.length}</strong></div>
      </section>

      <section className="card community-admin-settings">
        <div className="community-admin-heading"><div><span className="eyebrow">Rules</span><h2 className="font-display">Community settings</h2></div><button type="button" className="btn btn-small" onClick={saveSettings} disabled={saving === "settings"}><Save size={14} /> {saving === "settings" ? "Saving…" : "Save rules"}</button></div>
        <p className="muted community-admin-kill-switch-note">Turn this off to hide the community from learner navigation, the dashboard, public messaging, WhatsApp links, and direct learner pages. The admin control stays available so you can enable it again later.</p>
        <div className="community-settings-grid">
          <label><span>Community visible to members</span><input type="checkbox" checked={Boolean(settings.enabled)} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /></label>
          <label><span>Paid membership required</span><input type="checkbox" checked={Boolean(settings.membership_required)} onChange={(event) => setSettings({ ...settings, membership_required: event.target.checked })} /></label>
          <label><span>Posts per day</span><input type="number" min="0" max="100" value={settings.posts_per_day} onChange={(event) => setSettings({ ...settings, posts_per_day: event.target.value })} /></label>
          <label><span>Comments per day</span><input type="number" min="0" max="500" value={settings.comments_per_day} onChange={(event) => setSettings({ ...settings, comments_per_day: event.target.value })} /></label>
          <label><span>Post cooldown (seconds)</span><input type="number" min="0" max="86400" value={settings.post_cooldown_seconds} onChange={(event) => setSettings({ ...settings, post_cooldown_seconds: event.target.value })} /></label>
          <label><span>Maximum active posts</span><input type="number" min="1" max="500" value={settings.max_active_posts} onChange={(event) => setSettings({ ...settings, max_active_posts: event.target.value })} /></label>
          <label><span>Post length</span><input type="number" min="50" max="2000" value={settings.max_post_length} onChange={(event) => setSettings({ ...settings, max_post_length: event.target.value })} /></label>
          <label><span>Comment length</span><input type="number" min="20" max="1000" value={settings.max_comment_length} onChange={(event) => setSettings({ ...settings, max_comment_length: event.target.value })} /></label>
          <label><span>Image size (MB)</span><input type="number" min="1" max="10" value={settings.image_size_mb} onChange={(event) => setSettings({ ...settings, image_size_mb: event.target.value })} /></label>
          <label><span>Community video enabled</span><input type="checkbox" checked={Boolean(settings.video_enabled)} onChange={(event) => setSettings({ ...settings, video_enabled: event.target.checked })} /></label>
          <label><span>Video uploads per member / day</span><input type="number" min="0" max="5" value={settings.video_posts_per_day} onChange={(event) => setSettings({ ...settings, video_posts_per_day: event.target.value })} /></label>
          <label><span>Maximum active video drafts</span><input type="number" min="1" max="20" value={settings.max_active_videos} onChange={(event) => setSettings({ ...settings, max_active_videos: event.target.value })} /></label>
          <label><span>Video source size (MB)</span><input type="number" min="25" max="1000" value={settings.max_video_upload_mb} onChange={(event) => setSettings({ ...settings, max_video_upload_mb: event.target.value })} /></label>
          <label><span>Video duration (seconds)</span><input type="number" min="15" max="600" value={settings.max_video_duration_seconds} onChange={(event) => setSettings({ ...settings, max_video_duration_seconds: event.target.value })} /></label>
        </div>
      </section>

      <section className="card community-admin-members">
        <div className="community-admin-heading"><div><span className="eyebrow">Member controls</span><h2 className="font-display">Suspend, restore, or ban access.</h2></div><span className="field-hint">Paid membership is checked separately from these controls.</span></div>
        <div className="table-wrap"><table><thead><tr><th>Member</th><th>Membership</th><th>Community state</th><th>Reason / temporary posting block</th><th>Action</th></tr></thead><tbody>{members.map((member: any) => { const status = member.control?.status || "ACTIVE"; return <tr key={member.id}><td><strong>{text(member.name, "Unnamed member")}</strong><small>{member.email}</small></td><td>{member.membership?.status && new Date(member.membership.period_end) > new Date() ? <span className="badge">Paid active</span> : <span className="field-hint">Not active</span>}</td><td><span className={`community-status community-status-${status.toLowerCase()}`}>{status}</span></td><td><input className="input" value={reason[member.id] || ""} onChange={(event) => setReason({ ...reason, [member.id]: event.target.value })} placeholder="Optional reason" /><input className="input community-block-input" type="datetime-local" value={blockUntil[member.id] || ""} onChange={(event) => setBlockUntil({ ...blockUntil, [member.id]: event.target.value })} aria-label={`Posting block expiry for ${member.name || "member"}`} /></td><td><div className="admin-inline-actions"><button type="button" className="btn btn-outline btn-small" onClick={() => controlMember(member.id, "ACTIVE")} disabled={saving === `member:${member.id}`}><Check size={13} /> Restore</button><button type="button" className="btn btn-outline btn-small" onClick={() => controlMember(member.id, status as "ACTIVE" | "SUSPENDED" | "BANNED", true)} disabled={saving === `member:${member.id}`}><ShieldAlert size={13} /> Block posting</button><button type="button" className="btn btn-outline btn-small" onClick={() => controlMember(member.id, "SUSPENDED")} disabled={saving === `member:${member.id}`}><ShieldAlert size={13} /> Suspend</button><button type="button" className="btn btn-outline btn-small is-danger" onClick={() => controlMember(member.id, "BANNED")} disabled={saving === `member:${member.id}`}><Trash2 size={13} /> Ban</button></div></td></tr>; })}</tbody></table></div>
        {!members.length && <p className="field-hint">No non-admin members match this search.</p>}
      </section>

      <section className="community-admin-two-col">
        <section className="card"><div className="community-admin-heading"><div><span className="eyebrow">Reports</span><h2 className="font-display">Moderation queue</h2></div><Flag size={17} /></div>{reports.length ? reports.map((report: any) => <div className="community-admin-item" key={report.id}><div><strong>{text(report.reporter?.name, "Member report")}</strong><p>{report.reason}</p><small>{text(report.post?.body, "Post unavailable").slice(0, 120)}</small></div><div className="admin-inline-actions"><span className="community-status">{report.status}</span>{report.status === "OPEN" && <><button type="button" className="btn btn-outline btn-small" onClick={() => resolveReport(report.id, "REVIEWED")} disabled={saving === `report:${report.id}`}>Review</button><button type="button" className="btn btn-outline btn-small" onClick={() => resolveReport(report.id, "DISMISSED")} disabled={saving === `report:${report.id}`}>Dismiss</button></>}</div></div>) : <p className="field-hint">No reports yet.</p>}</section>
        <section className="card"><div className="community-admin-heading"><div><span className="eyebrow">Posts</span><h2 className="font-display">Recent content</h2></div></div>{posts.length ? posts.slice(0, 10).map((post: any) => <div className="community-admin-item" key={post.id}><div><strong>{text(post.body, "Image post").slice(0, 110)}</strong><small>{post.status} · {new Date(post.created_at).toLocaleString()}</small></div><div className="admin-inline-actions">{post.status !== "PUBLISHED" && <button type="button" className="btn btn-outline btn-small" onClick={() => moderatePost(post.id, "PUBLISHED")}>Restore</button>}{post.status === "PUBLISHED" && <button type="button" className="btn btn-outline btn-small" onClick={() => moderatePost(post.id, "HIDDEN")} disabled={saving === `post:${post.id}`}>Hide</button>}<button type="button" className="btn btn-outline btn-small is-danger" onClick={() => moderatePost(post.id, "DELETED")} disabled={saving === `post:${post.id}`}>Delete</button></div></div>) : <p className="field-hint">No posts yet.</p>}</section>
      </section>

      <section className="card"><div className="community-admin-heading"><div><span className="eyebrow">Comments</span><h2 className="font-display">Recent comments</h2></div></div>{comments.length ? comments.slice(0, 12).map((comment: any) => <div className="community-admin-item" key={comment.id}><div><strong>{text(comment.body, "Comment").slice(0, 140)}</strong><small>{comment.status} · {new Date(comment.created_at).toLocaleString()}</small></div><div className="admin-inline-actions">{comment.status !== "PUBLISHED" && <button type="button" className="btn btn-outline btn-small" onClick={() => moderateComment(comment.id, "PUBLISHED")}>Restore</button>}{comment.status === "PUBLISHED" && <button type="button" className="btn btn-outline btn-small" onClick={() => moderateComment(comment.id, "HIDDEN")} disabled={saving === `comment:${comment.id}`}>Hide</button>}<button type="button" className="btn btn-outline btn-small is-danger" onClick={() => moderateComment(comment.id, "DELETED")} disabled={saving === `comment:${comment.id}`}>Delete</button></div></div>) : <p className="field-hint">No comments yet.</p>}</section>

      <section className="card"><div className="community-admin-heading"><div><span className="eyebrow">Bunny Stream</span><h2 className="font-display">Recent video uploads</h2></div><span className="field-hint">Hidden videos lose feed playback. Delete removes the Bunny asset.</span></div>{videos.length ? videos.map((video: any) => <div className="community-admin-item" key={video.id}><div><strong>{text(video.source_filename, "Community video")}</strong><p>{text(video.author?.name, "Member")} · {video.duration_seconds ? `${video.duration_seconds}s` : "Processing"}{video.storage_size_bytes ? ` · ${(video.storage_size_bytes / 1024 / 1024).toFixed(1)} MB` : ""}</p>{video.processing_error && <small>{video.processing_error}</small>}</div><div className="admin-inline-actions"><span className="community-status">{video.status}</span>{video.status === "HIDDEN" && <button type="button" className="btn btn-outline btn-small" onClick={() => moderateVideo(video.id, "READY")} disabled={saving === `video:${video.id}`}>Restore</button>}{["READY", "UPLOAD_CREATED", "UPLOADED", "PROCESSING"].includes(video.status) && <button type="button" className="btn btn-outline btn-small" onClick={() => moderateVideo(video.id, "HIDDEN")} disabled={saving === `video:${video.id}`}>Hide</button>}<button type="button" className="btn btn-outline btn-small is-danger" onClick={() => moderateVideo(video.id, "DELETED")} disabled={saving === `video:${video.id}`}><Trash2 size={13} /> Delete</button></div></div>) : <p className="field-hint">No Bunny video uploads yet.</p>}</section>

      <section className="card"><div className="community-admin-heading"><div><span className="eyebrow">Audit trail</span><h2 className="font-display">Recent moderation actions</h2></div></div>{actions.length ? <div className="table-wrap"><table><thead><tr><th>Action</th><th>Target</th><th>Reason</th><th>When</th></tr></thead><tbody>{actions.map((action: any) => <tr key={action.id}><td><span className="badge">{action.action}</span></td><td>{action.target_user_id || action.target_post_id || action.target_comment_id || action.target_report_id || action.target_video_id || "Settings"}</td><td>{action.reason}</td><td>{new Date(action.created_at).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="field-hint">No moderation actions recorded yet.</p>}</section>
    </div>
  );
}
