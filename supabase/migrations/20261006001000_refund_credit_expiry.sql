begin;
do $$ declare source text; begin
 source:=pg_get_functiondef('public.record_verified_refund(uuid,text,text,bigint,text)'::regprocedure);
 if strpos(source,'update public.review_credit_grants set quantity=consumed where order_id=o.id;')=0 then raise exception 'Refund definition changed; review the forward correction'; end if;
 execute replace(source,'update public.review_credit_grants set quantity=consumed where order_id=o.id;','update public.review_credit_grants set expires_at=now(),period_start=null,reason=left(reason||'' [Full refund: unused allowance expired; original terms retained in subscription/audit history.]'',500) where order_id=o.id;');
end $$;
commit;
