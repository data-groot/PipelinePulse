
WITH deduped AS (
    SELECT 
        payload->>'user_id' AS user_id,
        payload->>'country' AS country,
        payload->>'plan' AS plan,
        (payload->>'created_at')::timestamptz AS created_at,
        ROW_NUMBER() OVER(PARTITION BY payload->>'user_id' ORDER BY ingested_at DESC) as rn
    FROM bronze.raw_users
)
SELECT 
    user_id,
    country,
    plan,
    created_at,
    CURRENT_TIMESTAMP AS dbt_updated_at
FROM deduped
WHERE rn = 1