export const PEOPLE = {
  makenzie: { id: 'makenzie', name: 'Makenzie', role: 'Sales, partnerships, finance', district: 'Sales' },
  collin: { id: 'collin', name: 'Collin', role: 'Product and tech', district: 'Product' },
};
export const PERSON_IDS = ['makenzie', 'collin'];
export const OWNERS = { makenzie: 'Makenzie', collin: 'Collin', shared: 'Shared' };
export const partnerOf = (p) => (p === 'makenzie' ? 'collin' : 'makenzie');
export const nameOf = (p) => PEOPLE[p]?.name || OWNERS[p] || p;
