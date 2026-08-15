package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.CreateAddressRequest;
import com.hyperlocalmart.user.dto.response.AddressResponse;
import com.hyperlocalmart.user.entity.Address;
import com.hyperlocalmart.user.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AddressService {

    private final AddressRepository addressRepository;

    @Transactional(readOnly = true)
    public List<AddressResponse> listAddresses(UUID userId) {
        return addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AddressResponse createAddress(UUID userId, CreateAddressRequest request) {
        if (request.isDefault()) {
            clearDefault(userId);
        }
        Address address = Address.builder()
                .userId(userId)
                .townId(request.getTownId())
                .label(request.getLabel())
                .recipientName(request.getRecipientName())
                .recipientPhone(request.getRecipientPhone())
                .line1(request.getLine1())
                .line2(request.getLine2())
                .landmark(request.getLandmark())
                .pincode(request.getPincode())
                .isDefault(request.isDefault())
                .build();
        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public AddressResponse updateAddress(UUID userId, UUID addressId, CreateAddressRequest request) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Address not found"));
        // Keep the address in its original town — client town picker must not block edits.
        if (request.getTownId() != null && !address.getTownId().equals(request.getTownId())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Address must stay in the same town");
        }
        if (request.isDefault()) {
            clearDefault(userId);
        }
        address.setLabel(request.getLabel());
        address.setRecipientName(request.getRecipientName());
        address.setRecipientPhone(request.getRecipientPhone());
        address.setLine1(request.getLine1());
        address.setLine2(blankToNull(request.getLine2()));
        address.setLandmark(blankToNull(request.getLandmark()));
        address.setPincode(blankToNull(request.getPincode()));
        address.setDefault(request.isDefault());
        return toResponse(addressRepository.save(address));
    }

    @Transactional
    public void deleteAddress(UUID userId, UUID addressId) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Address not found"));
        boolean wasDefault = address.isDefault();
        addressRepository.delete(address);
        if (wasDefault) {
            addressRepository.findByUserIdOrderByIsDefaultDescCreatedAtDesc(userId).stream()
                    .findFirst()
                    .ifPresent(next -> {
                        next.setDefault(true);
                        addressRepository.save(next);
                    });
        }
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Transactional(readOnly = true)
    public AddressResponse getAddressForUser(UUID userId, UUID addressId, UUID townId) {
        Address address = addressRepository.findByIdAndUserId(addressId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Address not found"));
        if (!address.getTownId().equals(townId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Address must belong to the selected town");
        }
        return toResponse(address);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAddressSnapshot(UUID userId, UUID addressId, UUID townId) {
        AddressResponse address = getAddressForUser(userId, addressId, townId);
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("addressId", address.getId());
        snapshot.put("townId", address.getTownId());
        snapshot.put("label", address.getLabel());
        snapshot.put("recipientName", address.getRecipientName());
        snapshot.put("recipientPhone", address.getRecipientPhone());
        snapshot.put("line1", address.getLine1());
        snapshot.put("line2", address.getLine2());
        snapshot.put("landmark", address.getLandmark());
        snapshot.put("pincode", address.getPincode());
        return snapshot;
    }

    private void clearDefault(UUID userId) {
        addressRepository.findByUserIdAndIsDefaultTrue(userId).forEach(a -> a.setDefault(false));
    }

    private AddressResponse toResponse(Address address) {
        return AddressResponse.builder()
                .id(address.getId())
                .townId(address.getTownId())
                .label(address.getLabel())
                .recipientName(address.getRecipientName())
                .recipientPhone(address.getRecipientPhone())
                .line1(address.getLine1())
                .line2(address.getLine2())
                .landmark(address.getLandmark())
                .pincode(address.getPincode())
                .isDefault(address.isDefault())
                .build();
    }
}
