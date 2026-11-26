import { render, screen } from '@testing-library/react'
import { i18nReady } from '@/i18n'
import { AdBanner } from './AdBanner'
import { ADSENSE_SCRIPT } from './adsense'
import { readAdsConfig, type AdsConfig } from './config'

const valid = {
  VITE_ADSENSE_ENABLED: 'true',
  VITE_ADSENSE_CLIENT: 'ca-pub-9007960458261252',
  VITE_ADSENSE_SLOT: '2734653062',
}

describe('readAdsConfig', () => {
  it('is off unless explicitly enabled', () => {
    expect(readAdsConfig({})).toBeNull()
    expect(readAdsConfig({ ...valid, VITE_ADSENSE_ENABLED: 'false' })).toBeNull()
    expect(readAdsConfig({ ...valid, VITE_ADSENSE_ENABLED: undefined })).toBeNull()
  })

  it('reads the IDs when enabled', () => {
    expect(readAdsConfig(valid)).toEqual({
      client: 'ca-pub-9007960458261252',
      slot: '2734653062',
      nonPersonalized: false,
    })
    expect(
      readAdsConfig({ ...valid, VITE_ADSENSE_NON_PERSONALIZED: 'TRUE' })?.nonPersonalized,
    ).toBe(true)
  })

  it('stays off with missing or malformed IDs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readAdsConfig({ ...valid, VITE_ADSENSE_CLIENT: '' })).toBeNull()
    expect(readAdsConfig({ ...valid, VITE_ADSENSE_CLIENT: 'pub-123"><script>' })).toBeNull()
    expect(readAdsConfig({ ...valid, VITE_ADSENSE_SLOT: 'abc' })).toBeNull()
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })
})

describe('AdBanner', () => {
  beforeAll(() => i18nReady)
  const config: AdsConfig = {
    client: 'ca-pub-9007960458261252',
    slot: '2734653062',
    nonPersonalized: true,
  }
  const scripts = () => document.querySelectorAll(`script[src^="${ADSENSE_SCRIPT}"]`)

  beforeEach(() => {
    document.head.innerHTML = ''
    delete window.adsbygoogle
  })

  it('renders nothing and loads nothing when ads are off', () => {
    const { container } = render(<AdBanner config={null} />)
    expect(container).toBeEmptyDOMElement()
    expect(scripts()).toHaveLength(0)
    expect(window.adsbygoogle).toBeUndefined()
  })

  it('renders one ad unit and loads the script once', () => {
    const { container } = render(
      <>
        <AdBanner config={config} />
        <AdBanner config={config} />
      </>,
    )
    const ins = container.querySelectorAll('ins.adsbygoogle')
    expect(ins).toHaveLength(2)
    expect(ins[0]).toHaveAttribute('data-ad-client', config.client)
    expect(ins[0]).toHaveAttribute('data-ad-slot', config.slot)
    expect(scripts()).toHaveLength(1)
    expect(scripts()[0]).toHaveAttribute('src', `${ADSENSE_SCRIPT}?client=${config.client}`)
    // One request per unit, and the non-personalized flag set before them.
    expect(window.adsbygoogle).toHaveLength(2)
    expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1)
    expect(screen.getAllByText('Advertisement')).toHaveLength(2)
  })
})
