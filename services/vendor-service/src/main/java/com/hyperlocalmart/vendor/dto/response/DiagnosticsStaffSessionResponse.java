package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class DiagnosticsStaffSessionResponse {

    private UUID staffId;
    private String roleType;
    private String title;
    private boolean collectionCapable;
    private String displayName;
    private boolean vendorOwner;
    private boolean canManageStaff;
    private boolean canManageCatalog;
    private boolean canDispatch;
    private boolean canLabDesk;
    private boolean canReadAudit;
}
