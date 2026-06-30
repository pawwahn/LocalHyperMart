package com.hyperlocalmart.user.security;

import com.hyperlocalmart.user.entity.User;
import com.hyperlocalmart.user.entity.UserRole;
import com.hyperlocalmart.user.entity.UserStatus;
import com.hyperlocalmart.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String phone) {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return toPrincipal(user);
    }

    public UserDetails loadUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return toPrincipal(user);
    }

    private AuthUserPrincipal toPrincipal(User user) {
        if (user.getStatus() == UserStatus.DISABLED) {
            throw new UsernameNotFoundException("User disabled");
        }
        List<String> roles = user.getUserRoles().stream()
                .map(UserRole::getRole)
                .map(role -> role.getName().name())
                .toList();
        return new AuthUserPrincipal(user.getId(), user.getPhone(), roles, user.getPasswordHash());
    }
}
