package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.RoleName;
import com.hyperlocalmart.user.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {

    @Query("SELECT DISTINCT ur.user.id FROM UserRole ur WHERE ur.role.name IN :roleNames")
    List<UUID> findUserIdsByRoleNames(@Param("roleNames") Collection<RoleName> roleNames);
}
