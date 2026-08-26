"use client";

import { useMemo } from 'react';
import { findShowEvents } from '@/lib/find-shows/catalog';
import { EventDetailView } from '@/components/events/event-detail-view';
import { EventListView } from '@/components/events/event-list-view';
import type { WorkspacePreferences } from '@/types';

interface EventsSectionProps {
    eventId?: string;
    preferences?: WorkspacePreferences;
    mode?: 'all' | 'target';
}

/**
 * Routes between the catalog list and a single event's detail view. Each view
 * lives in its own file under components/events/.
 */
export function EventsSection({ eventId, mode = 'all' }: EventsSectionProps) {
    // Look up active event in the full catalog
    const activeEvent = useMemo(
        () => (eventId ? findShowEvents.find((e) => e.slug === eventId) : null),
        [eventId]
    );

    if (activeEvent) {
        return <EventDetailView event={activeEvent} />;
    }

    return <EventListView mode={mode} />;
}
