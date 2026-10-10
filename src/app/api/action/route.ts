import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  administrator,
  identity,
  PREVIEW_ORIGIN,
  serviceClient,
  userClient,
} from "@/lib/supabase/server";
import { checked, enforceMutation, failure, rateLimit } from "@/server/http";
import { checkout, verifyAndFulfill } from "@/server/commerce";
import { Provider, paymentReadiness } from "@/lib/payments/providers";
import { archiveAdmin, saveAdmin } from "@/server/admin";
import { verifyAndRecordRefund } from "@/server/refunds";
import {
  deleteBunnyVideo,
} from "@/server/bunny-stream";
import { reconcileCommunityVideo } from "@/server/community-video-status";
const credential = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});
const uuid = z.uuid();
export async function POST(request: NextRequest) {
  try {
    enforceMutation(request);
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new Error("Send a valid application request.");
    const text = await request.text();
    if (text.length > 1_000_000) throw new Error("That form is too large.");
    const { action, payload = {} } = z
      .object({
        action: z.string().max(50),
        payload: z.record(z.string(), z.any()).optional(),
      })
      .parse(JSON.parse(text));
    rateLimit(
      `${request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"}:${action}`,
      ["login", "register", "contact", "mentorship_application_submit"].includes(action) ? 8 : 40,
    );
    const db = await userClient(),
      origin = process.env.APP_ORIGIN || PREVIEW_ORIGIN;
    let data: any = null,
      message = "Your changes have been saved.";
    if (action === "login") {
      const values = credential.parse(payload),
        response = await db.auth.signInWithPassword(values);
      if (response.error)
        throw new Error(
          "We could not sign you in. Check your email, password, and email verification.",
        );
      const session = await identity();
      data = {
        redirect: session.profile.onboarded ? "/dashboard" : "/onboarding",
      };
      message = "You are signed in.";
    } else if (action === "register") {
      const values = credential
        .extend({ name: z.string().trim().min(2).max(100) })
        .parse(payload);
      const response = await db.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: { name: values.name },
        },
      });
      if (response.error) {
        console.error("signup_failed", response.error.code || "unknown");
        if (response.error.code === "email_address_not_authorized")
          throw new Error(
            "The network email sender is not configured for this address yet. Please contact the team; do not keep retrying.",
          );
        if (response.error.code === "over_email_send_rate_limit")
          throw new Error(
            "The email service is temporarily rate-limited. Please wait before requesting another verification email.",
          );
        throw new Error(
          "We could not create your account. Please check your details or contact the team if email delivery is unavailable.",
        );
      }
      data = {
        requires_confirmation: !response.data.session,
        redirect: response.data.session ? "/onboarding" : null,
      };
      message = "Check your email to verify your account before signing in.";
    } else if (action === "logout") {
      const { error } = await db.auth.signOut();
      if (error) throw new Error("Please try signing out again.");
      data = { redirect: "/" };
    } else if (action === "forgot_password") {
      const { error } = await db.auth.resetPasswordForEmail(
        z.email().parse(payload.email),
        { redirectTo: `${origin}/auth/callback?next=/reset-password` },
      );
      if (error)
        throw new Error(
          "We could not send a recovery message right now. Please try later.",
        );
      message =
        "If an account exists, you will receive a password recovery email.";
    } else if (action === "reset_password") {
      await identity();
      const { error } = await db.auth.updateUser({
        password: z.string().min(8).max(128).parse(payload.password),
      });
      if (error)
        throw new Error(
          "We could not update your password. Request a new recovery link.",
        );
      data = { redirect: "/dashboard" };
    } else if (action === "contact") {
      if (payload.website)
        return NextResponse.json({
          ok: true,
          message: "Your message has been received.",
        });
      const values = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.email().max(320),
          message: z.string().trim().min(10).max(5000),
        })
        .parse(payload);
      checked(await serviceClient().from("contact_messages").insert(values));
      message = "Your message has been sent to the network team.";
    } else if (action === "mentorship_application_submit") {
      if (payload.website)
        return NextResponse.json({
          ok: true,
          message: "Your application has been received.",
        });
      const values = z
        .object({
          name: z.string().trim().min(2).max(120),
          email: z.email().max(320),
          phone: z
            .string()
            .trim()
            .min(7)
            .max(40)
            .regex(/^[0-9+().\-\s]+$/, "Enter a valid phone number."),
          country_code: z
            .string()
            .trim()
            .regex(/^[A-Za-z]{2}$/, "Choose a country.")
            .transform((value) => value.toUpperCase()),
          current_situation: z.string().trim().min(30).max(2400),
          ai_experience: z.enum(["BEGINNER", "FOUNDATIONAL", "PRACTICAL", "ADVANCED"]),
          primary_goal: z.string().trim().min(10).max(2000),
          project_idea: z.string().trim().min(10).max(2400),
          weekly_hours: z.enum(["UNDER_5", "FIVE_TO_TEN", "TEN_TO_FIFTEEN", "FIFTEEN_PLUS"]),
          motivation: z.string().trim().min(30).max(2400),
          support_needs: z.string().trim().min(2).max(1200),
          consent: z.literal(true, {
            error: "Confirm that this is an application, not an acceptance or payment request.",
          }),
        })
        .parse(payload);
      const service = serviceClient();
      const country = checked(
        await service
          .from("countries")
          .select("code")
          .eq("code", values.country_code)
          .eq("active", true)
          .maybeSingle(),
      );
      if (!country) throw new Error("Choose an available country.");
      const auth = await db.auth.getUser();
      const application = checked(
        await service
          .from("mentorship_applications")
          .insert({
            user_id: auth.data.user?.id || null,
            name: values.name,
            email: values.email.toLowerCase(),
            phone: values.phone,
            country_code: values.country_code,
            current_situation: values.current_situation,
            ai_experience: values.ai_experience,
            primary_goal: values.primary_goal,
            project_idea: values.project_idea,
            weekly_hours: values.weekly_hours,
            motivation: values.motivation,
            support_needs: values.support_needs,
          })
          .select("id,status")
          .single(),
      );
      checked(
        await service.from("mentorship_application_events").insert({
          application_id: application.id,
          actor_id: auth.data.user?.id || null,
          event_type: "SUBMITTED",
          to_status: "NEW",
        }),
      );
      message =
        "Your application has been received. The team will review it and follow up using the details you provided.";
    } else {
      const session = await identity(),
        { user, profile } = session;
      rateLimit(`user:${user.id}:${action}`, 60);
      if (action === "onboarding") {
        const values = z
          .object({
            name: z.string().trim().min(2).max(100).optional(),
            country_code: z.string().length(2),
            interests: z.array(z.string().max(60)).min(1).max(10),
            experience_level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
          })
          .parse(payload);
        checked(
          await session.db
            .from("countries")
            .select("code")
            .eq("code", values.country_code)
            .eq("active", true)
            .single(),
        );
        data = checked(
          await session.db
            .from("profiles")
            .update({ ...values, onboarded: true })
            .eq("id", user.id)
            .select("*")
            .single(),
        );
        message = "Your learning path is ready.";
      } else if (action === "profile") {
        const values = z
          .object({
            name: z.string().trim().min(2).max(100),
            country_code: z.string().length(2),
          })
          .parse(payload);
        checked(
          await session.db
            .from("countries")
            .select("code")
            .eq("code", values.country_code)
            .eq("active", true)
            .single(),
        );
        data = checked(
          await session.db
            .from("profiles")
            .update(values)
            .eq("id", user.id)
            .select("*")
            .single(),
        );
      } else if (action === "enroll")
        data = checked(
          await session.db.rpc("enroll_free", {
            p_course_id: uuid.parse(payload.course_id),
          }),
        );
      else if (action === "complete_lesson")
        data = checked(
          await session.db.rpc("complete_lesson", {
            p_lesson_id: uuid.parse(payload.lesson_id),
          }),
        );
      else if (action === "hold_slot") {
        const availabilityId = uuid.parse(payload.availability_id);
        const holdId = checked(
          await session.db.rpc("hold_slot", {
            p_availability_id: availabilityId,
          }),
        );
        const hold = checked(
          await session.db
            .from("booking_holds")
            .select("id,expires_at,availability_id")
            .eq("id", holdId)
            .single(),
        );
        const slot = checked(
          await session.db
            .from("public_availability")
            .select("package_id")
            .eq("id", availabilityId)
            .single(),
        );
        const pack = checked(
          await session.db
            .from("support_packages")
            .select("price_id")
            .eq("id", slot.package_id)
            .single(),
        );
        const price = checked(
          await session.db
            .from("product_prices")
            .select("currency,country_code,status")
            .eq("id", pack.price_id)
            .single(),
        );
        const providers = checked(
          await serviceClient()
            .from("payment_providers")
            .select("code,name,enabled,countries,currencies,mode")
            .limit(10),
        );
        data = {
          ...hold,
          hold_id: holdId,
          price_id: pack.price_id,
          providers: providers.map((p: any) => ({
            code: p.code,
            name: p.name,
            ready: Boolean(
              p.enabled &&
              p.mode === "TEST" &&
              price.status === "ACTIVE" &&
              (!price.country_code ||
                price.country_code === profile.country_code) &&
              p.countries.includes(profile.country_code) &&
              p.currencies.includes(price.currency) &&
              paymentReadiness().find((r) => r.provider === p.code)?.configured,
            ),
          })),
        };
        message =
          "Your selected time is temporarily held. Payment is required to confirm it.";
      } else if (action === "appointment_cancel")
        data = checked(
          await session.db.rpc("appointment_cancel", {
            p_appointment_id: uuid.parse(payload.appointment_id),
          }),
        );
      else if (action === "appointment_reschedule")
        data = checked(
          await session.db.rpc("appointment_reschedule", {
            p_appointment_id: uuid.parse(payload.appointment_id),
            p_availability_id: uuid.parse(payload.availability_id),
          }),
        );
      else if (action === "cancel_membership")
        data = checked(
          await session.db.rpc("cancel_membership", {
            p_subscription_id: uuid.parse(payload.subscription_id),
          }),
        );
      else if (action === "checkout") data = await checkout(session, payload);
      else if (action === "verify_payment") {
        const ref = z.string().max(100).parse(payload.reference),
          order = checked(
            await session.db
              .from("orders")
              .select("reference,provider,product_id")
              .eq("reference", ref)
              .eq("user_id", user.id)
              .single(),
          );
        const result = await verifyAndFulfill(
          order.provider as Provider,
          ref,
          `reconcile:${ref}`,
        );
        // Tell the return page where the learner should go next.
        const purchased = checked(
          await session.db
            .from("products")
            .select("type")
            .eq("id", order.product_id)
            .maybeSingle(),
        );
        const course =
          purchased?.type === "COURSE"
            ? checked(
                await session.db
                  .from("courses")
                  .select("id,title,slug")
                  .eq("product_id", order.product_id)
                  .maybeSingle(),
              )
            : null;
        data = { ...result, product_type: purchased?.type || null, course };
      } else if (action === "notification_read")
        data = checked(
          await session.db
            .from("notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("id", uuid.parse(payload.id))
            .eq("user_id", user.id)
            .select("id"),
        );
      else if (action === "community_post_create") {
        const access = checked(
          await session.db.rpc("community_access", { p_user_id: user.id }),
        );
        if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
        if (!access.can_post)
          throw new Error(access.posting_reason || "You have reached the community posting limit.");
        const values = z
          .object({
            body: z.string().trim().min(1).max(10000),
            image_path: z.string().trim().max(300).nullable().optional(),
            video_id: uuid.nullable().optional(),
          })
          .parse(payload);
        if (values.body.length > Number(access.limits?.max_post_length || 2000))
          throw new Error("That post is longer than the current community limit.");
        if (
          values.image_path &&
          (!values.image_path.startsWith(`${user.id}/`) ||
            !/^[^/]+\/(?:[a-f0-9-]+)\.(?:jpg|jpeg|png|webp|gif)$/i.test(
              values.image_path,
            ))
        )
          throw new Error("That community image is not owned by your account.");
        if (values.image_path && values.video_id)
          throw new Error("Choose either an image or a video for this post.");
        let video: any = null;
        if (values.video_id) {
          video = checked(
            await serviceClient()
              .from("community_videos")
              .select("id,author_id,status,post_id")
              .eq("id", values.video_id)
              .eq("author_id", user.id)
              .maybeSingle(),
          );
          if (!video || video.status !== "READY" || video.post_id)
            throw new Error("This video is not ready to share yet.");
        }
        data = checked(
          await session.db
            .from("community_posts")
            .insert({
              author_id: user.id,
              body: values.body,
              image_path: values.image_path || null,
            })
            .select("id,body,image_path,created_at")
            .single(),
        );
        if (video) {
          const linked = await serviceClient()
            .from("community_videos")
            .update({ post_id: data.id })
            .eq("id", video.id)
            .eq("author_id", user.id)
            .eq("status", "READY")
            .is("post_id", null)
            .select("id")
            .maybeSingle();
          if (linked.error || !linked.data) {
            await session.db
              .from("community_posts")
              .update({ status: "DELETED" })
              .eq("id", data.id)
              .eq("author_id", user.id);
            throw new Error("This video could not be attached to the post. Please try again.");
          }
        }
        message = "Your post is now in the community.";
      } else if (action === "community_comment_create") {
        const access = checked(
          await session.db.rpc("community_access", { p_user_id: user.id }),
        );
        if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
        if (!access.can_comment)
          throw new Error(access.comment_reason || "You have reached the community comment limit.");
        const values = z
          .object({ post_id: uuid, body: z.string().trim().min(1).max(5000) })
          .parse(payload);
        if (values.body.length > Number(access.limits?.max_comment_length || 1000))
          throw new Error("That comment is longer than the current community limit.");
        data = checked(
          await session.db
            .from("community_comments")
            .insert({
              post_id: values.post_id,
              author_id: user.id,
              body: values.body,
            })
            .select("id,post_id,body,created_at")
            .single(),
        );
        message = "Comment added.";
      } else if (action === "community_react") {
        const access = checked(
          await session.db.rpc("community_access", { p_user_id: user.id }),
        );
        if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
        const postId = uuid.parse(payload.post_id);
        const existing = checked(
          await session.db
            .from("community_reactions")
            .select("post_id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle(),
        );
        if (existing)
          checked(
            await session.db
              .from("community_reactions")
              .delete()
              .eq("post_id", postId)
              .eq("user_id", user.id),
          );
        else
          checked(
            await session.db
              .from("community_reactions")
              .insert({ post_id: postId, user_id: user.id, reaction: "LIKE" }),
          );
        data = { reacted: !existing };
        message = existing ? "Reaction removed." : "Reaction added.";
      } else if (action === "community_post_delete") {
        const postId = uuid.parse(payload.post_id);
        let query = session.db
          .from("community_posts")
          .update({ status: "DELETED" })
          .eq("id", postId);
        if (profile.role !== "ADMIN") query = query.eq("author_id", user.id);
        data = checked(await query.select("id").single());
        const attachedVideo = checked(
          await serviceClient()
            .from("community_videos")
            .select("id,bunny_video_id")
            .eq("post_id", data.id)
            .maybeSingle(),
        );
        if (attachedVideo) {
          await serviceClient()
            .from("community_videos")
            .update({ status: "DELETED", processing_error: "Removed with its community post." })
            .eq("id", attachedVideo.id);
          if (attachedVideo.bunny_video_id)
            try {
              await deleteBunnyVideo(attachedVideo.bunny_video_id);
            } catch (error) {
              console.error("community_video_post_cleanup_failed", attachedVideo.id);
            }
        }
        message = "Your post was removed.";
      } else if (action === "community_report") {
        const access = checked(
          await session.db.rpc("community_access", { p_user_id: user.id }),
        );
        if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
        const values = z
          .object({
            post_id: uuid,
            reason: z.string().trim().min(3).max(500),
          })
          .parse(payload);
        data = checked(
          await session.db
            .from("community_reports")
            .insert({
              post_id: values.post_id,
              reporter_id: user.id,
              reason: values.reason,
            })
            .select("id,status")
            .single(),
        );
        message = "Thank you. The post has been reported for review.";
      } else if (action === "community_media_delete") {
        const path = z
          .string()
          .regex(/^[^/]+\/(?:[a-f0-9-]+)\.(?:jpg|jpeg|png|webp|gif)$/i)
          .parse(payload.path);
        if (!path.startsWith(`${user.id}/`))
          throw new Error("That community image is not owned by your account.");
        data = checked(
          await session.db.storage.from("community-media").remove([path]),
        );
        message = "Unused community image removed.";
      } else if (action === "community_video_finalize") {
        const access = checked(
          await session.db.rpc("community_access", { p_user_id: user.id }),
        );
        if (!access.can_access) throw new Error(access.reason || "PAID_MEMBERSHIP_REQUIRED");
        if (access.limits?.video_enabled === false)
          throw new Error("COMMUNITY_VIDEO_DISABLED");
        const values = z.object({ video_id: uuid }).parse(payload);
        const service = serviceClient();
        const record = checked(
          await service
            .from("community_videos")
            .select("id,author_id,bunny_video_id,status,post_id,created_at,upload_expires_at")
            .eq("id", values.video_id)
            .eq("author_id", user.id)
            .maybeSingle(),
        );
        if (!record || !record.bunny_video_id || record.post_id)
          throw new Error("That community video is not available for processing.");
        if (["DELETED", "EXPIRED", "REJECTED", "HIDDEN"].includes(record.status))
          throw new Error("That community video is no longer available.");
        const reconciled = await reconcileCommunityVideo(record, access.limits || {});
        if (!reconciled) throw new Error("This video was already removed or shared. Refresh the community page.");
        const { bunny_video_id: _providerId, ...publicData } = reconciled;
        data = publicData;
        message = data.status === "READY" ? "Your video is ready to share." :
          data.status === "FAILED" || data.status === "REJECTED" ? data.processing_error :
          "Bunny is preparing your video. We will update the status automatically.";
      } else if (action === "community_video_discard") {
        const values = z.object({ video_id: uuid }).parse(payload);
        const service = serviceClient();
        const record = checked(
          await service
            .from("community_videos")
            .select("id,bunny_video_id,post_id")
            .eq("id", values.video_id)
            .eq("author_id", user.id)
            .maybeSingle(),
        );
        if (!record || record.post_id)
          throw new Error("That community video cannot be removed here.");
        if (record.bunny_video_id)
          try {
            await deleteBunnyVideo(record.bunny_video_id);
          } catch (error) {
            if (!(error instanceof Error) || error.message !== "BUNNY_VIDEO_NOT_FOUND")
              throw error;
          }
        data = checked(
          await service
            .from("community_videos")
            .update({ status: "DELETED", processing_error: "Upload draft removed by member." })
            .eq("id", record.id)
            .select("id,status")
            .single(),
        );
        message = "Video upload removed.";
      }
      else {
        if (profile.role !== "ADMIN") throw new Error("ADMIN_REQUIRED");
        await administrator();
        if (action === "admin_save")
          data = await saveAdmin(session.db, payload);
        else if (action === "admin_delete")
          data = await archiveAdmin(
            session.db,
            z.string().parse(payload.table),
            z.string().max(120).parse(payload.id),
          );
        else if (action === "review_status") {
          const values = z
            .object({
              id: uuid,
              status: z.enum(["PENDING", "UNDER_REVIEW"]),
              reviewer_id: uuid.nullable().optional(),
            })
            .parse(payload);
          data = checked(
            await session.db
              .from("review_submissions")
              .update({
                status: values.status,
                reviewer_id: values.reviewer_id || user.id,
              })
              .eq("id", values.id)
              .select("*")
              .single(),
          );
        } else if (action === "review_feedback") {
          const values = z
            .object({
              submission_id: uuid,
              overall_score: z.coerce.number().min(0).max(100),
              category_scores: z.record(
                z.string(),
                z.coerce.number().min(0).max(100),
              ),
              strengths: z.string().min(1).max(10000),
              improvements: z.string().min(1).max(10000),
              next_steps: z.string().min(1).max(10000),
            })
            .parse(payload);
          data = checked(
            await session.db.rpc("admin_review_feedback", {
              p_submission_id: values.submission_id,
              p_overall_score: values.overall_score,
              p_category_scores: values.category_scores,
              p_strengths: values.strengths,
              p_improvements: values.improvements,
              p_next_steps: values.next_steps,
            }),
          );
        } else if (action === "record_existing_refund") {
          const values = z
            .object({
              provider: z.enum(["PAYSTACK", "KORA"]),
              refund_id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
              order_reference: z.string().regex(/^arn-[a-f0-9-]{36}$/),
            })
            .parse(payload);
          data = await verifyAndRecordRefund(
            values.provider,
            values.refund_id,
            values.order_reference,
          );
        } else if (action === "admin_grant_course") {
          const values = z
            .object({
              user_id: uuid,
              course_id: uuid,
              reason: z.string().trim().min(5).max(500),
              expires_at: z.iso.datetime().nullable().optional(),
            })
            .parse(payload);
          data = checked(
            await session.db.rpc("admin_grant_course", {
              p_user_id: values.user_id,
              p_course_id: values.course_id,
              p_reason: values.reason,
              p_expires_at: values.expires_at || null,
            }),
          );
          message =
            "Course access granted and audited. No payment was created.";
        } else if (action === "admin_credit") {
          const values = z
            .object({
              user_id: uuid,
              quantity: z.coerce
                .number()
                .int()
                .refine(
                  (n) => n !== 0 && Math.abs(n) <= 100,
                  "Enter a non-zero quantity between -100 and 100.",
                ),
              reason: z.string().min(5).max(500),
            })
            .parse(payload);
          data = checked(
            await session.db.rpc("admin_adjust_credit", {
              p_user_id: values.user_id,
              p_quantity: values.quantity,
              p_reason: values.reason,
            }),
          );
        } else if (action === "ai_support_settings_update") {
          const values = z
            .object({
              enabled: z.coerce.boolean(),
              public_enabled: z.coerce.boolean(),
              learner_enabled: z.coerce.boolean(),
              model: z.string().trim().regex(/^[A-Za-z0-9._-]{2,120}$/),
              welcome_message: z.string().trim().min(1).max(500),
              fallback_message: z.string().trim().min(1).max(500),
              system_prompt: z.string().trim().min(50).max(6000),
              max_requests_per_hour: z.coerce.number().int().min(1).max(100),
              max_context_sources: z.coerce.number().int().min(1).max(12),
              max_answer_length: z.coerce.number().int().min(200).max(2000),
            })
            .parse(payload);
          const service = serviceClient();
          data = checked(
            await service
              .from("ai_support_settings")
              .update({ ...values, updated_by: user.id, updated_at: new Date().toISOString() })
              .eq("id", true)
              .select("enabled,public_enabled,learner_enabled,model,welcome_message,fallback_message,system_prompt,max_requests_per_hour,max_context_sources,max_answer_length,updated_at")
              .single(),
          );
          checked(
            await service.from("ai_support_admin_actions").insert({
              actor_id: user.id,
              action: "UPDATE_SETTINGS",
              details: {
                enabled: values.enabled,
                public_enabled: values.public_enabled,
                learner_enabled: values.learner_enabled,
                model: values.model,
              },
            }),
          );
          message = "AI support settings updated.";
        } else if (action === "ai_support_source_save") {
          const values = z
            .object({
              id: uuid.optional(),
              title: z.string().trim().min(2).max(180),
              audience: z.enum(["PUBLIC", "LEARNER", "COURSE"]),
              course_id: uuid.nullable().optional(),
              body: z.string().trim().min(20).max(12000),
              tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
              status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
              sort_order: z.coerce.number().int().min(-10000).max(10000),
            })
            .parse(payload);
          if (values.audience === "COURSE" && !values.course_id)
            throw new Error("Choose a course for a course-specific support source.");
          if (values.audience !== "COURSE" && values.course_id)
            throw new Error("Only course-specific sources can be assigned to a course.");
          const service = serviceClient();
          const record = {
            title: values.title,
            audience: values.audience,
            course_id: values.course_id || null,
            body: values.body,
            tags: values.tags.map((tag) => tag.toLowerCase()),
            status: values.status,
            sort_order: values.sort_order,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          };
          data = values.id
            ? checked(
                await service
                  .from("ai_support_sources")
                  .update(record)
                  .eq("id", values.id)
                  .select("id,title,audience,course_id,body,tags,status,sort_order,updated_at")
                  .single(),
              )
            : checked(
                await service
                  .from("ai_support_sources")
                  .insert({ ...record, created_by: user.id })
                  .select("id,title,audience,course_id,body,tags,status,sort_order,updated_at")
                  .single(),
              );
          checked(
            await service.from("ai_support_admin_actions").insert({
              actor_id: user.id,
              action: values.id ? "UPDATE_SOURCE" : "CREATE_SOURCE",
              source_id: data.id,
              details: { title: data.title, audience: data.audience, status: data.status },
            }),
          );
          message = values.id ? "AI support source updated." : "AI support source created.";
        } else if (action === "ai_support_source_archive") {
          const values = z.object({ id: uuid }).parse(payload);
          const service = serviceClient();
          data = checked(
            await service
              .from("ai_support_sources")
              .update({ status: "ARCHIVED", updated_by: user.id, updated_at: new Date().toISOString() })
              .eq("id", values.id)
              .select("id,title,status")
              .single(),
          );
          checked(
            await service.from("ai_support_admin_actions").insert({
              actor_id: user.id,
              action: "ARCHIVE_SOURCE",
              source_id: data.id,
              details: { title: data.title },
            }),
          );
          message = "AI support source archived.";
        } else if (action === "mentorship_application_update") {
          const values = z
            .object({
              application_id: uuid,
              status: z.enum([
                "NEW",
                "REVIEWING",
                "NEEDS_INFO",
                "ACCEPTED",
                "DECLINED",
                "WITHDRAWN",
              ]),
              note: z.string().trim().max(2000).optional().default(""),
            })
            .parse(payload);
          const service = serviceClient();
          const existing = checked(
            await service
              .from("mentorship_applications")
              .select("id,status")
              .eq("id", values.application_id)
              .single(),
          );
          const changed = existing.status !== values.status;
          if (!changed && !values.note)
            throw new Error("Choose a different status or add a private note.");
          data = checked(
            await service
              .from("mentorship_applications")
              .update({
                status: values.status,
                status_updated_by: user.id,
                status_updated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id)
              .select("id,status,status_updated_at")
              .single(),
          );
          checked(
            await service.from("mentorship_application_events").insert({
              application_id: existing.id,
              actor_id: user.id,
              event_type: changed ? "STATUS_CHANGED" : "NOTE_ADDED",
              from_status: changed ? existing.status : null,
              to_status: changed ? values.status : null,
              note: values.note,
            }),
          );
          message = changed
            ? "Application status updated and recorded. This does not create payment or confirm a place."
            : "Private application note recorded.";
        } else if (action === "community_settings_update") {
          const values = z
            .object({
              enabled: z.coerce.boolean(),
              membership_required: z.coerce.boolean(),
              posts_per_day: z.coerce.number().int().min(0).max(100),
              comments_per_day: z.coerce.number().int().min(0).max(500),
              post_cooldown_seconds: z.coerce.number().int().min(0).max(86400),
              max_active_posts: z.coerce.number().int().min(1).max(500),
              max_post_length: z.coerce.number().int().min(50).max(2000),
              max_comment_length: z.coerce.number().int().min(20).max(1000),
              image_size_mb: z.coerce.number().int().min(1).max(10),
              video_enabled: z.coerce.boolean(),
              video_posts_per_day: z.coerce.number().int().min(0).max(5),
              max_active_videos: z.coerce.number().int().min(1).max(20),
              max_video_upload_mb: z.coerce.number().int().min(25).max(1000),
              max_video_duration_seconds: z.coerce.number().int().min(15).max(600),
            })
            .parse(payload);
          data = checked(
            await serviceClient().rpc("admin_community_moderate", {
              p_actor_id: user.id,
              p_action: "UPDATE_SETTINGS",
              p_reason: "Community settings updated.",
              p_details: values,
            }),
          );
          message = "Community settings updated.";
        } else if (action === "community_member_control") {
          const values = z
            .object({
              user_id: uuid,
              status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
              posting_blocked_until: z.iso.datetime().nullable().optional(),
              reason: z.string().trim().max(500).optional().default(""),
            })
            .parse(payload);
          const moderationAction =
            values.status === "BANNED"
              ? "BAN_MEMBER"
              : values.status === "SUSPENDED"
                ? "SUSPEND_MEMBER"
                : "UNSUSPEND_MEMBER";
          data = checked(
            await serviceClient().rpc("admin_community_moderate", {
              p_actor_id: user.id,
              p_action: moderationAction,
              p_target_user_id: values.user_id,
              p_status: values.status,
              p_reason: values.reason || "",
              p_details: { posting_blocked_until: values.posting_blocked_until || "" },
            }),
          );
          message = values.status === "ACTIVE" ? "Community access restored." : "Community member control updated.";
        } else if (action === "community_post_moderate") {
          const values = z
            .object({
              post_id: uuid,
              status: z.enum(["PUBLISHED", "HIDDEN", "DELETED"]),
              reason: z.string().trim().min(3).max(500),
            })
            .parse(payload);
          if (values.status === "DELETED") {
            const attachedVideo = checked(
              await serviceClient()
                .from("community_videos")
                .select("id,bunny_video_id")
                .eq("post_id", values.post_id)
                .maybeSingle(),
            );
            if (attachedVideo) {
              await serviceClient()
                .from("community_videos")
                .update({ status: "DELETED", processing_error: "Removed with its community post." })
                .eq("id", attachedVideo.id);
              if (attachedVideo.bunny_video_id)
                try {
                  await deleteBunnyVideo(attachedVideo.bunny_video_id);
                } catch (error) {
                  console.error("community_video_admin_post_cleanup_failed", attachedVideo.id);
                }
            }
          }
          data = checked(
            await serviceClient().rpc("admin_community_moderate", {
              p_actor_id: user.id,
              p_action: values.status === "PUBLISHED" ? "RESTORE_POST" : values.status === "HIDDEN" ? "HIDE_POST" : "DELETE_POST",
              p_target_post_id: values.post_id,
              p_status: values.status,
              p_reason: values.reason,
              p_details: { status: values.status },
            }),
          );
          message = "Community post moderation saved.";
        } else if (action === "community_video_moderate") {
          const values = z
            .object({
              video_id: uuid,
              status: z.enum(["READY", "HIDDEN", "DELETED"]),
              reason: z.string().trim().min(3).max(500),
            })
            .parse(payload);
          const service = serviceClient();
          const existing = checked(
            await service
              .from("community_videos")
              .select("id,bunny_video_id")
              .eq("id", values.video_id)
              .single(),
          );
          if (values.status === "DELETED" && existing.bunny_video_id)
            try {
              await deleteBunnyVideo(existing.bunny_video_id);
            } catch (error) {
              if (!(error instanceof Error) || error.message !== "BUNNY_VIDEO_NOT_FOUND")
                throw error;
            }
          data = checked(
            await service.rpc("admin_community_moderate", {
              p_actor_id: user.id,
              p_action: values.status === "READY" ? "RESTORE_VIDEO" : values.status === "HIDDEN" ? "HIDE_VIDEO" : "DELETE_VIDEO",
              p_status: values.status,
              p_reason: values.reason,
              p_details: { video_id: values.video_id, status: values.status },
            }),
          );
          message = values.status === "DELETED" ? "Community video deleted from Bunny Stream and the feed." : "Community video moderation saved.";
        } else if (action === "community_comment_moderate") {
          const values = z
            .object({
              comment_id: uuid,
              status: z.enum(["PUBLISHED", "HIDDEN", "DELETED"]),
              reason: z.string().trim().min(3).max(500),
            })
            .parse(payload);
          data = checked(
            await serviceClient().rpc("admin_community_moderate", {
              p_actor_id: user.id,
              p_action: values.status === "PUBLISHED" ? "RESTORE_COMMENT" : values.status === "HIDDEN" ? "HIDE_COMMENT" : "DELETE_COMMENT",
              p_target_comment_id: values.comment_id,
              p_status: values.status,
              p_reason: values.reason,
              p_details: { status: values.status },
            }),
          );
          message = "Community comment moderation saved.";
        } else if (action === "community_report_resolve") {
          const values = z
            .object({
              report_id: uuid,
              status: z.enum(["REVIEWED", "DISMISSED"]),
              reason: z.string().trim().min(3).max(500),
            })
            .parse(payload);
          const report = checked(
            await serviceClient().rpc("admin_community_moderate", {
              p_actor_id: user.id,
              p_action: "RESOLVE_REPORT",
              p_target_report_id: values.report_id,
              p_status: values.status,
              p_reason: values.reason,
              p_details: { status: values.status },
            }),
          );
          data = report;
          message = "Community report resolved.";
        } else throw new Error("This action is not available.");
      }
    }
    return NextResponse.json(
      { ok: true, data, message },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          ok: false,
          error: error.issues[0]?.message || "Check the form details.",
        },
        { status: 400 },
      );
    return failure(error);
  }
}
