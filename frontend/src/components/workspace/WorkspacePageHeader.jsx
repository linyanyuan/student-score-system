export default function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  children,
  className,
}) {
  const rootClassName = ['workspace-page-header', className].filter(Boolean).join(' ')

  return (
    <section className={rootClassName}>
      <div className="workspace-page-header-top">
        <div className="workspace-page-header-main">
          {eyebrow ? <div className="workspace-page-header-eyebrow">{eyebrow}</div> : null}
          {title ? <h1 className="workspace-page-header-title">{title}</h1> : null}
          {description ? <p className="workspace-page-header-description">{description}</p> : null}
        </div>
        {actions ? <div className="workspace-page-header-actions">{actions}</div> : null}
      </div>
      {meta ? <div className="workspace-page-header-meta">{meta}</div> : null}
      {children ? <div className="workspace-page-header-body">{children}</div> : null}
    </section>
  )
}
