package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.UpsertPatientProfileRequest;
import com.hyperlocalmart.user.dto.response.PatientProfileResponse;
import com.hyperlocalmart.user.entity.PatientProfile;
import com.hyperlocalmart.user.repository.PatientProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PatientProfileService {

    private final PatientProfileRepository patientProfileRepository;

    @Transactional(readOnly = true)
    public List<PatientProfileResponse> list(UUID accountUserId) {
        return patientProfileRepository.findByAccountUserIdAndActiveTrueOrderByDisplayNameAsc(accountUserId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PatientProfileResponse get(UUID accountUserId, UUID patientId) {
        return toResponse(requirePatient(accountUserId, patientId));
    }

    @Transactional(readOnly = true)
    public PatientProfileResponse getInternal(UUID accountUserId, UUID patientId) {
        return get(accountUserId, patientId);
    }

    @Transactional
    public PatientProfileResponse create(UUID accountUserId, UpsertPatientProfileRequest request) {
        validateAgeOrDob(request);
        PatientProfile profile = PatientProfile.builder()
                .accountUserId(accountUserId)
                .displayName(trim(request.getDisplayName()))
                .relation(trim(request.getRelation()))
                .gender(trim(request.getGender()))
                .ageYears(request.getAgeYears())
                .dateOfBirth(request.getDateOfBirth())
                .notes(trim(request.getNotes()))
                .active(true)
                .build();
        profile.setCreatedBy(accountUserId);
        profile.setUpdatedBy(accountUserId);
        return toResponse(patientProfileRepository.save(profile));
    }

    @Transactional
    public PatientProfileResponse update(UUID accountUserId, UUID patientId, UpsertPatientProfileRequest request) {
        validateAgeOrDob(request);
        PatientProfile profile = requirePatient(accountUserId, patientId);
        profile.setDisplayName(trim(request.getDisplayName()));
        profile.setRelation(trim(request.getRelation()));
        profile.setGender(trim(request.getGender()));
        profile.setAgeYears(request.getAgeYears());
        profile.setDateOfBirth(request.getDateOfBirth());
        profile.setNotes(trim(request.getNotes()));
        profile.setUpdatedBy(accountUserId);
        return toResponse(patientProfileRepository.save(profile));
    }

    @Transactional
    public void deactivate(UUID accountUserId, UUID patientId) {
        PatientProfile profile = requirePatient(accountUserId, patientId);
        profile.setActive(false);
        profile.setUpdatedBy(accountUserId);
        patientProfileRepository.save(profile);
    }

    private PatientProfile requirePatient(UUID accountUserId, UUID patientId) {
        return patientProfileRepository.findByIdAndAccountUserIdAndActiveTrue(patientId, accountUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Patient profile not found"));
    }

    private static void validateAgeOrDob(UpsertPatientProfileRequest request) {
        if (request.getAgeYears() == null && request.getDateOfBirth() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Age or date of birth is required");
        }
    }

    private PatientProfileResponse toResponse(PatientProfile profile) {
        return PatientProfileResponse.builder()
                .id(profile.getId())
                .displayName(profile.getDisplayName())
                .relation(profile.getRelation())
                .gender(profile.getGender())
                .ageYears(profile.getAgeYears())
                .dateOfBirth(profile.getDateOfBirth())
                .notes(profile.getNotes())
                .active(profile.isActive())
                .build();
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }
}
