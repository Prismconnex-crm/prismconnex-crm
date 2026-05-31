import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// Global count cache to avoid slow SQLite table scans on massive datasets (11M+ rows)
const countCache = new Map<string, { total: number; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Number.parseInt(searchParams.get('limit') || '50', 10) || 50);
    const skip = (page - 1) * limit;

    // Filtering
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');
    const employeeRange = searchParams.get('employeeRange');
    const location = searchParams.get('location');

    // Build where clause
    const where: Prisma.CompanyWhereInput = {};
    
    if (search) {
      where.name = { contains: search };
    }
    
    if (category) {
      where.category = category;
    }
    
    if (employeeRange) {
      where.employeeRange = employeeRange;
    }
    
    if (location) {
      where.region = location;
    }

    // Resolve count from cache or database
    const cacheKey = JSON.stringify(where);
    const cached = countCache.get(cacheKey);
    let total = 0;

    if (cached && cached.expiresAt > Date.now()) {
      total = cached.total;
    } else {
      if (search) {
        // Skip massive table-scan counting when performing text searches
        total = 1000; 
      } else if (category) {
        // Skip exact counting for categories to avoid slow index scans (categories have 500k+ rows)
        // Set an estimated max value so pagination works without the slow COUNT query
        total = 500000;
      } else {
        total = await prisma.company.count({ where });
      }
      countCache.set(cacheKey, { total, expiresAt: Date.now() + CACHE_TTL });
    }

    // Dynamic query options to bypass `orderBy` full-table sorts during search
    const queryOptions: Prisma.CompanyFindManyArgs = {
      where,
      skip,
      take: limit,
    };

    if (!search) {
      queryOptions.orderBy = { engagementScore: 'desc' };
    }

    // Fetch paginated companies
    const companies = await prisma.company.findMany(queryOptions);

    // Prisma returns arrays as strings, but frontend expects arrays
    const formattedCompanies = companies.map((c) => ({
      ...c,
      name: c.name.replace(/\s+\d+$/, ''), // Remove unique generation digits from display name
      tags: c.tags ? c.tags.split(',').map((t) => t.trim()) : [],
      highlights: c.highlights ? c.highlights.split(',').map((t) => t.trim()) : [],
      insights: c.insights ? c.insights.split(',').map((t) => t.trim()) : [],
      events: [],
      deals: [],
      activity: []
    }));

    return NextResponse.json({
      companies: formattedCompanies,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}
