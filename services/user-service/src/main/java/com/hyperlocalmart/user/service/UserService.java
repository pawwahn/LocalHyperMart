package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.dto.request.UpdateProfileRequest;
import com.hyperlocalmart.user.dto.response.UserProfileResponse;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.entity.UserRole;
import com.hyperlocalmart.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
        return toProfile(user);
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
                .build();
    }
}
