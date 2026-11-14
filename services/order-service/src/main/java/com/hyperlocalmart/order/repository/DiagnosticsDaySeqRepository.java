package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.DiagnosticsDaySeq;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface DiagnosticsDaySeqRepository extends JpaRepository<DiagnosticsDaySeq, LocalDate> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from DiagnosticsDaySeq s where s.day = :day")
    Optional<DiagnosticsDaySeq> lockDay(@Param("day") LocalDate day);
}
