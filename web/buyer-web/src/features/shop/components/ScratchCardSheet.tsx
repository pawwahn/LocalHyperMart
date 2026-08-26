import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/shared/ui';
import { revealScratchCard, type ScratchCardDto } from '../api/shopApi';

type Props = {
  card: ScratchCardDto;
  token: string;
  onClose: () => void;
  onRevealed: (card: ScratchCardDto) => void;
};

export function ScratchCardSheet({ card, token, onClose, onRevealed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(
    card.status === 'REVEALED' && card.revealedAmount != null ? Number(card.revealedAmount) : null,
  );
  const revealed = amount != null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#c4c4c8');
    grad.addColorStop(0.45, '#f4f4f5');
    grad.addColorStop(1, '#9ca3af');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(15,23,42,0.45)';
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCRATCH', w / 2, h / 2 + 6);
  }, [revealed, card.id]);

  function scratchAt(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || revealed || busy) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  function clearedRatio(): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let cleared = 0;
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 40) cleared += 1;
    }
    return cleared / (data.length / 16);
  }

  async function finishReveal() {
    if (revealed || busy || started.current) return;
    started.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await revealScratchCard(token, card.orderId);
      setAmount(Number(next.revealedAmount ?? 0));
      onRevealed(next);
      window.dispatchEvent(new Event('hlm:wallet-invalidate'));
    } catch (err) {
      started.current = false;
      setError(err instanceof Error ? err.message : 'Could not credit wallet');
    } finally {
      setBusy(false);
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scratchAt(e);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    scratchAt(e);
    if (clearedRatio() > 0.42) {
      drawing.current = false;
      void finishReveal();
    }
  }

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="scratch-title">
      <section style={styles.card}>
        <p style={styles.eyebrow}>You earned a scratch card</p>
        <h2 id="scratch-title" style={styles.title}>
          {revealed ? 'Added to wallet' : 'Scratch to reveal'}
        </h2>
        <p style={styles.sub}>
          {card.orderNumber ? `Order ${card.orderNumber}` : 'Thanks for your order'}
          {revealed
            ? ''
            : ` · win ₹${Math.round(Number(card.rewardMin))}–₹${Math.round(Number(card.rewardMax))}`}
        </p>

        <div style={styles.stage}>
          {revealed ? (
            <p style={styles.prize}>₹{Number(amount).toFixed(0)}</p>
          ) : (
            <canvas
              ref={canvasRef}
              width={280}
              height={120}
              style={styles.canvas}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => {
                drawing.current = false;
              }}
              onPointerLeave={() => {
                drawing.current = false;
              }}
            />
          )}
        </div>

        {error ? <p style={styles.error}>{error}</p> : null}

        <div style={styles.actions}>
          {revealed ? (
            <Button size="lg" fullWidth onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button size="lg" fullWidth disabled={busy} onClick={() => void finishReveal()}>
                {busy ? 'Crediting…' : 'Reveal now'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Later
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1300,
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: 'rgba(2, 6, 12, 0.62)',
  },
  card: {
    width: 'min(380px, 100%)',
    display: 'grid',
    gap: '0.45rem',
    padding: '1rem 1rem 0.9rem',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-elevated)',
    textAlign: 'center',
  },
  eyebrow: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display)',
    fontSize: '1.35rem',
    letterSpacing: '-0.03em',
  },
  sub: { margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 },
  stage: {
    margin: '0.35rem 0 0.15rem',
    minHeight: 120,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #0C831F, #085516)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  canvas: { width: '100%', height: 120, touchAction: 'none', cursor: 'pointer' },
  prize: {
    margin: 0,
    color: '#fff',
    fontFamily: 'var(--font-display)',
    fontSize: '2.4rem',
    fontWeight: 800,
  },
  error: { margin: 0, color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 700 },
  actions: { display: 'grid', gap: '0.35rem', marginTop: '0.2rem' },
};
