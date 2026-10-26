/** Human label for bundled membership slab codes on orders. */
export function membershipSlabLabel(slab: string | null | undefined): string {
  switch (slab) {
    case 'QUARTERLY':
      return '3 months';
    case 'HALF_YEAR':
      return '6 months';
    case 'ANNUAL':
      return '12 months';
    default:
      return slab?.trim() || 'plan';
  }
}
