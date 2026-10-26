package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.BeautyDaySeq;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface BeautyDaySeqRepository extends JpaRepository<BeautyDaySeq, LocalDate> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from BeautyDaySeq s where s.day = :day")
    Optional<BeautyDaySeq> lockDay(@Param("day") LocalDate day);
}
