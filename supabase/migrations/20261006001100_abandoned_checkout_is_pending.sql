begin;
do $$ declare source text; begin
 source:=pg_get_functiondef('public.record_payment_failure(uuid,text,text,text)'::regprocedure);
 execute replace(source,'when ''abandoned'' then ''CANCELLED''','when ''canceled'' then ''CANCELLED''');
end $$;
commit;
