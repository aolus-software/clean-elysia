-- User Activities Table
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID DEFAULT generateUUIDv4(),
    user_id String,
    action String,
    resource String,
    timestamp DateTime64(3) DEFAULT now64(),
    ip_address String,
    user_agent String,
    metadata Map(String, String)
) ENGINE = MergeTree()
ORDER BY (user_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 1 YEAR;

-- Auth Events Table
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID DEFAULT generateUUIDv4(),
    user_id String,
    event_type Enum('login' = 1, 'logout' = 2, 'failed_login' = 3, 'password_change' = 4),
    timestamp DateTime64(3) DEFAULT now64(),
    ip_address String,
    country String,
    success Boolean,
    failure_reason String
) ENGINE = MergeTree()
ORDER BY (user_id, timestamp)
TTL toDateTime(timestamp) + INTERVAL 2 YEAR;

-- Permission Usage Table
CREATE TABLE IF NOT EXISTS permission_usage (
    id UUID DEFAULT generateUUIDv4(),
    user_id String,
    permission_name String,
    resource_id String,
    timestamp DateTime64(3) DEFAULT now64(),
    execution_time_ms UInt32
) ENGINE = MergeTree()
ORDER BY (permission_name, timestamp)
TTL toDateTime(timestamp) + INTERVAL 6 MONTH;

-- Materialized views for analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_user_activities
ENGINE = SummingMergeTree()
ORDER BY (date, user_id, action)
AS SELECT
    toDate(timestamp) as date,
    user_id,
    action,
    count() as activity_count
FROM user_activities
GROUP BY date, user_id, action;

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_auth_stats
ENGINE = SummingMergeTree()
ORDER BY (hour, event_type)
AS SELECT
    toStartOfHour(timestamp) as hour,
    event_type,
    countIf(success = true) as successful_count,
    countIf(success = false) as failed_count
FROM auth_events
GROUP BY hour, event_type;