/** Resolve public entry, local identity guards, and honest unknown-route content. */
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Home from './pages/Home';
import ReadBlog from './pages/ReadBlog';
import WriteBlog from './pages/WriteBlog';
import { getSession, roleHome } from './utils/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { PublicNavbar } from './components/PublicNavbar';

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

/** Select fresh local identity on each route transition.
 * Returns:
 *   Single route table without another router or future placeholder pages.
 */
export default function App() {
  const location = useLocation();
  const session = getSession();
  const authEntry = session ? <Navigate to={roleHome(session)} replace /> : <RegisterPage />;
  return (
    <div className="min-h-screen bg-slate-50 font-['Helvetica_Neue',Arial,sans-serif] text-slate-800">
      {location.pathname !== '/' && (session ? <Navbar session={session} /> : <PublicNavbar />)}
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route path="/login" element={session ? <Navigate to={roleHome(session)} replace /> : <LoginPage />} />
        <Route path="/register" element={authEntry} />
        {[
          ['/blogs', <Home />], ['/blog/:id', <ReadBlog />],
          ['/write', <WriteBlog key="create" />], ['/edit/:id', <WriteBlog key={location.pathname} />],
        ].map(([path, page]) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute>
                {page}
              </ProtectedRoute>
            }
          />
        ))}
        {['/admin', '/users'].map((path) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute adminOnly>
                <NotFound />
              </ProtectedRoute>
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}
