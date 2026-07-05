PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=30000000000;
PRAGMA cache_size=-200000;

CREATE INDEX IF NOT EXISTS idx_company_engagement
ON Company(engagementScore DESC);

CREATE INDEX IF NOT EXISTS idx_company_name
ON Company(name);

CREATE INDEX IF NOT EXISTS idx_company_category
ON Company(category);

CREATE INDEX IF NOT EXISTS idx_company_employee
ON Company(employeeRange);

CREATE INDEX IF NOT EXISTS idx_company_region
ON Company(region);

CREATE INDEX IF NOT EXISTS idx_company_filters
ON Company(category, employeeRange, region, engagementScore DESC);

CREATE INDEX IF NOT EXISTS idx_company_engagement_cursor
ON Company(engagementScore DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_company_filters_cursor
ON Company(category, employeeRange, region, engagementScore DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_company_category_engagement_cursor
ON Company(category, engagementScore DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_company_employee_engagement_cursor
ON Company(employeeRange, engagementScore DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_company_region_engagement_cursor
ON Company(region, engagementScore DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_company_name_nocase_cursor
ON Company(name COLLATE NOCASE, id ASC);

ANALYZE Company;
PRAGMA optimize;
