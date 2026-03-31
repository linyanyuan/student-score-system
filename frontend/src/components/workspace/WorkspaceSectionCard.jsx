export default function WorkspaceSectionCard({
  eyebrow,
  title,
  description,
  extra,
  children,
  className,
}) {
  const rootClassName = ['workspace-section-card', className].filter(Boolean).join(' ')

  return (
    <section className={rootClassName}>
      <div className="workspace-section-header">
        <div className="workspace-section-titles">
          {eyebrow ? <div className="workspace-section-eyebrow">{eyebrow}</div> : null}
          {title ? <h2 className="workspace-section-title">{title}</h2> : null}
          {description ? <p className="workspace-section-description">{description}</p> : null}
        </div>
        {extra ? <div className="workspace-section-extra">{extra}</div> : null}
      </div>
      {children ? <div className="workspace-section-body">{children}</div> : null}
    </section>
  )
}
