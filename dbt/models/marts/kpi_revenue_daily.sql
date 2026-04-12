{{ config(materialized='table', schema='gold') }}

SELECT
    created_at::date                        AS order_date,
    SUM(amount)                             AS total_revenue,
    COUNT(*)                                AS order_count,
    AVG(amount)                             AS avg_order_value
FROM {{ ref('stg_orders') }}
WHERE created_at IS NOT NULL
GROUP BY created_at::date
ORDER BY order_date
