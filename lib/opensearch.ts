/**
 * OpenSearch Client
 * 
 * Provides a singleton OpenSearch client for the application.
 * When OPENSEARCH_URL is not set, the search API falls back to 
 * an in-memory SQLite-backed prefix search engine.
 */

import { Client } from "@opensearch-project/opensearch";

let _client: Client | null = null;

export function getOpenSearchClient(): Client | null {
  const url = process.env.OPENSEARCH_URL;
  if (!url) return null;

  if (!_client) {
    const auth = process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD
      ? {
          username: process.env.OPENSEARCH_USERNAME,
          password: process.env.OPENSEARCH_PASSWORD,
        }
      : undefined;

    _client = new Client({
      node: url,
      auth,
      ssl: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    });
  }

  return _client;
}

export const COMPANIES_INDEX = "companies_v1";

/**
 * Check if OpenSearch is available and configured
 */
export function isOpenSearchEnabled(): boolean {
  return !!process.env.OPENSEARCH_URL;
}
