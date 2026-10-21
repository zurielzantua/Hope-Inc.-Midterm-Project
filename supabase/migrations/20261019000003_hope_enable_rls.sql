-- S1-DBA-02: turn on Row Level Security for every HOPE table (repo rule: RLS on all tables).
-- With RLS on and no policies, the public API (anon/authenticated keys) can read and write nothing.
-- That is the safe default. Role-based policies are added with the app_user/rights migration (S1-DBA-03).
ALTER TABLE employee    ENABLE ROW LEVEL SECURITY;
ALTER TABLE department  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobhistory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salesdetail ENABLE ROW LEVEL SECURITY;
ALTER TABLE product     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricehist   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;
