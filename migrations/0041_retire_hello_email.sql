DO $$
DECLARE
  old_email text := concat('hello', '@', 'petwash.co.il');
  new_email text := 'support@petwash.co.il';
  target record;
  update_sql text;
BEGIN
  FOR target IN
    SELECT table_schema, table_name, column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND is_generated = 'NEVER'
      AND is_updatable = 'YES'
      AND (
        data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
        OR udt_name IN ('text', 'varchar', 'bpchar', 'json', 'jsonb')
      )
  LOOP
    IF target.udt_name IN ('json', 'jsonb') THEN
      update_sql := format(
        'UPDATE %I.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
        target.table_schema,
        target.table_name,
        target.column_name,
        target.column_name,
        old_email,
        new_email,
        target.udt_name,
        target.column_name,
        '%' || old_email || '%'
      );
    ELSE
      update_sql := format(
        'UPDATE %I.%I SET %I = replace(%I::text, %L, %L) WHERE %I::text LIKE %L',
        target.table_schema,
        target.table_name,
        target.column_name,
        target.column_name,
        old_email,
        new_email,
        target.column_name,
        '%' || old_email || '%'
      );
    END IF;

    EXECUTE update_sql;
  END LOOP;
END $$;
