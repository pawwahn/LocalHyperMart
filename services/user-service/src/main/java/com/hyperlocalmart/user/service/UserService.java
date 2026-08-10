package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.BindStaffContextRequest;
import com.hyperlocalmart.user.dto.request.CreateStaffUserRequest;
import com.hyperlocalmart.user.dto.request.UpdateProfileRequest;
import com.hyperlocalmart.user.dto.request.UpdateUserStatusRequest;
import com.hyperlocalmart.user.dto.response.StaffUserResponse;
import com.hyperlocalmart.user.dto.response.UserProfileResponse;
import com.hyperlocalmart.user.entity.Role;
import com.hyperlocalmart.user.entity.RoleName;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.entity.UserRole;
import com.hyperlocalmart.user.entity.UserStatus;
import com.hyperlocalmart.user.repository.RoleRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final Set<RoleName> STAFF_ROLES = EnumSet.of(RoleName.DELIVERY_AGENT, RoleName.VENDOR, RoleName.HUB_ADMIN);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        return toProfile(user);
    }

    @Transactional(readOnly = true)
    public UserProfileResponse findByPhone(String phone) {
        String normalized = phone == null ? "" : phone.trim().replaceAll("\\s+", "");
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Phone is required");
        }
        User user = userRepository.findByPhone(normalized)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Customer not found"));
        return toProfile(user);
    }

    @Transactional
    public StaffUserResponse createStaffUser(CreateStaffUserRequest request) {
        if (!STAFF_ROLES.contains(request.getRole())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Role cannot be provisioned via staff API");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone number already registered");
        }

        Role role = roleRepository.findByName(request.getRole())
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Role not configured"));

        User user = User.builder()
                .phone(request.getPhone().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName().trim())
                .lastName(blankToNull(request.getLastName()))
                .status(UserStatus.ACTIVE)
                .build();

        UserRole userRole = UserRole.builder()
                .user(user)
                .role(role)
                .townId(request.getTownId())
                .build();
        user.getUserRoles().add(userRole);
        userRepository.save(user);

        return StaffUserResponse.builder()
                .userId(user.getId())
                .phone(user.getPhone())
                .role(role.getName().name())
                .status(user.getStatus().name())
                .build();
    }

    @Transactional
    public StaffUserResponse bindStaffContext(UUID userId, BindStaffContextRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));

        if (request.getHubId() != null) {
            UserRole hubRole = user.getUserRoles().stream()
                    .filter(ur -> ur.getRole().getName() == RoleName.HUB_ADMIN)
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Hub admin role not found for user"));
            hubRole.setTownId(request.getTownId());
            hubRole.setHubId(request.getHubId());
            userRepository.save(user);
            return StaffUserResponse.builder()
                    .userId(user.getId())
                    .phone(user.getPhone())
                    .role(RoleName.HUB_ADMIN.name())
                    .status(user.getStatus().name())
                    .build();
        }

        if (request.getVendorId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "vendorId or hubId is required");
        }

        UserRole vendorRole = user.getUserRoles().stream()
                .filter(ur -> ur.getRole().getName() == RoleName.VENDOR)
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor role not found for user"));

        vendorRole.setTownId(request.getTownId());
        vendorRole.setVendorId(request.getVendorId());
        userRepository.save(user);

        return StaffUserResponse.builder()
                .userId(user.getId())
                .phone(user.getPhone())
                .role(RoleName.VENDOR.name())
                .status(user.getStatus().name())
                .build();
    }

    @Transactional
    public StaffUserResponse updateUserStatus(UUID userId, UpdateUserStatusRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        user.setStatus(request.getStatus());
        userRepository.save(user);

        String role = user.getUserRoles().stream()
                .map(ur -> ur.getRole().getName().name())
                .findFirst()
                .orElse(null);

        return StaffUserResponse.builder()
                .userId(user.getId())
                .phone(user.getPhone())
                .role(role)
                .status(user.getStatus().name())
                .build();
    }

    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));

        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }
        if (request.getEmail() != null) {
            String email = request.getEmail().isBlank() ? null : request.getEmail().trim();
            if (email != null && userRepository.existsByEmail(email)
                    && (user.getEmail() == null || !user.getEmail().equals(email))) {
                throw new BusinessException(ErrorCode.CONFLICT, "Email already in use");
            }
            user.setEmail(email);
        }
        if (request.getDefaultTownId() != null) {
            user.setDefaultTownId(request.getDefaultTownId());
        }

        return toProfile(userRepository.save(user));
    }

    private UserProfileResponse toProfile(User user) {
        List<String> roles = user.getUserRoles().stream()
                .map(UserRole::getRole)
                .map(role -> role.getName().name())
                .toList();
        return UserProfileResponse.builder()
                .id(user.getId())
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .email(user.getEmail())
                .roles(roles)
                .defaultTownId(user.getDefaultTownId())
                .status(user.getStatus() == null ? null : user.getStatus().name())
                .lastLoginAt(user.getLastLoginAt())
                .build();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
