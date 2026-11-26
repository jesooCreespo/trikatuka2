import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { STEPS, type Step } from '@/state/wizard'

export function Stepper({ current }: { current: Step }) {
  const { t } = useTranslation()
  const index = STEPS.indexOf(current)

  return (
    <nav aria-label={t('steps.progress', { current: index + 1, total: STEPS.length })}>
      <p className="text-muted-foreground mb-2 text-xs font-medium sm:hidden">
        {t('steps.progress', { current: index + 1, total: STEPS.length })} · {t(`steps.${current}`)}
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i < index
          const active = i === index
          return (
            <li
              key={step}
              className="flex flex-1 items-center gap-1.5 sm:gap-2"
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary ring-primary/15 ring-4',
                  !done && !active && 'text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'hidden truncate text-sm lg:inline',
                  active ? 'font-medium' : 'text-muted-foreground',
                )}
              >
                {t(`steps.${step}`)}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={cn('bg-border h-px min-w-3 flex-1', done && 'bg-primary')}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
