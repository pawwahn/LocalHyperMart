package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.InviteAppAdminRequest;
import com.hyperlocalmart.user.dto.request.PatchAppAdminRoleRequest;
import com.hyperlocalmart.user.dto.response.AppAdminUserResponse;
import com.hyperlocalmart.user.entity.Role;
import com.hyperlocalmart.user.entity.RoleName;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.entity.UserRole;
import com.hyperlocalmart.user.entity.UserStatus;
import com.hyperlocalmart.user.repository.RoleRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import com.hyperlocalmart.user.repository.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AppAdminUserService {

    private static final Set<RoleName> LISTED = EnumSet.of(
            RoleName.SUPER_ADMIN,
            RoleName.APP_ADMIN_WRITE,
            RoleName.APP_ADMIN_READ);
    private static final Set<RoleName> MANAGEABLE = EnumSet.of(RoleName.APP_ADMIN_WRITE, RoleName.APP_ADMIN_READ);

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<AppAdminUserResponse> listAppAdmins() {
        List<UUID> userIds = userRoleRepository.findUserIdsByRoleNames(LISTED);
        if (userIds.isEmpty()) {
            return List.of();
        }
        return userRepository.findAllById(userIds).stream()
                .map(this::toResponse)
                .sorted(Comparator.comparing(AppAdminUserResponse::getPhone))
                .toList();
    }

    @Transactional
    public AppAdminUserResponse invite(InviteAppAdminRequest request) {
        RoleName targetRole = request.getRole();
        if (!MANAGEABLE.contains(targetRole)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Role must be APP_ADMIN_READ or APP_ADMIN_WRITE");
        }

        String phone = request.getPhone().trim();
        Optional<User> existing = userRepository.findByPhone(phone);
        if (existing.isEmpty()) {
            if (request.getPassword() == null || request.getPassword().isBlank()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Password is required for a new login");
            }
            if (request.getFirstName() == null || request.getFirstName().isBlank()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "First name is required for a new login");
            }
            Role role = roleRepository.findByName(targetRole)
                    .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Role not configured"));
            User user = User.builder()
                    .phone(phone)
                    .passwordHash(passwordEncoder.encode(request.getPassword()))
                    .firstName(request.getFirstName().trim())
                    .lastName(blankToNull(request.getLastName()))
                    .status(UserStatus.ACTIVE)
                    .build();
            user.getUserRoles().add(UserRole.builder().user(user).role(role).build());
            userRepository.save(user);
            return toResponse(user);
        }

        User user = existing.get();
        if (resolvePlatformRole(user) == RoleName.SUPER_ADMIN) {
            throw new BusinessException(ErrorCode.CONFLICT, "User is already a super admin");
        }
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getFirstName() != null && !request.getFirstName().isBlank()) {
            user.setFirstName(request.getFirstName().trim());
        }
        if (request.getLastName() != null) {
            user.setLastName(blankToNull(request.getLastName()));
        }
        removeManageableRoles(user);
        attachRole(user, targetRole);
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public AppAdminUserResponse updateRole(UUID userId, PatchAppAdminRoleRequest request) {
        if (!MANAGEABLE.contains(request.getRole())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Role must be APP_ADMIN_READ or APP_ADMIN_WRITE");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        if (resolvePlatformRole(user) == RoleName.SUPER_ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cannot change super admin role here");
        }
        if (resolvePlatformRole(user) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "User is not an app admin");
        }
        removeManageableRoles(user);
        attachRole(user, request.getRole());
        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public void resetPassword(UUID userId, String newPassword) {
        if (newPassword == null || newPassword.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Password is required");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        if (resolvePlatformRole(user) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "User is not an app admin");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword.trim()));
        userRepository.save(user);
    }

    @Transactional
    public void revokeAppAdminAccess(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        if (resolvePlatformRole(user) == RoleName.SUPER_ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Cannot revoke super admin access here");
        }
        boolean removed = removeManageableRoles(user);
        if (!removed) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "User has no read/write app admin role");
        }
        userRepository.save(user);
    }

    private boolean removeManageableRoles(User user) {
        boolean removed = false;
        var iterator = user.getUserRoles().iterator();
        while (iterator.hasNext()) {
            RoleName name = iterator.next().getRole().getName();
            if (MANAGEABLE.contains(name)) {
                iterator.remove();
                removed = true;
            }
        }
        return removed;
    }

    private void attachRole(User user, RoleName roleName) {
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERNAL_ERROR, "Role not configured"));
        boolean already = user.getUserRoles().stream()
                .anyMatch(ur -> ur.getRole().getName() == roleName);
        if (!already) {
            user.getUserRoles().add(UserRole.builder().user(user).role(role).build());
        }
    }

    private AppAdminUserResponse toResponse(User user) {
        RoleName platformRole = resolvePlatformRole(user);
        return AppAdminUserResponse.builder()
                .userId(user.getId())
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .status(user.getStatus() == null ? null : user.getStatus().name())
                .platformRole(platformRole == null ? null : platformRole.name())
                .manageable(platformRole != null && MANAGEABLE.contains(platformRole))
                .lastLoginAt(user.getLastLoginAt())
                .build();
    }

    private RoleName resolvePlatformRole(User user) {
        Set<RoleName> names = EnumSet.noneOf(RoleName.class);
        for (UserRole ur : user.getUserRoles()) {
            names.add(ur.getRole().getName());
        }
        if (names.contains(RoleName.SUPER_ADMIN)) {
            return RoleName.SUPER_ADMIN;
        }
        if (names.contains(RoleName.APP_ADMIN_WRITE)) {
            return RoleName.APP_ADMIN_WRITE;
        }
        if (names.contains(RoleName.APP_ADMIN_READ)) {
            return RoleName.APP_ADMIN_READ;
        }
        return null;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
