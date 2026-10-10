import { NextRequest, NextResponse } from "next/server";
import { readPublic } from "@/lib/catalog";
import {
  administrator,
  configured,
  identity,
  serviceClient,
} from "@/lib/supabase/server";
import { checked, failure } from "@/server/http";
import { paymentReadiness } from "@/lib/payments/providers";
import { courseContent, enrollmentList } from "@/server/learning";
import { recommendCourses } from "@/server/recommendations";
import { deleteBunnyVideo, signedBunnyEmbedUrl } from "@/server/bunny-stream";
import { reconcileCommunityVideo } from "@/server/community-video-status";
export const dynamic = "force-dynamic";
const PUBLIC = new Set([
  "products",
  "courses",
  "membership_plans",
  "countries",
  "currencies",
  "product_prices",
  "settings",
  "support_packages",
  "availability",
  "curriculum",
  "ai_support_status",
]);
const ADMIN_TABLES = new Set([
  "profiles",
  "products",
  "product_prices",
  "courses",
  "course_modules",
  "lessons",
  "course_resources",
  "enrollments",
  "membership_plans",
  "subscriptions",
  "review_submissions",
  "review_feedback",
  "review_credit_grants",
  "support_packages",
  "availability",
  "appointments",
  "ai_drops",
  "events",
  "event_private_links",
      "announcements",
      "community_reports",
      "payments",
  "payment_refunds",
  "orders",
  "business_settings",
  "countries",
  "currencies",
  "payment_providers",
  "audit_logs",
  "contact_messages",
  "notifications",
  "points_rules",
  "points_transactions",
  "badges",
  "user_badges",
  "review_categories",
  "project_categories",
  "review_scoring_criteria",
]);
export async function GET(request: NextRequest) {
  const filters = Object.fromEntries(request.nextUrl.searchParams);
  const resource = filters.resource || "courses";
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (PUBLIC.has(resource))
      return NextResponse.json(await readPublic(resource, filters), {
        headers,
      });
    if (resource === "payment_readiness") {
      const providers = await readiness(filters.country_code);
      return NextResponse.json(
        { data: { providers }, configured: configured() },
        { headers },
      );
    }
    if (resource === "admin") {
      const { db } = await administrator();
      const table = filters.table || "courses";
      if (!ADMIN_TABLES.has(table))
        throw new Error("This management area is unavailable.");
      const page = Math.max(0, Math.min(1000, Number(filters.page) || 0));
      let query = db.from(table).select("*", { count: "exact" });
      const key =
        table === "business_settings"
          ? "key"
          : ["countries", "currencies", "payment_providers"].includes(table)
            ? "code"
            : ["review_categories", "project_categories"].includes(table)
              ? "category"
              : "id";
      if (filters.id) query = query.eq(key, filters.id);
      if (filters.course_id && table === "course_modules")
        query = query.eq("course_id", filters.course_id);
      if (filters.module_id && table === "lessons")
        query = query.eq("module_id", filters.module_id);
      if (
        filters.user_id &&
        [
          "enrollments",
          "orders",
          "subscriptions",
          "review_submissions",
          "appointments",
          "points_transactions",
          "payments",
          "review_credit_grants",
          "user_badges",
        ].includes(table)
      )
        query = query.eq("user_id", filters.user_id);
      if (filters.category && table === "business_settings")
        query = query.eq("category", filters.category);
      if (filters.search) {
        const field = [
          "profiles",
          "products",
          "membership_plans",
          "support_packages",
          "countries",
          "currencies",
        ].includes(table)
          ? "name"
          : [
                "courses",
                "lessons",
                "course_modules",
                "ai_drops",
                "events",
                "announcements",
              ].includes(table)
            ? "title"
            : table === "business_settings"
              ? "key"
              : null;
        if (field)
          query = query.ilike(
            field,
            `%${filters.search.replace(/[%_]/g, "")}%`,
          );
      }
      const result = await query.order(key).range(page * 50, page * 50 + 49);
      let rows = checked(result) || [];
      if (table === "events" && rows.length) {
        const links = checked(
          await db
            .from("event_private_links")
            .select("*")
            .in(
              "event_id",
              rows.map((r: any) => r.id),
            )
            .limit(50),
        );
        rows = rows.map((r: any) => ({
          ...r,
          meeting_url:
            links.find((l: any) => l.event_id === r.id)?.meeting_url || "",
        }));
      }
      return NextResponse.json(
        { data: rows, count: result.count, configured: true },
        { headers },
      );
    }
    if (resource === "admin_mentorship") {
      await administrator();
      const service = serviceClient();
      const [applications, events] = await Promise.all([
        service
          .from("mentorship_applications")
          .select("id,user_id,name,email,phone,country_code,current_situation,ai_experience,primary_goal,project_idea,weekly_hours,motivation,support_needs,status,status_updated_at,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(250),
        service
          .from("mentorship_application_events")
          .select("id,application_id,actor_id,event_type,from_status,to_status,note,created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      return NextResponse.json(
        {
          data: {
            applications: checked(applications) || [],
            events: checked(events) || [],
          },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "admin_ai_support") {
      await administrator();
      const service = serviceClient();
      const search = String(filters.search || "").replace(/[%_]/g, "").trim();
      let sourceQuery = service
        .from("ai_support_sources")
        .select("id,title,audience,course_id,body,tags,status,sort_order,created_at,updated_at")
        .order("status")
        .order("sort_order")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (search) sourceQuery = sourceQuery.ilike("title", `%${search}%`);
      const [settings, sources, courses, conversations, actions] = await Promise.all([
        service
          .from("ai_support_settings")
          .select("enabled,public_enabled,learner_enabled,model,welcome_message,fallback_message,system_prompt,max_requests_per_hour,max_context_sources,max_answer_length,updated_at")
          .eq("id", true)
          .single(),
        sourceQuery,
        service
          .from("courses")
          .select("id,title,status")
          .order("title")
          .limit(200),
        service
          .from("ai_support_conversations")
          .select("id,user_id,visitor_id,audience,model,created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        service
          .from("ai_support_admin_actions")
          .select("id,action,actor_id,source_id,details,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const conversationRows = checked(conversations) || [];
      const conversationIds = conversationRows.map((row: any) => row.id);
      const userIds = Array.from(
        new Set(conversationRows.map((row: any) => row.user_id).filter(Boolean)),
      );
      const [messages, profiles] = await Promise.all([
        conversationIds.length
          ? service
              .from("ai_support_messages")
              .select("id,conversation_id,role,content,source_refs,model,created_at")
              .in("conversation_id", conversationIds)
              .order("created_at")
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
        userIds.length
          ? service.from("profiles").select("id,name,email").in("id", userIds).limit(100)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const messagesByConversation = new Map<string, any[]>();
      for (const message of checked(messages) || []) {
        const list = messagesByConversation.get(message.conversation_id) || [];
        list.push(message);
        messagesByConversation.set(message.conversation_id, list);
      }
      const profileMap = new Map(
        (checked(profiles) || []).map((profile: any) => [profile.id, profile]),
      );
      return NextResponse.json(
        {
          data: {
            settings: checked(settings) || null,
            sources: checked(sources) || [],
            courses: checked(courses) || [],
            conversations: conversationRows.map((conversation: any) => ({
              ...conversation,
              profile: profileMap.get(conversation.user_id) || null,
              messages: messagesByConversation.get(conversation.id) || [],
            })),
            actions: checked(actions) || [],
          },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "admin_community") {
      await administrator();
      const service = serviceClient();
      const abandoned = checked(
        await service
          .from("community_videos")
          .select("id,bunny_video_id")
          .is("post_id", null)
          .in("status", ["RESERVED", "UPLOAD_CREATED", "UPLOADED", "PROCESSING", "READY"])
          .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(50),
      ) || [];
      for (const video of abandoned) {
        if (video.bunny_video_id)
          try {
            await deleteBunnyVideo(video.bunny_video_id);
          } catch (error) {
            console.error("community_video_admin_cleanup_failed", video.id);
            continue;
          }
        await service
          .from("community_videos")
          .update({ status: "DELETED", processing_error: "Unattached upload draft expired." })
          .eq("id", video.id);
      }
      const search = String(filters.search || "").replace(/[%_]/g, "").trim();
      let memberQuery = service
        .from("profiles")
        .select("id,name,email,status,role,created_at")
        .neq("role", "ADMIN")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search) memberQuery = memberQuery.ilike("name", `%${search}%`);
      const [settings, members, controls, subscriptions, reports, posts, comments, videos, actions] =
        await Promise.all([
          service.from("community_settings").select("*").eq("id", true).single(),
          memberQuery,
          service.from("community_member_controls").select("*").limit(500),
          service.from("subscriptions").select("user_id,status,period_end").limit(500),
          service.from("community_reports").select("id,post_id,reporter_id,reason,status,created_at").order("created_at", { ascending: false }).limit(50),
          service.from("community_posts").select("id,author_id,body,status,created_at,updated_at").order("created_at", { ascending: false }).limit(50),
          service.from("community_comments").select("id,post_id,author_id,body,status,created_at").order("created_at", { ascending: false }).limit(100),
          service.from("community_videos").select("id,post_id,author_id,source_filename,status,duration_seconds,storage_size_bytes,processing_error,created_at,updated_at").order("created_at", { ascending: false }).limit(50),
          service.from("community_moderation_actions").select("id,action,actor_id,target_user_id,target_post_id,target_comment_id,target_report_id,target_video_id,reason,created_at").order("created_at", { ascending: false }).limit(50),
        ]);
      const memberRows = checked(members) || [];
      const controlRows = checked(controls) || [];
      const subscriptionRows = checked(subscriptions) || [];
      const controlMap = new Map(controlRows.map((row: any) => [row.user_id, row]));
      const memberMap = new Map(memberRows.map((row: any) => [row.id, row]));
      const subscriptionMap = new Map(
        subscriptionRows.map((row: any) => [row.user_id, row]),
      );
      const reportRows = checked(reports) || [];
      const postRows = checked(posts) || [];
      const reportProfileIds = Array.from(new Set(reportRows.map((row: any) => row.reporter_id)));
      const reportPostIds = Array.from(new Set(reportRows.map((row: any) => row.post_id)));
      const reportProfiles = reportProfileIds.length
        ? checked(await service.from("profiles").select("id,name,email").in("id", reportProfileIds).limit(100)) || []
        : [];
      const reportPosts = reportPostIds.length
        ? checked(await service.from("community_posts").select("id,body,status").in("id", reportPostIds).limit(100)) || []
        : [];
      const profileMap = new Map(reportProfiles.map((row: any) => [row.id, row]));
      const postMap = new Map(reportPosts.map((row: any) => [row.id, row]));
      return NextResponse.json(
        {
          data: {
            settings: checked(settings) || null,
            members: memberRows.map((member: any) => ({
              ...member,
              control: controlMap.get(member.id) || { status: "ACTIVE" },
              membership: subscriptionMap.get(member.id) || null,
            })),
            reports: reportRows.map((report: any) => ({
              ...report,
              reporter: profileMap.get(report.reporter_id) || { name: "Member" },
              post: postMap.get(report.post_id) || null,
            })),
            posts: postRows,
            comments: checked(comments) || [],
            videos: (checked(videos) || []).map((video: any) => ({
              ...video,
              author: memberMap.get(video.author_id) || { name: "Member" },
            })),
            actions: checked(actions) || [],
          },
          configured: true,
        },
        { headers },
      );
    }
    const { db, user, profile } = await identity();
    if (resource === "me")
      return NextResponse.json(
        {
          data: {
            user: { id: user.id, email: user.email },
            profile,
            memberActive: checked(
              await db.rpc("has_membership", { p_user_id: user.id }),
            ),
          },
          configured: true,
        },
        { headers },
      );
    if (resource === "review_configuration") {
      const [projects, categories, criteria, settings] = await Promise.all([
        db
          .from("project_categories")
          .select("category,label,sort_order")
          .eq("active", true)
          .order("sort_order")
          .limit(100),
        db
          .from("review_categories")
          .select("category,label,sort_order")
          .eq("active", true)
          .order("sort_order")
          .limit(100),
        db
          .from("review_scoring_criteria")
          .select("category,criterion_key,label,max_score")
          .eq("active", true)
          .limit(200),
        db
          .from("business_settings")
          .select("key,value,type,unit")
          .eq("active", true)
          .eq("is_public", true)
          .limit(100),
      ]);
      return NextResponse.json(
        {
          data: {
            project_categories: checked(projects),
            review_categories: checked(categories),
            scoring_criteria: checked(criteria),
            settings: checked(settings),
          },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "community_access") {
      const [access, communityEnabled] = await Promise.all([
        db.rpc("community_access", { p_user_id: user.id }),
        db.rpc("community_is_enabled"),
      ]);
      const accessSnapshot = checked(access);
      const enabled = checked(communityEnabled);
      let whatsapp = null;
      if (accessSnapshot.can_access || profile.role === "ADMIN") {
        const result = await serviceClient()
          .from("business_settings")
          .select("value")
          .eq("key", "community.whatsapp_url")
          .eq("active", true)
          .maybeSingle();
        whatsapp = result.data?.value || null;
      }
      return NextResponse.json(
        {
          data: { ...accessSnapshot, community_enabled: enabled !== false, whatsapp_url: whatsapp },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "community_feed") {
      const access = checked(
        await db.rpc("community_access", { p_user_id: user.id }),
      );
      if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
      const page = Math.max(0, Math.min(1000, Number(filters.page) || 0));
      const posts = checked(
        await db
          .from("community_posts")
          .select("id,author_id,body,image_path,created_at,updated_at")
          .eq("status", "PUBLISHED")
          .order("created_at", { ascending: false })
          .range(page * 20, page * 20 + 19),
      ) || [];
      if (!posts.length)
        return NextResponse.json(
          { data: { posts: [], page, has_more: false }, configured: true },
          { headers },
        );
      const postIds = posts.map((post: any) => post.id),
        commentRows = checked(
          await db
            .from("community_comments")
            .select("id,post_id,author_id,body,created_at")
            .in("post_id", postIds)
            .eq("status", "PUBLISHED")
            .order("created_at")
            .limit(500),
        ) || [],
        reactionRows = checked(
          await db
            .from("community_reactions")
            .select("post_id,user_id")
            .in("post_id", postIds)
            .limit(5000),
        ) || [],
        videoRows = checked(
          await serviceClient()
            .from("community_videos")
            .select("id,post_id,bunny_video_id,status,duration_seconds")
            .in("post_id", postIds)
            .eq("status", "READY")
            .limit(100),
        ) || [],
        authorIds = Array.from(
          new Set(
            [...posts, ...commentRows].map((row: any) => row.author_id),
          ),
        );
      let authors: any[] = [];
      if (process.env.SUPABASE_SERVICE_ROLE_KEY)
        authors = checked(
          await serviceClient()
            .from("profiles")
            .select("id,name,avatar_url")
            .in("id", authorIds)
            .limit(100),
        ) || [];
      const authorMap = new Map(authors.map((author: any) => [author.id, author]));
      const videoByPost = new Map<string, any>(
        videoRows.map((video: any) => [video.post_id, video]),
      );
      const commentsByPost = new Map<string, any[]>();
      for (const comment of commentRows) {
        const list = commentsByPost.get(comment.post_id) || [];
        list.push({
          ...comment,
          author: authorMap.get(comment.author_id) || { name: "Member" },
        });
        commentsByPost.set(comment.post_id, list);
      }
      const rows = await Promise.all(
        posts.map(async (post: any) => {
          const signed = post.image_path
            ? await db.storage
                .from("community-media")
                .createSignedUrl(post.image_path, 3600)
            : null;
          const reactions = reactionRows.filter(
            (reaction: any) => reaction.post_id === post.id,
          );
          const video = videoByPost.get(post.id);
          let videoUrl: string | null = null;
          if (video?.bunny_video_id)
            try {
              videoUrl = signedBunnyEmbedUrl(video.bunny_video_id);
            } catch (error) {
              console.error("community_video_playback_signature_failed", video.id);
            }
          return {
            ...post,
            image_url: signed?.data?.signedUrl || null,
            video: videoUrl
              ? {
                  id: video.id,
                  url: videoUrl,
                  duration_seconds: video.duration_seconds,
                }
              : null,
            author: authorMap.get(post.author_id) || { name: "Member" },
            is_author: post.author_id === user.id,
            comments: commentsByPost.get(post.id) || [],
            reaction_count: reactions.length,
            reacted: reactions.some((reaction: any) => reaction.user_id === user.id),
          };
        }),
      );
      return NextResponse.json(
        { data: { posts: rows, page, has_more: posts.length === 20 }, configured: true },
        { headers },
      );
    }
    if (resource === "community_video_drafts") {
      const access = checked(
        await db.rpc("community_access", { p_user_id: user.id }),
      );
      if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
      if (access.limits?.video_enabled === false)
        return NextResponse.json({ data: { drafts: [] }, configured: true }, { headers });
      const drafts = checked(
        await serviceClient()
          .from("community_videos")
          .select("id,source_filename,status,bunny_video_id,post_id,upload_expires_at,bunny_status,declared_size_bytes,storage_size_bytes,duration_seconds,processing_error,created_at,updated_at")
          .eq("author_id", user.id)
          .is("post_id", null)
          .in("status", ["UPLOAD_CREATED", "UPLOADED", "PROCESSING", "READY", "FAILED", "REJECTED"])
          .order("created_at", { ascending: false })
          .limit(5),
      ) || [];
      const current = await Promise.all(drafts.map(async (draft: any) => {
        if (!["UPLOAD_CREATED", "UPLOADED", "PROCESSING", "FAILED", "REJECTED"].includes(draft.status) ||
            Date.now() - new Date(draft.updated_at).getTime() < 8_000)
          return draft;
        try {
          return (await reconcileCommunityVideo(draft, access.limits)) || draft;
        } catch (error) {
          console.error("community_video_status_refresh_failed", draft.id);
          return { ...draft, status_check_unavailable: true };
        }
      }));
      return NextResponse.json(
        { data: { drafts: current.map(({ bunny_video_id, post_id, upload_expires_at, ...safe }: any) => ({
          ...safe,
          preview_url: safe.status === "READY" && bunny_video_id ? signedBunnyEmbedUrl(bunny_video_id) : null,
        })) }, configured: true },
        { headers },
      );
    }
    if (["ai_drops", "events", "announcements"].includes(resource)) {
      const access = checked(
        await db.rpc("community_access", { p_user_id: user.id }),
      );
      if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
    }
    if (resource === "marketplace") {
      // One authenticated read for the learner catalogue: published courses,
      // the learner's eligible price per course, and what they already own.
      const country = profile?.country_code || null;
      const [courseRows, enrolledRows, member, currencyRows, countryRow, lessonRows] =
        await Promise.all([
          db
            .from("courses")
            .select(
              "id,title,slug,description,thumbnail_url,instructor,category,level,access_type,featured,estimated_minutes,objectives,prerequisites,product_id,created_at",
            )
            .eq("status", "PUBLISHED")
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(200),
          db.from("enrollments").select("course_id").eq("user_id", user.id).limit(500),
          db.rpc("has_membership", { p_user_id: user.id }),
          db.from("currencies").select("code,minor_units"),
          country
            ? db.from("countries").select("code,currency_code").eq("code", country).eq("active", true).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          db.from("public_curriculum").select("course_id,lesson_id").limit(10000),
        ]);
      const courses = checked(courseRows) || [];
      const productIds = courses.map((c: any) => c.product_id).filter(Boolean);
      const priceRows = productIds.length
        ? checked(
            await db
              .from("product_prices")
              .select("id,product_id,amount,currency,country_code,starts_at,ends_at,sort_order,status")
              .in("product_id", productIds)
              .eq("status", "ACTIVE")
              .limit(1000),
          ) || []
        : [];
      const owned = new Set((checked(enrolledRows) || []).map((e: any) => e.course_id));
      const minorUnits = new Map(
        (checked(currencyRows) || []).map((c: any) => [c.code, c.minor_units]),
      );
      const learnerCurrency = (checked(countryRow) as any)?.currency_code || null;
      const lessons = new Map<string, number>();
      for (const row of checked(lessonRows) || [])
        lessons.set(row.course_id, (lessons.get(row.course_id) || 0) + 1);
      const now = Date.now();
      const eligible = (p: any) =>
        (!p.starts_at || new Date(p.starts_at).getTime() <= now) &&
        (!p.ends_at || new Date(p.ends_at).getTime() > now) &&
        (!p.country_code || p.country_code === country) &&
        (!learnerCurrency || p.currency === learnerCurrency);
      const memberActive = checked(member) === true;
      const items = courses.map((course: any) => {
        const access = String(course.access_type || "").toUpperCase();
        const options = priceRows
          .filter((p: any) => p.product_id === course.product_id && eligible(p))
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || Number(a.amount) - Number(b.amount));
        const price = options[0];
        return {
          ...course,
          access_type: access,
          lesson_count: lessons.get(course.id) || 0,
          owned: owned.has(course.id),
          included: access === "MEMBERSHIP" && memberActive,
          price: price
            ? {
                id: price.id,
                amount: price.amount,
                currency: price.currency,
                minor_units: minorUnits.get(price.currency),
              }
            : null,
        };
      });
      return NextResponse.json(
        {
          data: {
            courses: items,
            country_code: country,
            member_active: memberActive,
          },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "dashboard") {
      const [
        enrollments,
        reviews,
        balance,
        subs,
        apps,
        notes,
        drops,
        events,
        announcements,
        recommendations,
        recognition,
        catalogCourses,
      ] = await Promise.all([
        enrollmentList(db, user.id),
        db
          .from("review_submissions")
          .select("id,title,status,created_at,completed_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        db.rpc("review_balance"),
        db
          .from("subscriptions")
          .select("*,membership_plans(name,benefits,included_reviews)")
          .eq("user_id", user.id)
          .order("period_end", { ascending: false })
          .limit(20),
        db
          .from("appointments")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "CONFIRMED")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(20),
        db
          .from("notifications")
          .select("id,title,body,url,read_at,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
        db
          .from("ai_drops")
          .select(
            "id,title,description,type,url,thumbnail_url,audience,publish_at",
          )
          .eq("status", "PUBLISHED")
          .order("publish_at", { ascending: false })
          .limit(4),
        db
          .from("events")
          .select("id,title,description,starts_at,ends_at,audience,status")
          .eq("status", "PUBLISHED")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(5),
        db
          .from("announcements")
          .select("id,title,description,url,publish_at")
          .eq("status", "PUBLISHED")
          .order("publish_at", { ascending: false })
          .limit(8),
        recommendCourses(
          db,
          process.env.SUPABASE_SERVICE_ROLE_KEY ? serviceClient() : null,
          profile,
        ),
        db.rpc("my_recognition"),
        db
          .from("courses")
          .select(
            "id,title,slug,description,thumbnail_url,category,level,access_type,estimated_minutes,featured",
          )
          .eq("status", "PUBLISHED")
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
      const subscriptions = checked(subs) || [];
      const active = subscriptions.find(
        (s: any) =>
          ["ACTIVE", "EXPIRING", "CANCELLED"].includes(s.status) &&
          new Date(s.period_start) <= new Date() &&
          new Date(s.period_end) > new Date(),
      );
      const membership = active
        ? {
            ...active,
            plan_name:
              active.terms_snapshot?.plan_name || active.membership_plans?.name,
            ends_at: active.period_end,
            benefits:
              active.terms_snapshot?.benefits ||
              active.membership_plans?.benefits,
          }
        : null;
      const reviewRows = checked(reviews) || [],
        reviewBalance = checked(balance),
        enrolledIds = new Set(enrollments.map((e: any) => e.course_id)),
        availableCourses = (checked(catalogCourses) || []).filter(
          (course: any) => !enrolledIds.has(course.id),
        );
      return NextResponse.json(
        {
          data: {
            profile,
            enrollments,
            courses: enrollments.map((e: any) => e.course),
            reviews: reviewRows,
            reviewBalance: Number(reviewBalance.available),
            reviewLimits: reviewBalance.limits,
            membership,
            appointments: checked(apps),
            notifications: checked(notes),
            ai_drops: checked(drops),
            events: checked(events),
            announcements: checked(announcements),
            recommended_courses: recommendations,
            available_courses: availableCourses,
            recognition: [
              {
                name: "Learning points",
                description: `${checked(recognition).points} points earned; recognition, not cash.`,
              },
              ...(checked(recognition).badges || []),
            ],
            stats: {
              coursesCompleted: enrollments.filter((e: any) => e.completed_at)
                .length,
              lessonsCompleted: enrollments.reduce(
                (n: number, e: any) => n + e.completed_lessons,
                0,
              ),
              projectsReviewed: reviewRows.filter(
                (r: any) => r.status === "REVIEWED",
              ).length,
            },
          },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "enrollments")
      return NextResponse.json(
        { data: await enrollmentList(db, user.id), configured: true },
        { headers },
      );
    if (resource === "recognition")
      return NextResponse.json(
        { data: checked(await db.rpc("my_recognition")), configured: true },
        { headers },
      );
    if (resource === "course_access")
      return NextResponse.json(
        {
          data: {
            allowed: checked(
              await db.rpc("can_access_course", {
                p_user_id: user.id,
                p_course_id: filters.course_id,
              }),
            ),
          },
          configured: true,
        },
        { headers },
      );
    if (resource === "lessons") {
      if (!filters.course_id) throw new Error("Choose a course first.");
      const setting = checked(
        await serviceClient()
          .from("business_settings")
          .select("value")
          .eq("key", "storage.signed_url_ttl_seconds")
          .single(),
      );
      return NextResponse.json(
        {
          data: await courseContent(
            db,
            user.id,
            filters.course_id,
            Number(setting.value),
            profile.role === "ADMIN",
          ),
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "reviews") {
      const [rows, balance] = await Promise.all([
        db
          .from("review_submissions")
          .select("*,review_feedback(*)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        db.rpc("review_balance"),
      ]);
      const b = checked(balance);
      return NextResponse.json(
        {
          data: {
            reviews: (checked(rows) || []).map((r: any) => ({
              ...r,
              ...(Array.isArray(r.review_feedback)
                ? r.review_feedback[0]
                : r.review_feedback),
            })),
            reviewBalance: Number(b.available),
            limits: b.limits,
          },
          configured: true,
        },
        { headers },
      );
    }
    if (resource === "review_detail") {
      const review = checked(
        await db
          .from("review_submissions")
          .select("*,review_feedback(*)")
          .eq("id", filters.id)
          .single(),
      );
      const setting = checked(
        await serviceClient()
          .from("business_settings")
          .select("value")
          .eq("key", "storage.signed_url_ttl_seconds")
          .single(),
      );
      const videoUrl =
        review.video_path && !review.video_deleted_at
          ? checked(
              await db.storage
                .from("review-videos")
                .createSignedUrl(review.video_path, Number(setting.value)),
            ).signedUrl
          : null;
      return NextResponse.json(
        { data: { ...review, video_url: videoUrl }, configured: true },
        { headers },
      );
    }
    if (resource === "analytics") {
      if (profile.role !== "ADMIN") throw new Error("ADMIN_REQUIRED");
      const raw = checked(
        await db.rpc("admin_metrics", {
          p_from: filters.from || null,
          p_to: filters.to || null,
        }),
      );
      const revenueByCurrency = Object.fromEntries(
        (raw.revenue_by_currency || []).map((r: any) => [
          r.currency,
          r.amount_minor,
        ]),
      );
      return NextResponse.json(
        {
          data: {
            ...raw,
            users: raw.users_total,
            activeMembers: raw.active_members,
            pendingReviews: raw.pending_reviews,
            upcomingAppointments: raw.upcoming_appointments,
            revenueByCurrency,
          },
          configured: true,
        },
        { headers },
      );
    }
    const tables: Record<string, string> = {
      appointments: "appointments",
      subscriptions: "subscriptions",
      orders: "orders",
      notifications: "notifications",
      ai_drops: "ai_drops",
      events: "events",
      announcements: "announcements",
      lesson_progress: "lesson_progress",
    };
    const table = tables[resource];
    if (!table) throw new Error("This resource is not available.");
    let query = db
      .from(table)
      .select(
        resource === "subscriptions"
          ? "*,membership_plans(name)"
          : resource === "orders"
            ? "*,products(name)"
            : "*",
      );
    if (["ai_drops", "events", "announcements"].includes(resource))
      query = query.eq("status", "PUBLISHED");
    else query = query.eq("user_id", user.id);
    let rows = checked(await query.limit(100)) || [];
    if (resource === "subscriptions")
      rows = rows.map((s: any) => ({
        ...s,
        plan: s.membership_plans,
        plan_name: s.terms_snapshot?.plan_name || s.membership_plans?.name,
        current_period_end: s.period_end,
      }));
    if (resource === "orders")
      rows = rows.map((o: any) => ({ ...o, product: o.products }));
    if (resource === "events" && rows.length) {
      const links = checked(
        await db
          .from("event_private_links")
          .select("event_id,meeting_url")
          .in(
            "event_id",
            rows.map((r: any) => r.id),
          )
          .limit(100),
      );
      rows = rows.map((e: any) => ({
        ...e,
        meeting_url: links.find((l: any) => l.event_id === e.id)?.meeting_url,
      }));
    }
    if (resource === "ai_drops" && rows.some((r: any) => r.resource_path)) {
      const setting = checked(
        await serviceClient()
          .from("business_settings")
          .select("value")
          .eq("key", "storage.signed_url_ttl_seconds")
          .single(),
      );
      rows = await Promise.all(
        rows.map(async (r: any) => {
          if (!r.resource_path) return r;
          const path = r.resource_path.replace(/^ai-drop-media\//, "");
          const signed = checked(
            await db.storage
              .from("ai-drop-media")
              .createSignedUrl(path, Number(setting.value)),
          );
          return {
            ...r,
            url: r.url || signed.signedUrl,
            resource_url: signed.signedUrl,
          };
        }),
      );
    }
    return NextResponse.json({ data: rows, configured: true }, { headers });
  } catch (error) {
    return failure(error);
  }
}
async function readiness(country?: string) {
  const service = serviceClient();
  const records = checked(
    await service
      .from("payment_providers")
      .select("code,name,enabled,countries,currencies,mode")
      .limit(10),
  );
  return paymentReadiness().map((p) => {
    const record = records.find((r: any) => r.code === p.provider);
    return {
      code: p.provider,
      name: record?.name || p.provider,
      ready: Boolean(
        p.configured &&
        record?.enabled &&
        record?.mode === "TEST" &&
        (!country || record.countries.includes(country)),
      ),
      credentialsConfigured: p.configured,
      countries: record?.countries || [],
      currencies: record?.currencies || [],
      mode: record?.mode || "TEST",
      automaticRenewal: false,
    };
  });
}
