export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-8xl font-black text-slate-100 select-none">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-500 max-w-sm">
        Sorry, we couldn't find the page you're looking for. It may have been moved or no longer exists.
      </p>
      <a
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-md bg-[#1F8CFF] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
      >
        Go to homepage
      </a>
    </div>
  );
}
