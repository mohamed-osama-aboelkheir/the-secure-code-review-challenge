export default function UsageBar({ usage }) {
  const { usedBytes = 0, quotaBytes = 0 } = usage || {};
  const percent = quotaBytes ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
  const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);
  const quotaMb = Math.round(quotaBytes / (1024 * 1024));

  return (
    <div className="usage">
      <div className="usage-track">
        <div className="usage-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="muted">
        {usedMb} MB of {quotaMb} MB used
      </span>
    </div>
  );
}
