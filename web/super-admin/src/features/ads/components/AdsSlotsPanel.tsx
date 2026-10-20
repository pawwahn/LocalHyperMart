import type { TownVm } from '@/features/towns/api/townsApi';
import { AdsDateBoard } from './AdsDateBoard';

type Props = {
  token: string;
  towns: TownVm[];
  townId: string;
  onTownChange?: (id: string) => void;
  refreshTick?: number;
  onBooked?: () => void;
  offRooms?: string[];
};

export function AdsSlotsPanel({ token, towns, townId, onTownChange, refreshTick = 0, onBooked, offRooms }: Props) {
  return (
    <AdsDateBoard
      token={token}
      towns={towns}
      townId={townId}
      onTownChange={onTownChange}
      refreshTick={refreshTick}
      startOpen
      canBook
      onBooked={onBooked}
      offRooms={offRooms}
    />
  );
}
