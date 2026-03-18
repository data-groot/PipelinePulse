{{ config(schema='silver') }}
SELECT 
    payload->>'order_id' AS order_id,
    payload->>'user_id' AS user_id,
    (payload->>'amount')::numeric AS amount,
    payload->>'status' AS status,
    (payload->>'created_at')::timestamptz AS created_at,
    CURRENT_TIMESTAMP AS dbt_updated_at
FROM bronze.raw_orders
WHERE (payload->>'amount')::numeric > 0 
  AND payload->>'order_id' IS NOT NULL
