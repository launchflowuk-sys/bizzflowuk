import { Switch, Route, useParams, Router as WouterRouter } from "wouter";
import { useGetPublicSite, useListPublicServices, useListPublicAreas, useBrowsePublicGallery, useListPublicBeforeAfter, useListPublicReviews, useListPublicCaseStudies, useListPublicFaqs, useBrowsePublicBlog, useGetPublicBlogPost, useGetPublicService, useGetPublicArea, useGetPublicCaseStudy, useSubmitContact, useSubmitQuoteRequest, useCreateVisualiserRequest } from "@workspace/api-client-react";
import { useState } from "react";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-4 h-4 ${i <= rating ? 'text-amber-400' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

function SiteNav({ tenant, settings, tenantSlug }: any) {
  const [open, setOpen] = useState(false);
  const primary = settings?.primaryColor || tenant?.primaryColor || '#f97316';
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href={`/site/${tenantSlug}`} className="font-bold text-xl text-slate-900">{tenant?.name}</a>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
          <a href={`/site/${tenantSlug}/services`} className="hover:text-orange-500 transition-colors">Services</a>
          <a href={`/site/${tenantSlug}/areas`} className="hover:text-orange-500 transition-colors">Areas</a>
          <a href={`/site/${tenantSlug}/gallery`} className="hover:text-orange-500 transition-colors">Gallery</a>
          <a href={`/site/${tenantSlug}/case-studies`} className="hover:text-orange-500 transition-colors">Work</a>
          <a href={`/site/${tenantSlug}/reviews`} className="hover:text-orange-500 transition-colors">Reviews</a>
          <a href={`/site/${tenantSlug}/blog`} className="hover:text-orange-500 transition-colors">Blog</a>
          <a href={`/site/${tenantSlug}/quote`} style={{ backgroundColor: primary }} className="ml-2 inline-flex h-9 items-center rounded-md px-4 text-sm font-semibold text-white shadow hover:opacity-90 transition-opacity">Get a Quote</a>
        </div>
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
          {['services','areas','gallery','case-studies','reviews','blog','contact'].map(p => (
            <a key={p} href={`/site/${tenantSlug}/${p}`} className="block text-sm font-medium capitalize text-slate-700 hover:text-orange-500">{p.replace('-',' ')}</a>
          ))}
          <a href={`/site/${tenantSlug}/quote`} style={{ backgroundColor: primary }} className="block text-center rounded-md px-4 py-2 text-sm font-semibold text-white">Get a Quote</a>
        </div>
      )}
    </nav>
  );
}

function SiteFooter({ tenant, settings, tenantSlug }: any) {
  return (
    <footer className="bg-slate-900 text-slate-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2 space-y-4">
          <div className="font-bold text-xl text-white">{tenant?.name}</div>
          <p className="text-sm leading-relaxed text-slate-400">{tenant?.description}</p>
          <div className="flex gap-4">
            {settings?.facebookUrl && <a href={settings.facebookUrl} className="text-slate-400 hover:text-white text-xs">Facebook</a>}
            {settings?.instagramUrl && <a href={settings.instagramUrl} className="text-slate-400 hover:text-white text-xs">Instagram</a>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white uppercase tracking-wide">Quick Links</div>
          {['services','areas','gallery','case-studies','reviews','faqs','blog'].map(p => (
            <a key={p} href={`/site/${tenantSlug}/${p}`} className="block text-sm capitalize text-slate-400 hover:text-white transition-colors">{p.replace('-',' ')}</a>
          ))}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-white uppercase tracking-wide">Contact</div>
          {settings?.phone && <p className="text-sm text-slate-400">{settings.phone}</p>}
          {settings?.email && <p className="text-sm text-slate-400">{settings.email}</p>}
          {settings?.address && <p className="text-sm text-slate-400">{settings.address}, {settings.city}</p>}
          <a href={`/site/${tenantSlug}/quote`} className="inline-flex mt-2 items-center rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 transition-colors">Get a Free Quote</a>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 pt-8 border-t border-slate-800 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} {tenant?.name}. All rights reserved.
      </div>
    </footer>
  );
}

function HomePage({ tenantSlug }: { tenantSlug: string }) {
  const { data, isLoading } = useGetPublicSite(tenantSlug);
  if (isLoading) return <div className="flex h-96 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!data) return <div className="p-8 text-center text-slate-500">Site not found</div>;
  const { tenant, settings, featuredServices, featuredReviews, recentCaseStudies, featuredBeforeAfter, globalFaqs } = data as any;
  const primary = settings?.primaryColor || tenant?.primaryColor || '#f97316';
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug} />
      {/* Hero */}
      <section className="relative bg-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-28 md:py-40">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">Premium Rendering Specialists</div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">{settings?.heroHeadline || tenant?.name}</h1>
            <p className="text-xl text-slate-300 leading-relaxed">{settings?.heroSubheadline || tenant?.description}</p>
            <div className="flex flex-wrap gap-4 pt-4">
              <a href={`/site/${tenantSlug}/quote`} style={{ backgroundColor: primary }} className="inline-flex h-12 items-center rounded-md px-8 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-opacity">{settings?.ctaText || 'Get a Free Quote'}</a>
              <a href={`/site/${tenantSlug}/gallery`} className="inline-flex h-12 items-center rounded-md border border-slate-600 px-8 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors">View Our Work</a>
            </div>
            {settings?.phone && <p className="text-slate-400 text-sm pt-2">Call us: <a href={`tel:${settings.phone}`} className="text-white font-semibold hover:text-orange-400">{settings.phone}</a></p>}
          </div>
        </div>
      </section>
      {/* Trust badges */}
      <section className="bg-slate-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-8 text-slate-300 text-sm">
          {['15+ Years Experience','Approved Applicators','10-Year Guarantee','Fully Insured','Free Surveys'].map(b => (
            <div key={b} className="flex items-center gap-2"><svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>{b}</div>
          ))}
        </div>
      </section>
      {/* Services */}
      {featuredServices?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Our Services</h2>
              <p className="text-slate-600 mt-3 max-w-xl mx-auto">Expert rendering solutions for every property type</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredServices.map((s: any) => (
                <a key={s.id} href={`/site/${tenantSlug}/services/${s.slug}`} className="group rounded-xl border border-slate-200 p-6 space-y-3 hover:border-orange-400 hover:shadow-lg transition-all">
                  <h3 className="font-semibold text-slate-900 group-hover:text-orange-600">{s.name}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{s.tagline || s.description}</p>
                  <span className="inline-flex text-sm font-medium text-orange-500 group-hover:text-orange-600">Learn more &rarr;</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Before/After */}
      {featuredBeforeAfter?.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Transformations</h2>
              <p className="text-slate-600 mt-3">See the difference we make</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredBeforeAfter.slice(0,4).map((ba: any) => (
                <div key={ba.id} className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-2">
                    <div className="relative">
                      <img src={ba.beforeImageUrl} alt="Before" className="w-full h-48 object-cover"/>
                      <span className="absolute top-2 left-2 rounded bg-slate-900/70 px-2 py-0.5 text-xs text-white font-medium">Before</span>
                    </div>
                    <div className="relative">
                      <img src={ba.afterImageUrl} alt="After" className="w-full h-48 object-cover"/>
                      <span className="absolute top-2 left-2 rounded bg-orange-500 px-2 py-0.5 text-xs text-white font-medium">After</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 text-sm">{ba.title}</h3>
                    {ba.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{ba.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Case Studies */}
      {recentCaseStudies?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Recent Projects</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentCaseStudies.map((cs: any) => (
                <a key={cs.id} href={`/site/${tenantSlug}/case-studies/${cs.slug}`} className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
                  {cs.heroImageUrl && <img src={cs.heroImageUrl} alt={cs.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"/>}
                  <div className="p-5 space-y-2">
                    <div className="text-xs text-orange-500 font-medium">{cs.location}</div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-orange-600 line-clamp-2">{cs.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{cs.tagline}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Reviews */}
      {featuredReviews?.length > 0 && (
        <section className="py-20 bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">What Our Customers Say</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredReviews.map((r: any) => (
                <div key={r.id} className="rounded-xl bg-slate-800 p-6 space-y-4">
                  <StarRating rating={r.rating}/>
                  {r.title && <h3 className="font-semibold text-white">{r.title}</h3>}
                  <p className="text-sm text-slate-300 leading-relaxed">{r.content}</p>
                  <div className="pt-2 border-t border-slate-700">
                    <div className="text-sm font-medium text-white">{r.reviewerName}</div>
                    {r.reviewerLocation && <div className="text-xs text-slate-400">{r.reviewerLocation}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* FAQs */}
      {globalFaqs?.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
              {globalFaqs.map((faq: any) => (
                <details key={faq.id} className="group rounded-lg border border-slate-200 p-5">
                  <summary className="flex cursor-pointer items-center justify-between font-medium text-slate-900">
                    {faq.question}
                    <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <p className="mt-4 text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* CTA */}
      <section style={{ backgroundColor: primary }} className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center text-white space-y-6">
          <h2 className="text-3xl font-bold">Ready to Transform Your Property?</h2>
          <p className="text-lg opacity-90">Get a free, no-obligation quote from our expert team.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={`/site/${tenantSlug}/quote`} className="inline-flex h-12 items-center rounded-md bg-white px-8 text-sm font-semibold text-orange-600 hover:bg-slate-50 transition-colors">Get a Free Quote</a>
            {settings?.phone && <a href={`tel:${settings.phone}`} className="inline-flex h-12 items-center rounded-md border border-white/50 px-8 text-sm font-medium text-white hover:bg-white/10 transition-colors">Call {settings.phone}</a>}
          </div>
        </div>
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function ServicesPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: services, isLoading } = useListPublicServices(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const primary = settings?.primaryColor || '#f97316';
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 sm:px-6 text-center">
        <h1 className="text-4xl font-bold">Our Services</h1>
        <p className="text-slate-300 mt-3">Expert rendering solutions tailored to your property</p>
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(services as any[])?.map((s: any) => (
              <a key={s.id} href={`/site/${tenantSlug}/services/${s.slug}`} className="group rounded-xl border border-slate-200 p-6 space-y-3 hover:border-orange-400 hover:shadow-lg transition-all bg-white">
                <h2 className="text-xl font-semibold text-slate-900 group-hover:text-orange-600">{s.name}</h2>
                <p className="text-sm text-orange-500">{s.tagline}</p>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{s.description}</p>
                {(s.benefits as string[])?.length > 0 && (
                  <ul className="space-y-1">
                    {(s.benefits as string[]).slice(0,3).map((b: string) => (
                      <li key={b} className="text-xs text-slate-500 flex items-center gap-2"><svg className="w-3 h-3 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>{b}</li>
                    ))}
                  </ul>
                )}
                <span className="inline-flex text-sm font-medium text-orange-500">Find out more &rarr;</span>
              </a>
            ))}
          </div>
        )}
      </section>
      <section style={{ backgroundColor: primary }} className="py-12">
        <div className="max-w-3xl mx-auto px-4 text-center text-white space-y-4">
          <h2 className="text-2xl font-bold">Not sure which service you need?</h2>
          <p className="opacity-90">Our team will assess your property and recommend the best solution.</p>
          <a href={`/site/${tenantSlug}/contact`} className="inline-flex h-10 items-center rounded-md bg-white px-6 text-sm font-semibold text-orange-600 hover:bg-slate-50 transition-colors">Speak to an Expert</a>
        </div>
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function ServiceDetailPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: service, isLoading } = useGetPublicService(tenantSlug, slug);
  const { tenant, settings } = (siteData as any) || {};
  const s = service as any;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      {isLoading ? <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div> : s ? (
        <>
          <div className="bg-slate-900 text-white py-16 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-orange-400 text-sm mb-2">{s.tagline}</div>
              <h1 className="text-4xl font-bold">{s.name}</h1>
              <p className="text-slate-300 mt-4 text-lg leading-relaxed max-w-2xl">{s.description}</p>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
            {(s.benefits as string[])?.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Key Benefits</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(s.benefits as string[]).map((b: string) => (
                    <div key={b} className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
                      <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      <span className="text-sm text-slate-700">{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.content && <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">{s.content}</div>}
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-8 text-center space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Interested in {s.name}?</h3>
              <p className="text-slate-600">Get a free, no-obligation quote from our certified team.</p>
              <a href={`/site/${tenantSlug}/quote`} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400 transition-colors">Get a Free Quote</a>
            </div>
          </div>
        </>
      ) : <div className="p-8 text-center text-slate-500">Service not found</div>}
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function AreasPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: areas, isLoading } = useListPublicAreas(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 sm:px-6 text-center">
        <h1 className="text-4xl font-bold">Areas We Cover</h1>
        <p className="text-slate-300 mt-3">Serving the North West of England</p>
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(areas as any[])?.map((area: any) => (
              <a key={area.id} href={`/site/${tenantSlug}/areas/${area.slug}`} className="group rounded-xl border border-slate-200 p-6 space-y-2 hover:border-orange-400 hover:shadow-lg transition-all bg-white">
                <h2 className="text-xl font-semibold text-slate-900 group-hover:text-orange-600">{area.name}</h2>
                {area.county && <p className="text-xs text-orange-500">{area.county}</p>}
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{area.description}</p>
                <span className="inline-flex text-sm font-medium text-orange-500">View page &rarr;</span>
              </a>
            ))}
          </div>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function AreaDetailPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: area, isLoading } = useGetPublicArea(tenantSlug, slug);
  const { tenant, settings } = (siteData as any) || {};
  const a = area as any;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      {isLoading ? <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div> : a ? (
        <>
          <div className="bg-slate-900 text-white py-16 px-4">
            <div className="max-w-4xl mx-auto">
              {a.county && <div className="text-orange-400 text-sm mb-2">{a.county}</div>}
              <h1 className="text-4xl font-bold">Rendering in {a.name}</h1>
              <p className="text-slate-300 mt-4 text-lg leading-relaxed max-w-2xl">{a.description}</p>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
            {a.content && <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed mb-10">{a.content}</div>}
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-8 text-center space-y-4">
              <h3 className="text-xl font-bold text-slate-900">We cover {a.name} and surrounding areas</h3>
              <a href={`/site/${tenantSlug}/quote`} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400">Get a Free Quote</a>
            </div>
          </div>
        </>
      ) : <div className="p-8 text-center text-slate-500">Area not found</div>}
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function GalleryPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: images, isLoading } = useBrowsePublicGallery(tenantSlug);
  const { data: beforeAfter } = useListPublicBeforeAfter(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Our Gallery</h1>
        <p className="text-slate-300 mt-3">Recent projects and transformations</p>
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {(images as any[])?.map((img: any) => (
              <div key={img.id} className="break-inside-avoid rounded-lg overflow-hidden bg-slate-100">
                <img src={img.imageUrl} alt={img.altText || img.caption || ''} className="w-full object-cover"/>
                {img.caption && <p className="p-3 text-xs text-slate-600">{img.caption}</p>}
              </div>
            ))}
          </div>
        )}
        {(beforeAfter as any[])?.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Before & After</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(beforeAfter as any[]).map((ba: any) => (
                <div key={ba.id} className="rounded-xl overflow-hidden border border-slate-200">
                  <div className="grid grid-cols-2">
                    <div className="relative"><img src={ba.beforeImageUrl} alt="Before" className="w-full h-48 object-cover"/><span className="absolute top-2 left-2 rounded bg-slate-900/70 px-2 py-0.5 text-xs text-white">Before</span></div>
                    <div className="relative"><img src={ba.afterImageUrl} alt="After" className="w-full h-48 object-cover"/><span className="absolute top-2 left-2 rounded bg-orange-500 px-2 py-0.5 text-xs text-white">After</span></div>
                  </div>
                  <div className="p-4"><h3 className="font-medium text-slate-900 text-sm">{ba.title}</h3></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function ReviewsPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: reviews, isLoading } = useListPublicReviews(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const avgRating = (reviews as any[])?.length ? Math.round((reviews as any[]).reduce((s: number, r: any) => s + r.rating, 0) / (reviews as any[]).length * 10) / 10 : 0;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Customer Reviews</h1>
        {(reviews as any[])?.length > 0 && <div className="mt-4 flex items-center justify-center gap-2"><StarRating rating={5}/><span className="text-slate-300 text-sm">{avgRating}/5 from {(reviews as any[]).length} reviews</span></div>}
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(reviews as any[])?.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-6 space-y-3 bg-white">
                <StarRating rating={r.rating}/>
                {r.title && <h3 className="font-semibold text-slate-900">{r.title}</h3>}
                <p className="text-sm text-slate-600 leading-relaxed">{r.content}</p>
                <div className="pt-3 border-t border-slate-100">
                  <div className="font-medium text-sm text-slate-900">{r.reviewerName}</div>
                  {r.reviewerLocation && <div className="text-xs text-slate-400">{r.reviewerLocation}</div>}
                  {r.platform && <div className="text-xs text-slate-400">{r.platform}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function CaseStudiesPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: caseStudies, isLoading } = useListPublicCaseStudies(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Our Work</h1>
        <p className="text-slate-300 mt-3">Detailed case studies from recent projects</p>
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(caseStudies as any[])?.map((cs: any) => (
              <a key={cs.id} href={`/site/${tenantSlug}/case-studies/${cs.slug}`} className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all bg-white">
                {cs.heroImageUrl && <img src={cs.heroImageUrl} alt={cs.title} className="w-full h-48 object-cover"/>}
                <div className="p-5 space-y-2">
                  {cs.location && <div className="text-xs text-orange-500 font-medium">{cs.location}</div>}
                  <h2 className="font-semibold text-slate-900 group-hover:text-orange-600">{cs.title}</h2>
                  <p className="text-sm text-slate-500 line-clamp-2">{cs.tagline}</p>
                  {cs.projectDuration && <div className="text-xs text-slate-400">Duration: {cs.projectDuration}</div>}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function CaseStudyDetailPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: cs, isLoading } = useGetPublicCaseStudy(tenantSlug, slug);
  const { tenant, settings } = (siteData as any) || {};
  const c = cs as any;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      {isLoading ? <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div> : c ? (
        <>
          {c.heroImageUrl && <img src={c.heroImageUrl} alt={c.title} className="w-full h-72 object-cover"/>}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div>
              {c.location && <div className="text-orange-500 text-sm font-medium mb-2">{c.location}</div>}
              <h1 className="text-3xl font-bold text-slate-900">{c.title}</h1>
              {c.tagline && <p className="text-xl text-slate-600 mt-2">{c.tagline}</p>}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
                {c.clientName && <span>Client: {c.clientName}</span>}
                {c.projectDuration && <span>Duration: {c.projectDuration}</span>}
              </div>
            </div>
            {c.challenge && <div><h2 className="text-xl font-bold text-slate-900 mb-3">The Challenge</h2><p className="text-slate-600 leading-relaxed">{c.challenge}</p></div>}
            {c.solution && <div><h2 className="text-xl font-bold text-slate-900 mb-3">Our Solution</h2><p className="text-slate-600 leading-relaxed">{c.solution}</p></div>}
            {c.result && <div className="rounded-xl bg-green-50 border border-green-200 p-6"><h2 className="text-xl font-bold text-slate-900 mb-3">The Result</h2><p className="text-slate-700 leading-relaxed">{c.result}</p></div>}
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-8 text-center space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Like what you see?</h3>
              <a href={`/site/${tenantSlug}/quote`} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400">Get a Free Quote</a>
            </div>
          </div>
        </>
      ) : <div className="p-8 text-center text-slate-500">Case study not found</div>}
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function FaqsPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: faqs, isLoading } = useListPublicFaqs(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
      </div>
      <section className="py-16 max-w-3xl mx-auto px-4 sm:px-6 space-y-4">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (faqs as any[])?.map((faq: any) => (
          <details key={faq.id} className="group rounded-lg border border-slate-200 p-5 bg-white">
            <summary className="flex cursor-pointer items-center justify-between font-medium text-slate-900">
              {faq.question}
              <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
          </details>
        ))}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function BlogListPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: posts, isLoading } = useBrowsePublicBlog(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Blog & Advice</h1>
        <p className="text-slate-300 mt-3">Expert tips, project showcases and industry news</p>
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(posts as any[])?.map((post: any) => (
              <a key={post.id} href={`/site/${tenantSlug}/blog/${post.slug}`} className="group rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all bg-white">
                {post.heroImageUrl && <img src={post.heroImageUrl} alt={post.title} className="w-full h-48 object-cover"/>}
                <div className="p-5 space-y-2">
                  <h2 className="font-semibold text-slate-900 group-hover:text-orange-600 line-clamp-2">{post.title}</h2>
                  {post.excerpt && <p className="text-sm text-slate-500 line-clamp-3">{post.excerpt}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-400 pt-2">
                    {post.authorName && <span>{post.authorName}</span>}
                    {post.readTime && <span>{post.readTime} min read</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function BlogPostPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: post, isLoading } = useGetPublicBlogPost(tenantSlug, slug);
  const { tenant, settings } = (siteData as any) || {};
  const p = post as any;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      {isLoading ? <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div> : p ? (
        <>
          {p.heroImageUrl && <img src={p.heroImageUrl} alt={p.title} className="w-full h-64 object-cover"/>}
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
            <div className="mb-8 space-y-3">
              <h1 className="text-3xl font-bold text-slate-900">{p.title}</h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                {p.authorName && <span>By {p.authorName}</span>}
                {p.readTime && <span>{p.readTime} min read</span>}
                {p.publishedAt && <span>{new Date(p.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              </div>
              {p.excerpt && <p className="text-lg text-slate-600 font-medium leading-relaxed border-l-4 border-orange-400 pl-4">{p.excerpt}</p>}
            </div>
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed">{p.content}</div>
            <div className="mt-12 rounded-xl bg-orange-50 border border-orange-200 p-8 text-center space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Ready to get started?</h3>
              <a href={`/site/${tenantSlug}/quote`} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400">Get a Free Quote</a>
            </div>
          </article>
        </>
      ) : <div className="p-8 text-center text-slate-500">Post not found</div>}
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function QuotePage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const mutation = useSubmitQuoteRequest();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', postcode: '', serviceInterest: '', notes: '' });
  const [submitted, setSubmitted] = useState(false);
  const services = ['Silicone Render', 'Monocouche Render', 'K-Rend', 'Pebble Dash Removal', 'EWI Systems', 'Not sure'];
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: { ...form, tenantSlug } } as any);
      setSubmitted(true);
    } catch {}
  };
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Get a Free Quote</h1>
        <p className="text-slate-300 mt-3">No obligation — we'll survey and quote for free</p>
      </div>
      <section className="py-16 max-w-2xl mx-auto px-4 sm:px-6">
        {submitted ? (
          <div className="text-center space-y-4 py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg></div>
            <h2 className="text-2xl font-bold text-slate-900">Quote Request Received</h2>
            <p className="text-slate-600">Thank you! We'll be in touch within 24 hours to arrange your free survey.</p>
            <a href={`/site/${tenantSlug}`} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400">Back to Home</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">First name *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email *</label><input required type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Property address *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">City</label><input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.city} onChange={e => setForm({...form, city: e.target.value})}/></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Postcode</label><input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.postcode} onChange={e => setForm({...form, postcode: e.target.value})}/></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Service required</label>
              <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.serviceInterest} onChange={e => setForm({...form, serviceInterest: e.target.value})}>
                <option value="">Select...</option>
                {services.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Additional notes</label><textarea rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/></div>
            <button type="submit" disabled={mutation.isPending} className="w-full inline-flex h-11 items-center justify-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50 transition-colors">
              {mutation.isPending ? 'Sending...' : 'Submit Quote Request'}
            </button>
            {mutation.isError && <p className="text-sm text-red-600 text-center">Something went wrong. Please try again or call us directly.</p>}
          </form>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function ContactPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const mutation = useSubmitContact();
  const [form, setForm] = useState({ senderName: '', senderEmail: '', senderPhone: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: { ...form, tenantSlug } } as any);
      setSubmitted(true);
    } catch {}
  };
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Contact Us</h1>
        <p className="text-slate-300 mt-3">Get in touch with our team</p>
      </div>
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">Get in Touch</h2>
              <div className="space-y-3 text-sm text-slate-600">
                {settings?.phone && <p><strong>Phone:</strong> <a href={`tel:${settings.phone}`} className="text-orange-500">{settings.phone}</a></p>}
                {settings?.email && <p><strong>Email:</strong> <a href={`mailto:${settings.email}`} className="text-orange-500">{settings.email}</a></p>}
                {settings?.address && <p><strong>Address:</strong> {settings.address}, {settings.city}</p>}
              </div>
            </div>
          </div>
          <div>
            {submitted ? (
              <div className="text-center space-y-4 py-12">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto"><svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg></div>
                <h3 className="font-semibold text-slate-900">Message Sent</h3>
                <p className="text-sm text-slate-600">We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.senderName} onChange={e => setForm({...form, senderName: e.target.value})}/></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Email</label><input type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.senderEmail} onChange={e => setForm({...form, senderEmail: e.target.value})}/></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.senderPhone} onChange={e => setForm({...form, senderPhone: e.target.value})}/></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Subject</label><input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}/></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Message *</label><textarea required rows={5} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.message} onChange={e => setForm({...form, message: e.target.value})}/></div>
                <button type="submit" disabled={mutation.isPending} className="w-full inline-flex h-11 items-center justify-center rounded-md bg-orange-500 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
                  {mutation.isPending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function VisualiserPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const mutation = useCreateVisualiserRequest();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', serviceInterest: '', colourPreference: '', notes: '' });
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ data: { ...form, tenantSlug } } as any);
      setSubmitted(true);
    } catch {}
  };
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div className="bg-slate-900 text-white py-16 px-4 text-center">
        <h1 className="text-4xl font-bold">Render Visualiser</h1>
        <p className="text-slate-300 mt-3">See what your property could look like with new render</p>
      </div>
      <section className="py-16 max-w-2xl mx-auto px-4 sm:px-6">
        {submitted ? (
          <div className="text-center space-y-4 py-12">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"><svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg></div>
            <h2 className="text-2xl font-bold text-slate-900">Request Received</h2>
            <p className="text-slate-600">We'll create a visualisation of your property and send it to you within 48 hours.</p>
            <a href={`/site/${tenantSlug}`} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400">Back to Home</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <p className="text-sm text-slate-600 leading-relaxed">Upload a photo of your property and we'll show you exactly what it could look like with new render applied.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">First name *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Last name *</label><input required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
            </div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Email *</label><input required type="email" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Phone</label><input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Property address</label><input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Colour preference</label><input placeholder="e.g. Off-white, light grey, cream..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.colourPreference} onChange={e => setForm({...form, colourPreference: e.target.value})}/></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Additional notes</label><textarea rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/></div>
            <button type="submit" disabled={mutation.isPending} className="w-full inline-flex h-11 items-center justify-center rounded-md bg-orange-500 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
              {mutation.isPending ? 'Submitting...' : 'Submit Visualiser Request'}
            </button>
          </form>
        )}
      </section>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

export default function PublicSiteApp() {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug || '';
  const base = `/site/${tenantSlug}`;
  return (
    <WouterRouter base={base}>
      <Switch>
        <Route path="/" component={() => <HomePage tenantSlug={tenantSlug}/>}/>
        <Route path="/services" component={() => <ServicesPage tenantSlug={tenantSlug}/>}/>
        <Route path="/services/:slug" component={({ params: p }) => <ServiceDetailPage tenantSlug={tenantSlug} slug={p.slug}/>}/>
        <Route path="/areas" component={() => <AreasPage tenantSlug={tenantSlug}/>}/>
        <Route path="/areas/:slug" component={({ params: p }) => <AreaDetailPage tenantSlug={tenantSlug} slug={p.slug}/>}/>
        <Route path="/gallery" component={() => <GalleryPage tenantSlug={tenantSlug}/>}/>
        <Route path="/case-studies" component={() => <CaseStudiesPage tenantSlug={tenantSlug}/>}/>
        <Route path="/case-studies/:slug" component={({ params: p }) => <CaseStudyDetailPage tenantSlug={tenantSlug} slug={p.slug}/>}/>
        <Route path="/reviews" component={() => <ReviewsPage tenantSlug={tenantSlug}/>}/>
        <Route path="/faqs" component={() => <FaqsPage tenantSlug={tenantSlug}/>}/>
        <Route path="/blog" component={() => <BlogListPage tenantSlug={tenantSlug}/>}/>
        <Route path="/blog/:slug" component={({ params: p }) => <BlogPostPage tenantSlug={tenantSlug} slug={p.slug}/>}/>
        <Route path="/quote" component={() => <QuotePage tenantSlug={tenantSlug}/>}/>
        <Route path="/contact" component={() => <ContactPage tenantSlug={tenantSlug}/>}/>
        <Route path="/visualiser" component={() => <VisualiserPage tenantSlug={tenantSlug}/>}/>
      </Switch>
    </WouterRouter>
  );
}
