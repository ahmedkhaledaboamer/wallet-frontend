/** Wraps text in a Unicode left-to-right isolate (LRI…PDI) so figures/ranges keep their order inside RTL sentences. */
export const LRI = String.fromCharCode(0x2066);
export const PDI = String.fromCharCode(0x2069);
export const ltr = (s: string) => `${LRI}${s}${PDI}`;
