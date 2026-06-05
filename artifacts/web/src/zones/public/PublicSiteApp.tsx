import { Switch, Route, useParams, Router as WouterRouter } from "wouter";
import { useGetPublicSite, useListPublicServices, useListPublicAreas, useBrowsePublicGallery, useListPublicBeforeAfter, useListPublicReviews, useListPublicCaseStudies, useListPublicFaqs, useBrowsePublicBlog, useGetPublicBlogPost, useGetPublicService, useGetPublicArea, useGetPublicCaseStudy, useSubmitContact, useSubmitQuoteRequest, useCreateVisualiserRequest, useRequestUploadUrl } from "@workspace/api-client-react";
import { useState, useRef } from "react";

const BLUE = "#1F8CFF";
const NAVY = "#0A121C";
const LIGHT_BG = "#F6F8FB";
const TEXT = "#26323F";
const MUTED = "#64717F";

const ALL_AREAS = [
  "Grays","Thurrock","Basildon","Brentwood","Romford","Dagenham",
  "Barking","Ilford","Upminster","Hornchurch","Rainham","Chelmsford",
  "Southend","Dartford","Gravesend","Chigwell","Epping","London","Essex",
];

const STATIC_SERVICES = [
  { slug: "silicone-rendering", name: "Silicone Rendering", desc: "Flexible, breathable and weather-resistant render finish ideal for long-lasting protection and a clean modern exterior.", icon: "🏠" },
  { slug: "monocouche-rendering", name: "Monocouche Rendering", desc: "A coloured-through render system designed to create a durable, low-maintenance finish with a sharp modern look.", icon: "🎨" },
  { slug: "k-rend", name: "K Rend", desc: "A popular render system for UK homes, offering textured finishes, strong weather protection and a clean external appearance.", icon: "🧱" },
  { slug: "external-wall-insulation", name: "External Wall Insulation", desc: "Improve the appearance and thermal performance of your property with an insulated render system.", icon: "🌡️" },
  { slug: "pebbledash-removal", name: "Pebbledash Removal", desc: "Remove dated pebbledash and replace it with a smooth, modern rendered finish.", icon: "⛏️" },
  { slug: "render-repairs", name: "Render Repairs", desc: "Repair cracked, damaged or failing render before it becomes a bigger issue.", icon: "🔧" },
];

const PROCESS_STEPS = [
  { n: 1, title: "Send Photos or Request a Visit", body: "Upload property photos or send your details for a free quote request." },
  { n: 2, title: "Get Clear Advice", body: "We assess your walls, existing surface and preferred finish." },
  { n: 3, title: "Choose Your Render System", body: "Select from silicone render, monocouche, K Rend, EWI or repair options." },
  { n: 4, title: "Professional Preparation", body: "Surfaces are prepared properly before rendering starts." },
  { n: 5, title: "Clean Modern Finish", body: "Your property is finished with a sharp, durable exterior render." },
];

const WHY_POINTS = [
  "Rendering specialists, not general builders",
  "Based locally in Grays, Thurrock",
  "Serving Essex and London",
  "Clean modern finishes on every project",
  "Photo-based quote requests available",
  "Clear communication from enquiry to completion",
  "Work focused on kerb appeal, protection and long-term finish",
];

const TRUST_ITEMS = [
  "Local rendering specialists",
  "Premium render systems",
  "Domestic and commercial work",
  "Free quote requests",
  "Photo upload available",
];

function Spinner() {
  return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: BLUE }}/></div>;
}

function CheckIcon({ color = BLUE }: { color?: string }) {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke={color} strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
    </svg>
  );
}

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

function BlueBtn({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} style={{ backgroundColor: BLUE }} className={`inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity ${className}`}>
      {children}
    </a>
  );
}

function OutlineBtn({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <a href={href} className={`inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-semibold transition-colors ${dark ? 'border-white/40 text-white hover:bg-white/10' : 'border-slate-300 text-[#26323F] hover:border-[#1F8CFF] hover:text-[#1F8CFF]'}`}>
      {children}
    </a>
  );
}

function SectionHero({ title, subtitle, dark = true }: { title: string; subtitle?: string; dark?: boolean }) {
  return (
    <div style={{ backgroundColor: dark ? NAVY : BLUE }} className="py-16 px-4 text-center text-white">
      <div className="max-w-3xl mx-auto space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-lg opacity-80">{subtitle}</p>}
      </div>
    </div>
  );
}

function ImageUpload({ onUploaded, label = "Upload photo", hint }: { onUploaded: (url: string) => void; label?: string; hint?: string }) {
  const requestUrl = useRequestUploadUrl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setState("uploading");
    setPreview(URL.createObjectURL(file));
    try {
      const result = await requestUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } }) as any;
      await fetch(result.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      onUploaded(result.objectPath);
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: TEXT }}>{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${state === "done" ? "border-green-400 bg-green-50" : "border-slate-300 bg-slate-50 hover:border-[#1F8CFF]"}`}
      >
        {preview ? (
          <div className="space-y-2">
            <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded object-cover"/>
            {state === "uploading" && <p className="text-xs text-slate-500">Uploading…</p>}
            {state === "done" && <p className="text-xs text-green-600 font-medium">✓ Uploaded successfully</p>}
            {state === "error" && <p className="text-xs text-red-500">Upload failed — try again</p>}
          </div>
        ) : (
          <div className="space-y-1">
            <svg className="w-8 h-8 mx-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <p className="text-sm text-slate-500">Click to upload a photo</p>
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
      </div>
    </div>
  );
}

function SiteNav({ tenant, settings, tenantSlug }: any) {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Services", href: `/site/${tenantSlug}/services` },
    { label: "Before & After", href: `/site/${tenantSlug}/gallery` },
    { label: "Areas", href: `/site/${tenantSlug}/areas` },
    { label: "Case Studies", href: `/site/${tenantSlug}/case-studies` },
    { label: "Reviews", href: `/site/${tenantSlug}/reviews` },
    { label: "Contact", href: `/site/${tenantSlug}/contact` },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <a href={`/site/${tenantSlug}`} className="font-bold text-xl flex-shrink-0" style={{ color: NAVY }}>
          {tenant?.name || "AMO Rendering"}
        </a>
        <div className="hidden lg:flex items-center gap-6 text-sm font-medium flex-1">
          {links.map(l => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-[#1F8CFF] whitespace-nowrap" style={{ color: TEXT }}>{l.label}</a>
          ))}
        </div>
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          {settings?.phone && (
            <a href={`tel:${settings.phone}`} className="text-sm font-semibold hover:text-[#1F8CFF] transition-colors" style={{ color: TEXT }}>{settings.phone}</a>
          )}
          <BlueBtn href={`/site/${tenantSlug}/quote`}>Get Quote</BlueBtn>
        </div>
        <button className="lg:hidden p-2 rounded-md hover:bg-slate-100" onClick={() => setOpen(!open)}>
          <svg className="w-6 h-6" style={{ color: TEXT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}/>
          </svg>
        </button>
      </div>
      {open && (
        <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-1">
          {links.map(l => (
            <a key={l.href} href={l.href} className="block py-2 text-sm font-medium hover:text-[#1F8CFF]" style={{ color: TEXT }}>{l.label}</a>
          ))}
          {settings?.phone && <a href={`tel:${settings.phone}`} className="block py-2 text-sm font-semibold" style={{ color: BLUE }}>{settings.phone}</a>}
          <div className="pt-2"><BlueBtn href={`/site/${tenantSlug}/quote`} className="w-full">Get a Free Quote</BlueBtn></div>
        </div>
      )}
    </nav>
  );
}

function SiteFooter({ tenant, settings, tenantSlug }: any) {
  return (
    <footer style={{ backgroundColor: NAVY }} className="text-slate-300 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2 space-y-4">
          <div className="font-bold text-xl text-white">{tenant?.name || "AMO Rendering"}</div>
          <p className="text-sm leading-relaxed text-slate-400">Premium rendering specialists based in Grays, Thurrock, serving Essex and London.</p>
          <div className="space-y-1 text-sm text-slate-400">
            <p>Grays, Thurrock, Essex</p>
            <p><a href="mailto:info@amorendering.co.uk" className="hover:text-white transition-colors">info@amorendering.co.uk</a></p>
            <p><a href="mailto:mark@amorendering.co.uk" className="hover:text-white transition-colors">mark@amorendering.co.uk</a></p>
            {settings?.phone && <p><a href={`tel:${settings.phone}`} className="hover:text-white transition-colors">{settings.phone}</a></p>}
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Services</div>
          {["Silicone Rendering","Monocouche Rendering","K Rend","Pebbledash Removal","External Wall Insulation","Render Repairs"].map(s => (
            <a key={s} href={`/site/${tenantSlug}/services`} className="block text-sm text-slate-400 hover:text-white transition-colors">{s}</a>
          ))}
        </div>
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Areas</div>
          {["Grays","Thurrock","Essex","London","Basildon","Romford","Chelmsford","Southend"].map(a => (
            <span key={a} className="block text-sm text-slate-400">{a}</span>
          ))}
          <div className="pt-2">
            <BlueBtn href={`/site/${tenantSlug}/quote`}>Get a Free Quote</BlueBtn>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 pt-8 border-t border-slate-800 flex flex-wrap gap-4 items-center justify-between text-xs text-slate-600">
        <span>&copy; {new Date().getFullYear()} {tenant?.name || "AMO Rendering"}. All rights reserved.</span>
        <div className="flex gap-4">
          <a href={`/site/${tenantSlug}/faqs`} className="hover:text-slate-400 transition-colors">FAQs</a>
          <a href={`/site/${tenantSlug}/contact`} className="hover:text-slate-400 transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

function QuoteCTASection({ tenantSlug, phone }: { tenantSlug: string; phone?: string }) {
  return (
    <section style={{ backgroundColor: NAVY }} className="py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center text-white space-y-6">
        <h2 className="text-3xl font-bold">Ready to Modernise Your Property Exterior?</h2>
        <p className="text-lg text-slate-300">Send us your details and upload photos of your property. AMO Rendering will review your project and help you choose the right rendering solution.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Free Quote</BlueBtn>
          <OutlineBtn href={`/site/${tenantSlug}/visualiser`} dark>Upload Property Photos</OutlineBtn>
        </div>
        {phone && <p className="text-slate-400 text-sm">Or call us directly: <a href={`tel:${phone}`} className="text-white font-semibold hover:text-[#8EC8FF]">{phone}</a></p>}
      </div>
    </section>
  );
}

function HomePage({ tenantSlug }: { tenantSlug: string }) {
  const { data, isLoading } = useGetPublicSite(tenantSlug);
  if (isLoading) return <Spinner/>;
  if (!data) return <div className="p-8 text-center text-slate-500">Site not found</div>;
  const { tenant, settings, featuredServices, featuredReviews, recentCaseStudies, featuredBeforeAfter, globalFaqs } = data as any;
  const services = featuredServices?.length ? featuredServices : STATIC_SERVICES;

  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>

      {/* Hero */}
      <section style={{ backgroundColor: NAVY }} className="overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1F8CFF]/30 bg-[#1F8CFF]/10 px-4 py-1.5 text-xs font-semibold text-[#8EC8FF] tracking-wide uppercase">
              Silicone Render Specialists · Grays, Thurrock
            </div>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-bold text-white leading-tight tracking-tight">
              Transform Tired Exterior Walls With Premium Silicone Rendering
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed max-w-xl">
              AMO Rendering provides silicone rendering, monocouche render, K Rend, external wall insulation and pebbledash removal for homes and properties across Grays, Thurrock, Essex and London.
            </p>
            <div className="flex flex-wrap gap-4">
              <BlueBtn href={`/site/${tenantSlug}/quote`} className="h-12 px-8 text-base">Request a Free Quote</BlueBtn>
              <OutlineBtn href={`/site/${tenantSlug}/gallery`} dark>View Before &amp; After Work</OutlineBtn>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              {["Based in Grays, Thurrock","Serving Essex & London","Silicone Render Specialists","Photo Quotes Available"].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckIcon color="#8EC8FF"/>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl overflow-hidden bg-slate-800 aspect-[4/3] flex items-center justify-center border border-slate-700">
              <div className="text-center space-y-3 p-8">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: BLUE + "20" }}>
                  <svg className="w-8 h-8" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>
                  </svg>
                </div>
                <p className="text-slate-400 text-sm font-medium">Clean · Modern · Durable</p>
                <p className="text-slate-500 text-xs">Before &amp; after images available on the gallery page</p>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 rounded-xl bg-[#1F8CFF] text-white px-4 py-3 text-xs font-semibold shadow-lg">
              Free Quote Available<br/><span className="opacity-80 font-normal">Photo upload accepted</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section style={{ backgroundColor: "#E8F3FF" }} className="border-b border-[#8EC8FF]/40 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-6 text-sm font-medium" style={{ color: TEXT }}>
          {TRUST_ITEMS.map(t => (
            <div key={t} className="flex items-center gap-2">
              <CheckIcon color={BLUE}/>
              {t}
            </div>
          ))}
        </div>
      </section>

      {/* Before & After Showcase */}
      {featuredBeforeAfter?.length > 0 && (
        <section style={{ backgroundColor: LIGHT_BG }} className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE }}>Transformations</p>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: TEXT }}>See What Professional Rendering Can Do</h2>
              <p className="mt-4 max-w-2xl mx-auto" style={{ color: MUTED }}>From cracked render and tired pebbledash to clean modern exterior finishes, our work helps homeowners improve kerb appeal and protect their property.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredBeforeAfter.slice(0, 4).map((ba: any) => (
                <div key={ba.id} className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-2">
                    <div className="relative">
                      <img src={ba.beforeImageUrl} alt="Before" className="w-full h-52 object-cover"/>
                      <span className="absolute top-3 left-3 rounded-md bg-slate-900/75 px-2 py-1 text-xs text-white font-semibold">Before</span>
                    </div>
                    <div className="relative">
                      <img src={ba.afterImageUrl} alt="After" className="w-full h-52 object-cover"/>
                      <span className="absolute top-3 left-3 rounded-md px-2 py-1 text-xs text-white font-semibold" style={{ backgroundColor: BLUE }}>After</span>
                    </div>
                  </div>
                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm" style={{ color: TEXT }}>{ba.title}</h3>
                      {ba.location && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{ba.location}</p>}
                    </div>
                    {ba.serviceName && <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#E8F3FF]" style={{ color: BLUE }}>{ba.serviceName}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <BlueBtn href={`/site/${tenantSlug}/gallery`}>View All Transformations</BlueBtn>
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE }}>What We Do</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: TEXT }}>Rendering Services For Homes &amp; Properties Across Essex And London</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.slice(0, 6).map((s: any) => (
              <a key={s.id || s.slug} href={`/site/${tenantSlug}/services/${s.slug}`} className="group rounded-2xl border border-slate-200 p-7 space-y-4 hover:border-[#1F8CFF] hover:shadow-md transition-all bg-white">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: BLUE + "15" }}>
                  <svg className="w-5 h-5" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>
                  </svg>
                </div>
                <h3 className="font-bold text-lg" style={{ color: TEXT }}>{s.name}</h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{s.tagline || s.desc || s.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all" style={{ color: BLUE }}>
                  Find out more <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                </span>
              </a>
            ))}
          </div>
          <div className="mt-10 text-center">
            <BlueBtn href={`/site/${tenantSlug}/services`}>View All Services</BlueBtn>
          </div>
        </div>
      </section>

      {/* Why Choose AMO */}
      <section style={{ backgroundColor: LIGHT_BG }} className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: BLUE }}>Why Choose Us</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: TEXT }}>Why Homeowners Choose AMO Rendering</h2>
            <ul className="space-y-4">
              {WHY_POINTS.map(p => (
                <li key={p} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: BLUE }}>
                    <CheckIcon color="white"/>
                  </div>
                  <span className="text-base" style={{ color: TEXT }}>{p}</span>
                </li>
              ))}
            </ul>
            <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Free Quote</BlueBtn>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Silicone Rendering", sub: "Weather-resistant finish" },
              { label: "Pebbledash Removal", sub: "Clean modern replacement" },
              { label: "External Wall Insulation", sub: "Thermal performance" },
              { label: "Render Repairs", sub: "Stop damage spreading" },
            ].map(c => (
              <div key={c.label} className="rounded-xl p-5 bg-white border border-slate-200 space-y-1">
                <div className="font-semibold text-sm" style={{ color: TEXT }}>{c.label}</div>
                <div className="text-xs" style={{ color: MUTED }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE }}>How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: TEXT }}>A Simple Process From First Enquiry To Finished Exterior</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {PROCESS_STEPS.map((s, i) => (
              <div key={s.n} className="relative text-center space-y-3">
                {i < PROCESS_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[60%] w-full h-px border-t-2 border-dashed border-slate-200"/>
                )}
                <div className="relative w-12 h-12 rounded-full flex items-center justify-center mx-auto text-white font-bold text-lg" style={{ backgroundColor: BLUE }}>
                  {s.n}
                </div>
                <h3 className="font-bold text-sm" style={{ color: TEXT }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      {recentCaseStudies?.length > 0 && (
        <section style={{ backgroundColor: LIGHT_BG }} className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE }}>Our Work</p>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: TEXT }}>Featured Case Studies</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentCaseStudies.map((cs: any) => (
                <a key={cs.id} href={`/site/${tenantSlug}/case-studies/${cs.slug}`} className="group rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all bg-white">
                  {cs.heroImageUrl
                    ? <img src={cs.heroImageUrl} alt={cs.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"/>
                    : <div className="w-full h-48 flex items-center justify-center" style={{ backgroundColor: BLUE + "10" }}>
                        <svg className="w-12 h-12 opacity-30" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/></svg>
                      </div>
                  }
                  <div className="p-5 space-y-2">
                    {cs.location && <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BLUE }}>{cs.location}</div>}
                    <h3 className="font-bold" style={{ color: TEXT }}>{cs.title}</h3>
                    {cs.tagline && <p className="text-sm" style={{ color: MUTED }}>{cs.tagline}</p>}
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-10 text-center">
              <BlueBtn href={`/site/${tenantSlug}/case-studies`}>View All Case Studies</BlueBtn>
            </div>
          </div>
        </section>
      )}

      {/* Areas */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE }}>Service Area</p>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: TEXT }}>Rendering Services Across Essex And London</h2>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {ALL_AREAS.map(a => (
              <a key={a} href={`/site/${tenantSlug}/areas`} className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium hover:border-[#1F8CFF] hover:text-[#1F8CFF] transition-colors" style={{ color: TEXT }}>{a}</a>
            ))}
          </div>
          <p className="text-center mt-8 text-sm" style={{ color: MUTED }}>Not sure if we cover your area? <a href={`/site/${tenantSlug}/contact`} className="font-semibold hover:underline" style={{ color: BLUE }}>Get in touch and we'll let you know.</a></p>
        </div>
      </section>

      {/* Reviews */}
      {featuredReviews?.length > 0 && (
        <section style={{ backgroundColor: NAVY }} className="py-20 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#8EC8FF" }}>Reviews</p>
              <h2 className="text-3xl sm:text-4xl font-bold">Trusted By Homeowners Across Essex And London</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredReviews.map((r: any) => (
                <div key={r.id} className="rounded-2xl p-7 space-y-4" style={{ backgroundColor: "#0F1E2E" }}>
                  <StarRating rating={r.rating}/>
                  {r.title && <h3 className="font-bold text-white">{r.title}</h3>}
                  <p className="text-sm text-slate-300 leading-relaxed">"{r.content}"</p>
                  <div className="pt-3 border-t border-slate-700/50">
                    <div className="text-sm font-semibold text-white">{r.reviewerName}</div>
                    {r.reviewerLocation && <div className="text-xs text-slate-500 mt-0.5">{r.reviewerLocation}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <OutlineBtn href={`/site/${tenantSlug}/reviews`} dark>Read All Reviews</OutlineBtn>
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {globalFaqs?.length > 0 && (
        <section style={{ backgroundColor: LIGHT_BG }} className="py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: BLUE }}>FAQs</p>
              <h2 className="text-3xl font-bold" style={{ color: TEXT }}>Common Questions About Rendering</h2>
            </div>
            <div className="space-y-3">
              {globalFaqs.map((faq: any) => (
                <details key={faq.id} className="group rounded-xl border border-slate-200 bg-white px-6 py-5">
                  <summary className="flex cursor-pointer items-center justify-between font-semibold" style={{ color: TEXT }}>
                    {faq.question}
                    <svg className="w-5 h-5 flex-shrink-0 transition-transform group-open:rotate-180" style={{ color: BLUE }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <p className="mt-4 text-sm leading-relaxed" style={{ color: MUTED }}>{faq.answer}</p>
                </details>
              ))}
            </div>
            <div className="mt-8 text-center">
              <BlueBtn href={`/site/${tenantSlug}/faqs`}>View All FAQs</BlueBtn>
            </div>
          </div>
        </section>
      )}

      {/* Quote CTA */}
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>

      {/* Final CTA */}
      <section style={{ backgroundColor: BLUE }} className="py-14">
        <div className="max-w-3xl mx-auto px-4 text-center text-white space-y-5">
          <h2 className="text-3xl font-bold">Transform Your Exterior With AMO Rendering</h2>
          <a href={`/site/${tenantSlug}/quote`} className="inline-flex items-center rounded-md bg-white px-8 py-3 text-sm font-bold hover:bg-slate-50 transition-colors" style={{ color: BLUE }}>
            Get My Free Quote
          </a>
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
  const list = (services as any[])?.length ? (services as any[]) : STATIC_SERVICES;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <SectionHero title="Rendering Services" subtitle="Professional rendering solutions for homes and commercial properties across Essex and London"/>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <Spinner/> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((s: any) => (
              <a key={s.id || s.slug} href={`/site/${tenantSlug}/services/${s.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-7 space-y-4 hover:border-[#1F8CFF] hover:shadow-md transition-all">
                <h2 className="text-xl font-bold group-hover:text-[#1F8CFF] transition-colors" style={{ color: TEXT }}>{s.name}</h2>
                {s.tagline && <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BLUE }}>{s.tagline}</p>}
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{s.desc || s.description}</p>
                {(s.benefits as string[])?.length > 0 && (
                  <ul className="space-y-2">
                    {(s.benefits as string[]).slice(0, 3).map((b: string) => (
                      <li key={b} className="flex items-center gap-2 text-xs" style={{ color: MUTED }}><CheckIcon color={BLUE}/>{b}</li>
                    ))}
                  </ul>
                )}
                <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: BLUE }}>Find out more →</span>
              </a>
            ))}
          </div>
        )}
      </section>
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function ServiceDetailPage({ tenantSlug, slug }: { tenantSlug: string; slug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: service, isLoading } = useGetPublicService(tenantSlug, slug);
  const { tenant, settings } = (siteData as any) || {};
  const s = service as any;
  const staticService = STATIC_SERVICES.find(ss => ss.slug === slug);
  const fallback = staticService || { name: slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), desc: "" };

  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      {isLoading ? <Spinner/> : (
        <>
          <div style={{ backgroundColor: NAVY }} className="py-16 px-4 sm:px-6 text-white">
            <div className="max-w-4xl mx-auto space-y-4">
              <a href={`/site/${tenantSlug}/services`} className="text-xs font-semibold uppercase tracking-wide opacity-60 hover:opacity-100 transition-opacity">← All Services</a>
              {(s?.tagline) && <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#8EC8FF" }}>{s.tagline}</p>}
              <h1 className="text-4xl font-bold">{s?.name || fallback.name}</h1>
              <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">{s?.description || fallback.desc}</p>
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Free Quote</BlueBtn>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-12">
            {(s?.benefits as string[])?.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-6" style={{ color: TEXT }}>Key Benefits</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(s.benefits as string[]).map((b: string) => (
                    <div key={b} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 bg-white">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: BLUE }}>
                        <CheckIcon color="white"/>
                      </div>
                      <span className="text-sm" style={{ color: TEXT }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s?.content && <div className="prose prose-slate max-w-none leading-relaxed" style={{ color: MUTED }}>{s.content}</div>}
            <div className="rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: BLUE + "10", border: `1px solid ${BLUE}30` }}>
              <h3 className="text-xl font-bold" style={{ color: TEXT }}>Interested in {s?.name || fallback.name}?</h3>
              <p className="text-sm" style={{ color: MUTED }}>Get a free quote — no obligation, photo upload available.</p>
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Free Quote</BlueBtn>
            </div>
          </div>
        </>
      )}
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
      <SectionHero title="Areas We Cover" subtitle="Rendering services across Essex and London for domestic and commercial properties"/>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <Spinner/> : (
          <>
            {(areas as any[])?.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                {(areas as any[]).map((a: any) => (
                  <a key={a.id} href={`/site/${tenantSlug}/areas/${a.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-7 space-y-3 hover:border-[#1F8CFF] hover:shadow-md transition-all">
                    <h2 className="text-xl font-bold group-hover:text-[#1F8CFF] transition-colors" style={{ color: TEXT }}>{a.name}</h2>
                    {a.county && <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: BLUE }}>{a.county}</p>}
                    {a.description && <p className="text-sm leading-relaxed line-clamp-3" style={{ color: MUTED }}>{a.description}</p>}
                    <span className="text-sm font-semibold" style={{ color: BLUE }}>See rendering services →</span>
                  </a>
                ))}
              </div>
            )}
            <div className="rounded-2xl p-8" style={{ backgroundColor: LIGHT_BG }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: TEXT }}>Additional Areas</h2>
              <div className="flex flex-wrap gap-3">
                {ALL_AREAS.map(a => (
                  <span key={a} className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm" style={{ color: TEXT }}>{a}</span>
                ))}
              </div>
              <p className="mt-6 text-sm" style={{ color: MUTED }}>Not listed? <a href={`/site/${tenantSlug}/contact`} className="font-semibold" style={{ color: BLUE }}>Contact us to check availability.</a></p>
            </div>
          </>
        )}
      </section>
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>
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
      {isLoading ? <Spinner/> : a ? (
        <>
          <div style={{ backgroundColor: NAVY }} className="py-16 px-4 sm:px-6 text-white">
            <div className="max-w-4xl mx-auto space-y-3">
              <a href={`/site/${tenantSlug}/areas`} className="text-xs font-semibold uppercase tracking-wide opacity-60 hover:opacity-100 transition-opacity">← All Areas</a>
              {a.county && <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#8EC8FF" }}>{a.county}</p>}
              <h1 className="text-4xl font-bold">Rendering Services in {a.name}</h1>
              {a.description && <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">{a.description}</p>}
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Get a Quote for {a.name}</BlueBtn>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">
            <div>
              <h2 className="text-2xl font-bold mb-4" style={{ color: TEXT }}>Services Available in {a.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STATIC_SERVICES.map(s => (
                  <a key={s.slug} href={`/site/${tenantSlug}/services/${s.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-[#1F8CFF] transition-colors">
                    <h3 className="font-semibold text-sm" style={{ color: TEXT }}>{s.name}</h3>
                    <p className="text-xs mt-1" style={{ color: MUTED }}>{s.desc}</p>
                  </a>
                ))}
              </div>
            </div>
            {a.content && <p className="leading-relaxed" style={{ color: MUTED }}>{a.content}</p>}
            <div className="rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: BLUE + "10", border: `1px solid ${BLUE}30` }}>
              <h3 className="text-xl font-bold" style={{ color: TEXT }}>Get a Free Rendering Quote in {a.name}</h3>
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Free Quote</BlueBtn>
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
      <SectionHero title="Before & After Gallery" subtitle="Real rendering projects across Essex and London — see the transformation"/>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {(beforeAfter as any[])?.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: TEXT }}>Rendering Transformations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(beforeAfter as any[]).map((ba: any) => (
                <div key={ba.id} className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-2">
                    <div className="relative"><img src={ba.beforeImageUrl} alt="Before" className="w-full h-52 object-cover"/><span className="absolute top-3 left-3 rounded-md bg-slate-900/75 px-2 py-1 text-xs text-white font-semibold">Before</span></div>
                    <div className="relative"><img src={ba.afterImageUrl} alt="After" className="w-full h-52 object-cover"/><span className="absolute top-3 left-3 rounded-md px-2 py-1 text-xs text-white font-semibold" style={{ backgroundColor: BLUE }}>After</span></div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-sm" style={{ color: TEXT }}>{ba.title}</h3>
                    {ba.description && <p className="text-xs mt-1" style={{ color: MUTED }}>{ba.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isLoading ? <Spinner/> : (images as any[])?.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-8 text-center" style={{ color: TEXT }}>Project Gallery</h2>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {(images as any[]).map((img: any) => (
                <div key={img.id} className="break-inside-avoid rounded-xl overflow-hidden border border-slate-100">
                  <img src={img.imageUrl} alt={img.altText || img.caption || ''} className="w-full object-cover"/>
                  {img.caption && <p className="p-3 text-xs" style={{ color: MUTED }}>{img.caption}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

function ReviewsPage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { data: reviews, isLoading } = useListPublicReviews(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const list = reviews as any[];
  const avgRating = list?.length ? Math.round(list.reduce((s, r) => s + r.rating, 0) / list.length * 10) / 10 : 0;
  return (
    <div>
      <SiteNav tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
      <div style={{ backgroundColor: NAVY }} className="py-16 px-4 text-center text-white">
        <h1 className="text-4xl font-bold">Trusted By Homeowners Across Essex And London</h1>
        {list?.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <StarRating rating={5}/>
            <span className="text-slate-300 text-sm">{avgRating} average from {list.length} reviews</span>
          </div>
        )}
      </div>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <Spinner/> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {list?.map((r: any) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-7 space-y-4">
                <StarRating rating={r.rating}/>
                {r.title && <h3 className="font-bold" style={{ color: TEXT }}>{r.title}</h3>}
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>"{r.content}"</p>
                <div className="pt-3 border-t border-slate-100">
                  <div className="font-semibold text-sm" style={{ color: TEXT }}>{r.reviewerName}</div>
                  {r.reviewerLocation && <div className="text-xs mt-0.5" style={{ color: MUTED }}>{r.reviewerLocation}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>
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
      <SectionHero title="Case Studies" subtitle="Detailed rendering projects from across Essex and London"/>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <Spinner/> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(caseStudies as any[])?.map((cs: any) => (
              <a key={cs.id} href={`/site/${tenantSlug}/case-studies/${cs.slug}`} className="group rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all bg-white">
                {cs.heroImageUrl
                  ? <img src={cs.heroImageUrl} alt={cs.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"/>
                  : <div className="w-full h-48 flex items-center justify-center" style={{ backgroundColor: BLUE + "10" }}>
                      <svg className="w-12 h-12 opacity-20" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/></svg>
                    </div>
                }
                <div className="p-5 space-y-2">
                  {cs.location && <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: BLUE }}>{cs.location}</div>}
                  <h2 className="font-bold" style={{ color: TEXT }}>{cs.title}</h2>
                  <p className="text-sm" style={{ color: MUTED }}>{cs.tagline}</p>
                  {cs.projectDuration && <div className="text-xs" style={{ color: MUTED }}>Duration: {cs.projectDuration}</div>}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>
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
      {isLoading ? <Spinner/> : c ? (
        <>
          {c.heroImageUrl && <img src={c.heroImageUrl} alt={c.title} className="w-full h-72 object-cover"/>}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div>
              <a href={`/site/${tenantSlug}/case-studies`} className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>← Case Studies</a>
              {c.location && <div className="text-sm font-semibold uppercase tracking-widest mt-3" style={{ color: BLUE }}>{c.location}</div>}
              <h1 className="text-3xl font-bold mt-2" style={{ color: TEXT }}>{c.title}</h1>
              {c.tagline && <p className="text-xl mt-2" style={{ color: MUTED }}>{c.tagline}</p>}
              <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: MUTED }}>
                {c.clientName && <span>Client: {c.clientName}</span>}
                {c.projectDuration && <span>Duration: {c.projectDuration}</span>}
              </div>
            </div>
            {c.challenge && (
              <div>
                <h2 className="text-xl font-bold mb-3" style={{ color: TEXT }}>The Challenge</h2>
                <p className="leading-relaxed" style={{ color: MUTED }}>{c.challenge}</p>
              </div>
            )}
            {c.solution && (
              <div>
                <h2 className="text-xl font-bold mb-3" style={{ color: TEXT }}>Our Solution</h2>
                <p className="leading-relaxed" style={{ color: MUTED }}>{c.solution}</p>
              </div>
            )}
            {c.result && (
              <div className="rounded-2xl p-6" style={{ backgroundColor: BLUE + "10", border: `1px solid ${BLUE}30` }}>
                <h2 className="text-xl font-bold mb-3" style={{ color: TEXT }}>The Result</h2>
                <p className="leading-relaxed" style={{ color: TEXT }}>{c.result}</p>
              </div>
            )}
            <div className="rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: LIGHT_BG }}>
              <h3 className="text-xl font-bold" style={{ color: TEXT }}>Like what you see?</h3>
              <p className="text-sm" style={{ color: MUTED }}>Request a free quote for your property.</p>
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Get a Free Quote</BlueBtn>
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
      <SectionHero title="Frequently Asked Questions" subtitle="Everything you need to know about rendering"/>
      <section className="py-16 max-w-3xl mx-auto px-4 sm:px-6 space-y-3">
        {isLoading ? <Spinner/> : (faqs as any[])?.map((faq: any) => (
          <details key={faq.id} className="group rounded-xl border border-slate-200 bg-white px-6 py-5">
            <summary className="flex cursor-pointer items-center justify-between font-semibold" style={{ color: TEXT }}>
              {faq.question}
              <svg className="w-5 h-5 flex-shrink-0 transition-transform group-open:rotate-180" style={{ color: BLUE }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: MUTED }}>{faq.answer}</p>
          </details>
        ))}
      </section>
      <QuoteCTASection tenantSlug={tenantSlug} phone={settings?.phone}/>
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
      <SectionHero title="Rendering Advice & News" subtitle="Guides, project showcases and tips for homeowners"/>
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {isLoading ? <Spinner/> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(posts as any[])?.map((post: any) => (
              <a key={post.id} href={`/site/${tenantSlug}/blog/${post.slug}`} className="group rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all bg-white">
                {post.heroImageUrl && <img src={post.heroImageUrl} alt={post.title} className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"/>}
                <div className="p-5 space-y-2">
                  <h2 className="font-bold group-hover:text-[#1F8CFF] transition-colors line-clamp-2" style={{ color: TEXT }}>{post.title}</h2>
                  {post.excerpt && <p className="text-sm line-clamp-3" style={{ color: MUTED }}>{post.excerpt}</p>}
                  <div className="flex items-center gap-3 text-xs pt-2" style={{ color: MUTED }}>
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
      {isLoading ? <Spinner/> : p ? (
        <>
          {p.heroImageUrl && <img src={p.heroImageUrl} alt={p.title} className="w-full h-64 object-cover"/>}
          <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
            <div className="mb-8 space-y-3">
              <a href={`/site/${tenantSlug}/blog`} className="text-xs font-semibold uppercase tracking-wide" style={{ color: MUTED }}>← Blog</a>
              <h1 className="text-3xl font-bold" style={{ color: TEXT }}>{p.title}</h1>
              <div className="flex items-center gap-4 text-sm" style={{ color: MUTED }}>
                {p.authorName && <span>By {p.authorName}</span>}
                {p.readTime && <span>{p.readTime} min read</span>}
                {p.publishedAt && <span>{new Date(p.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              </div>
              {p.excerpt && <p className="text-lg font-medium leading-relaxed border-l-4 pl-4" style={{ color: TEXT, borderColor: BLUE }}>{p.excerpt}</p>}
            </div>
            <div className="prose prose-slate max-w-none leading-relaxed" style={{ color: TEXT }}>{p.content}</div>
            <div className="mt-12 rounded-2xl p-8 text-center space-y-4" style={{ backgroundColor: LIGHT_BG }}>
              <h3 className="text-xl font-bold" style={{ color: TEXT }}>Ready to transform your property?</h3>
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Free Quote</BlueBtn>
            </div>
          </article>
        </>
      ) : <div className="p-8 text-center text-slate-500">Post not found</div>}
      <SiteFooter tenant={tenant} settings={settings} tenantSlug={tenantSlug}/>
    </div>
  );
}

const PROPERTY_TYPES = ["Detached house","Semi-detached house","Terraced house","End-of-terrace","Bungalow","Commercial property","Flat / apartment block","Other"];
const SURFACE_TYPES = ["Existing render","Pebbledash","Brick","Block","Other / not sure"];
const TIMEFRAMES = ["ASAP","Within 1 month","1–3 months","3–6 months","Planning stage"];

function QuotePage({ tenantSlug }: { tenantSlug: string }) {
  const { data: siteData } = useGetPublicSite(tenantSlug);
  const { tenant, settings } = (siteData as any) || {};
  const mutation = useSubmitQuoteRequest();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', city: '', postcode: '',
    serviceInterest: '', notes: '', propertyType: '', existingSurface: '', desiredFinish: '', timeframe: '',
    photoUrls: [] as string[],
  });
  const [submitted, setSubmitted] = useState(false);
  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [field]: e.target.value });
  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F8CFF] focus:border-[#1F8CFF] transition";
  const labelCls = "block text-xs font-semibold uppercase tracking-wide mb-1";

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
      <div style={{ backgroundColor: NAVY }} className="py-16 px-4 text-center text-white">
        <h1 className="text-4xl font-bold">Request A Rendering Quote</h1>
        <p className="text-lg text-slate-300 mt-3 max-w-xl mx-auto">Tell us about your property and upload photos so AMO Rendering can assess the work and recommend the right render system.</p>
      </div>
      <section className="py-16 max-w-2xl mx-auto px-4 sm:px-6">
        {submitted ? (
          <div className="text-center space-y-5 py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: BLUE + "20" }}>
              <svg className="w-8 h-8" style={{ color: BLUE }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 className="text-2xl font-bold" style={{ color: TEXT }}>Quote Request Received</h2>
            <p style={{ color: MUTED }}>Thank you! We'll review your request and be in touch within 24 hours.</p>
            <BlueBtn href={`/site/${tenantSlug}`}>Back to Home</BlueBtn>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} style={{ color: MUTED }}>First name *</label><input required className={inputCls} value={form.firstName} onChange={f('firstName')}/></div>
              <div><label className={labelCls} style={{ color: MUTED }}>Last name *</label><input required className={inputCls} value={form.lastName} onChange={f('lastName')}/></div>
            </div>
            <div><label className={labelCls} style={{ color: MUTED }}>Phone *</label><input required className={inputCls} value={form.phone} onChange={f('phone')}/></div>
            <div><label className={labelCls} style={{ color: MUTED }}>Email *</label><input required type="email" className={inputCls} value={form.email} onChange={f('email')}/></div>
            <div><label className={labelCls} style={{ color: MUTED }}>Property address</label><input className={inputCls} value={form.address} onChange={f('address')}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls} style={{ color: MUTED }}>Town / city</label><input className={inputCls} value={form.city} onChange={f('city')}/></div>
              <div><label className={labelCls} style={{ color: MUTED }}>Postcode</label><input className={inputCls} value={form.postcode} onChange={f('postcode')}/></div>
            </div>
            <div><label className={labelCls} style={{ color: MUTED }}>Property type</label>
              <select className={inputCls} value={form.propertyType} onChange={f('propertyType')}>
                <option value="">Select...</option>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={labelCls} style={{ color: MUTED }}>Service required</label>
              <select className={inputCls} value={form.serviceInterest} onChange={f('serviceInterest')}>
                <option value="">Select...</option>
                {["Silicone Rendering","Monocouche Rendering","K Rend","External Wall Insulation","Pebbledash Removal","Render Repairs","Crack Repairs","Not sure"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelCls} style={{ color: MUTED }}>Existing surface</label>
              <select className={inputCls} value={form.existingSurface} onChange={f('existingSurface')}>
                <option value="">Select...</option>
                {SURFACE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={labelCls} style={{ color: MUTED }}>Desired finish</label><input className={inputCls} placeholder="e.g. smooth white silicone, light grey monocouche..." value={form.desiredFinish} onChange={f('desiredFinish')}/></div>
            <div><label className={labelCls} style={{ color: MUTED }}>Timeframe</label>
              <select className={inputCls} value={form.timeframe} onChange={f('timeframe')}>
                <option value="">Select...</option>
                {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={labelCls} style={{ color: MUTED }}>Additional notes</label><textarea rows={4} className={inputCls} placeholder="Any additional details about your property or project..." value={form.notes} onChange={f('notes')}/></div>
            <ImageUpload
              label="Property photos (optional — helps us quote accurately)"
              hint="Upload a photo of your property exterior · JPG or PNG · max 10MB"
              onUploaded={url => setForm({ ...form, photoUrls: [url] })}
            />
            <button type="submit" disabled={mutation.isPending} className="w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: BLUE }}>
              {mutation.isPending ? 'Submitting...' : 'Submit Quote Request'}
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
  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F8CFF] transition";

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
      <SectionHero title="Contact AMO Rendering" subtitle="Get in touch — we're happy to discuss your property and rendering options"/>
      <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold mb-5" style={{ color: TEXT }}>Get In Touch</h2>
              <div className="space-y-4 text-sm" style={{ color: MUTED }}>
                {settings?.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE + "15" }}>
                      <svg className="w-4 h-4" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
                    </div>
                    <div><p className="font-semibold" style={{ color: TEXT }}>Phone</p><a href={`tel:${settings.phone}`} className="hover:text-[#1F8CFF] transition-colors">{settings.phone}</a></div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE + "15" }}>
                    <svg className="w-4 h-4" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                  </div>
                  <div><p className="font-semibold" style={{ color: TEXT }}>Email</p><a href="mailto:info@amorendering.co.uk" className="hover:text-[#1F8CFF] transition-colors">info@amorendering.co.uk</a></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: BLUE + "15" }}>
                    <svg className="w-4 h-4" style={{ color: BLUE }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/></svg>
                  </div>
                  <div><p className="font-semibold" style={{ color: TEXT }}>Location</p><p>Grays, Thurrock, Essex</p><p className="text-xs">Serving Essex and London</p></div>
                </div>
              </div>
            </div>
            <div className="rounded-xl p-5 space-y-2" style={{ backgroundColor: LIGHT_BG }}>
              <p className="font-semibold text-sm" style={{ color: TEXT }}>Prefer to send photos?</p>
              <p className="text-sm" style={{ color: MUTED }}>Use our quote form to upload photos of your property and we'll provide a more accurate quote.</p>
              <BlueBtn href={`/site/${tenantSlug}/quote`}>Request a Photo Quote</BlueBtn>
            </div>
          </div>
          <div>
            {submitted ? (
              <div className="text-center space-y-4 py-12">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: BLUE + "20" }}>
                  <svg className="w-6 h-6" style={{ color: BLUE }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                </div>
                <h3 className="font-bold text-lg" style={{ color: TEXT }}>Message Sent</h3>
                <p className="text-sm" style={{ color: MUTED }}>We'll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-lg" style={{ color: TEXT }}>Send a Message</h3>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Your name *</label><input required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F8CFF]" value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })}/></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Email</label><input type="email" className={inputCls} value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.target.value })}/></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Phone</label><input className={inputCls} value={form.senderPhone} onChange={e => setForm({ ...form, senderPhone: e.target.value })}/></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Subject</label><input className={inputCls} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}/></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Message *</label><textarea required rows={5} className={inputCls} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}/></div>
                <button type="submit" disabled={mutation.isPending} className="w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: BLUE }}>
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
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', colourPreference: '', notes: '', photoUrls: [] as string[] });
  const [submitted, setSubmitted] = useState(false);
  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F8CFF] transition";

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
      <div style={{ backgroundColor: NAVY }} className="py-16 px-4 text-center text-white">
        <h1 className="text-4xl font-bold">Render Visualiser</h1>
        <p className="text-lg text-slate-300 mt-3">Upload a photo of your property and we'll show you what new render could look like</p>
      </div>
      <section className="py-16 max-w-2xl mx-auto px-4 sm:px-6">
        {submitted ? (
          <div className="text-center space-y-5 py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: BLUE + "20" }}>
              <svg className="w-8 h-8" style={{ color: BLUE }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            </div>
            <h2 className="text-2xl font-bold" style={{ color: TEXT }}>Request Received</h2>
            <p style={{ color: MUTED }}>We'll create a visualisation of your property and send it to you within 48 hours.</p>
            <BlueBtn href={`/site/${tenantSlug}`}>Back to Home</BlueBtn>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>Upload a photo of your property and we'll show you exactly what it could look like with new render applied.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>First name *</label><input required className={inputCls} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}/></div>
              <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Last name *</label><input required className={inputCls} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}/></div>
            </div>
            <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Email *</label><input required type="email" className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></div>
            <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Phone</label><input className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></div>
            <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Property address</label><input className={inputCls} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}/></div>
            <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Colour preference</label><input placeholder="e.g. Off-white, light grey, cream..." className={inputCls} value={form.colourPreference} onChange={e => setForm({ ...form, colourPreference: e.target.value })}/></div>
            <ImageUpload
              label="Property photo (optional but recommended)"
              hint="JPG or PNG · max 10MB — we'll apply the colour digitally"
              onUploaded={url => setForm({ ...form, photoUrls: [url] })}
            />
            <div><label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Additional notes</label><textarea rows={3} className={inputCls} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></div>
            <button type="submit" disabled={mutation.isPending} className="w-full rounded-lg py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: BLUE }}>
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
        <Route component={() => <HomePage tenantSlug={tenantSlug}/>}/>
      </Switch>
    </WouterRouter>
  );
}
