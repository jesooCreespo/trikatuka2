import { CircleHelp, Languages, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LANGUAGES } from '@/i18n'
import { useTheme, type ThemePreference } from '@/lib/theme'
import { Logo } from './Logo'

export function Header() {
  const { t, i18n } = useTranslation()
  const preference = useTheme((s) => s.preference)
  const setPreference = useTheme((s) => s.setPreference)
  const ThemeIcon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor
  const lang = i18n.resolvedLanguage ?? 'en'

  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2.5 rounded-md font-semibold tracking-tight">
          <Logo className="size-7" />
          <span>Trikatuka</span>
          <span className="text-muted-foreground hidden text-sm font-normal sm:inline">
            {t('app.tagline')}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={t('app.language')}>
                <Languages />
                <span className="uppercase">{lang}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('app.language')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={lang}
                onValueChange={(v) => void i18n.changeLanguage(v)}
              >
                {LANGUAGES.map((l) => (
                  <DropdownMenuRadioItem key={l.code} value={l.code}>
                    {l.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('app.theme')}>
                <ThemeIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('app.theme')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={preference}
                onValueChange={(v) => setPreference(v as ThemePreference)}
              >
                <DropdownMenuRadioItem value="system">{t('app.themeSystem')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light">{t('app.themeLight')}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">{t('app.themeDark')}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" asChild>
            <Link to="/help" aria-label={t('app.help')}>
              <CircleHelp />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
