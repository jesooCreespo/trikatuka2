import { allowedWorkerUrl, installDefaultTrustedTypesPolicy } from './trusted-types';

const ORIGIN = 'https://trikatuka.example';

describe('allowedWorkerUrl', () => {
  it("accepts the app's own worker chunks", () => {
    expect(allowedWorkerUrl(`${ORIGIN}/worker-AUM3Q3XG.js`, ORIGIN)).toBe(
      `${ORIGIN}/worker-AUM3Q3XG.js`,
    );
    expect(allowedWorkerUrl('/worker-abc_1.js', ORIGIN)).toBe(`${ORIGIN}/worker-abc_1.js`);
    expect(allowedWorkerUrl('/worker-abc.js?v=1', ORIGIN)).toBe(`${ORIGIN}/worker-abc.js?v=1`);
  });

  it('rejects everything else', () => {
    for (const input of [
      'https://evil.example/worker-AUM3Q3XG.js',
      `${ORIGIN}/main-ABC.js`,
      'data:text/javascript,alert(1)',
      'blob:https://trikatuka.example/123',
      'javascript:alert(1)',
    ]) {
      expect(allowedWorkerUrl(input, ORIGIN), input).toBeNull();
    }
  });
});

describe('installDefaultTrustedTypesPolicy', () => {
  it('registers a "default" policy that only creates script URLs', () => {
    const createPolicy = vi.fn();
    installDefaultTrustedTypesPolicy({ createPolicy }, ORIGIN);
    expect(createPolicy).toHaveBeenCalledWith('default', {
      createScriptURL: expect.any(Function),
    });
    const rules = createPolicy.mock.calls[0]![1] as { createScriptURL: (s: string) => unknown };
    expect(rules.createScriptURL(`${ORIGIN}/worker-a.js`)).toBe(`${ORIGIN}/worker-a.js`);
    expect(rules.createScriptURL('https://evil.example/x.js')).toBeNull();
  });

  it('does nothing without Trusted Types and never throws', () => {
    expect(() => installDefaultTrustedTypesPolicy(undefined, ORIGIN)).not.toThrow();
    const createPolicy = vi.fn(() => {
      throw new Error('policy exists');
    });
    expect(() => installDefaultTrustedTypesPolicy({ createPolicy }, ORIGIN)).not.toThrow();
  });
});
