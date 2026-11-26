import { readAdsConfig } from './config';

const valid = {
  enabled: true,
  client: 'ca-pub-9007960458261252',
  slot: '2734653062',
  nonPersonalized: false,
};

describe('readAdsConfig', () => {
  it('is off unless explicitly enabled', () => {
    expect(readAdsConfig({ ...valid, enabled: false })).toBeNull();
  });

  it('reads the IDs when enabled', () => {
    expect(readAdsConfig(valid)).toEqual({
      client: 'ca-pub-9007960458261252',
      slot: '2734653062',
      nonPersonalized: false,
    });
    expect(readAdsConfig({ ...valid, nonPersonalized: true })?.nonPersonalized).toBe(true);
  });

  it('stays off with missing or malformed IDs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readAdsConfig({ ...valid, client: '' })).toBeNull();
    expect(readAdsConfig({ ...valid, client: 'pub-123"><script>' })).toBeNull();
    expect(readAdsConfig({ ...valid, slot: 'abc' })).toBeNull();
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });
});
