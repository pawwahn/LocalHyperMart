package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.PatientProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientProfileRepository extends JpaRepository<PatientProfile, UUID> {

    List<PatientProfile> findByAccountUserIdAndActiveTrueOrderByDisplayNameAsc(UUID accountUserId);

    Optional<PatientProfile> findByIdAndAccountUserIdAndActiveTrue(UUID id, UUID accountUserId);
}
