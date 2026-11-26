import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Help() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/">
          <ArrowLeft />
          {t('help.back')}
        </Link>
      </Button>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('help.title')}</h1>
        <p className="text-muted-foreground max-w-prose">{t('help.intro')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('help.stepsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-1.5 pl-5">
              {(['step1', 'step2', 'step3', 'step4'] as const).map((k) => (
                <li key={k}>{t(`help.${k}`)}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('help.rulesTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>{t('help.ruleCopy')}</li>
              <li>{t('help.ruleFollow')}</li>
              <li>{t('help.ruleLocal')}</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t('help.orderTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-prose">{t('help.order')}</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm">
        <a
          className="text-primary underline-offset-4 hover:underline"
          href="/privacypolicy.html"
          target="_blank"
          rel="noreferrer"
        >
          {t('help.privacy')}
        </a>
      </p>
    </div>
  )
}
