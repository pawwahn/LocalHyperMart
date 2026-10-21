package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.SaveServiceOfferingRequest;
import com.hyperlocalmart.vendor.dto.response.ServiceOfferingListResponse;
import com.hyperlocalmart.vendor.dto.response.ServiceOfferingResponse;
import com.hyperlocalmart.vendor.entity.ServiceOffering;
import com.hyperlocalmart.vendor.repository.ServiceOfferingRepository;
import com.hyperlocalmart.vendor.repository.VendorRegistrationRequestRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ServiceOfferingService {

    private final ServiceOfferingRepository offeringRepository;
    private final VendorRepository vendorRepository;
    private final VendorRegistrationRequestRepository registrationRequestRepository;

    @Transactional(readOnly = true)
    public ServiceOfferingListResponse list() {
        return ServiceOfferingListResponse.builder()
                .items(offeringRepository.findAllByOrderBySortOrderAscNameAsc().stream()
                        .map(ServiceOfferingService::toResponse)
                        .toList())
                .build();
    }

    @Transactional
    public ServiceOfferingResponse create(SaveServiceOfferingRequest request, UUID actorUserId) {
        String name = normalizeName(request.getName());
        if (offeringRepository.existsByNameIgnoreCase(name)) {
            throw new BusinessException(ErrorCode.CONFLICT, "A service named " + name + " already exists");
        }
        int nextSort = offeringRepository.findAll().stream()
                .mapToInt(ServiceOffering::getSortOrder)
                .max()
                .orElse(0) + 1;
        ServiceOffering offering = ServiceOffering.builder()
                .name(name)
                .hidesListings(CatalogListingPolicy.hidesListingsForName(name, request.getHidesListings()))
                .sortOrder(nextSort)
                .build();
        offering.setCreatedBy(actorUserId);
        offering.setUpdatedBy(actorUserId);
        return toResponse(offeringRepository.save(offering));
    }

    @Transactional
    public ServiceOfferingResponse update(UUID id, SaveServiceOfferingRequest request, UUID actorUserId) {
        ServiceOffering offering = offeringRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Service not found"));
        String name = normalizeName(request.getName());
        offeringRepository.findByNameIgnoreCase(name)
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new BusinessException(ErrorCode.CONFLICT, "A service named " + name + " already exists");
                });
        offering.setName(name);
        offering.setHidesListings(CatalogListingPolicy.hidesListingsForName(name, request.getHidesListings()));
        offering.setUpdatedBy(actorUserId);
        return toResponse(offeringRepository.save(offering));
    }

    @Transactional
    public void delete(UUID id) {
        ServiceOffering offering = offeringRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Service not found"));
        if (vendorRepository.existsByServiceId(id) || registrationRequestRepository.existsByServiceId(id)) {
            throw new BusinessException(ErrorCode.CONFLICT, offering.getName() + " is used by a vendor");
        }
        offeringRepository.delete(offering);
    }

    private static ServiceOfferingResponse toResponse(ServiceOffering offering) {
        return ServiceOfferingResponse.builder()
                .id(offering.getId())
                .name(offering.getName())
                .hidesListings(offering.isHidesListings())
                .sortOrder(offering.getSortOrder())
                .build();
    }

    private static String normalizeName(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service name is required");
        }
        String name = raw.trim().replaceAll("\\s+", " ");
        if (name.length() > 80) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service name is too long");
        }
        return name;
    }
}
