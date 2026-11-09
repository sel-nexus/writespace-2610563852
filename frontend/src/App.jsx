/** Resolve only the implemented landing and an honest unknown-route state. */
import { Link, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { getDiscoverySession } from './utils/storage';

/** Render a safe, explicit response for every unimplemented or unknown route.
 * Returns:
 *   Not-found content with a navigation path back to discovery.
 */
function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-24">
      <h1 className="font-[Georgia,serif] text-4xl">Page not found</h1>
      <p className="mt-6 text-slate-600">This page is not available.</p>
      <Link to="/" className="mt-8 inline-flex rounded-lg px-4 py-3 text-indigo-600 underline focus-visible:outline focus-visible:outline-2">
        Back to Home
      </Link>
    </main>
  );
}

/** Select current discovery identity on each route-shell render.
 * Returns:
 *   Single route table without another router or future placeholder pages.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 font-['Helvetica_Neue',Arial,sans-serif] text-slate-800">
      <Routes>
        <Route path="/" element={<LandingPage session={getDiscoverySession()} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
