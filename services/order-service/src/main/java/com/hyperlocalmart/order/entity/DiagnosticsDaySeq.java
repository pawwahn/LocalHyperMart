package com.hyperlocalmart.order.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "diagnostics_day_seq")
@Getter
@Setter
public class DiagnosticsDaySeq {

    @Id
    private LocalDate day;

    @Column(name = "next_val", nullable = false)
    private int nextVal;
}
