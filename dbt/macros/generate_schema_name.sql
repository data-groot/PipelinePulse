-- generate_schema_name.sql
-- Override dbt's default behaviour of prefixing the profile schema onto every
-- custom schema name (e.g. "public_silver").  Instead, use the custom schema
-- exactly as declared in the model's config block (e.g. "silver").
-- When no custom schema is declared, fall back to the profile target schema
-- ("public") so staging/marts separation still works correctly.

{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is not none -%}
        {{ custom_schema_name | trim }}
    {%- else -%}
        {{ target.schema | trim }}
    {%- endif -%}
{%- endmacro %}
