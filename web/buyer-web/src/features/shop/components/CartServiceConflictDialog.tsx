import { useNavigate } from 'react-router-dom';
import { foodCartLandingPath } from '@/features/food/lib/foodCartLanding';
import type { CartView } from '../api/shopApi';
import type { CartServiceMixConflict } from '../lib/cartServiceMix';
import { ConfirmDialog } from './ConfirmDialog';

type Props = {
  conflict: CartServiceMixConflict | null;
  cart: CartView | null;
  onClose: () => void;
};

export function CartServiceConflictDialog({ conflict, cart, onClose }: Props) {
  const navigate = useNavigate();
  const foodPath = foodCartLandingPath(cart) ?? '/food';

  if (!conflict) return null;

  const foodBlocksOther = conflict === 'food_blocks_other';

  const title = foodBlocksOther
    ? 'Food delivery items in your basket'
    : 'Grocery items in your basket';

  const description = foodBlocksOther
    ? 'You already have dishes from Koya Food in your basket. Grocery and other shop items cannot be added to the same order.'
    : 'You already have grocery items in your basket. Food from local hotels must be ordered separately.';

  const note = foodBlocksOther
    ? 'To shop grocery: open Basket and remove the food items — or tap Open Koya Food below (Services → Koya Food) to finish your food order.'
    : 'To order food: finish or clear your grocery basket first, then open Services → Koya Food.';

  return (
    <ConfirmDialog
      open
      title={title}
      description={description}
      note={note}
      confirmLabel={foodBlocksOther ? 'Open Koya Food' : 'Open Basket'}
      cancelLabel="Go back"
      onConfirm={() => {
        onClose();
        navigate(foodBlocksOther ? foodPath : '/cart');
      }}
      onClose={onClose}
    />
  );
}