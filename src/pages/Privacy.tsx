import { ArrowLeft, Languages } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

/**
 * The privacy policy, as written by the app's owner. The text is legal content: it is kept
 * verbatim and in English only (translations would not be authoritative). Edit the wording
 * only on the owner's instructions; this file only gives it the app's layout.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

// Links inside running text are always underlined: color alone doesn't set them apart (WCAG 1.4.1).
const externalLink = 'text-primary underline underline-offset-4'

export function Privacy() {
  const { t, i18n } = useTranslation()
  const english = (i18n.resolvedLanguage ?? 'en') === 'en'

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/">
          <ArrowLeft />
          {t('help.back')}
        </Link>
      </Button>

      {!english && (
        <p className="bg-muted/50 text-muted-foreground flex max-w-3xl items-center gap-2 rounded-lg border p-3 text-sm">
          <Languages className="size-4 shrink-0" aria-hidden />
          {t('privacy.englishOnly')}
        </p>
      )}

      <article
        lang="en"
        className="bg-card max-w-3xl space-y-8 rounded-xl border p-6 leading-relaxed sm:p-8"
      >
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>

        <Section title="1. Data Controller">
          <p>
            The data controller responsible for processing personal data on this website is FRASD
            Artur Nowakowski, located at Poland, Janiego 57e, 44-200 Rybnik. You can contact us via
            email at contact [at] frasd.eu.
          </p>
        </Section>

        <Section title="2. Types of Personal Data Collected">
          <p>When you visit our website, we may collect the following types of personal data:</p>
          <List
            items={[
              'IP address,',
              'Browser information (e.g., type, version, language),',
              'Data related to your advertising preferences (collected through Google AdSense).',
            ]}
          />
        </Section>

        <Section title="3. Purpose of Data Processing">
          <p>We collect and process personal data for the following purposes:</p>
          <List
            items={[
              'To display personalized advertisements using Google AdSense,',
              'To improve the functionality of our website,',
              'To analyze website traffic and user behavior.',
            ]}
          />
        </Section>

        <Section title="4. Legal Basis for Data Processing">
          <p>We process personal data based on the following legal grounds:</p>
          <List
            items={[
              'Your consent, which is given when you accept cookies or other tracking technologies,',
              "Our legitimate interest in improving and maintaining the website's performance.",
            ]}
          />
        </Section>

        <Section title="5. Recipients of Personal Data">
          <p>We may share your personal data with the following third parties:</p>
          <List
            items={[
              'Google LLC, as part of the Google AdSense program,',
              'Service providers who assist us in website maintenance and analytics.',
            ]}
          />
        </Section>

        <Section title="6. Google AdSense and Third-Party Advertisers">
          <p>
            Our website uses Google AdSense, a service provided by Google, to display
            advertisements. Google AdSense may use cookies and web beacons to collect data from
            users, including:
          </p>
          <List items={['Demographic information,', 'Interests,', 'Website interactions.']} />
          <p>
            Google may use this data to show personalized ads based on your browsing behavior. You
            can learn more about how Google uses data{' '}
            <a
              className={externalLink}
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noreferrer"
            >
              here
            </a>
            .
          </p>
        </Section>

        <Section title="7. Cookies and Tracking Technologies">
          <p>We use cookies and similar tracking technologies to:</p>
          <List
            items={[
              'Display relevant advertisements,',
              'Analyze user behavior,',
              'Improve website functionality.',
            ]}
          />
          <p>
            By continuing to use our website, you consent to the use of cookies. You can manage or
            withdraw your consent at any time through your browser settings. For more information on
            how we use cookies, please refer to our{' '}
            <Link className={externalLink} to="/privacy">
              Cookie Policy.
            </Link>
          </p>
        </Section>

        <Section title="8. Transfer of Data Outside the European Economic Area (EEA)">
          <p>
            Your personal data may be transferred to and processed in countries outside the EEA,
            including the United States, where Google servers are located. In such cases, we ensure
            that appropriate safeguards, such as Standard Contractual Clauses (SCCs), are in place
            to protect your data.
          </p>
        </Section>

        <Section title="9. Data Retention">
          <p>
            We retain your personal data for as long as necessary to fulfill the purposes outlined
            in this Privacy Policy, or as required by law. Data related to cookies and
            advertisements is typically retained for [specify retention period, e.g., 12 months].
          </p>
        </Section>

        <Section title="10. Your Rights">
          <p>You have the following rights regarding your personal data:</p>
          <List
            items={[
              <>
                <strong>Right to access</strong> – You can request a copy of the data we hold about
                you,
              </>,
              <>
                <strong>Right to rectification</strong> – You can request corrections to inaccurate
                data,
              </>,
              <>
                <strong>Right to erasure</strong> – You can request the deletion of your data,
              </>,
              <>
                <strong>Right to restrict processing</strong> – You can request to limit the
                processing of your data,
              </>,
              <>
                <strong>Right to data portability</strong> – You can request to receive your data in
                a structured, machine-readable format,
              </>,
              <>
                <strong>Right to object</strong> – You can object to the processing of your data,
                including for marketing purposes.
              </>,
            ]}
          />
          <p>To exercise your rights, please contact us at [Your Contact Information].</p>
        </Section>

        <Section title="11. Automated Decision-Making and Profiling">
          <p>
            We do not engage in automated decision-making or profiling that has a legal or similarly
            significant impact on individuals, except in cases where such activities are required
            for displaying personalized ads through Google AdSense.
          </p>
        </Section>

        <Section title="12. Security Measures">
          <p>
            We implement appropriate technical and organizational measures to protect your personal
            data from unauthorized access, loss, or misuse. These measures include encryption,
            access controls, and regular security audits.
          </p>
        </Section>

        <Section title="13. Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time to reflect changes in legal
            requirements or our data processing practices. Any changes will be posted on this page
            with an updated &quot;last modified&quot; date.
          </p>
        </Section>

        <Section title="14. Contact Information">
          <p>
            If you have any questions or concerns about this Privacy Policy or how we handle your
            personal data, please contact us at contact [at] frasd.eu.
          </p>
        </Section>

        <p className="text-muted-foreground">
          <em>Last updated: 2024/09/23</em>
        </p>
      </article>
    </div>
  )
}
