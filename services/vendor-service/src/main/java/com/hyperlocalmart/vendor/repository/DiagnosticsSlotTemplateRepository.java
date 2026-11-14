package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsSlotTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiagnosticsSlotTemplateRepository extends JpaRepository<DiagnosticsSlotTemplate, UUID> {

    List<DiagnosticsSlotTemplate> findByBranchIdIn(Collection<UUID> branchIds);

    List<DiagnosticsSlotTemplate> findByBranchIdOrderByStartTimeAsc(UUID branchId);

    void deleteByBranchId(UUID branchId);
}
