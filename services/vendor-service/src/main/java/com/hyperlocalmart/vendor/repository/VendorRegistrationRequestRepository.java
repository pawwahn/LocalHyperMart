package com.hyperlocalmart.vendor.repository;

import com.hyperlocalmart.vendor.entity.RegistrationRequestStatus;
import com.hyperlocalmart.vendor.entity.VendorRegistrationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VendorRegistrationRequestRepository extends JpaRepository<VendorRegistrationRequest, UUID> {

    List<VendorRegistrationRequest> findAllByOrderByCreatedAtDesc();

    List<VendorRegistrationRequest> findByStatusOrderByCreatedAtDesc(RegistrationRequestStatus status);

    boolean existsByPhoneAndStatus(String phone, RegistrationRequestStatus status);
}
