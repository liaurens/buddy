import { gateGreeting, gateSubline, isGateNeeded } from './gateState';

describe('isGateNeeded', () => {
    it('gates while pending or unknown', () => {
        expect(isGateNeeded('pending')).toBe(true);
        expect(isGateNeeded(null)).toBe(true);
        expect(isGateNeeded(undefined)).toBe(true);
    });

    it('opens after done or an explicit skip', () => {
        expect(isGateNeeded('done')).toBe(false);
        expect(isGateNeeded('skipped')).toBe(false);
    });
});

describe('gateGreeting', () => {
    it('is time-aware', () => {
        expect(gateGreeting(8)).toBe('Good morning!');
        expect(gateGreeting(13)).toBe('Hi — starting fresh.');
        expect(gateGreeting(20)).toBe('Evening — better late than never.');
    });

    it('includes a name when given', () => {
        expect(gateGreeting(8, 'Loek')).toBe('Good morning, Loek!');
    });
});

describe('gateSubline', () => {
    it('nudges gently after noon', () => {
        expect(gateSubline(9)).toBe('Three tiny steps, then the day is yours.');
        expect(gateSubline(12)).toBe('The check-in still comes first — it only takes a minute.');
        expect(gateSubline(19)).toBe('The check-in still comes first — it only takes a minute.');
    });
});
