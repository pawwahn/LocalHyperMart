import { useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';
import { useAuth } from '@/shared/auth/AuthContext';
import {
  bulkSyncListings,
  type BulkSyncResult,
  type ListingView,
  type MasterItemView,
} from '../api/listingsApi';
import {
  CatalogUploadValidationError,
  downloadCatalogWorkbook,
  parseCatalogUpload,
  summarizeBulkSync,
  validateAndBuildBulkSync,
} from '../api/catalogExcel';

type Props = {
  masterItems: MasterItemView[];
  listedByMaster: Map<string, ListingView>;
  shopName?: string;
  disabled?: boolean;
  onUploaded: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  onExcelUploadStart?: () => void;
};

export function CatalogExcelToolbar({
  masterItems,
  listedByMaster,
  shopName,
  disabled,
  onUploaded,
  onNotice,
  onError,
  onExcelUploadStart,
}: Props) {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'template' | 'vendor' | 'upload' | null>(null);

  async function download(mode: 'template' | 'vendor') {
    if (masterItems.length === 0) {
      onError('Catalog is still loading — try again in a moment.');
      return;
    }
    setBusy(mode);
    try {
      await downloadCatalogWorkbook(mode, masterItems, listedByMaster, shopName);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not build Excel file');
    } finally {
      setBusy(null);
    }
  }

  async function onFilePicked(file: File | undefined) {
    if (!file || !session) return;
    setBusy('upload');
    onExcelUploadStart?.();
    try {
      const rows = await parseCatalogUpload(file);
      const payload = validateAndBuildBulkSync(rows, {
        existingListingMasterIds: new Set(listedByMaster.keys()),
      });
      if (payload.length === 0) {
        onNotice('No listing changes found in the file.');
        return;
      }
      const CHUNK = 120;
      let created = 0;
      let updated = 0;
      let hidden = 0;
      let failed = 0;
      const errors: BulkSyncResult['errors'] = [];
      for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        const result = await bulkSyncListings(session.accessToken, session.vendorId, slice);
        created += result.created;
        updated += result.updated;
        hidden += result.hidden;
        failed += result.failed;
        errors.push(...result.errors);
      }
      await onUploaded();
      onNotice(
        summarizeBulkSync({ created, updated, hidden, failed, errors }),
      );
    } catch (err) {
      if (err instanceof CatalogUploadValidationError) {
        onError(err.message);
        return;
      }
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={styles.wrap}>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || busy != null}
        onClick={() => void download('template')}
      >
        {busy === 'template' ? 'Building…' : 'Admin template'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || busy != null}
        onClick={() => void download('vendor')}
      >
        {busy === 'vendor' ? 'Building…' : 'My catalog sheet'}
      </Button>
      <Button
        size="sm"
        disabled={disabled || busy != null}
        onClick={() => inputRef.current?.click()}
      >
        {busy === 'upload' ? 'Uploading…' : 'Upload Excel'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={styles.fileInput}
        onChange={(e) => void onFilePicked(e.target.files?.[0])}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  fileInput: {
    display: 'none',
  },
};
