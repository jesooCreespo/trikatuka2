import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="text-muted-foreground border-t text-xs">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4">
        <span>
          {t('footer.by', { version: __APP_VERSION__ })}{' '}
          <a
            className="underline-offset-4 hover:underline"
            href="http://aknowakowski.blogspot.com"
            target="_blank"
            rel="noreferrer"
          >
            akn
          </a>
        </span>
        <a
          className="underline-offset-4 hover:underline"
          href="https://paypal.me/aartek"
          target="_blank"
          rel="noreferrer"
        >
          {t('footer.beer')}
        </a>
        <Link className="underline-offset-4 hover:underline" to="/privacy">
          {t('footer.privacy')}
        </Link>
        <span className="sm:ml-auto">{t('footer.disclaimer')}</span>
      </div>
    </footer>
  )
}
