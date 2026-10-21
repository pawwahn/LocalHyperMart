package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.LaundryDaySeq;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface LaundryDaySeqRepository extends JpaRepository<LaundryDaySeq, LocalDate> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from LaundryDaySeq s where s.day = :day")
    Optional<LaundryDaySeq> lockDay(@Param("day") LocalDate day);
}
