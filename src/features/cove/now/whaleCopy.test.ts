import { displayNameFromEmail, whaleCopy, whaleGreeting, whaleStatus } from './whaleCopy';

describe('displayNameFromEmail', () => {
    it('takes the first segment of the local part, capitalised', () => {
        expect(displayNameFromEmail('sam.jones@example.com')).toBe('Sam');
        expect(displayNameFromEmail('LOEK@example.com')).toBe('Loek');
        expect(displayNameFromEmail('mia_v@example.com')).toBe('Mia');
    });

    it('strips trailing digits', () => {
        expect(displayNameFromEmail('sam99@example.com')).toBe('Sam');
    });

    it('falls back to nameless when the guess would read badly', () => {
        expect(displayNameFromEmail(undefined)).toBeUndefined();
        expect(displayNameFromEmail('')).toBeUndefined();
        // Too long — a mashed-together full name is not a greeting.
        expect(displayNameFromEmail('laureensdekkers44@example.com')).toBeUndefined();
        // Digits in the middle — not a plain name.
        expect(displayNameFromEmail('x1y2z@example.com')).toBeUndefined();
    });
});

describe('whaleGreeting', () => {
    it('greets by time of day', () => {
        expect(whaleGreeting(8)).toBe('Morning!');
        expect(whaleGreeting(12)).toBe('Hey!');
        expect(whaleGreeting(19)).toBe('Evening!');
    });

    it('includes the name when given', () => {
        expect(whaleGreeting(8, 'Loek')).toBe('Morning, Loek!');
    });

    it('treats 11:00 and 17:00 as boundaries', () => {
        expect(whaleGreeting(10)).toBe('Morning!');
        expect(whaleGreeting(11)).toBe('Hey!');
        expect(whaleGreeting(16)).toBe('Hey!');
        expect(whaleGreeting(17)).toBe('Evening!');
    });
});

describe('whaleStatus', () => {
    it('handles no picks planned', () => {
        expect(whaleStatus(0, 0, false)).toMatch(/Nothing planned yet/);
    });

    it('encourages before the first pick is done', () => {
        expect(whaleStatus(0, 3, false)).toBe('One small thing at a time. Ready?');
    });

    it('uses gentler copy on a survival day', () => {
        expect(whaleStatus(0, 1, true)).toBe('Just one small thing today. Ready?');
    });

    it('reports progress without rushing', () => {
        expect(whaleStatus(1, 3, false)).toBe('1 down, 2 to go. No rush.');
        expect(whaleStatus(2, 3, false)).toBe('2 down, 1 to go. No rush.');
    });

    it('celebrates when everything is done', () => {
        expect(whaleStatus(3, 3, false)).toBe('Everything done. I’m so proud of you!');
        expect(whaleStatus(1, 1, true)).toBe('Everything done. I’m so proud of you!');
    });
});

describe('whaleCopy', () => {
    it('combines greeting and status', () => {
        expect(whaleCopy(1, 3, 9, false, 'Loek')).toEqual({
            greeting: 'Morning, Loek!',
            status: '1 down, 2 to go. No rush.',
        });
    });
});
