export default function WorkspaceMetricCard({
  icon,
  label,
  value,
  helper,
  accent,
  footer,
  className,
}) {
  const rootClassName = ['workspace-metric-card', className].filter(Boolean).join(' ')
  const accentStyle = accent ? { background: accent.background, color: accent.color } : undefined

  return (
    <div className={rootClassName}>
      <div className="workspace-metric-icon" style={accentStyle}>
        {icon}
      </div>
      <div className="workspace-metric-body">
        {label ? <div className="workspace-metric-label">{label}</div> : null}
        {value ? <div className="workspace-metric-value">{value}</div> : null}
      </div>
      {helper ? <div className="workspace-metric-helper">{helper}</div> : null}
      {footer ? <div className="workspace-metric-footer">{footer}</div> : null}
    </div>
  )
}
