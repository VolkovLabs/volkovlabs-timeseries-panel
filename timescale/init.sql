CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE metrics (
    id integer NOT NULL,
    time timestamp with time zone NOT NULL,
    name text NOT NULL,
    value DOUBLE PRECISION NULL
);

CREATE TABLE metrics2 (
    id integer NOT NULL,
    time timestamp with time zone NOT NULL,
    name text NOT NULL,
    value DOUBLE PRECISION NULL
);

CREATE TABLE controls (
    id integer NOT NULL,
    time timestamp with time zone NOT NULL,
    name text NOT NULL,
    value DOUBLE PRECISION NULL
);

CREATE TABLE config (
    id integer NOT NULL,
    time timestamp with time zone NOT NULL,
    name text NOT NULL,
    max DOUBLE PRECISION NULL,
    min DOUBLE PRECISION NULL
);

CREATE TABLE scales (
    well text NULL,
    user_id integer NOT NULL,
    dashboard_id text NOT NULL,
    metric text NOT NULL,
    min DOUBLE PRECISION NULL,
    max DOUBLE PRECISION NULL,
    description text NOT NULL,
    UNIQUE (well, user_id, dashboard_id, metric)
);

CREATE SEQUENCE seq_metrics START 1;
CREATE SEQUENCE seq_metrics2 START 1;
CREATE SEQUENCE seq_controls START 1;
CREATE SEQUENCE seq_config START 1;

SELECT create_hypertable('metrics','time');
SELECT create_hypertable('metrics2','time');
SELECT create_hypertable('controls','time');
SELECT create_hypertable('config','time');

CREATE INDEX ix_metrics_name_time ON metrics (name, time DESC);
CREATE INDEX ix_metrics2_name_time ON metrics (name, time DESC);
CREATE INDEX ix_controls_name_time ON controls (name, time DESC);
CREATE INDEX ix_config_name_time ON config (name, time DESC);

insert into config values(nextval('seq_config'), now(), 'device1', 100, 0);
insert into config values(nextval('seq_config'), now(), 'device2', 50, 80);
