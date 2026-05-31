import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Users, Store, Building2, ExternalLink } from 'lucide-react';
import { getFindShowDetail, getFindShowRegisterUrl } from '@/lib/find-shows/eventseye';
import { findShowEventsBySlug } from '@/lib/find-shows/catalog';
import { getFindShowAvatarUrl, getFindShowGradient } from '@/lib/find-shows/presentation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EventRegistrationDialog } from '@/components/find-shows/event-registration-dialog';

export default async function FindShowDetailRoute({
  params,
}: {
  params: { eventSlug: string };
}) {
  const event = findShowEventsBySlug[params.eventSlug];

  if (!event) {
    notFound();
  }

  const detail = await getFindShowDetail(event.slug);
  const registerUrl = getFindShowRegisterUrl(detail, event);
  
  const bannerUrl = detail.bannerUrl;
  const logoUrl = detail.logoUrl ?? getFindShowAvatarUrl(event.name);

  return (
    <div className="px-5 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/find-shows"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to Find Shows
        </Link>

        <div className="mt-6 overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-[#0f1729]/90 dark:shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
          <div className="relative h-72">
            {bannerUrl ? (
              <Image
                src={bannerUrl}
                alt={`${event.name} banner`}
                fill
                sizes="100vw"
                className="object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ backgroundImage: getFindShowGradient(event.slug) }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex items-end gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-white/25 bg-white shadow-lg">
                  <Image
                    src={logoUrl}
                    alt={`${event.name} logo`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                    {event.name}
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-8">
            
            {/* Left Column: Tabs Content */}
            <div>
              <Tabs defaultValue="about" className="w-full">
                <TabsList className="mb-6 w-full justify-start rounded-full bg-slate-100 dark:bg-white/[0.04]">
                  <TabsTrigger 
                    value="about" 
                    className="rounded-full px-6 transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#1e293b]"
                  >
                    About
                  </TabsTrigger>
                  <TabsTrigger 
                    value="exhibitors" 
                    className="rounded-full px-6 transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-[#1e293b]"
                  >
                    Exhibitors
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="about" className="space-y-6">
                  {detail.description ? (
                    <div className="prose prose-slate max-w-none text-base leading-relaxed text-slate-600 dark:prose-invert dark:text-slate-300">
                      <p>{detail.description}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300/80 p-8 text-center dark:border-white/[0.12]">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        No description provided for this event.
                      </p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="exhibitors">
                  <div className="rounded-3xl border border-slate-200/70 bg-slate-50/50 p-6 dark:border-white/[0.08] dark:bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                        <Store className="size-7" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          Exhibiting Companies
                        </p>
                        <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                          {detail.exhibitorCount ? detail.exhibitorCount.toLocaleString() : 'TBA'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 space-y-3 border-t border-slate-200/60 pt-5 dark:border-white/[0.08]">
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        Individual exhibitor lists are available closer to the event date to our premium members. Check back soon or register for the event directly to secure your attendance.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Column: Event Snapshot */}
            <div className="flex flex-col rounded-3xl border border-slate-200/70 bg-slate-50/90 p-6 dark:border-white/[0.08] dark:bg-white/[0.04]">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Event Date
              </p>
              
              <div className="mt-5 flex-1 space-y-6 text-sm text-slate-700 dark:text-slate-200">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-5 shrink-0 text-indigo-500" />
                  <span className="font-semibold text-slate-900 dark:text-white text-base">{event.displayDate}</span>
                </div>
                
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  <div>
                    <span className="block font-semibold text-slate-900 dark:text-white text-base">
                      {event.venue}
                    </span>
                    <span className="mt-1 flex text-slate-500 dark:text-slate-400">
                      {detail.fullVenueAddress ?? `${event.city}, ${event.country}`}
                    </span>
                  </div>
                </div>

                {(detail.visitorCount || detail.exhibitorCount) && (
                  <div className="grid grid-cols-2 gap-4 rounded-2xl bg-white p-4 shadow-sm border border-slate-200/50 dark:bg-[#0b1120] dark:border-white/[0.06]">
                    {detail.visitorCount && (
                       <div>
                         <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Visitors</p>
                         <p className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                           <Users className="size-4 text-amber-500" />
                           {detail.visitorCount.toLocaleString()}
                         </p>
                       </div>
                    )}
                    {detail.exhibitorCount && (
                       <div>
                         <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">Exhibitors</p>
                         <p className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                           <Store className="size-4 text-violet-500" />
                           {detail.exhibitorCount.toLocaleString()}
                         </p>
                       </div>
                    )}
                  </div>
                )}
                
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Organizer</p>
                  <p className="mt-1 font-medium">{event.organizer}</p>
                </div>
              </div>

              {/* Action Button Area */}
              <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-white/[0.08]">
                <EventRegistrationDialog registerUrl={registerUrl} eventName={event.name} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
