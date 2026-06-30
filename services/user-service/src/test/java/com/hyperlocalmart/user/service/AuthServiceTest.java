package com.hyperlocalmart.user.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.user.config.LoginProperties;
import com.hyperlocalmart.user.config.OtpProperties;
import com.hyperlocalmart.user.dto.request.LoginRequest;
import com.hyperlocalmart.user.dto.request.RegisterRequest;
import com.hyperlocalmart.user.dto.response.AuthResponse;
import com.hyperlocalmart.user.dto.response.RegisterResponse;
import com.hyperlocalmart.user.entity.Role;
import com.hyperlocalmart.user.entity.RoleName;
import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.entity.UserStatus;
import com.hyperlocalmart.user.repository.PasswordResetOtpRepository;
import com.hyperlocalmart.user.repository.RefreshTokenRepository;
import com.hyperlocalmart.user.repository.RoleRepository;
import com.hyperlocalmart.user.repository.UserRepository;
import com.hyperlocalmart.user.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.HashSet;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordResetOtpRepository passwordResetOtpRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;

    private LoginProperties loginProperties;
    private OtpProperties otpProperties;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        loginProperties = new LoginProperties();
        loginProperties.setMaxFailedAttempts(5);
        loginProperties.setLockDurationMinutes(30);
        otpProperties = new OtpProperties();
        authService = new AuthService(
                userRepository,
                roleRepository,
                refreshTokenRepository,
                passwordResetOtpRepository,
                passwordEncoder,
                jwtService,
                loginProperties,
                otpProperties
        );
    }

    @Test
    void register_createsBuyerUser() {
        RegisterRequest request = new RegisterRequest();
        request.setPhone("9876543210");
        request.setPassword("Password@1");
        request.setFirstName("Ravi");
        request.setLastName("Kumar");

        when(userRepository.existsByPhone(request.getPhone())).thenReturn(false);
        when(roleRepository.findByName(RoleName.BUYER)).thenReturn(Optional.of(Role.builder().name(RoleName.BUYER).build()));
        when(passwordEncoder.encode(request.getPassword())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(UUID.randomUUID());
            return user;
        });

        RegisterResponse response = authService.register(request);

        assertThat(response.getRole()).isEqualTo("BUYER");
        assertThat(response.getUserId()).isNotNull();
        verify(userRepository).save(any(User.class));
    }

    @Test
    void register_rejectsDuplicatePhone() {
        RegisterRequest request = new RegisterRequest();
        request.setPhone("9876543210");
        when(userRepository.existsByPhone(request.getPhone())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONFLICT);
    }

    @Test
    void login_returnsTokensOnSuccess() {
        LoginRequest request = new LoginRequest();
        request.setPhone("9876543210");
        request.setPassword("Password@1");

        User user = activeUser();
        when(userRepository.findByPhone(request.getPhone())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(request.getPassword(), user.getPasswordHash())).thenReturn(true);
        when(jwtService.generateAccessToken(any(), anyString(), any())).thenReturn("access-token");
        when(jwtService.accessTokenExpiresInSeconds()).thenReturn(3600L);
        when(jwtService.refreshTokenExpiresAt()).thenReturn(Instant.now().plusSeconds(604800));

        AuthResponse response = authService.login(request);

        assertThat(response.getAccessToken()).isEqualTo("access-token");
        assertThat(response.getRefreshToken()).isNotBlank();
        assertThat(response.getRoles()).containsExactly("BUYER");
        assertThat(user.getFailedLoginCount()).isZero();
        verify(refreshTokenRepository).save(any());
    }

    @Test
    void login_locksAccountAfterMaxFailures() {
        LoginRequest request = new LoginRequest();
        request.setPhone("9876543210");
        request.setPassword("wrong");

        User user = activeUser();
        user.setFailedLoginCount(4);
        when(userRepository.findByPhone(request.getPhone())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getLockedUntil()).isNotNull();
        assertThat(captor.getValue().getFailedLoginCount()).isEqualTo(5);
    }

    private User activeUser() {
        Role buyerRole = Role.builder().id(UUID.randomUUID()).name(RoleName.BUYER).build();
        User user = User.builder()
                .id(UUID.randomUUID())
                .phone("9876543210")
                .passwordHash("hashed")
                .status(UserStatus.ACTIVE)
                .userRoles(new HashSet<>())
                .build();
        user.getUserRoles().add(com.hyperlocalmart.user.entity.UserRole.builder()
                .user(user)
                .role(buyerRole)
                .build());
        return user;
    }
}
