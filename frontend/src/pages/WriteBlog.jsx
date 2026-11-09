/** Share a controlled plain-text draft between creation and permitted editing. */
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getPosts } from '../utils/storage';
import { getSession } from '../utils/auth';
import { canManagePost } from '../utils/permissions';
import { createPost, updatePost } from '../utils/postMutations';

const inputStyle = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 focus-visible:outline focus-visible:outline-2';

/** Prefill only eligible targets and retain unsaved drafts after failures.
 * Returns:
 *   Editor, missing-target state or unauthorized redirect.
 */
export default function WriteBlog() {
  const { id } = useParams();
  const target = id ? getPosts().find((post) => post.id === id) : null;
  const permitted = !id || canManagePost(getSession(), target);
  const [values, setValues] = useState(() => ({
    title: permitted && target ? target.title : '', content: permitted && target ? target.content : '',
  }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  /** Validate and persist via fresh domain checks before changing the route.
   * Args:
   *   event: Form submission event.
   */
  function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const result = id ? updatePost(id, values) : createPost(values);
    setSubmitting(false);
    setErrors(result.errors || {});
    setError('');
    if (result.ok) navigate(`/blog/${encodeURIComponent(result.post.id)}`);
    else if (result.error === 'forbidden') navigate('/blogs', { replace: true });
    else if (result.error === 'not_found') setMissing(true);
    else if (result.error === 'generation_failed') setError('Your post could not be prepared. Nothing was saved. Please try again.');
    else if (result.error !== 'validation_failed') setError('Your post could not be saved locally. Your draft is still here. Please try again.');
  }

  if (id && (!target || missing)) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-[Georgia,serif] text-4xl">Post not found</h1>
        <Link to="/blogs" className="mt-8 inline-flex py-3 text-indigo-700 underline focus-visible:outline">
          Back to Blogs
        </Link>
      </main>
    );
  }
  if (!permitted) return <Navigate to="/blogs" replace />;
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-[Georgia,serif] text-4xl tracking-tight">{id ? 'Edit Post' : 'Write a Post'}</h1>
      <form onSubmit={submit} noValidate aria-busy={submitting} className="mt-8 space-y-6">
        <div>
          <label htmlFor="post-title" className="font-medium">Title</label>
          <input
            id="post-title"
            value={values.title}
            onChange={(event) => setValues({ ...values, title: event.target.value })}
            aria-required="true"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'post-title-error' : undefined}
            className={inputStyle}
          />
          {errors.title && (
            <p id="post-title-error" role="alert" className="mt-2 text-sm text-red-700">{errors.title}</p>
          )}
        </div>
        <div>
          <label htmlFor="post-content" className="font-medium">Content</label>
          <textarea
            id="post-content"
            value={values.content}
            onChange={(event) => setValues({ ...values, content: event.target.value })}
            aria-required="true"
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? 'post-content-error post-counter' : 'post-counter'}
            className={`${inputStyle} min-h-64 resize-y`}
          />
          {errors.content && (
            <p id="post-content-error" role="alert" className="mt-2 text-sm text-red-700">{errors.content}</p>
          )}
          <p id="post-counter" className="mt-2 text-sm tabular-nums text-slate-600">{values.content.length} characters</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        )}
        <div className="flex flex-wrap gap-6">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700 focus-visible:outline disabled:opacity-50"
          >
            {submitting ? 'Saving…' : id ? 'Save Changes' : 'Publish'}
          </button>
          <Link to="/blogs" className="rounded-lg px-4 py-3 text-slate-700 underline focus-visible:outline">
            Cancel
          </Link>
        </div>
      </form>
      <p className="mt-8 text-sm leading-relaxed text-slate-600">
        Local demo only. Posts stay in this browser and do not sync. Never enter sensitive information.
        Other tabs may overwrite changes; reload and check before retrying.
      </p>
    </main>
  );
}
