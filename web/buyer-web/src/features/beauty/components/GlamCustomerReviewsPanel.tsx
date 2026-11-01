import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchVendorBeautyReviews,
  type BeautyCustomerReview,
  type BeautyVendorReviewsSummary,
} from '../api/beautyApi';

type Props = {
  token: string;
  vendorId: string;
  artistName: string;
  /** Shown while the first page loads (from artist list preview). */
  preview?: BeautyCustomerReview[];
};

const PAGE_SIZE = 12;

function formatReviewDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function starBar(summary: BeautyVendorReviewsSummary, stars: 5 | 4 | 3 | 2 | 1): number {
  const count =
    stars === 5
      ? summary.stars5
      : stars === 4
        ? summary.stars4
        : stars === 3
          ? summary.stars3
          : stars === 2
            ? summary.stars2
            : summary.stars1;
  const total = Math.max(1, summary.totalRatings);
  return Math.round((count / total) * 100);
}

function ReviewCard({ review }: { review: BeautyCustomerReview }) {
  const stars = Math.min(5, Math.max(1, review.stars));
  return (
    <article className="hlm-glam-review-card">
      <div className="hlm-glam-review-card-head">
        <span className="hlm-glam-review-card-stars" aria-label={`${stars} out of 5 stars`}>
          {'★'.repeat(stars)}
          <span className="hlm-glam-review-card-stars-dim">{'★'.repeat(5 - stars)}</span>
        </span>
        {review.createdAt ? (
          <time className="hlm-glam-review-card-date" dateTime={review.createdAt}>
            {formatReviewDate(review.createdAt)}
          </time>
        ) : null}
      </div>
      <p className="hlm-glam-review-card-text">{review.comment}</p>
    </article>
  );
}

export function GlamCustomerReviewsPanel({ token, vendorId, artistName, preview = [] }: Props) {
  const [summary, setSummary] = useState<BeautyVendorReviewsSummary | null>(null);
  const [items, setItems] = useState<BeautyCustomerReview[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (pageIndex: number, append: boolean) => {
      if (!token || !vendorId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchVendorBeautyReviews(token, vendorId, pageIndex, PAGE_SIZE);
        setSummary(data.summary);
        setTotalPages(data.reviews.totalPages ?? 1);
        setTotalElements(data.reviews.totalElements ?? 0);
        setPage(data.reviews.page ?? pageIndex);
        const next = data.reviews.items ?? [];
        setItems((prev) => (append ? [...prev, ...next] : next));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load reviews');
        if (!append && preview.length > 0) {
          setItems(preview);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token, vendorId, preview],
  );

  useEffect(() => {
    setItems([]);
    setSummary(null);
    void loadPage(0, false);
  }, [vendorId, loadPage]);

  const displayItems = items.length > 0 ? items : preview;
  const commentCount = summary?.reviewsWithComments ?? (preview.length > 0 ? preview.length : 0);
  const avgDisplay = summary?.avgStars ?? null;

  const histogram = useMemo(() => {
    if (!summary || summary.totalRatings <= 0) return [];
    return ([5, 4, 3, 2, 1] as const).map((stars) => ({ stars, pct: starBar(summary, stars) }));
  }, [summary]);

  if (!loading && commentCount === 0 && displayItems.length === 0 && !error) {
    return null;
  }

  const hasMore = page + 1 < totalPages;
  const loadedCount = items.length > 0 ? items.length : displayItems.length;

  const inlineItems = sheetOpen ? displayItems : displayItems.slice(0, 3);

  const reviewsBlock = (list: BeautyCustomerReview[], listClass: string) => (
    <div className={listClass}>
      {loading && list.length === 0 ? (
        <p className="hlm-glam-reviews-muted">Loading reviews…</p>
      ) : (
        list.map((review, index) => <ReviewCard key={`${review.createdAt ?? 'r'}-${index}`} review={review} />)
      )}
    </div>
  );

  const actionsBlock = (showSeeAll: boolean) =>
    (showSeeAll && totalElements > 3) || (sheetOpen && (hasMore || totalElements > 0)) ? (
      <div className="hlm-glam-reviews-actions">
        {showSeeAll && totalElements > 3 ? (
          <button type="button" className="hlm-glam-reviews-link-btn" onClick={() => setSheetOpen(true)}>
            See all {totalElements} reviews
          </button>
        ) : null}
        {hasMore && sheetOpen ? (
          <button
            type="button"
            className="hlm-glam-reviews-load"
            disabled={loadingMore}
            onClick={() => void loadPage(page + 1, true)}
          >
            {loadingMore ? 'Loading…' : `Load more (${loadedCount} of ${totalElements})`}
          </button>
        ) : null}
        {!hasMore && loadedCount > 0 && totalElements > 0 && sheetOpen ? (
          <span className="hlm-glam-reviews-end">Showing all {totalElements} reviews with comments</span>
        ) : null}
      </div>
    ) : null;

  const summaryBlock = (
    <>
      <div className="hlm-glam-reviews-summary">
        <div className="hlm-glam-reviews-score-block">
          <span className="hlm-glam-reviews-score" aria-hidden>
            {avgDisplay != null ? Number(avgDisplay).toFixed(1) : '—'}
          </span>
          <span className="hlm-glam-reviews-score-label">
            {summary?.totalRatings ?? 0} rating{(summary?.totalRatings ?? 0) === 1 ? '' : 's'}
          </span>
          {commentCount > 0 ? (
            <span className="hlm-glam-reviews-comment-count">{commentCount} with comments</span>
          ) : null}
        </div>
        {histogram.length > 0 ? (
          <div className="hlm-glam-reviews-bars" aria-label="Rating breakdown">
            {histogram.map((row) => (
              <div key={row.stars} className="hlm-glam-reviews-bar-row">
                <span className="hlm-glam-reviews-bar-label">{row.stars}★</span>
                <div className="hlm-glam-reviews-bar-track">
                  <div className="hlm-glam-reviews-bar-fill" style={{ width: `${row.pct}%` }} />
                </div>
                <span className="hlm-glam-reviews-bar-pct">{row.pct}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <p className="hlm-glam-reviews-error">{error}</p> : null}
    </>
  );

  return (
    <>
      <section className="hlm-glam-reviews-panel" aria-label={`Customer reviews for ${artistName}`}>
        <div className="hlm-glam-reviews-panel-head">
          <h3 className="hlm-glam-reviews-title">Customer reviews</h3>
          <p className="hlm-glam-reviews-sub">Verified bookings · newest first</p>
        </div>
        {summaryBlock}
        {reviewsBlock(inlineItems, 'hlm-glam-reviews-list')}
        {actionsBlock(!sheetOpen)}
      </section>

      {sheetOpen ? (
        <div className="hlm-glam-reviews-sheet-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
          <div
            className="hlm-glam-reviews-sheet"
            role="dialog"
            aria-label={`All reviews — ${artistName}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hlm-glam-reviews-sheet-head">
              <div>
                <h3 className="hlm-glam-reviews-title">All reviews</h3>
                <p className="hlm-glam-reviews-sub">{artistName}</p>
              </div>
              <button type="button" className="hlm-glam-reviews-sheet-close" aria-label="Close" onClick={() => setSheetOpen(false)}>
                ✕
              </button>
            </div>
            {summaryBlock}
            {reviewsBlock(displayItems, 'hlm-glam-reviews-list hlm-glam-reviews-list--sheet')}
            {actionsBlock(false)}
          </div>
        </div>
      ) : null}
    </>
  );
}
