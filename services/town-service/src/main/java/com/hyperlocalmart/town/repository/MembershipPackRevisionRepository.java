package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.MembershipPackRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MembershipPackRevisionRepository extends JpaRepository<MembershipPackRevision, UUID> {

    List<MembershipPackRevision> findTop50ByOrderByVersionNoDesc();

    @Query("select coalesce(max(r.versionNo), 0) from MembershipPackRevision r")
    Integer maxVersionNo();
}
