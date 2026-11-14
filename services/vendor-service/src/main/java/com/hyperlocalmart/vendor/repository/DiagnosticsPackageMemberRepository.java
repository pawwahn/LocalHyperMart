package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.DiagnosticsPackageMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiagnosticsPackageMemberRepository extends JpaRepository<DiagnosticsPackageMember, DiagnosticsPackageMember.Key> {

    List<DiagnosticsPackageMember> findByPackageId(UUID packageId);

    List<DiagnosticsPackageMember> findByPackageIdIn(Collection<UUID> packageIds);

    void deleteByPackageId(UUID packageId);
}
