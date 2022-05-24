import { expect } from 'chai';
import { forFirestore } from '../dist/index';

describe('Parser Tests', () => {
  it('Will Parse Date Properly', () => {
    const parsed = forFirestore({
      startDate: new Date(),
    });
    const timestamp = parsed.startDate;
    expect(Object.keys(timestamp).length).to.equal(2);
    console.log(parsed);
  });
});
